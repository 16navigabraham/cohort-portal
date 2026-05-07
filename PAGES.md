# Academic Portal — Frontend Pages

This document describes every page/screen the frontend needs to build, organized by role. Use `API.md` for the exact request/response shapes.

---

## How Auth Works

- Every user logs in through the same login page (`POST /auth/login`).
- The JWT response includes `role` (`STUDENT` or `ADMIN`) and `courseId` (null for super admin).
- After login, redirect based on role:
  - `role === "ADMIN"` and `courseId === null` → Super Admin dashboard
  - `role === "ADMIN"` and `courseId !== null` → Course Admin dashboard
  - `role === "STUDENT"` → Student dashboard
- Store the token in `localStorage` or an http-only cookie. Attach it to every request as `Authorization: Bearer <token>`.
- Token expires in 7 days. On `401`, clear token and redirect to login.

---

## 1. Login Page

**Route:** `/login` (public)

**What's on the page:**
- Email field
- Password field
- Submit button
- Error message area (shows API error text)

**Behaviour:**
- On submit, call `POST /auth/login`.
- On success, save the token + user object, then redirect based on role (see above).
- Default password for everyone is their first name in lowercase (show a small hint below the form: "First-time login? Your password is your first name, lowercase.").

---

---

## 2. Super Admin

Super admin has `courseId: null` in their token. They can see and manage everything across all cohorts and courses.

---

### 2.1 Super Admin Dashboard (Overview)

**Route:** `/admin`

**What's on the page:**
- Summary cards:
  - Total cohorts (with count of students across all cohorts)
  - Total active courses
  - Total students
- List of cohorts — each row shows cohort name, dates, student count, course count, and a **View** button that goes to the cohort detail page.
- "Create Cohort" button → opens create cohort form (or navigates to create page).

**API calls:**
- `GET /admin/cohorts` — load all cohorts with counts.

---

### 2.2 Create Cohort

**Route:** `/admin/cohorts/new` (or a modal on the dashboard)

**What's on the page:**
- Cohort name field (e.g. "Cohort III")
- Start date picker
- End date picker
- Submit button

**After submit:**
- Call `POST /admin/cohorts`.
- On success, optionally call `POST /admin/courses/seed/:cohortId` automatically to create all 5 standard courses in one shot.
- Redirect to the new cohort's detail page.

---

### 2.3 Cohort Detail Page

**Route:** `/admin/cohorts/:cohortId`

**What's on the page:**
- Cohort name and date range at the top.
- Tabs or sections:

  **Courses tab**
  - List of courses in this cohort (name, student count, tutor name).
  - "Add Course" button (for custom courses beyond the 5 defaults).
  - Each course row has a **View Course** link → goes to Course Detail page.

  **Students tab**
  - Table of all students in this cohort: name, email, course they're in.
  - "Add Student" button → opens single-student form.
  - "Bulk Upload" button → opens bulk upload form.

  **Admins tab**
  - List of course admins (tutors) assigned to this cohort's courses.
  - "Add Tutor" button → opens create-admin form.

**API calls:**
- `GET /admin/courses?cohortId=:cohortId`
- `GET /admin/students?cohortId=:cohortId`

---

### 2.4 Add Single Student (form)

**Can appear as:** a modal or sub-page under the cohort detail.

**What's on the page:**
- Name field
- Email field
- Cohort selector (pre-filled if coming from cohort detail)
- Course selector (loads courses for the selected cohort)
- Submit button

**API calls:**
- `POST /admin/students`

---

### 2.5 Bulk Add Students

**Can appear as:** a modal or sub-page under the cohort detail.

**What's on the page:**
- Cohort selector (pre-filled if coming from cohort detail)
- Course selector
- A table/textarea where the admin pastes or types multiple students — each row has a name field and email field. Or: a CSV import button that parses the CSV and fills the table.
- Submit button

**Behaviour:**
- On submit, call `POST /admin/students/bulk`.
- Response includes `created` (success list) and `failed` (with reason). Show both to the admin.

---

### 2.6 Add Course Admin (Tutor)

**Can appear as:** a modal or sub-page.

**What's on the page:**
- Name field
- Email field
- Course selector (which course they teach)
- Submit button (default password = first name lowercase — display this as a note)

**API calls:**
- `POST /admin/admins`
- `GET /admin/courses` (to populate course dropdown)

---

### 2.7 Course Detail Page (Super Admin View)

**Route:** `/admin/courses/:courseId`

