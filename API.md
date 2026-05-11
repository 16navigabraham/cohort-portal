# Academic Portal — API Reference

**Base URL:** `http://localhost:3012` (dev) · `https://cohort-portal-cmhj.onrender.com` (prod)

All protected routes require:
```
Authorization: Bearer <token>
```

---

## Table of Contents

- [Authentication](#authentication)
- [Role System](#role-system)
- [Data Model Overview](#data-model-overview)
- [Admin Routes](#admin-routes)
  - [Cohorts](#cohorts)
  - [Courses](#courses)
  - [Curriculum](#curriculum)
  - [Assignments](#assignments-admin)
  - [Assessments](#assessments-admin)
  - [Admins / Tutors](#admins--tutors)
  - [Students](#students)
  - [Materials](#materials)
  - [Attendance](#attendance)
- [Student Routes](#student-routes)
  - [Curriculum](#curriculum-student)
  - [Assignments](#assignments-student)
  - [Assessments](#assessments-student)
  - [Materials](#materials-student)
  - [Attendance](#attendance-student)
  - [Grades](#grades)
- [UX Design Notes](#ux-design-notes)
- [Token Payload](#token-payload)
- [Error Format](#error-format)

---

## Role System

```
┌─────────────────────────────────────────────────────────┐
│                     ADMIN role                          │
│                                                         │
│  Super Admin (courseId = null)                          │
│  ├── Creates cohorts, courses, curriculum               │
│  ├── Creates tutors and students                        │
│  └── Sees everything across all courses                 │
│                                                         │
│  Tutor / Course Admin (courseId = set)                  │
│  ├── Manages own course only                            │
│  ├── Creates assignments & assessments                  │
│  ├── Grades submissions                                 │
│  └── Cannot touch other courses                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    STUDENT role                         │
│  cohortId + courseId set in token                       │
│  All endpoints auto-scoped — no manual filtering needed │
└─────────────────────────────────────────────────────────┘
```

> **Frontend tip:** After login, check `role` from the token.
> - `ADMIN` + `courseId === null` → Super Admin dashboard
> - `ADMIN` + `courseId !== null` → Tutor dashboard
> - `STUDENT` → Student dashboard

---

## Data Model Overview

```
Cohort (e.g. "Cohort III", 12 weeks)
└── Course (e.g. "Web Development")
    ├── Curriculum Week 1..12
    │   ├── Materials (week-specific)
    │   └── Assignment (opens Friday, closes Monday+1)
    │       └── Submissions (one per student, editable while open)
    ├── Materials (course-level, not week-specific)
    ├── Assessment (MCQ or File Upload)
    │   └── AssessmentResults (one per student)
    ├── AttendanceSessions
    │   └── Attendances
    └── Students / Tutors
```

---

## Authentication

### POST `/auth/login`

Login for all roles — student, tutor, super admin.

> **Default password** = first name in lowercase (e.g. name "Jane Okonkwo" → password `jane`)

**Rate limit:** 10 attempts per 15 minutes per IP.

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
| Status | Message |
|--------|---------|
| `400` | `"Email and password required"` |
| `401` | `"Invalid credentials"` |
| `429` | `"Too many login attempts. Try again in 15 minutes."` |

---

## Admin Routes

**Prefix:** `/admin` · Requires `ADMIN` role JWT.

---

### Cohorts

> Super admin only.

#### POST `/admin/cohorts`

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
    "_count": { "students": 45, "courses": 5 }
  }
]
```

---

### Courses

> Super admin only. Any course name is accepted — no whitelist.

#### POST `/admin/courses`

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

#### GET `/admin/courses`

**Query params:** `?cohortId=` (optional)

**Response `200`** — array of course objects with `_count.students` and `_count.admins`.

---

#### DELETE `/admin/courses/:id`

> Super admin only.

**Response `200`** `{ "message": "Deleted" }`

---

### Curriculum

```
Setup flow (super admin, done once before cohort starts):

  1. Create cohort
  2. Create courses
  3. Seed curriculum → generates Week 1–12 for a course
  4. Fill each week: title, description, materials, assignment
  5. Students see it all from day one
```

> **Important:** Seed and fill the full 12 weeks before the cohort starts.
> Week assignment windows are auto-calculated from the cohort `startDate`.

---

#### POST `/admin/curriculum/seed/:cohortId/:courseId`

> Super admin only. Generates 12 curriculum weeks for a course. Safe to call multiple times (upsert).

**Response `201`** — array of 12 curriculum week objects.

```json
[
  { "id": "clxcur001", "courseId": "...", "cohortId": "...", "week": 1, "title": "Week 1", "description": null },
  { "id": "clxcur002", "courseId": "...", "cohortId": "...", "week": 2, "title": "Week 2", "description": null },
  ...
]
```

---

#### GET `/admin/curriculum`

**Query params:** `?cohortId=` `?courseId=` (both optional)

Returns all 12 weeks with their assignment and materials attached.

**Response `200`**
```json
[
  {
    "id": "clxcur001",
    "week": 1,
    "title": "Intro to Web Development",
    "description": "HTML, CSS fundamentals and the browser rendering model.",
    "assignment": {
      "id": "clxasgn001",
      "title": "Build a landing page",
      "openAt": "2026-05-08T00:00:00.000Z",
      "closeAt": "2026-05-11T23:59:59.999Z"
    },
    "materials": [
      {
        "id": "clxmat001",
        "title": "Week 1 Slides",
        "cloudinaryUrl": "https://res.cloudinary.com/...",
        "type": "pdf"
      }
    ]
  }
]
```

---

#### PATCH `/admin/curriculum/:id`

Update a week's title or description.

```json
{
  "title": "Intro to Web Development",
  "description": "HTML, CSS fundamentals and the browser rendering model."
}
```

**Response `200`** — updated curriculum week object.

---

### Assignments (Admin)

Assignments belong to curriculum weeks. One assignment per week.
The open/close window is auto-calculated — **Friday 00:00 to Monday 23:59** of that week.

```
Week timeline example (cohort starts Monday 2026-05-07):

  Week 1: Mon May 7 → Sun May 13
          Assignment open: Fri May 9 00:00
          Assignment close: Mon May 12 23:59

  Week 2: Mon May 14 → Sun May 20
          Assignment open: Fri May 16 00:00
          Assignment close: Mon May 19 23:59
```

---

#### POST `/admin/curriculum/:id/assignment`

> Creates the assignment for a specific curriculum week.
> `Content-Type: multipart/form-data` (supports optional file upload for question doc)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | ✅ | |
| `description` | string | ✅ | Brief context shown above the question |
| `questionText` | string | optional | Type the question/instructions directly |
| `questionDoc` | File (.pdf / .docx) | optional | Upload a doc — text extracted + original stored for download |
| `allowedSubmissionTypes` | JSON string | optional | Defaults to all types |

> **Either `questionText` or `questionDoc` should be provided** (or both — typed text takes priority if both are given).

**`allowedSubmissionTypes` values:** `"pdf"`, `"doc"`, `"url"`, `"image"`, `"video"`, `"code"`

```json
{
  "title": "Build a landing page",
  "description": "Apply everything from Week 1.",
  "questionText": "Build a responsive landing page for a fictional Web3 product. It must include a hero section, features section, and a call-to-action. Submit your GitHub repository link.",
  "allowedSubmissionTypes": "[\"url\",\"pdf\",\"image\"]"
}
```

**Response `201`**
```json
{
  "id": "clxasgn001",
  "title": "Build a landing page",
  "description": "Apply everything from Week 1.",
  "questionText": "Build a responsive landing page...",
  "questionDocUrl": null,
  "allowedSubmissionTypes": "[\"url\",\"pdf\",\"image\"]",
  "curriculumId": "clxcur001",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "openAt": "2026-05-08T00:00:00.000Z",
  "closeAt": "2026-05-11T23:59:59.999Z",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

**Errors**
| Status | Message |
|--------|---------|
| `400` | `"title and description required"` |
| `404` | `"Curriculum week not found"` |
| `409` | `"Assignment already exists for this week..."` |

---

#### GET `/admin/assignments`

**Query params:** `?cohortId=` `?courseId=` (both optional). Tutors are auto-scoped to their course.

**Response `200`** — array of assignment objects, ordered by `openAt` descending.

---

#### PATCH `/admin/assignments/:id`

Edit an existing assignment. All fields optional.
`Content-Type: multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | |
| `description` | string | |
| `questionText` | string | Replaces existing question text |
| `questionDoc` | File | Re-uploads doc, re-extracts text |
| `allowedSubmissionTypes` | JSON string | Replaces existing types |

**Response `200`** — updated assignment object.

---

#### GET `/admin/assignments/:id/submissions`

Returns all student submissions for an assignment, **including grades and feedback**.

**Response `200`**
```json
[
  {
    "id": "clxsub001",
    "submissionType": "url",
    "contentUrl": "https://github.com/student/landing-page",
    "cloudinaryUrl": null,
    "submittedAt": "2026-05-09T18:30:00.000Z",
    "updatedAt": "2026-05-10T09:00:00.000Z",
    "grade": null,
    "feedback": null,
    "student": {
      "name": "Jane Okonkwo",
      "email": "jane@web3nova.org"
    }
  },
  {
    "id": "clxsub002",
    "submissionType": "pdf",
    "contentUrl": null,
    "cloudinaryUrl": "https://res.cloudinary.com/dvagunlxh/raw/upload/.../report.pdf",
    "submittedAt": "2026-05-10T14:00:00.000Z",
    "updatedAt": "2026-05-10T14:00:00.000Z",
    "grade": null,
    "feedback": null,
    "student": {
      "name": "Emeka Nwosu",
      "email": "emeka@web3nova.org"
    }
  }
]
```

---

#### PATCH `/admin/submissions/:id/grade`

```json
{
  "grade": 85,
  "feedback": "Good structure. Work on mobile responsiveness."
}
```

**Response `200`** — updated submission object.

> **Note:** Grades and feedback are **never shown to students** — only tutors and super admin can see them.

---

### Assessments (Admin)

Two assessment types:

```
┌──────────────────┬──────────────────────────────────────────────┐
│ type             │ How it works                                 │
├──────────────────┼──────────────────────────────────────────────┤
│ MCQ (Quiz/Test)  │ Questions displayed in frontend              │
│                  │ Student picks A/B/C/D per question           │
│                  │ Auto-marked on submit → score stored         │
│                  │ Score NEVER shown to student                 │
│                  │ Submission locked after first submit         │
├──────────────────┼──────────────────────────────────────────────┤
│ file_upload      │ Question text shown in frontend              │
│                  │ Student submits file/url/video/etc           │
│                  │ Tutor reviews and scores manually            │
│                  │ Student can edit before due date             │
└──────────────────┴──────────────────────────────────────────────┘
```

---

#### GET `/admin/assessments`

**Query params:** `?cohortId=` `?courseId=` (both optional). Tutors are auto-scoped to their course.

**Response `200`** — array of assessment objects, ordered by `dueDate` descending.

---

#### POST `/admin/assessments`

Creates an assessment shell. Add questions separately via PATCH or upload.

```json
{
  "title": "Week 3 Quiz",
  "type": "TEST",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "dueDate": "2026-05-21"
}
```

**Response `201`**
```json
{
  "id": "clxassmt001",
  "title": "Week 3 Quiz",
  "type": "TEST",
  "dueDate": "2026-05-21T00:00:00.000Z",
  "questions": "[]",
  "correctAnswers": "[]",
  "questionText": null,
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### PATCH `/admin/assessments/:id`

Manually set MCQ questions (JSON array).

```json
{
  "questions": [
    { "q": "What does HTML stand for?", "options": ["HyperText Markup Language", "High Tech Modern Language", "HyperText Modern Layout", "None of the above"] }
  ]
}
```

> `questions` is a JSON array where each item has `q` (question text) and `options` (array of 4 strings, A–D).
> The correct answer index is stored separately and never sent to students.

**Response `200`** — updated assessment object.

---

#### POST `/admin/assessments/:id/upload-questions`

**Upload a `.csv`, `.pdf`, or `.docx` file to auto-parse MCQ questions.**

`Content-Type: multipart/form-data`

| Field | Type |
|-------|------|
| `file` | `.csv` / `.pdf` / `.docx` |

**CSV format:**
```csv
question,option_a,option_b,option_c,option_d,correct
What does HTML stand for?,HyperText Markup Language,High Tech Modern Language,HyperText Modern Layout,None,A
What is CSS used for?,Styling web pages,Database management,Server scripting,Network routing,A
```

**PDF / DOCX format:**
```
Q: What does HTML stand for?
A: HyperText Markup Language
B: High Tech Modern Language
C: HyperText Modern Layout
D: None of the above
Answer: A

Q: What is CSS used for?
A: Styling web pages
B: Database management
C: Server scripting
D: Network routing
Answer: A
```

> Each question block must be separated by a blank line. `Answer:` must be `A`, `B`, `C`, or `D`.

**Response `200`**
```json
{
  "message": "12 questions loaded",
  "assessment": { "id": "clxassmt001", "questions": "[...]", "..." : "..." }
}
```

**Errors**
| Status | Message |
|--------|---------|
| `400` | `"Unsupported file type. Use .csv, .pdf, or .docx"` |
| `400` | `"Row 3: missing required columns..."` |
| `400` | `"No valid questions found. Check the format..."` |

---

#### POST `/admin/assessments/:id/paper`

For `file_upload` type assessments — upload a question paper PDF to Cloudinary.
Students see a download link + can read `questionText` if set.

`Content-Type: multipart/form-data`

| Field | Type |
|-------|------|
| `file` | PDF or any format |

**Response `200`** — updated assessment with `questions: '{"paperUrl":"https://..."}'`

---

#### GET `/admin/assessments/:id/results`

Returns all student results, **including scores** (hidden from students).

**Response `200`**
```json
[
  {
    "id": "clxres001",
    "submissionType": "file",
    "cloudinaryUrl": null,
    "contentUrl": null,
    "answers": "{\"0\":\"A\",\"1\":\"A\"}",
    "score": 83,
    "submittedAt": "2026-05-14T11:00:00.000Z",
    "student": {
      "name": "Jane Okonkwo",
      "email": "jane@web3nova.org"
    }
  }
]
```

> For MCQ: `score` is auto-calculated as a percentage (0–100).
> For file_upload: `score` is `null` until tutor sets it manually.

---

#### PATCH `/admin/assessments/results/:id/score`

Manually set score for a file_upload assessment result.

```json
{ "score": 78 }
```

**Response `200`** — updated result object.

---

### Admins / Tutors

> Super admin only.

#### POST `/admin/admins`

Default password = first name lowercase.

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
  "id": "clxabc123",
  "name": "Tunde Adeyemi",
  "email": "tunde@web3nova.org",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

---

#### DELETE `/admin/admins/:id`

> Super admin only.

**Response `200`** `{ "message": "Deleted" }`

---

#### GET `/admin/admins`

> Super admin only. Returns all admin/tutor accounts.

**Response `200`**
```json
[
  {
    "id": "clxabc123",
    "name": "Tunde Adeyemi",
    "email": "tunde@web3nova.org",
    "courseId": "clx9z8y7x6w5v4u3t2s1",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
]
```

---

### Students

#### POST `/admin/students`

Default password = first name lowercase.

```json
{
  "name": "Jane Okonkwo",
  "email": "jane@web3nova.org",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1"
}
```

**Response `201`** — student object (no password).

---

#### POST `/admin/students/bulk`

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
  "created": [{ "id": "clxstu001", "name": "Jane Okonkwo", "email": "jane@web3nova.org" }],
  "failed":  [{ "name": "Dupe User", "email": "dupe@web3nova.org", "reason": "Unique constraint failed on email" }]
}
```

---

#### GET `/admin/students`

**Query params:** `?cohortId=` (optional). Tutors only see their course students.

**Response `200`** — array of student objects.

---

#### DELETE `/admin/students/:id`

Tutors can only delete students from their own course.

**Response `200`** `{ "message": "Deleted" }`

---

### Materials

#### POST `/admin/materials`

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `file` | File | Any format, max 50MB |
| `title` | string | Display name |
| `type` | string | `pdf`, `video`, `slide`, `link`, etc. |
| `cohortId` | string | |
| `courseId` | string | |
| `curriculumId` | string | **Optional.** Attach to a specific curriculum week |

> If `curriculumId` is provided, the material appears under that week in the curriculum view.
> If omitted, it appears in the general course materials list.

**Response `201`**
```json
{
  "id": "clxmat001",
  "title": "Week 1 Slides",
  "cloudinaryUrl": "https://res.cloudinary.com/dvagunlxh/raw/upload/...",
  "publicId": "academic-portal/materials/week1",
  "type": "pdf",
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "curriculumId": "clxcur001",
  "uploadedAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### DELETE `/admin/materials/:id`

**Response `200`** `{ "message": "Deleted" }` — also deletes from Cloudinary.

---

#### GET `/admin/materials`

**Query params:** `?cohortId=` `?courseId=` (both optional). Tutors are auto-scoped to their course.

**Response `200`** — array of material objects, ordered by `createdAt` descending.

---

### Attendance

#### POST `/admin/attendance/sessions`

Opens a new session. Any previously active session for the same cohort + course is automatically closed.

```json
{
  "cohortId": "clx1a2b3c4d5e6f7g8h9",
  "courseId": "clx9z8y7x6w5v4u3t2s1",
  "date": "2026-05-07",
  "allowedIp": "192.168.1.1"
}
```

**Response `201`** — session object with `"active": true`.

> `allowedIp` must match the network IP students will check in from. Students not on this IP are rejected.

---

#### PATCH `/admin/attendance/sessions/:id/close`

**Response `200`** — session object with `"active": false`.

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

**Response `200`** — array of attendance records with student name/email included.

---

## Student Routes

**Prefix:** `/student` · Requires `STUDENT` role JWT.

All endpoints are **automatically scoped** to the student's `cohortId` and `courseId` from the token. No filtering params needed.

---

### Curriculum (Student)

#### GET `/student/curriculum`

Returns all 12 curriculum weeks with week-specific materials and assignment window info.
**Grades and scores are never included in this response.**

**Response `200`**
```json
[
  {
    "id": "clxcur001",
    "week": 1,
    "title": "Intro to Web Development",
    "description": "HTML, CSS fundamentals and the browser rendering model.",
    "materials": [
      {
        "id": "clxmat001",
        "title": "Week 1 Slides",
        "cloudinaryUrl": "https://res.cloudinary.com/...",
        "type": "pdf"
      }
    ],
    "assignment": {
      "id": "clxasgn001",
      "title": "Build a landing page",
      "openAt": "2026-05-08T00:00:00.000Z",
      "closeAt": "2026-05-11T23:59:59.999Z"
    }
  }
]
```

> **UX note:** Use `openAt` and `closeAt` to show the submission window badge on each week card.
> If `assignment` is `null`, no assignment was set for that week.

---

### Assignments (Student)

#### GET `/student/assignments`

Returns **only currently open assignments** — those where `openAt ≤ now ≤ closeAt`.

```
Friday 00:00 ──────────── open ──────────── Monday 23:59
                    │ students can submit │
                         and re-submit
```

**Response `200`**
```json
[
  {
    "id": "clxasgn001",
    "title": "Build a landing page",
    "description": "Apply everything from Week 1.",
    "openAt": "2026-05-08T00:00:00.000Z",
    "closeAt": "2026-05-11T23:59:59.999Z"
  }
]
```

> If no assignments are currently open, returns `[]`. Students see the window on their curriculum view, but cannot submit outside it.

---

#### GET `/student/assignments/:id`

> Fetch full assignment details including question text and allowed submission types.

**Response `200`**
```json
{
  "id": "clxasgn001",
  "title": "Build a landing page",
  "description": "Apply everything from Week 1.",
  "questionText": "Build a responsive landing page for a fictional Web3 product. Include a hero section, features section, and a call-to-action. Submit your GitHub repository link.",
  "questionDocUrl": "https://res.cloudinary.com/.../question.pdf",
  "allowedSubmissionTypes": "[\"url\",\"pdf\",\"image\"]",
  "openAt": "2026-05-08T00:00:00.000Z",
  "closeAt": "2026-05-11T23:59:59.999Z"
}
```

> **UX note:**
> - Show `questionText` as the main question body.
> - If `questionDocUrl` is set, show a download button alongside (student can read the original doc).
> - Parse `allowedSubmissionTypes` with `JSON.parse()` to render only the allowed submission options.

---

#### POST `/student/assignments/:id/submit`

`Content-Type: multipart/form-data`

**Submission type determines what fields to send:**

| `submissionType` | Send | Notes |
|-----------------|------|-------|
| `pdf` | `file` (File) | Max 20MB |
| `doc` | `file` (File) | Max 20MB |
| `image` | `file` (File) | Max 20MB |
| `code` | `file` (File) | Max 20MB |
| `video` | `file` (File) | Max **50MB** |
| `url` | `contentUrl` (string) | GitHub, Figma, YouTube, etc. |

| Field | Type | Notes |
|-------|------|-------|
| `submissionType` | string | **Required.** One of the allowed types |
| `file` | File | Required for non-url types |
| `contentUrl` | string | Required for `url` type |

**First submission → `201`**
```json
{ "message": "Submitted successfully" }
```

**Re-submission within open window → `200`** (replaces previous)
```json
{ "message": "Submission updated" }
```

> **Edit rule:** Students can re-submit as many times as they want **while the window is open** (Friday–Monday). After `closeAt`, the window is locked and no further submissions are accepted.
> Previous Cloudinary file is deleted automatically on re-submit.

**Errors**
| Status | Message |
|--------|---------|
| `400` | `"submissionType required"` |
| `400` | `"Submission type 'video' is not allowed for this assignment"` |
| `400` | `"File too large. Max size: 50MB"` |
| `403` | `"Assignment is not open for submission"` |
| `404` | `"Assignment not found"` |

---

### Assessments (Student)

#### GET `/student/assessments`

**Query params:** `?type=TEST` or `?type=EXAM` (optional)

Questions are **not** returned here — fetch them via the single endpoint.

**Response `200`**
```json
[
  {
    "id": "clxassmt001",
    "title": "Week 3 Quiz",
    "type": "TEST",
    "dueDate": "2026-05-21T00:00:00.000Z",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
]
```

---

#### GET `/student/assessments/:id`

Returns full assessment. Parse `questions` to determine the mode.

**Response `200`**
```json
{
  "id": "clxassmt001",
  "title": "Week 3 Quiz",
  "type": "TEST",
  "dueDate": "2026-05-21T00:00:00.000Z",
  "questions": "[{\"q\":\"What does HTML stand for?\",\"options\":[\"HyperText Markup Language\",\"High Tech\",\"HyperText Modern\",\"None\"]}]",
  "questionText": null
}
```

**How to determine the assessment mode on the frontend:**

```
questions = JSON.parse(assessment.questions)

if (questions?.paperUrl)          → mode: "file_upload"  (show download + submission form)
else if (Array.isArray(questions)) → mode: "mcq"          (show radio button questions)
else                               → mode: "empty"        (questions not set yet)
```

> `correctAnswers` is **never returned** to students — it is server-side only.

---

#### POST `/student/assessments/:id/submit`

**For MCQ assessments only.**

```json
{
  "answers": {
    "0": "A",
    "1": "C",
    "2": "A"
  }
}
```

> Keys are question indexes (as strings). Values are `"A"`, `"B"`, `"C"`, or `"D"`.

**Response `201`**
```json
{ "message": "Submitted successfully" }
```

> **MCQ rules:**
> - Auto-marked immediately on submit. Score stored server-side.
> - Score is **never shown to students**.
> - **No re-submission allowed.** Once submitted, MCQ is permanently locked.

**Errors**
| Status | Message |
|--------|---------|
| `400` | `"answers required"` |
| `403` | `"Not in your cohort"` |
| `409` | `"Already submitted"` |

---

#### POST `/student/assessments/:id/submit-file`

**For file_upload assessments only.**

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `submissionType` | string | `pdf`, `doc`, `url`, `image`, `video`, `code` |
| `file` | File | Required for non-url types. Max 20MB (50MB for video) |
| `contentUrl` | string | Required for `url` type |

**First submission → `201`**
```json
{ "message": "Submitted successfully" }
```

**Re-submission before due date → `200`**
```json
{ "message": "Submission updated" }
```

> **Edit rule:** Students can update their file_upload submission any time before `dueDate`.
> After `dueDate`, re-submission is blocked with `403`.

**Errors**
| Status | Message |
|--------|---------|
| `403` | `"Due date has passed — submission cannot be edited"` |
| `409` | `"Already submitted"` (first submit only before re-submit logic) |

---

### Materials (Student)

#### GET `/student/materials`

Returns all course-level materials (those without a `curriculumId`).
Week-specific materials are returned via `GET /student/curriculum`.

**Response `200`** — array of material objects.

---

### Attendance (Student)

#### POST `/student/attendance/check-in`

No body. IP is validated server-side.

**Response `201`**
```json
{
  "message": "Checked in successfully",
  "record": {
    "id": "clxatt001",
    "date": "2026-05-07T00:00:00.000Z",
    "status": "PRESENT",
    "ip": "192.168.1.45"
  }
}
```

**Errors**
| Status | Message |
|--------|---------|
| `404` | `"No active attendance session for your cohort"` |
| `403` | `"You must be on the class network to check in"` |
| `409` | `"Already checked in for this session"` |

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

### Grades

#### GET `/student/grades`

Returns submission history. **Grades and scores are intentionally excluded** — only tutors can see them.

**Response `200`**
```json
{
  "assignments": [
    {
      "id": "clxsub001",
      "submittedAt": "2026-05-09T18:30:00.000Z",
      "assignment": {
        "title": "Build a landing page",
        "openAt": "2026-05-08T00:00:00.000Z",
        "closeAt": "2026-05-11T23:59:59.999Z"
      }
    }
  ],
  "assessments": [
    {
      "id": "clxres001",
      "submittedAt": "2026-05-14T11:00:00.000Z",
      "assessment": {
        "title": "Week 3 Quiz",
        "type": "TEST"
      }
    }
  ]
}
```

> **UX note:** Show this as a submission history — "Submitted ✓" with the timestamp. Do not show grade or score fields to students anywhere in the UI.

---

## UX Design Notes

### Cohort Setup (Super Admin)

```
Step 1  POST /admin/cohorts
        → set name, startDate, endDate

Step 2  POST /admin/courses  (×5 or however many)
        → one per track

Step 3  POST /admin/curriculum/seed/:cohortId/:courseId
        → generates Week 1–12 automatically

Step 4  For each week:
        PATCH /admin/curriculum/:id          → set title + description
        POST  /admin/curriculum/:id/assignment → set assignment
        POST  /admin/materials               → upload materials (with curriculumId)

Step 5  POST /admin/admins   → assign tutors to courses
        POST /admin/students/bulk → enroll students
```

---

### Assignment Submission Flow (Student UX)

```
Student opens Week card
  │
  ├── Sees: Week title, description, week-specific materials
  │
  ├── Sees assignment (if exists):
  │     Title, question text, optional "Download Question Doc" button
  │     Submission window badge: "Open — closes Monday 23:59"
  │
  └── If window is OPEN:
        Show submission form:
          ┌──────────────────────────────────┐
          │ How would you like to submit?    │
          │  ○ GitHub / URL link             │
          │  ○ PDF document                  │
          │  ○ Image(s)                      │
          │  ○ Video (max 50MB)              │
          │  ○ Code file                     │
          └──────────────────────────────────┘
          (Only show options from allowedSubmissionTypes)

          After submit → "Submitted ✓ — you can update this until Monday 23:59"
          After closeAt → "Submission window closed"
```

---

### MCQ Assessment Flow (Student UX)

```
Student opens assessment
  │
  ├── Sees: Title, due date, question count
  │
  ├── Reads each question, selects A/B/C/D
  │
  ├── Clicks "Submit Answers"
  │
  ├── Response: "Submitted successfully"
  │
  └── ⚠️  NO score shown. NO re-submission.
        Show: "Your answers have been recorded. Results will be released by your tutor."
```

---

### File Upload Assessment Flow (Student UX)

```
Student opens assessment
  │
  ├── Sees: questionText (instructions rendered in-page)
  ├── Optional: "Download Question Paper" button (if paperUrl set)
  │
  ├── Submission form with type selector (same as assignments)
  │
  ├── After submit → "Submitted ✓ — you can update this before [dueDate]"
  │
  └── After dueDate → locked, no edit
```

---

### What Students Can and Cannot See

| Item | Student sees |
|------|-------------|
| Curriculum weeks | ✅ Title, description, materials, assignment window |
| Assignment question | ✅ `questionText` + download link for `questionDocUrl` |
| Assignment grade | ❌ Never |
| Assignment feedback | ❌ Never |
| MCQ questions | ✅ Options only (no correct answers) |
| MCQ score | ❌ Never |
| File-upload assessment question | ✅ `questionText` |
| Assessment result score | ❌ Never |
| Other students' submissions | ❌ Never |

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

| Field | Notes |
|-------|-------|
| `role` | `"STUDENT"` or `"ADMIN"` — use to decide which dashboard to render |
| `courseId` | `null` for super admin, set for tutors and students |
| `cohortId` | `null` for admins, set for students |
| Expiry | 7 days from login |

---

## Error Format

All errors return this shape:

```json
{ "error": "human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid fields |
| `401` | No token / expired / invalid token |
| `403` | Valid token but insufficient permissions or window closed |
| `404` | Resource not found |
| `409` | Conflict — duplicate, already submitted, already checked in |
| `429` | Rate limited (login endpoint) |
| `500` | Server error — check Render logs |
