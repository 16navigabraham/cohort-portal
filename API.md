# Academic Portal — API Reference

**Base URL:** `http://localhost:3012` (dev) or your deployed URL

All protected routes require this header:
```
Authorization: Bearer <token>
```

---

## Authentication

### POST `/auth/login`

Login for all users — students, course admins, and super admin.

> Student default password = first name in lowercase (e.g. `john`).
> Admin default password = first name in lowercase.

**Request**
```json
{
  "email": "john.doe@web3nova.org",
  "password": "john"
}
```

**Response `200`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1a2b3c4d5e6f7g8h9",
    "name": "John Doe",
    "email": "john.doe@web3nova.org",
    "role": "STUDENT"
  }
}
```

**Errors**
| Status | Body |
|--------|------|
| `400` | `{ "error": "Email and password required" }` |
| `401` | `{ "error": "Invalid credentials" }` |

---

## Admin Routes

**Prefix:** `/admin` · Requires `ADMIN` role JWT.

| Admin type | `courseId` in token | Access |
|------------|---------------------|--------|
| Super admin | `null` | All cohorts, all courses |
| Course admin (tutor) | set | Own course only |

---

### Cohorts

> Super admin only.

#### POST `/admin/cohorts`

**Request**
```json
{
  "name": "Cohort III",
  "startDate": "2026-05-07",
  "endDate": "2026-08-07"
}
```

**Response `201`**
```json
{
  "id": "clx1a2b3c4d5e6f7g8h9",
  "name": "Cohort III",
  "startDate": "2026-05-07T00:00:00.000Z",
  "endDate": "2026-08-07T00:00:00.000Z",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### GET `/admin/cohorts`

**Response `200`**
```json
[
  {
    "id": "clx1a2b3c4d5e6f7g8h9",
    "name": "Cohort III",
    "startDate": "2026-05-07T00:00:00.000Z",
    "endDate": "2026-08-07T00:00:00.000Z",
    "createdAt": "2026-05-07T10:00:00.000Z",
    "_count": {
      "students": 45,
      "courses": 5
    }
  }
]
```

---

### Courses

> Super admin only.

Valid course names:
- `ZK, Rust & Protocol`
- `AI & Automation`
- `UI/UX`
- `Smart Contract (Web3 Development)`
- `Web Development`

#### POST `/admin/courses`

**Request**
```json
{
  "name": "Web Development",
  "cohortId": "clx1a2b3c4d5e6f7g8h9"
}
```

**Response `201`**
```json
{
  "id": "clx9z8y7x6w5v4u3t2s1",
  "name": "Web Development",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### POST `/admin/courses/seed/:cohortId`

Creates all 5 courses for a cohort in one request. Safe to call multiple times (upsert).

**Response `201`** — array of all 5 course objects.

---

#### GET `/admin/courses`

**Query params:** `?cohortId=clx1a2b3c4d5e6f7g8h9` (optional)

**Response `200`**
```json
[
  {
    "id": "clx9z8y7x6w5v4u3t2s1",
    "name": "Web Development",
    "cohortId": "clx1a2b3c4d5e6f7g8h9",
    "createdAt": "2026-05-07T10:00:00.000Z",
    "_count": {
      "students": 12,
      "admins": 1
    }
  }
]
```

---

### Admins

> Super admin only.

#### POST `/admin/admins`

Creates a course admin (tutor). Default password is their first name (lowercase).

**Request**
```json
{
  "name": "Tunde Adeyemi",
  "email": "tunde@web3nova.org",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

**Response `201`**
```json
{
  "id": "clxabc123def456ghi789",
  "name": "Tunde Adeyemi",
  "email": "tunde@web3nova.org",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

---

### Students

#### POST `/admin/students`

**Request**
```json
{
  "name": "Jane Okonkwo",
  "email": "jane@web3nova.org",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

**Response `201`**
```json
{
  "id": "clxstu001002003004005",
  "name": "Jane Okonkwo",
  "email": "jane@web3nova.org",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

---

#### POST `/admin/students/bulk`

**Request**
```json
{
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "students": [
    { "name": "Jane Okonkwo", "email": "jane@web3nova.org" },
    { "name": "Emeka Nwosu",  "email": "emeka@web3nova.org" }
  ]
}
```

**Response `201`**
```json
{
  "created": [
    { "id": "clxstu001", "name": "Jane Okonkwo", "email": "jane@web3nova.org" },
    { "id": "clxstu002", "name": "Emeka Nwosu",  "email": "emeka@web3nova.org" }
  ],
  "failed": []
}
```

Failed entries include a `reason` field (e.g. duplicate email):
```json
{
  "failed": [
    { "name": "Jane Okonkwo", "email": "jane@web3nova.org", "reason": "Unique constraint failed on email" }
  ]
}
```

---

#### GET `/admin/students`

**Query params:** `?cohortId=` (optional). Course admins only see students in their course.

**Response `200`**
```json
[
  {
    "id": "clxstu001",
    "name": "Jane Okonkwo",
    "email": "jane@web3nova.org",
    "cohortId": "clx1a2b3c4d5e6f7g8h9",
    "courseId": "clx9z8y7x6w5v4u3t2s1",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
]
```

---

### Materials

#### POST `/admin/materials`

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `file` | File | Any format |
| `title` | string | Display name |
| `type` | string | e.g. `pdf`, `video`, `slide` |
| `cohortId` | string | |
| `courseId` | string | |

**Response `201`**
```json
{
  "id": "clxmat001",
  "title": "Week 1 Slides",
  "cloudinaryUrl": "https://res.cloudinary.com/dvagunlxh/raw/upload/v1/academic-portal/materials/week1.pdf",
  "publicId": "academic-portal/materials/week1",
  "type": "pdf",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "uploadedAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### DELETE `/admin/materials/:id`

**Response `200`**
```json
{ "message": "Deleted" }
```

---

### Attendance Sessions

#### POST `/admin/attendance/sessions`

Opens a new session and closes any currently active session for the same cohort + course.

**Request**
```json
{
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "date": "2026-05-07",
  "allowedIp": "192.168.1.1"
}
```

**Response `201`**
```json
{
  "id": "clxsess001",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "date": "2026-05-07T00:00:00.000Z",
  "allowedIp": "192.168.1.1",
  "active": true,
  "createdAt": "2026-05-07T09:00:00.000Z"
}
```

---

#### PATCH `/admin/attendance/sessions/:id/close`

**Response `200`** — updated session object with `"active": false`.

---

#### GET `/admin/attendance/sessions`

**Query params:** `?cohortId=` (optional)

**Response `200`**
```json
[
  {
    "id": "clxsess001",
    "date": "2026-05-07T00:00:00.000Z",
    "allowedIp": "192.168.1.1",
    "active": false,
    "_count": { "attendances": 23 }
  }
]
```

---

#### GET `/admin/attendance`

**Query params:** `?cohortId=` `?sessionId=` (both optional)

**Response `200`**
```json
[
  {
    "id": "clxatt001",
    "studentId": "clxstu001",
    "sessionId": "clxsess001",
    "date": "2026-05-07T00:00:00.000Z",
    "status": "PRESENT",
    "ip": "192.168.1.45",
    "student": {
      "name": "Jane Okonkwo",
      "email": "jane@web3nova.org"
    }
  }
]
```

---

### Assignments

#### POST `/admin/assignments`

**Request**
```json
{
  "title": "Build a REST API",
  "description": "Create a fully functional REST API using Express.js with at least 5 endpoints.",
  "dueDate": "2026-05-21",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

**Response `201`**
```json
{
  "id": "clxasgn001",
  "title": "Build a REST API",
  "description": "Create a fully functional REST API...",
  "dueDate": "2026-05-21T00:00:00.000Z",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### GET `/admin/assignments/:id/submissions`

**Response `200`**
```json
[
  {
    "id": "clxsub001",
    "studentId": "clxstu001",
    "cloudinaryUrl": "https://res.cloudinary.com/dvagunlxh/raw/upload/v1/academic-portal/submissions/project.zip",
    "submittedAt": "2026-05-20T14:30:00.000Z",
    "grade": null,
    "feedback": null,
    "student": {
      "name": "Jane Okonkwo",
      "email": "jane@web3nova.org"
    }
  }
]
```

---

#### PATCH `/admin/submissions/:id/grade`

**Request**
```json
{
  "grade": 85,
  "feedback": "Good structure. Clean code."
}
```

**Response `200`** — updated submission object.

---

### Assessments

#### POST `/admin/assessments`

**Request**
```json
{
  "title": "Week 3 Quiz",
  "type": "TEST",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "dueDate": "2026-05-14",
  "questions": [
    {
      "q": "What does REST stand for?",
      "options": ["Representational State Transfer", "Remote Execution Service Tool", "Request Send Transfer", "None"],
      "answer": "Representational State Transfer"
    }
  ]
}
```

**Response `201`**
```json
{
  "id": "clxassmt001",
  "title": "Week 3 Quiz",
  "type": "TEST",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "dueDate": "2026-05-14T00:00:00.000Z",
  "questions": "[{\"q\":\"What does REST stand for?\",...}]",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

> `questions` is stored as a JSON string. Parse it on the frontend with `JSON.parse()`.

---

#### GET `/admin/assessments/:id/results`

**Response `200`**
```json
[
  {
    "id": "clxres001",
    "studentId": "clxstu001",
    "answers": "{\"0\":\"Representational State Transfer\"}",
    "score": null,
    "submittedAt": "2026-05-14T11:00:00.000Z",
    "student": {
      "name": "Jane Okonkwo",
      "email": "jane@web3nova.org"
    }
  }
]
```

---

#### PATCH `/admin/assessments/results/:id/score`

**Request**
```json
{ "score": 90 }
```

**Response `200`** — updated result object.

---

## Student Routes

**Prefix:** `/student` · Requires `STUDENT` role JWT.

All endpoints are automatically scoped to the student's own `cohortId` and `courseId` from the token.

---

### Materials

#### GET `/student/materials`

**Response `200`**
```json
[
  {
    "id": "clxmat001",
    "title": "Week 1 Slides",
    "cloudinaryUrl": "https://res.cloudinary.com/dvagunlxh/raw/upload/v1/academic-portal/materials/week1.pdf",
    "type": "pdf",
    "cohortId": "clx1a2b3c4d5e6f7g8h9",
    "courseId": "clx9z8y7x6w5v4u3t2s1",
    "uploadedAt": "2026-05-07T10:00:00.000Z"
  }
]
```

---

### Attendance

#### POST `/student/attendance/check-in`

No body required. Student must be on the class network (IP is validated server-side).

**Response `201`**
```json
{
  "message": "Checked in successfully",
  "record": {
    "id": "clxatt001",
    "studentId": "clxstu001",
    "sessionId": "clxsess001",
    "date": "2026-05-07T00:00:00.000Z",
    "status": "PRESENT",
    "ip": "192.168.1.45"
  }
}
```

**Errors**
| Status | Body |
|--------|------|
| `404` | `{ "error": "No active attendance session for your cohort" }` |
| `403` | `{ "error": "You must be on the class network to check in" }` |
| `409` | `{ "error": "Already checked in for this session" }` |

---

#### GET `/student/attendance`

**Response `200`**
```json
[
  {
    "id": "clxatt001",
    "date": "2026-05-07T00:00:00.000Z",
    "status": "PRESENT",
    "session": {
      "date": "2026-05-07T00:00:00.000Z",
      "active": false
    }
  }
]
```

---

### Assignments

#### GET `/student/assignments`

**Response `200`**
```json
[
  {
    "id": "clxasgn001",
    "title": "Build a REST API",
    "description": "Create a fully functional REST API...",
    "dueDate": "2026-05-21T00:00:00.000Z",
    "cohortId": "clx1a2b3c4d5e6f7g8h9",
    "courseId": "clx9z8y7x6w5v4u3t2s1",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
]
```

---

#### POST `/student/assignments/:id/submit`

`Content-Type: multipart/form-data`

| Field | Type |
|-------|------|
| `file` | File (any type) |

**Response `201`**
```json
{
  "id": "clxsub001",
  "studentId": "clxstu001",
  "assignmentId": "clxasgn001",
  "cloudinaryUrl": "https://res.cloudinary.com/dvagunlxh/raw/upload/v1/academic-portal/submissions/project.zip",
  "publicId": "academic-portal/submissions/project",
  "submittedAt": "2026-05-20T14:30:00.000Z",
  "grade": null,
  "feedback": null
}
```

**Errors**
| Status | Body |
|--------|------|
| `400` | `{ "error": "File required" }` |
| `404` | `{ "error": "Assignment not found" }` |
| `409` | `{ "error": "Already submitted" }` |

---

### Assessments

#### GET `/student/assessments`

**Query params:** `?type=TEST` or `?type=EXAM` (optional)

Questions are **not** returned here — use the single assessment endpoint to get them.

**Response `200`**
```json
[
  {
    "id": "clxassmt001",
    "title": "Week 3 Quiz",
    "type": "TEST",
    "dueDate": "2026-05-14T00:00:00.000Z",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
]
```

---

#### GET `/student/assessments/:id`

Returns full assessment including questions.

**Response `200`**
```json
{
  "id": "clxassmt001",
  "title": "Week 3 Quiz",
  "type": "TEST",
  "dueDate": "2026-05-14T00:00:00.000Z",
  "questions": "[{\"q\":\"What does REST stand for?\",\"options\":[...],\"answer\":\"...\"}]"
}
```

> Parse `questions` with `JSON.parse()`.

---

#### POST `/student/assessments/:id/submit`

**Request**
```json
{
  "answers": { "0": "Representational State Transfer", "1": "GET" }
}
```

`answers` can be any JSON — object or array.

**Response `201`**
```json
{
  "id": "clxres001",
  "studentId": "clxstu001",
  "assessmentId": "clxassmt001",
  "answers": "{\"0\":\"Representational State Transfer\",\"1\":\"GET\"}",
  "score": null,
  "submittedAt": "2026-05-14T11:00:00.000Z"
}
```

**Errors**
| Status | Body |
|--------|------|
| `400` | `{ "error": "answers required" }` |
| `403` | `{ "error": "Not in your cohort" }` |
| `409` | `{ "error": "Already submitted" }` |

---

### Grades

#### GET `/student/grades`

**Response `200`**
```json
{
  "assignments": [
    {
      "id": "clxsub001",
      "cloudinaryUrl": "https://res.cloudinary.com/...",
      "submittedAt": "2026-05-20T14:30:00.000Z",
      "grade": 85,
      "feedback": "Good structure. Clean code.",
      "assignment": {
        "title": "Build a REST API",
        "dueDate": "2026-05-21T00:00:00.000Z"
      }
    }
  ],
  "assessments": [
    {
      "id": "clxres001",
      "answers": "{\"0\":\"Representational State Transfer\"}",
      "score": 90,
      "submittedAt": "2026-05-14T11:00:00.000Z",
      "assessment": {
        "title": "Week 3 Quiz",
        "type": "TEST"
      }
    }
  ]
}
```

---

## Token Payload

```json
{
  "id": "clxstu001",
  "email": "jane@web3nova.org",
  "role": "STUDENT",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "iat": 1746612000,
  "exp": 1747216800
}
```

- `role`: use to decide which dashboard to render (`STUDENT` or `ADMIN`)
- `courseId: null` on super admin token
- Token expires in **7 days**

---

## Error Format

All errors follow this shape:

```json
{ "error": "human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid fields |
| `401` | No token / invalid token |
| `403` | Valid token but insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict — duplicate submission, already checked in, etc. |
| `500` | Server error |