Super admin sees this page for any course.

**What's on the page:**
- Course name and cohort name at the top.
- Same tabs as Course Admin sees (see section 3 below), but with full edit access.

---

---

## 3. Course Admin (Tutor)

Course admin has a non-null `courseId` in their token. They only see data for their assigned course.

---

### 3.1 Course Admin Dashboard

**Route:** `/admin` (same route, different content based on courseId)

**What's on the page:**
- Course name and cohort name at the top (pull from JWT or a `/admin/courses` call).
- Summary cards:
  - Student count in their course
  - Open assignments (not yet past due date)
  - Upcoming assessments
- Quick links to each section below.

---

### 3.2 Students Page

**Route:** `/admin/students`

**What's on the page:**
- Table of students in their course: name, email.
- Course admin cannot add or remove students (super admin only).

**API calls:**
- `GET /admin/students` — returns only their course's students automatically.

---

### 3.3 Materials Page

**Route:** `/admin/materials`

**What's on the page:**
- List of uploaded materials: title, type (pdf/video/slide), upload date, download/view link.
- "Upload Material" button → opens upload form.
- Delete button on each row.

**Upload form fields:**
- Title
- Type (dropdown: pdf, video, slide, or free text)
- File picker (any format)
- Cohort and course are taken from the admin's JWT — no need for selectors.

**API calls:**
- `POST /admin/materials` (multipart/form-data)
- `DELETE /admin/materials/:id`

---

### 3.4 Attendance Page

**Route:** `/admin/attendance`

**What's on the page:**

**Sessions panel (top)**
- List of past sessions: date, how many students attended, whether it's open or closed.
- "Open New Session" button → form to create a session.
- Each active session has a "Close Session" button.

**Open session form:**
- Date picker (defaults to today)
- Allowed IP field (the classroom network IP the students must be on to check in)

**Records panel (below)**
- When the admin clicks a session row, show all attendance records for that session: student name, IP, status (PRESENT), timestamp.
- Summary: e.g. "23 / 40 students present".

**API calls:**
- `POST /admin/attendance/sessions`
- `PATCH /admin/attendance/sessions/:id/close`
- `GET /admin/attendance/sessions`
- `GET /admin/attendance?sessionId=:id`

---

### 3.5 Assignments Page

**Route:** `/admin/assignments`

**What's on the page:**
- List of assignments: title, due date, submission count.
- "Create Assignment" button → form.
- Each assignment row has a **View Submissions** link.

**Create assignment form:**
- Title
- Description (textarea)
- Due date picker

**Submissions view (per assignment):**
- Table: student name, submitted at, file link (Cloudinary URL), grade, feedback.
- Each row has a "Grade" button → opens inline grade form.

**Grade form:**
- Score field (number)
- Feedback textarea
- Submit → calls `PATCH /admin/submissions/:id/grade`

**API calls:**
- `POST /admin/assignments`
- `GET /admin/assignments/:id/submissions`
- `PATCH /admin/submissions/:id/grade`

---

### 3.6 Assessments Page

**Route:** `/admin/assessments`

**What's on the page:**
- List of assessments: title, type (TEST/EXAM), due date.
- "Create Assessment" button → form.
- Each row has a **View Results** link.

**Create assessment form:**
- Title
- Type selector (TEST or EXAM)
- Due date picker
- Questions builder:
  - Each question has: question text, 4 options, correct answer selector.
  - "Add Question" button appends a new question row.
  - Minimum 1 question required.

**Results view (per assessment):**
- Table: student name, submitted at, score (or "Not graded yet").
- Each row has a "Set Score" button → opens score form.

**Score form:**
- Score field (number)
- Submit → calls `PATCH /admin/assessments/results/:id/score`

**API calls:**
- `POST /admin/assessments`
- `GET /admin/assessments/:id/results`
- `PATCH /admin/assessments/results/:id/score`

---

---

## 4. Student

Students have both `cohortId` and `courseId` in their token. All `/student/*` endpoints are automatically scoped — the student never needs to select their cohort or course.

---

### 4.1 Student Dashboard

**Route:** `/student`

**What's on the page:**
- Welcome banner with student name.
- Quick stats:
  - Attendance percentage (calculate from attendance records: PRESENT / total sessions).
  - Pending assignments (due date not yet passed, not yet submitted).
  - Upcoming assessments.
- Navigation to each section.

**API calls:**
- `GET /student/attendance` — to compute attendance stats.
- `GET /student/assignments` — to count pending.
- `GET /student/assessments` — to list upcoming.

