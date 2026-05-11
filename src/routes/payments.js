import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../db.js'
import { authenticate, requireStudent } from '../middleware/auth.js'
import { initTransaction, verifyTransaction } from '../services/monnify.js'

const router = Router()

// ── Fee constants ─────────────────────────────────────────────

const FULL_FEE       = 70_000          // ₦70,000 total
const INSTALMENT_1   = 35_000          // ₦35,000 first instalment
const INSTALMENT_2   = 35_000          // ₦35,000 second instalment

/**
 * Deadline rules:
 *  - Instalment 1: first week of June  → 7 Jun (gives full Mon-Sun week)
 *  - Instalment 2: first week of July  → 7 Jul
 *  Both are evaluated against the CURRENT year so they roll over automatically.
 */
function getDeadlines() {
  const year = new Date().getFullYear()
  return {
    instalment1Due: new Date(`${year}-06-07T23:59:59.000Z`),
    instalment2Due: new Date(`${year}-07-07T23:59:59.000Z`),
  }
}

/** Determine what a student is allowed to pay right now */
function getAllowedPayment(paymentRecord) {
  const { instalment1Due, instalment2Due } = getDeadlines()
  const now = new Date()

  if (!paymentRecord) {
    // No payments yet — both full and first instalment are valid
    return { canPayFull: true, canPayInstalment1: now <= instalment1Due, canPayInstalment2: false }
  }

  const { status, amountPaid } = paymentRecord
  if (status === 'COMPLETED') return { canPayFull: false, canPayInstalment1: false, canPayInstalment2: false }

  if (status === 'INSTALMENT_1_PAID') {
    return { canPayFull: false, canPayInstalment1: false, canPayInstalment2: now <= instalment2Due }
  }

  return { canPayFull: true, canPayInstalment1: now <= instalment1Due, canPayInstalment2: false }
}

// ── Student routes ────────────────────────────────────────────

router.use(authenticate, requireStudent)

/**
 * GET /payments/status
 * Returns the student's current payment status and what they can still pay.
 */
