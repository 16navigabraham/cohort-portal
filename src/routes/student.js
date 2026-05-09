import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../db.js'
import { uploadBuffer } from '../services/cloudinary.js'
import { authenticate, requireStudent } from '../middleware/auth.js'
import { isAssignmentOpen } from '../services/curriculum-dates.js'
import { scoreMCQ } from '../services/mcq-score.js'

const router = Router()
const VIDEO_LIMIT = 50 * 1024 * 1024  // 50MB for video
const FILE_LIMIT  = 20 * 1024 * 1024  // 20MB for other files

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_LIMIT },
  fileFilter: (req, file, cb) => {
    const isVideo = file.mimetype.startsWith('video/')
    const limit = isVideo ? VIDEO_LIMIT : FILE_LIMIT
    // Override limit per file type via custom check after upload
    req._fileIsVideo = isVideo
    req._fileLimit = limit
    cb(null, true)
  }
})

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

// ── Curriculum ────────────────────────────────────────────────

router.get('/curriculum', async (req, res) => {
  try {
    const weeks = await prisma.curriculum.findMany({
      where: { cohortId: req.user.cohortId, courseId: req.user.courseId },
      orderBy: { week: 'asc' },
      include: {
        materials: true,
        assignment: {
          select: { id: true, title: true, description: true, openAt: true, closeAt: true },
        },
      },
    })
    res.json(weeks)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Assignments ───────────────────────────────────────────────

router.get('/assignments', async (req, res) => {
  try {
    const now = new Date()
    const assignments = await prisma.assignment.findMany({
      where: {
        cohortId: req.user.cohortId,
        courseId: req.user.courseId,
        openAt: { lte: now },
        closeAt: { gte: now },
      },
      select: { id: true, title: true, description: true, openAt: true, closeAt: true },
      orderBy: { openAt: 'asc' },
    })
    res.json(assignments)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/assignments/:id', async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, description: true, questionText: true, questionDocUrl: true, allowedSubmissionTypes: true, openAt: true, closeAt: true, cohortId: true, courseId: true }
    })
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' })
    if (assignment.cohortId !== req.user.cohortId || assignment.courseId !== req.user.courseId) {
      return res.status(403).json({ error: 'Not your assignment' })
    }
    if (!isAssignmentOpen(assignment)) return res.status(403).json({ error: 'Assignment is not open' })

    const submission = await prisma.submission.findUnique({
      where: { studentId_assignmentId: { studentId: req.user.id, assignmentId: assignment.id } },
      select: { id: true, submissionType: true, cloudinaryUrl: true, contentUrl: true, submittedAt: true, updatedAt: true }
    })
    res.json({ ...assignment, submission: submission || null })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/assignments/:id/submit', upload.single('file'), async (req, res) => {
  const { id: assignmentId } = req.params
  const { submissionType, contentUrl } = req.body
  if (!submissionType) return res.status(400).json({ error: 'submissionType required' })
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' })
    if (!isAssignmentOpen(assignment)) return res.status(403).json({ error: 'Assignment is not open for submission' })
    if (assignment.cohortId !== req.user.cohortId) return res.status(403).json({ error: 'Not your cohort' })

    const allowed = JSON.parse(assignment.allowedSubmissionTypes || '[]')
    if (!allowed.includes(submissionType)) return res.status(400).json({ error: `Submission type '${submissionType}' is not allowed for this assignment` })

    if (submissionType === 'url') {
      if (!contentUrl) return res.status(400).json({ error: 'contentUrl required for url submission' })
    } else {
      if (!req.file) return res.status(400).json({ error: 'File required for this submission type' })
      const maxSize = submissionType === 'video' ? 50 * 1024 * 1024 : 20 * 1024 * 1024
      if (req.file.size > maxSize) return res.status(400).json({ error: `File too large. Max size: ${submissionType === 'video' ? '50MB' : '20MB'}` })
    }

    const existing = await prisma.submission.findUnique({
      where: { studentId_assignmentId: { studentId: req.user.id, assignmentId } }
    })

    if (existing) {
      // Edit within open window — replace previous submission
      let data = { submissionType, updatedAt: new Date() }
      if (submissionType === 'url') {
        data.contentUrl = contentUrl
        data.cloudinaryUrl = null
        data.publicId = null
      } else {
        // Delete old Cloudinary file if it exists
        if (existing.publicId) {
          const { deleteFile } = await import('../services/cloudinary.js')
          await deleteFile(existing.publicId).catch(() => {})
        }
        const folder = submissionType === 'video' ? 'academic-portal/submissions/video' : 'academic-portal/submissions'
        const resource_type = submissionType === 'video' ? 'video' : 'auto'
        const uploaded = await uploadBuffer(req.file.buffer, { folder, resource_type })
        data.cloudinaryUrl = uploaded.secure_url
        data.publicId = uploaded.public_id
        data.contentUrl = null
      }
      await prisma.submission.update({ where: { id: existing.id }, data })
      return res.json({ message: 'Submission updated' })
    }

    // New submission
    let data = { studentId: req.user.id, assignmentId, submissionType }
    if (submissionType === 'url') {
      data.contentUrl = contentUrl
    } else {
      const folder = submissionType === 'video' ? 'academic-portal/submissions/video' : 'academic-portal/submissions'
      const resource_type = submissionType === 'video' ? 'video' : 'auto'
      const uploaded = await uploadBuffer(req.file.buffer, { folder, resource_type })
      data.cloudinaryUrl = uploaded.secure_url
      data.publicId = uploaded.public_id
    }
    await prisma.submission.create({ data })
    res.status(201).json({ message: 'Submitted successfully' })
  } catch (err) { res.status(500).json({ error: err.message }) }
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
  try {
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } })
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' })
    if (assessment.cohortId !== req.user.cohortId) return res.status(403).json({ error: 'Not in your cohort' })

    const existing = await prisma.assessmentResult.findUnique({
      where: { studentId_assessmentId: { studentId: req.user.id, assessmentId } }
    })
    if (existing) return res.status(409).json({ error: 'Already submitted' })

    let score = null
    try {
      score = scoreMCQ(JSON.parse(assessment.correctAnswers || '[]'), answers)
    } catch { /* not auto-markable */ }

    await prisma.assessmentResult.create({
      data: { studentId: req.user.id, assessmentId, answers: typeof answers === 'string' ? answers : JSON.stringify(answers), score }
    })
    // Return submitted confirmation only — no score shown to student
    res.status(201).json({ message: 'Submitted successfully' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/assessments/:id/submit-file', upload.single('file'), async (req, res) => {
  const { id: assessmentId } = req.params
  const { submissionType, contentUrl } = req.body
  const type = submissionType || 'file'
  try {
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } })
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' })
    if (assessment.cohortId !== req.user.cohortId) return res.status(403).json({ error: 'Not in your cohort' })

    const isPastDue = new Date() > new Date(assessment.dueDate)

    if (type === 'url') {
      if (!contentUrl) return res.status(400).json({ error: 'contentUrl required' })
    } else {
      if (!req.file) return res.status(400).json({ error: 'file required' })
    }

    const existing = await prisma.assessmentResult.findUnique({
      where: { studentId_assessmentId: { studentId: req.user.id, assessmentId } }
    })

    if (existing) {
      if (isPastDue) return res.status(403).json({ error: 'Due date has passed — submission cannot be edited' })
      // Edit within due window
      let data = { submissionType: type, updatedAt: new Date() }
      if (type === 'url') {
        data.contentUrl = contentUrl
        data.cloudinaryUrl = null
        data.publicId = null
      } else {
        if (existing.publicId) {
          const { deleteFile } = await import('../services/cloudinary.js')
          await deleteFile(existing.publicId).catch(() => {})
        }
        const folder = type === 'video' ? 'academic-portal/assessment-answers/video' : 'academic-portal/assessment-answers'
        const resource_type = type === 'video' ? 'video' : 'auto'
        const uploaded = await uploadBuffer(req.file.buffer, { folder, resource_type })
        data.cloudinaryUrl = uploaded.secure_url
        data.publicId = uploaded.public_id
      }
      await prisma.assessmentResult.update({ where: { id: existing.id }, data })
      return res.json({ message: 'Submission updated' })
    }

    let data = { studentId: req.user.id, assessmentId, answers: '', submissionType: type }
    if (type === 'url') {
      data.contentUrl = contentUrl
    } else {
      const folder = type === 'video' ? 'academic-portal/assessment-answers/video' : 'academic-portal/assessment-answers'
      const resource_type = type === 'video' ? 'video' : 'auto'
      const uploaded = await uploadBuffer(req.file.buffer, { folder, resource_type })
      data.cloudinaryUrl = uploaded.secure_url
      data.publicId = uploaded.public_id
    }
    await prisma.assessmentResult.create({ data })
    res.status(201).json({ message: 'Submitted successfully' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Grades ────────────────────────────────────────────────────

router.get('/grades', async (req, res) => {
  try {
    const [submissions, assessmentResults] = await Promise.all([
      prisma.submission.findMany({
        where: { studentId: req.user.id },
        select: {
          id: true, submittedAt: true,
          assignment: { select: { title: true, openAt: true, closeAt: true } }
        }
      }),
      prisma.assessmentResult.findMany({
        where: { studentId: req.user.id },
        select: {
          id: true, submittedAt: true,
          assessment: { select: { title: true, type: true } }
        }
      })
    ])
    res.json({ assignments: submissions, assessments: assessmentResults })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
