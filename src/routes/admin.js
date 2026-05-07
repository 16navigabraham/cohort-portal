import { Router } from 'express'
import bcrypt from 'bcrypt'
import multer from 'multer'
import { prisma } from '../db.js'
import { uploadBuffer, deleteFile } from '../services/cloudinary.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'

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

// ── Assignments ───────────────────────────────────────────────

router.post('/assignments', async (req, res) => {
  const { title, description, dueDate, cohortId, courseId } = req.body
  if (!title || !description || !dueDate || !cohortId || !courseId) return res.status(400).json({ error: 'title, description, dueDate, cohortId, courseId required' })
  if (!isSuperAdmin(req) && req.user.courseId !== courseId) return res.status(403).json({ error: 'Not your course' })
  try {
    const assignment = await prisma.assignment.create({ data: { title, description, dueDate: new Date(dueDate), cohortId, courseId } })
    res.status(201).json(assignment)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/assignments/:id/submissions', async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { assignmentId: req.params.id },
      include: { student: { select: { name: true, email: true } } }
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

export default router
