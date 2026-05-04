# Academic Portal — API Reference

Base URL: `http://localhost:3012` (dev) or your deployed URL.

All protected routes require:
```
Authorization: Bearer <token>
```

---

## Authentication

### POST `/auth/login`
Login for all users (students, admins, super admin).

**Body**
```json
{ "email": "string", "password": "string" }
```
> Student password = first name (lowercase). Admin password = first name (lowercase).

**Response**
```json
{
  "token": "jwt_token",
  "user": { "id": "", "name": "", "email": "", "role": "STUDENT | ADMIN" }
}
```

---

## Admin Routes
Prefix: `/admin` — requires ADMIN role JWT.

Super admin = no `courseId` in token (founder/devs).
Course admin = has `courseId` (tutors, scoped to their course).

---

### Cohorts *(super admin only)*

#### POST `/admin/cohorts`
```json
{ "name": "Cohort III", "startDate": "2026-05-07", "endDate": "2026-08-07" }
```

#### GET `/admin/cohorts`
Returns all cohorts with student and course counts.

---

### Courses *(super admin only)*

Valid course names:
- `ZK, Rust & Protocol`
- `AI & Automation`
- `UI/UX`
- `Smart Contract (Web3 Development)`
- `Web Development`

#### POST `/admin/courses`
```json
{ "name": "Web Development", "cohortId": "string" }
```

#### POST `/admin/courses/seed/:cohortId`
Creates all 5 courses for a cohort in one request.

#### GET `/admin/courses`
Query: `?cohortId=` (optional filter)

---

### Admins *(super admin only)*

#### POST `/admin/admins`
Creates a course admin (tutor). Password defaults to their first name (lowercase).
```json
{ "name": "string", "email": "string", "courseId": "string" }
```

---

### Students

#### POST `/admin/students`
```json
{ "name": "string", "email": "string", "cohortId": "string", "courseId": "string" }
```

#### POST `/admin/students/bulk`
```json
{
  "cohortId": "string",
  "courseId": "string",
  "students": [
    { "name": "string", "email": "string" }
  ]
}
```
**Response**
```json
{ "created": [...], "failed": [...] }
```

#### GET `/admin/students`
Query: `?cohortId=` (optional filter). Course admins only see their course students.

---

### Materials

#### POST `/admin/materials`
`multipart/form-data`

| Field | Type |
|-------|------|
| `file` | File |
| `title` | string |
| `type` | string (e.g. `pdf`, `video`, `link`) |
| `cohortId` | string |
| `courseId` | string |

#### DELETE `/admin/materials/:id`

---

### Attendance Sessions

#### POST `/admin/attendance/sessions`
Opens a new session (closes any active one for the same cohort/course).
```json
{ "cohortId": "string", "courseId": "string", "date": "2026-05-07", "allowedIp": "192.168.1.1" }
```

#### PATCH `/admin/attendance/sessions/:id/close`
Closes a session manually.

#### GET `/admin/attendance/sessions`
Query: `?cohortId=`

#### GET `/admin/attendance`
Query: `?cohortId=` `?sessionId=`
Returns attendance records with student name and email.

---

### Assignments

#### POST `/admin/assignments`
```json
{ "title": "string", "description": "string", "dueDate": "2026-05-14", "cohortId": "string", "courseId": "string" }
```

#### GET `/admin/assignments/:id/submissions`
Returns all submissions for an assignment with student info.

#### PATCH `/admin/submissions/:id/grade`
```json
{ "grade": 85, "feedback": "Good work." }
```

---

### Assessments

#### POST `/admin/assessments`
```json
{
  "title": "string",
  "type": "TEST | EXAM",
  "cohortId": "string",
  "courseId": "string",
  "dueDate": "2026-05-14",
  "questions": [
    { "q": "What is a smart contract?", "options": ["A", "B", "C", "D"], "answer": "A" }
  ]
}
```

#### GET `/admin/assessments/:id/results`
Returns all student submissions for an assessment.

#### PATCH `/admin/assessments/results/:id/score`
```json
{ "score": 90 }
```

---

## Student Routes
Prefix: `/student` — requires STUDENT role JWT.

All student endpoints are automatically scoped to the student's `cohortId` and `courseId`.

---

### Materials

#### GET `/student/materials`
Returns all materials for the student's cohort and course, newest first.

---

### Attendance

#### POST `/student/attendance/check-in`
Student must be on the class network (IP validated against the active session).
No body required — uses the student's IP and JWT identity.

**Errors**
- `404` No active session
- `403` Wrong network
- `409` Already checked in

#### GET `/student/attendance`
Returns the student's full attendance history.

---

### Assignments

#### GET `/student/assignments`
Returns assignments for the student's cohort and course, ordered by due date.

#### POST `/student/assignments/:id/submit`
`multipart/form-data`

| Field | Type |
|-------|------|
| `file` | File (any type) |

---

### Assessments

#### GET `/student/assessments`
Query: `?type=TEST` or `?type=EXAM` (optional filter).
Returns `id`, `title`, `type`, `dueDate` — **questions are not included**.

#### GET `/student/assessments/:id`
Returns full assessment including questions. Only accessible if student is in the correct cohort.

#### POST `/student/assessments/:id/submit`
```json
{ "answers": { "0": "A", "1": "C" } }
```
`answers` can be any JSON structure (object or array).

---

### Grades

#### GET `/student/grades`
Returns all graded work.
```json
{
  "assignments": [
    { "cloudinaryUrl": "", "grade": 85, "feedback": "", "assignment": { "title": "", "dueDate": "" } }
  ],
  "assessments": [
    { "answers": {}, "score": 90, "assessment": { "title": "", "type": "" } }
  ]
}
```

---

## Token Payload

Decoded JWT contains:
```json
{
  "id": "user_id",
  "email": "string",
  "role": "STUDENT | ADMIN",
  "cohortId": "string | null",
  "courseId": "string | null"
}
```
Use `role` to render the correct dashboard. Super admin has `courseId: null`.

---

## Error Format

All errors return:
```json
{ "error": "message" }
```

Common status codes: `400` bad input · `401` unauthenticated · `403` forbidden · `404` not found · `409` conflict (duplicate) · `500` server error.
