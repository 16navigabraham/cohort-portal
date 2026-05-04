import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../db.js'
import { uploadBuffer } from '../services/cloudinary.js'
import { authenticate, requireStudent } from '../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.use(authenticate, requireStudent)

// ── Materials ─────────────────────────────────────────────────

router.get('/materials', async (req, res) => {
  const materials = await prisma.material.findMany({
    where: { cohortId: req.user.cohortId, courseId: req.user.courseId },
    orderBy: { uploadedAt: 'desc' }
  })
  res.json(materials)
})

// ── Attendance ────────────────────────────────────────────────

router.post('/attendance/check-in', async (req, res) => {
  const studentIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress

  const session = await prisma.attendanceSession.findFirst({
    where: { cohortId: req.user.cohortId, courseId: req.user.courseId, active: true }
  })
  if (!session) return res.status(404).json({ error: 'No active attendance session for your cohort' })
  if (session.allowedIp !== studentIp) return res.status(403).json({ error: 'You must be on the class network to check in' })

  const existing = await prisma.attendance.findUnique({
    where: { studentId_sessionId: { studentId: req.user.id, sessionId: session.id } }
  })
  if (existing) return res.status(409).json({ error: 'Already checked in for this session' })

  const record = await prisma.attendance.create({
    data: {
      studentId: req.user.id,
      cohortId: req.user.cohortId,
      sessionId: session.id,
      date: session.date,
      status: 'PRESENT',
      ip: studentIp
    }
  })
  res.status(201).json({ message: 'Checked in successfully', record })
})

router.get('/attendance', async (req, res) => {
  const records = await prisma.attendance.findMany({
    where: { studentId: req.user.id },
    include: { session: { select: { date: true, active: true } } },
    orderBy: { date: 'desc' }
  })
  res.json(records)
})

// ── Assignments ───────────────────────────────────────────────

router.get('/assignments', async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    where: { cohortId: req.user.cohortId, courseId: req.user.courseId },
    orderBy: { dueDate: 'asc' }
  })
  res.json(assignments)
})

router.post('/assignments/:id/submit', upload.single('file'), async (req, res) => {
  const { id: assignmentId } = req.params
  if (!req.file) return res.status(400).json({ error: 'File required' })

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' })

  const existing = await prisma.submission.findUnique({
    where: { studentId_assignmentId: { studentId: req.user.id, assignmentId } }
  })
  if (existing) return res.status(409).json({ error: 'Already submitted' })

  const result = await uploadBuffer(req.file.buffer, { folder: 'academic-portal/submissions', resource_type: 'auto' })
  const submission = await prisma.submission.create({
    data: {
      studentId: req.user.id,
      assignmentId,
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id
    }
  })
  res.status(201).json(submission)
})

// ── Assessments ───────────────────────────────────────────────

router.get('/assessments', async (req, res) => {
  const { type } = req.query
  const assessments = await prisma.assessment.findMany({
    where: { cohortId: req.user.cohortId, courseId: req.user.courseId, ...(type ? { type } : {}) },
    orderBy: { dueDate: 'asc' },
    select: { id: true, title: true, type: true, dueDate: true, createdAt: true }
  })
  res.json(assessments)
})

router.get('/assessments/:id', async (req, res) => {
  const assessment = await prisma.assessment.findUnique({ where: { id: req.params.id } })
  if (!assessment) return res.status(404).json({ error: 'Not found' })
  if (assessment.cohortId !== req.user.cohortId) return res.status(403).json({ error: 'Not in your cohort' })
  res.json(assessment)
})

router.post('/assessments/:id/submit', async (req, res) => {
  const { id: assessmentId } = req.params
  const { answers } = req.body
  if (!answers) return res.status(400).json({ error: 'answers required' })

  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } })
  if (!assessment) return res.status(404).json({ error: 'Assessment not found' })
  if (assessment.cohortId !== req.user.cohortId) return res.status(403).json({ error: 'Not in your cohort' })

  const existing = await prisma.assessmentResult.findUnique({
    where: { studentId_assessmentId: { studentId: req.user.id, assessmentId } }
  })
  if (existing) return res.status(409).json({ error: 'Already submitted' })

  const result = await prisma.assessmentResult.create({
    data: { studentId: req.user.id, assessmentId, answers }
  })
  res.status(201).json(result)
})

// ── Grades ────────────────────────────────────────────────────

router.get('/grades', async (req, res) => {
  const [submissions, assessmentResults] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: req.user.id },
      include: { assignment: { select: { title: true, dueDate: true } } }
    }),
    prisma.assessmentResult.findMany({
      where: { studentId: req.user.id },
      include: { assessment: { select: { title: true, type: true } } }
    })
  ])
  res.json({ assignments: submissions, assessments: assessmentResults })
})

export default router
