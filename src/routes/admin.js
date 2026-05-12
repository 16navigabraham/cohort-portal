import { Router } from 'express'
import bcrypt from 'bcrypt'
import multer from 'multer'
import { prisma } from '../db.js'
import { uploadBuffer, deleteFile } from '../services/cloudinary.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { parseMCQFile } from '../services/mcq-parser.js'
import { weekAssignmentWindow } from '../services/curriculum-dates.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.use(authenticate, requireAdmin)

// helper: super admin has no courseId
const isSuperAdmin = (req) => !req.user.courseId
const courseScope  = (req) => req.user.courseId ? { courseId: req.user.courseId } : {}

// ── Cohorts (super admin only) ────────────────────────────────

router.post('/cohorts', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  const { name, startDate, endDate } = req.body
  if (!name || !startDate || !endDate) return res.status(400).json({ error: 'name, startDate, endDate required' })
  try {
    const cohort = await prisma.cohort.create({ data: { name, startDate: new Date(startDate), endDate: new Date(endDate) } })
    res.status(201).json(cohort)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/cohorts', async (req, res) => {
  try {
    const cohorts = await prisma.cohort.findMany({ include: { _count: { select: { students: true, courses: true } } } })
    res.json(cohorts)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Courses (super admin only) ────────────────────────────────

router.post('/courses', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  const { name, cohortId } = req.body
  if (!name || !cohortId) return res.status(400).json({ error: 'name and cohortId required' })
  try {
    const course = await prisma.course.create({ data: { name, cohortId } })
    res.status(201).json(course)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/courses/:id', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  try {
    await prisma.course.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/courses', async (req, res) => {
  try {
    const { cohortId } = req.query
    const courses = await prisma.course.findMany({
      where: { ...(cohortId ? { cohortId } : {}), ...courseScope(req) },
      include: { _count: { select: { students: true, admins: true } } }
    })
    res.json(courses)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Admins (super admin only) ─────────────────────────────────

router.post('/admins', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  const { name, email, courseId } = req.body
  if (!name || !email || !courseId) return res.status(400).json({ error: 'name, email, courseId required' })
  try {
    const firstName = name.trim().split(' ')[0].toLowerCase()
    const hashed = await bcrypt.hash(firstName, 10)
    const admin = await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hashed, role: 'ADMIN', courseId },
      select: { id: true, name: true, email: true, courseId: true }
    })
    res.status(201).json(admin)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/admins/:id', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  try {
    await prisma.user.delete({ where: { id: req.params.id, role: 'ADMIN' } })
    res.json({ message: 'Deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/admins', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true, email: true, courseId: true, createdAt: true }
    })
    res.json(admins)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Students ──────────────────────────────────────────────────

router.post('/students', async (req, res) => {
  const { name, email, cohortId, courseId } = req.body
  if (!name || !email || !cohortId || !courseId) return res.status(400).json({ error: 'name, email, cohortId, courseId required' })
  if (!isSuperAdmin(req) && req.user.courseId !== courseId) return res.status(403).json({ error: 'Cannot add students to another course' })
  try {
    const firstName = name.trim().split(' ')[0].toLowerCase()
    const hashed = await bcrypt.hash(firstName, 10)
    const student = await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hashed, role: 'STUDENT', cohortId, courseId },
      select: { id: true, name: true, email: true, cohortId: true, courseId: true }
    })
    res.status(201).json(student)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/students/:id', async (req, res) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.id, role: 'STUDENT' } })
    if (!student) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== student.courseId) return res.status(403).json({ error: 'Not your course' })
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/students/bulk', async (req, res) => {
  const { students, cohortId, courseId } = req.body
  if (!Array.isArray(students) || !cohortId || !courseId) return res.status(400).json({ error: 'students array, cohortId, courseId required' })
  if (!isSuperAdmin(req) && req.user.courseId !== courseId) return res.status(403).json({ error: 'Cannot add students to another course' })

  const results = { created: [], failed: [] }
  for (const s of students) {
    if (!s.name || !s.email) { results.failed.push({ ...s, reason: 'missing name or email' }); continue }
    try {
      const firstName = s.name.trim().split(' ')[0].toLowerCase()
      const hashed = await bcrypt.hash(firstName, 10)
      const student = await prisma.user.create({
        data: { name: s.name, email: s.email.toLowerCase(), password: hashed, role: 'STUDENT', cohortId, courseId },
        select: { id: true, name: true, email: true }
      })
      results.created.push(student)
    } catch (err) {
      results.failed.push({ ...s, reason: err.message })
    }
  }
  res.status(201).json(results)
})

router.get('/students', async (req, res) => {
  try {
    const { cohortId } = req.query
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', ...(cohortId ? { cohortId } : {}), ...courseScope(req) },
      select: { id: true, name: true, email: true, cohortId: true, courseId: true, createdAt: true }
    })
    res.json(students)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Materials ─────────────────────────────────────────────────

router.post('/materials', upload.single('file'), async (req, res) => {
  const { title, type, cohortId, courseId } = req.body
  if (!req.file || !title || !type || !cohortId || !courseId) return res.status(400).json({ error: 'file, title, type, cohortId, courseId required' })
  if (!isSuperAdmin(req) && req.user.courseId !== courseId) return res.status(403).json({ error: 'Cannot upload to another course' })
  try {
    const result = await uploadBuffer(req.file.buffer, { folder: 'academic-portal/materials', resource_type: 'auto' })
    const material = await prisma.material.create({
      data: { title, cloudinaryUrl: result.secure_url, publicId: result.public_id, type, cohortId, courseId }
    })
    res.status(201).json(material)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/materials/:id', async (req, res) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } })
    if (!material) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== material.courseId) return res.status(403).json({ error: 'Not your course' })
    await deleteFile(material.publicId)
    await prisma.material.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/materials', async (req, res) => {
  try {
    const { cohortId, courseId } = req.query
    const materials = await prisma.material.findMany({
      where: {
        ...(cohortId ? { cohortId } : {}),
        ...(courseId ? { courseId } : {}),
        ...courseScope(req),
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(materials)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Attendance Sessions ───────────────────────────────────────

router.post('/attendance/sessions', async (req, res) => {
  const { cohortId, courseId, date, allowedIp } = req.body
  if (!cohortId || !courseId || !date || !allowedIp) return res.status(400).json({ error: 'cohortId, courseId, date, allowedIp required' })
  if (!isSuperAdmin(req) && req.user.courseId !== courseId) return res.status(403).json({ error: 'Not your course' })
  try {
    await prisma.attendanceSession.updateMany({ where: { cohortId, courseId, active: true }, data: { active: false } })
    const session = await prisma.attendanceSession.create({
      data: { cohortId, courseId, date: new Date(date), allowedIp, active: true }
    })
    res.status(201).json(session)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.patch('/attendance/sessions/:id/close', async (req, res) => {
  try {
    const session = await prisma.attendanceSession.update({ where: { id: req.params.id }, data: { active: false } })
    res.json(session)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/attendance/sessions', async (req, res) => {
  try {
    const { cohortId } = req.query
    const sessions = await prisma.attendanceSession.findMany({
      where: { ...(cohortId ? { cohortId } : {}), ...courseScope(req) },
      include: { _count: { select: { attendances: true } } },
      orderBy: { date: 'desc' }
    })
    res.json(sessions)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/attendance', async (req, res) => {
  try {
    const { cohortId, sessionId } = req.query
    const records = await prisma.attendance.findMany({
      where: { ...(cohortId ? { cohortId } : {}), ...(sessionId ? { sessionId } : {}), ...courseScope(req) },
      include: { student: { select: { name: true, email: true } } }
    })
    res.json(records)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Curriculum ────────────────────────────────────────────────

// Seed 12 curriculum weeks for a course in a cohort
router.post('/curriculum/seed/:cohortId/:courseId', async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' })
  const { cohortId, courseId } = req.params
  try {
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) return res.status(404).json({ error: 'Cohort not found' })
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const weeks = await Promise.all(
      Array.from({ length: 12 }, (_, i) => i + 1).map(week =>
        prisma.curriculum.upsert({
          where: { courseId_cohortId_week: { courseId, cohortId, week } },
          update: {},
          create: { courseId, cohortId, week, title: `Week ${week}` },
        })
      )
    )
    res.status(201).json(weeks)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/curriculum', async (req, res) => {
  const { cohortId, courseId } = req.query
  try {
    const where = {
      ...(cohortId ? { cohortId } : {}),
      ...(courseId ? { courseId } : {}),
      ...courseScope(req),
    }
    const weeks = await prisma.curriculum.findMany({
      where,
      orderBy: { week: 'asc' },
      include: {
        assignment: true,
        materials: true,
      },
    })
    res.json(weeks)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.patch('/curriculum/:id', async (req, res) => {
  const { title, description } = req.body
  try {
    const week = await prisma.curriculum.findUnique({ where: { id: req.params.id } })
    if (!week) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== week.courseId) return res.status(403).json({ error: 'Not your course' })
    const updated = await prisma.curriculum.update({
      where: { id: req.params.id },
      data: { ...(title ? { title } : {}), ...(description !== undefined ? { description } : {}) },
    })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Assignments (per curriculum week) ────────────────────────

router.post('/curriculum/:id/assignment', upload.single('questionDoc'), async (req, res) => {
  const { title, description, questionText, allowedSubmissionTypes } = req.body
  if (!title || !description) return res.status(400).json({ error: 'title and description required' })
  try {
    const week = await prisma.curriculum.findUnique({ where: { id: req.params.id }, include: { cohort: true } })
    if (!week) return res.status(404).json({ error: 'Curriculum week not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== week.courseId) return res.status(403).json({ error: 'Not your course' })

    const existing = await prisma.assignment.findUnique({ where: { curriculumId: req.params.id } })
    if (existing) return res.status(409).json({ error: 'Assignment already exists for this week. Use PATCH /admin/assignments/:id to update.' })

    const { openAt, closeAt } = weekAssignmentWindow(week.cohort.startDate, week.week)

    let parsedQuestionText = questionText || null
    let questionDocUrl = null

    if (req.file) {
      // Upload original doc to Cloudinary for student download fallback
      const uploaded = await uploadBuffer(req.file.buffer, { folder: 'academic-portal/question-docs', resource_type: 'raw' })
      questionDocUrl = uploaded.secure_url
      // Parse text from doc if no manual text provided
      if (!parsedQuestionText) {
        try {
          const { parseQuestionDoc } = await import('../services/mcq-parser.js')
          parsedQuestionText = await parseQuestionDoc(req.file.buffer, req.file.mimetype)
        } catch { /* fallback to doc URL only */ }
      }
    }

    const types = allowedSubmissionTypes
      ? (typeof allowedSubmissionTypes === 'string' ? allowedSubmissionTypes : JSON.stringify(allowedSubmissionTypes))
      : '["pdf","doc","url","image","video","code"]'

    const assignment = await prisma.assignment.create({
      data: {
        title, description, questionText: parsedQuestionText, questionDocUrl,
        allowedSubmissionTypes: types,
        curriculumId: req.params.id, cohortId: week.cohortId, courseId: week.courseId, openAt, closeAt,
      },
    })
    res.status(201).json(assignment)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.patch('/assignments/:id', upload.single('questionDoc'), async (req, res) => {
  const { title, description, questionText, allowedSubmissionTypes } = req.body
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } })
    if (!assignment) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== assignment.courseId) return res.status(403).json({ error: 'Not your course' })

    const data = {}
    if (title) data.title = title
    if (description) data.description = description
    if (questionText !== undefined) data.questionText = questionText
    if (allowedSubmissionTypes) data.allowedSubmissionTypes = typeof allowedSubmissionTypes === 'string' ? allowedSubmissionTypes : JSON.stringify(allowedSubmissionTypes)

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, { folder: 'academic-portal/question-docs', resource_type: 'raw' })
      data.questionDocUrl = uploaded.secure_url
      if (!questionText) {
        try {
          const { parseQuestionDoc } = await import('../services/mcq-parser.js')
          data.questionText = await parseQuestionDoc(req.file.buffer, req.file.mimetype)
        } catch { /* keep existing */ }
      }
    }

    const updated = await prisma.assignment.update({ where: { id: req.params.id }, data })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/assignments', async (req, res) => {
  try {
    const { cohortId, courseId } = req.query
    const assignments = await prisma.assignment.findMany({
      where: {
        ...(cohortId ? { cohortId } : {}),
        ...(courseId ? { courseId } : {}),
        ...courseScope(req),
      },
      orderBy: { openAt: 'desc' }
    })
    res.json(assignments)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/assignments/:id/submissions', async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { assignmentId: req.params.id },
      include: { student: { select: { name: true, email: true } } },
    })
    res.json(submissions)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.patch('/submissions/:id/grade', async (req, res) => {
  const { grade, feedback } = req.body
  if (grade === undefined) return res.status(400).json({ error: 'grade required' })
  try {
    const submission = await prisma.submission.update({ where: { id: req.params.id }, data: { grade, feedback } })
    res.json(submission)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Assessments ───────────────────────────────────────────────

router.post('/assessments', async (req, res) => {
  const { title, type, cohortId, courseId, dueDate } = req.body
  if (!title || !type || !cohortId || !courseId || !dueDate) return res.status(400).json({ error: 'title, type, cohortId, courseId, dueDate required' })
  if (!isSuperAdmin(req) && req.user.courseId !== courseId) return res.status(403).json({ error: 'Not your course' })
  try {
    const assessment = await prisma.assessment.create({
      data: { title, type, cohortId, courseId, dueDate: new Date(dueDate), questions: '[]' }
    })
    res.status(201).json(assessment)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.patch('/assessments/:id', async (req, res) => {
  try {
    const { questions } = req.body
    const assessment = await prisma.assessment.findUnique({ where: { id: req.params.id } })
    if (!assessment) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== assessment.courseId) return res.status(403).json({ error: 'Not your course' })
    const updated = await prisma.assessment.update({
      where: { id: req.params.id },
      data: { questions: typeof questions === 'string' ? questions : JSON.stringify(questions) }
    })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/assessments/:id/paper', upload.single('file'), async (req, res) => {
  try {
    const assessment = await prisma.assessment.findUnique({ where: { id: req.params.id } })
    if (!assessment) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== assessment.courseId) return res.status(403).json({ error: 'Not your course' })
    if (!req.file) return res.status(400).json({ error: 'file required' })
    const result = await uploadBuffer(req.file.buffer, { folder: 'academic-portal/papers', resource_type: 'auto' })
    const updated = await prisma.assessment.update({
      where: { id: req.params.id },
      data: { questions: JSON.stringify({ paperUrl: result.secure_url }) }
    })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Upload .csv/.pdf/.docx → parse MCQ questions automatically
router.post('/assessments/:id/upload-questions', upload.single('file'), async (req, res) => {
  try {
    const assessment = await prisma.assessment.findUnique({ where: { id: req.params.id } })
    if (!assessment) return res.status(404).json({ error: 'Not found' })
    if (!isSuperAdmin(req) && req.user.courseId !== assessment.courseId) return res.status(403).json({ error: 'Not your course' })
    if (!req.file) return res.status(400).json({ error: 'file required (.csv, .pdf, or .docx)' })

    const { questions, correctAnswers } = await parseMCQFile(req.file.buffer, req.file.mimetype)

    const updated = await prisma.assessment.update({
      where: { id: req.params.id },
      data: {
        questions: JSON.stringify(questions),
        correctAnswers: JSON.stringify(correctAnswers),
      },
    })
    res.json({ message: `${questions.length} questions loaded`, assessment: updated })
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.get('/assessments', async (req, res) => {
  try {
    const { cohortId, courseId } = req.query
    const assessments = await prisma.assessment.findMany({
      where: {
        ...(cohortId ? { cohortId } : {}),
        ...(courseId ? { courseId } : {}),
        ...courseScope(req),
      },
      orderBy: { dueDate: 'desc' }
    })
    res.json(assessments)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/assessments/:id/results', async (req, res) => {
  try {
    const results = await prisma.assessmentResult.findMany({
      where: { assessmentId: req.params.id },
      include: { student: { select: { name: true, email: true } } }
    })
    res.json(results)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.patch('/assessments/results/:id/score', async (req, res) => {
  const { score } = req.body
  if (score === undefined) return res.status(400).json({ error: 'score required' })
  try {
    const result = await prisma.assessmentResult.update({ where: { id: req.params.id }, data: { score } })
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Payments ──────────────────────────────────────────────────

/**
 * GET /admin/payments
 * Returns all payment records (filtered by course if not super admin)
 * Query params: cohortId, courseId, status (PENDING, INSTALMENT_1_PAID, COMPLETED)
 */
router.get('/payments', async (req, res) => {
  try {
    const { cohortId, courseId, status } = req.query
    const payments = await prisma.payment.findMany({
      where: {
        ...(cohortId ? { cohortId } : {}),
        ...(courseId ? { courseId } : {}),
        ...(status ? { status } : {}),
        ...courseScope(req),
      },
      include: {
        student: { select: { name: true, email: true } },
        cohort: { select: { name: true } },
        course: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(payments)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * GET /admin/payments/summary
 * Returns payment summary statistics for a course/cohort
 */
router.get('/payments/summary', async (req, res) => {
  try {
    const { cohortId, courseId } = req.query
    const where = {
      ...(cohortId ? { cohortId } : {}),
      ...(courseId ? { courseId } : {}),
      ...courseScope(req),
    }

    const payments = await prisma.payment.findMany({ where })
    const total = payments.length
    const completed = payments.filter(p => p.status === 'COMPLETED').length
    const instalment1Paid = payments.filter(p => p.status === 'INSTALMENT_1_PAID').length
    const pending = payments.filter(p => p.status === 'PENDING').length
    const totalCollected = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0)

    res.json({
      total,
      completed,
      instalment1Paid,
      pending,
      pendingPercentage: ((pending / total) * 100).toFixed(2),
      completionPercentage: ((completed / total) * 100).toFixed(2),
      totalCollected,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * GET /admin/payments/unpaid
 * Returns students who haven't paid yet
 */
router.get('/payments/unpaid', async (req, res) => {
  try {
    const { cohortId, courseId } = req.query
    const where = {
      ...(cohortId ? { cohortId } : {}),
      ...(courseId ? { courseId } : {}),
      ...courseScope(req),
    }

    const unpaid = await prisma.payment.findMany({
      where: { ...where, status: 'PENDING' },
      include: {
        student: { select: { name: true, email: true } },
        cohort: { select: { name: true } },
        course: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(unpaid)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