---

### 4.2 Materials Page

**Route:** `/student/materials`

**What's on the page:**
- List of materials uploaded for their course: title, type, upload date.
- Each material has a **View / Download** button that opens the Cloudinary URL.
- No upload capability — students only view.

**API calls:**
- `GET /student/materials`

---

### 4.3 Attendance Page

**Route:** `/student/attendance`

**What's on the page:**
- Attendance summary at the top: "X out of Y sessions attended" (percentage).
- Table of sessions: date, status (PRESENT / ABSENT — absent if the session exists but no record for this student).
- "Check In" button — only shown when there's an active session. On click, calls check-in with no body. The server validates their IP.

**Check-in behaviour:**
- On `201` → show success message "Checked in successfully".
- On `403` → show "You must be connected to the class network to check in."
- On `409` → show "You've already checked in for this session."
- On `404` → show "No class is currently in session."

**API calls:**
- `GET /student/attendance`
- `POST /student/attendance/check-in`

---

### 4.4 Assignments Page

**Route:** `/student/assignments`

**What's on the page:**
- List of assignments: title, description, due date, submission status (Submitted / Not submitted).
- Each assignment has a **Submit** button (disabled if already submitted or past due date).

**Submit form (per assignment):**
- File picker — any file type.
- Submit button → calls `POST /student/assignments/:id/submit`.
- On success, show the Cloudinary file URL as a link so the student can confirm their file uploaded correctly.

**API calls:**
- `GET /student/assignments`
- `POST /student/assignments/:id/submit` (multipart/form-data)

---

### 4.5 Assessments Page

**Route:** `/student/assessments`

**What's on the page:**
- List of assessments: title, type (Test/Exam), due date, submission status.
- Each assessment has a **Start** button (disabled if already submitted or past due date).

**Assessment attempt view:**
- Loaded when student clicks Start on an assessment.
- Calls `GET /student/assessments/:id` to get questions.
- Parse `questions` field with `JSON.parse()`.
- Render each question with its options as radio buttons or dropdown.
- "Submit Answers" button at the bottom.
- On submit, call `POST /student/assessments/:id/submit` with `{ answers: { "0": "chosen", "1": "chosen" } }`.
- After submit, show "Answers submitted. Results will be available after grading."

**Important:** Do not show the correct answers from the questions JSON to the student during or after the attempt. Only show their score once it's been graded (non-null score from the grades endpoint).

**API calls:**
- `GET /student/assessments`
- `GET /student/assessments/:id`
- `POST /student/assessments/:id/submit`

---

### 4.6 Grades Page

**Route:** `/student/grades`

**What's on the page:**
- Two sections: **Assignments** and **Assessments**.

**Assignments section:**
- Table: assignment title, submitted at, grade (or "Pending"), feedback (or "—").
- Each row has a link to view the submitted file (Cloudinary URL).

**Assessments section:**
- Table: assessment title, type, submitted at, score (or "Pending").

**API calls:**
- `GET /student/grades`

---

---

## 5. Shared / Utility Pages

### 5.1 404 Page

Show when no route matches. "Page not found" with a back button.

### 5.2 Unauthorized Page

Show on `401` or when a user tries to access a route outside their role. "You don't have access to this page." with a logout button.

### 5.3 Change Password (optional, future)

Not in current API. Students and admins use their default passwords for now. Add this page when the API supports it.

---

## Role → Page Map (Quick Reference)

| Page | Super Admin | Course Admin | Student |
|------|:-----------:|:------------:|:-------:|
| Login | ✓ | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ✓ |
| Cohorts list + create | ✓ | — | — |
| Cohort detail | ✓ | — | — |
| Add student (single) | ✓ | — | — |
| Bulk add students | ✓ | — | — |
| Add course admin | ✓ | — | — |
| Students list | ✓ (all) | ✓ (own course) | — |
| Materials (upload + delete) | ✓ | ✓ | — |
| Materials (view) | ✓ | ✓ | ✓ |
| Attendance (open/close session) | ✓ | ✓ | — |
| Attendance (view records) | ✓ | ✓ | — |
| Attendance (check in) | — | — | ✓ |
| Assignments (create + grade) | ✓ | ✓ | — |
| Assignments (submit) | — | — | ✓ |
| Assessments (create + score) | ✓ | ✓ | — |
| Assessments (attempt) | — | — | ✓ |
| Grades | — | — | ✓ |