router.get('/status', async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { studentId: req.user.id } })
    const allowed = getAllowedPayment(payment)
    const { instalment1Due, instalment2Due } = getDeadlines()

    res.json({
      payment: payment || null,
      totalFee: FULL_FEE,
      deadlines: { instalment1: instalment1Due, instalment2: instalment2Due },
      allowed,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * POST /payments/initiate
 * Body: { paymentType: 'full' | 'instalment1' | 'instalment2' }
 *
 * Creates a pending payment record and returns a Monnify checkout URL.
 */
router.post('/initiate', async (req, res) => {
  const { paymentType } = req.body
  if (!['full', 'instalment1', 'instalment2'].includes(paymentType)) {
    return res.status(400).json({ error: "paymentType must be 'full', 'instalment1', or 'instalment2'" })
  }

  try {
    const existing = await prisma.payment.findUnique({ where: { studentId: req.user.id } })
    const allowed  = getAllowedPayment(existing)

    if (paymentType === 'full'        && !allowed.canPayFull)        return res.status(403).json({ error: 'Full payment not allowed at this stage' })
    if (paymentType === 'instalment1' && !allowed.canPayInstalment1) return res.status(403).json({ error: 'First instalment window has closed or you already paid it' })
    if (paymentType === 'instalment2' && !allowed.canPayInstalment2) return res.status(403).json({ error: 'Second instalment not yet due or window has closed' })

    const amount = paymentType === 'full' ? FULL_FEE : INSTALMENT_1

    // Generate unique reference
    const ref = `AP-${req.user.id.slice(0, 8).toUpperCase()}-${paymentType.toUpperCase()}-${Date.now()}`

    const descriptions = {
      full:        'Academic portal full tuition fee (₦70,000)',
      instalment1: 'Academic portal tuition — 1st instalment (₦35,000)',
      instalment2: 'Academic portal tuition — 2nd instalment (₦35,000)',
    }

    const txn = await initTransaction({
      amount,
      email: req.user.email,
      name:  req.user.name,
      ref,
      description: descriptions[paymentType],
    })

    // Persist a pending record so we can reconcile on callback
    if (!existing) {
      await prisma.payment.create({
        data: {
          studentId:   req.user.id,
          cohortId:    req.user.cohortId,
          courseId:    req.user.courseId,
          status:      'PENDING',
          amountPaid:  0,
          pendingRef:  ref,
          pendingType: paymentType,
        },
      })
    } else {
      await prisma.payment.update({
        where: { studentId: req.user.id },
        data:  { pendingRef: ref, pendingType: paymentType },
      })
    }

    res.json({ checkoutUrl: txn.checkoutUrl, transactionReference: txn.transactionReference, ref })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * POST /payments/verify
 * Body: { paymentReference }
 *
 * Called after the student returns from the Monnify checkout page
 * (or you can call this from your redirect URL handler).
 */
router.post('/verify', async (req, res) => {
  const { paymentReference } = req.body
  if (!paymentReference) return res.status(400).json({ error: 'paymentReference required' })

  try {
    const txn = await verifyTransaction(paymentReference)

    if (txn.paymentStatus !== 'PAID') {
      return res.status(402).json({ error: 'Payment not confirmed', status: txn.paymentStatus })
    }

    const payment = await prisma.payment.findUnique({ where: { studentId: req.user.id } })
    if (!payment) return res.status(404).json({ error: 'No pending payment record found' })

    const { pendingType, amountPaid } = payment
    const newAmountPaid = amountPaid + txn.amountPaid

    let newStatus
    if (pendingType === 'full')        newStatus = 'COMPLETED'
    else if (pendingType === 'instalment1') newStatus = 'INSTALMENT_1_PAID'
    else if (pendingType === 'instalment2') newStatus = 'COMPLETED'

    await prisma.payment.update({
      where: { studentId: req.user.id },
      data: {
        status:      newStatus,
        amountPaid:  newAmountPaid,
        pendingRef:  null,
        pendingType: null,
        lastPaidAt:  new Date(),
        monnifyRef:  paymentReference,
      },
    })

    res.json({ message: 'Payment verified successfully', status: newStatus, amountPaid: newAmountPaid })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * POST /payments/webhook
 * Monnify sends a POST to this URL on payment events.
 * Add this route WITHOUT the authenticate middleware — Monnify calls it directly.
 * Verify the hash to ensure it's a genuine Monnify notification.
 */
export function buildWebhookHandler() {
  const webhookRouter = Router()

  webhookRouter.post('/webhook', async (req, res) => {
    try {
      // Validate Monnify webhook signature
      const hash = crypto
        .createHmac('sha512', process.env.MONNIFY_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex')

      if (hash !== req.headers['monnify-signature']) {
        return res.status(401).json({ error: 'Invalid signature' })
      }

      const { eventType, eventData } = req.body
      if (eventType !== 'SUCCESSFUL_TRANSACTION') return res.sendStatus(200)

      const { paymentReference, amountPaid, customer } = eventData
      // Find payment by pendingRef
      const payment = await prisma.payment.findFirst({ where: { pendingRef: paymentReference } })
      if (!payment || payment.monnifyRef === paymentReference) return res.sendStatus(200) // already processed

      const newAmountPaid = payment.amountPaid + amountPaid
      let newStatus
      if (payment.pendingType === 'full')         newStatus = 'COMPLETED'
      else if (payment.pendingType === 'instalment1') newStatus = 'INSTALMENT_1_PAID'
      else if (payment.pendingType === 'instalment2') newStatus = 'COMPLETED'

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:      newStatus,
          amountPaid:  newAmountPaid,
          pendingRef:  null,
          pendingType: null,
          lastPaidAt:  new Date(),
          monnifyRef:  paymentReference,
        },
      })

      res.sendStatus(200)
    } catch (err) {
      console.error('Webhook error:', err)
      res.sendStatus(500)
    }
  })

  return webhookRouter
}

export default router