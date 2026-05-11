const bearerAuth = {
  BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
}

const secured = [{ BearerAuth: [] }]

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Academic Portal API',
    version: '1.0.0',
    description:
      'Web3Nova cohort portal — auth, admin, and student endpoints. ' +
      'Login first to get a JWT, then click **Authorize** and paste it.',
  },
  servers: [
    { url: 'http://localhost:3012', description: 'Local' },
    { url: 'https://cohort-portal-cmhj.onrender.com', description: 'Production' },
  ],
  components: {
    securitySchemes: bearerAuth,
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  tags: [
    { name: 'Auth' },
    { name: 'Admin — Cohorts' },
    { name: 'Admin — Courses' },
    { name: 'Admin — Curriculum' },
    { name: 'Admin — Assignments' },
    { name: 'Admin — Assessments' },
    { name: 'Admin — Admins' },
    { name: 'Admin — Students' },
    { name: 'Admin — Materials' },
    { name: 'Admin — Attendance' },
    { name: 'Student — Curriculum' },
    { name: 'Student — Assignments' },
    { name: 'Student — Assessments' },
    { name: 'Student — Materials' },
    { name: 'Student — Attendance' },
    { name: 'Student — Grades' },
  ],
  paths: {

    // ── Auth ────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login (all roles)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email:    { type: 'string', example: 'john.doe@web3nova.org' },
                  password: { type: 'string', example: 'john' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT token + user object' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limited' },
        },
      },
    },

    // ── Cohorts ─────────────────────────────────────────────────
    '/admin/cohorts': {
      get: {
        tags: ['Admin — Cohorts'],
        summary: 'List cohorts',
        security: secured,
        responses: { 200: { description: 'Array of cohorts with student/course counts' } },
      },
      post: {
        tags: ['Admin — Cohorts'],
        summary: 'Create cohort (super admin)',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'startDate', 'endDate'],
                properties: {
                  name:      { type: 'string', example: 'Cohort III' },
                  startDate: { type: 'string', format: 'date', example: '2026-05-07' },
                  endDate:   { type: 'string', format: 'date', example: '2026-08-07' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created cohort' }, 403: { description: 'Super admin only' } },
      },
    },

    // ── Courses ─────────────────────────────────────────────────
    '/admin/courses': {
      get: {
        tags: ['Admin — Courses'],
        summary: 'List courses',
        security: secured,
        parameters: [
          { name: 'cohortId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of courses with counts' } },
      },
      post: {
        tags: ['Admin — Courses'],
        summary: 'Create course (super admin)',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'cohortId'],
                properties: {
                  name:     { type: 'string', example: 'Web Development' },
                  cohortId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created course' }, 403: { description: 'Super admin only' } },
      },
    },
    '/admin/courses/{id}': {
      delete: {
        tags: ['Admin — Courses'],
        summary: 'Delete course (super admin)',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Curriculum ───────────────────────────────────────────────
    '/admin/curriculum': {
      get: {
        tags: ['Admin — Curriculum'],
        summary: 'List curriculum weeks',
        security: secured,
        parameters: [
          { name: 'cohortId', in: 'query', schema: { type: 'string' } },
          { name: 'courseId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Weeks with assignment and materials' } },
      },
    },
    '/admin/curriculum/seed/{cohortId}/{courseId}': {
      post: {
        tags: ['Admin — Curriculum'],
        summary: 'Seed 12 weeks for a course (super admin)',
        security: secured,
        parameters: [
          { name: 'cohortId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 201: { description: 'Array of 12 curriculum week objects' } },
      },
    },
    '/admin/curriculum/{id}': {
      patch: {
        tags: ['Admin — Curriculum'],
        summary: 'Update week title / description',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title:       { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated week' } },
      },
    },

    // ── Assignments (admin) ──────────────────────────────────────
    '/admin/assignments': {
      get: {
        tags: ['Admin — Assignments'],
        summary: 'List assignments',
        security: secured,
        parameters: [
          { name: 'cohortId', in: 'query', schema: { type: 'string' } },
          { name: 'courseId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of assignments ordered by openAt desc' } },
      },
    },
    '/admin/curriculum/{id}/assignment': {
      post: {
        tags: ['Admin — Assignments'],
        summary: 'Create assignment for a curriculum week',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Curriculum week ID' }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title', 'description'],
                properties: {
                  title:                  { type: 'string' },
                  description:            { type: 'string' },
                  questionText:           { type: 'string' },
                  questionDoc:            { type: 'string', format: 'binary' },
                  allowedSubmissionTypes: { type: 'string', example: '["url","pdf","image"]' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created assignment' }, 409: { description: 'Already exists for this week' } },
      },
    },
    '/admin/assignments/{id}': {
      patch: {
        tags: ['Admin — Assignments'],
        summary: 'Update assignment',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  title:                  { type: 'string' },
                  description:            { type: 'string' },
                  questionText:           { type: 'string' },
                  questionDoc:            { type: 'string', format: 'binary' },
                  allowedSubmissionTypes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated assignment' } },
      },
    },
    '/admin/assignments/{id}/submissions': {
      get: {
        tags: ['Admin — Assignments'],
        summary: 'List submissions for an assignment',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Submissions with student info, grades, feedback' } },
      },
    },
    '/admin/submissions/{id}/grade': {
      patch: {
        tags: ['Admin — Assignments'],
        summary: 'Set grade and feedback on a submission',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['grade'],
                properties: {
                  grade:    { type: 'number', example: 85 },
                  feedback: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated submission' } },
      },
    },

    // ── Assessments (admin) ──────────────────────────────────────
    '/admin/assessments': {
      get: {
        tags: ['Admin — Assessments'],
        summary: 'List assessments',
        security: secured,
        parameters: [
          { name: 'cohortId', in: 'query', schema: { type: 'string' } },
          { name: 'courseId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of assessments ordered by dueDate desc' } },
      },
      post: {
        tags: ['Admin — Assessments'],
        summary: 'Create assessment',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'type', 'cohortId', 'courseId', 'dueDate'],
                properties: {
                  title:    { type: 'string', example: 'Week 3 Quiz' },
                  type:     { type: 'string', enum: ['TEST', 'EXAM'], example: 'TEST' },
                  cohortId: { type: 'string' },
                  courseId: { type: 'string' },
                  dueDate:  { type: 'string', format: 'date', example: '2026-05-21' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created assessment with empty questions' } },
      },
    },
    '/admin/assessments/{id}': {
      patch: {
        tags: ['Admin — Assessments'],
        summary: 'Set MCQ questions manually',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  questions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        q:       { type: 'string' },
                        options: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated assessment' } },
      },
    },
    '/admin/assessments/{id}/upload-questions': {
      post: {
        tags: ['Admin — Assessments'],
        summary: 'Auto-parse MCQ questions from CSV / PDF / DOCX',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { 200: { description: 'N questions loaded' }, 400: { description: 'Parse error' } },
      },
    },
    '/admin/assessments/{id}/paper': {
      post: {
        tags: ['Admin — Assessments'],
        summary: 'Upload question paper (file_upload assessments)',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Assessment with paperUrl set' } },
      },
    },
    '/admin/assessments/{id}/results': {
      get: {
        tags: ['Admin — Assessments'],
        summary: 'List student results for an assessment',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Results with student names, scores' } },
      },
    },
    '/admin/assessments/results/{id}/score': {
      patch: {
        tags: ['Admin — Assessments'],
        summary: 'Set score on a file-upload result',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['score'],
                properties: { score: { type: 'number', example: 78 } },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated result' } },
      },
    },

    // ── Admins ───────────────────────────────────────────────────
    '/admin/admins': {
      get: {
        tags: ['Admin — Admins'],
        summary: 'List admins/tutors (super admin)',
        security: secured,
        responses: { 200: { description: 'Array of admin accounts' } },
      },
      post: {
        tags: ['Admin — Admins'],
        summary: 'Create tutor account (super admin)',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'courseId'],
                properties: {
                  name:     { type: 'string', example: 'Tunde Adeyemi' },
                  email:    { type: 'string', example: 'tunde@web3nova.org' },
                  courseId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created admin (default password = first name lowercase)' } },
      },
    },
    '/admin/admins/{id}': {
      delete: {
        tags: ['Admin — Admins'],
        summary: 'Delete admin (super admin)',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Students ─────────────────────────────────────────────────
    '/admin/students': {
      get: {
        tags: ['Admin — Students'],
        summary: 'List students',
        security: secured,
        parameters: [{ name: 'cohortId', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Array of students (tutors scoped to their course)' } },
      },
      post: {
        tags: ['Admin — Students'],
        summary: 'Add single student',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'cohortId', 'courseId'],
                properties: {
                  name:     { type: 'string', example: 'Jane Okonkwo' },
                  email:    { type: 'string', example: 'jane@web3nova.org' },
                  cohortId: { type: 'string' },
                  courseId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created student' } },
      },
    },
    '/admin/students/bulk': {
      post: {
        tags: ['Admin — Students'],
        summary: 'Bulk-enroll students',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['students', 'cohortId', 'courseId'],
                properties: {
                  cohortId: { type: 'string' },
                  courseId: { type: 'string' },
                  students: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name:  { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: '{ created: [], failed: [] }' } },
      },
    },
    '/admin/students/{id}': {
      delete: {
        tags: ['Admin — Students'],
        summary: 'Remove student',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Materials (admin) ────────────────────────────────────────
    '/admin/materials': {
      get: {
        tags: ['Admin — Materials'],
        summary: 'List materials',
        security: secured,
        parameters: [
          { name: 'cohortId', in: 'query', schema: { type: 'string' } },
          { name: 'courseId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of material objects' } },
      },
      post: {
        tags: ['Admin — Materials'],
        summary: 'Upload material',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'title', 'type', 'cohortId', 'courseId'],
                properties: {
                  file:         { type: 'string', format: 'binary' },
                  title:        { type: 'string', example: 'Week 1 Slides' },
                  type:         { type: 'string', example: 'pdf' },
                  cohortId:     { type: 'string' },
                  courseId:     { type: 'string' },
                  curriculumId: { type: 'string', description: 'Optional — attaches to a curriculum week' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Uploaded material with Cloudinary URL' } },
      },
    },
    '/admin/materials/{id}': {
      delete: {
        tags: ['Admin — Materials'],
        summary: 'Delete material (also removes from Cloudinary)',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Attendance (admin) ───────────────────────────────────────
    '/admin/attendance/sessions': {
      get: {
        tags: ['Admin — Attendance'],
        summary: 'List attendance sessions',
        security: secured,
        parameters: [{ name: 'cohortId', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Sessions with attendance counts' } },
      },
      post: {
        tags: ['Admin — Attendance'],
        summary: 'Open an attendance session',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cohortId', 'courseId', 'date', 'allowedIp'],
                properties: {
                  cohortId:  { type: 'string' },
                  courseId:  { type: 'string' },
                  date:      { type: 'string', format: 'date', example: '2026-05-07' },
                  allowedIp: { type: 'string', example: '192.168.1.1' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Active session created' } },
      },
    },
    '/admin/attendance/sessions/{id}/close': {
      patch: {
        tags: ['Admin — Attendance'],
        summary: 'Close an attendance session',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Session closed' } },
      },
    },
    '/admin/attendance': {
      get: {
        tags: ['Admin — Attendance'],
        summary: 'List attendance records',
        security: secured,
        parameters: [
          { name: 'cohortId',  in: 'query', schema: { type: 'string' } },
          { name: 'sessionId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Records with student name/email' } },
      },
    },

    // ── Student — Curriculum ─────────────────────────────────────
    '/student/curriculum': {
      get: {
        tags: ['Student — Curriculum'],
        summary: 'Get all 12 weeks with materials and assignment windows',
        security: secured,
        responses: { 200: { description: 'Curriculum weeks (no grades)' } },
      },
    },

    // ── Student — Assignments ────────────────────────────────────
    '/student/assignments': {
      get: {
        tags: ['Student — Assignments'],
        summary: 'Get currently open assignments',
        security: secured,
        responses: { 200: { description: 'Open assignments only' } },
      },
    },
    '/student/assignments/{id}': {
      get: {
        tags: ['Student — Assignments'],
        summary: 'Get full assignment details',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Assignment with questionText and allowed types' } },
      },
    },
    '/student/assignments/{id}/submit': {
      post: {
        tags: ['Student — Assignments'],
        summary: 'Submit (or re-submit) an assignment',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['submissionType'],
                properties: {
                  submissionType: { type: 'string', enum: ['pdf', 'doc', 'url', 'image', 'video', 'code'] },
                  file:           { type: 'string', format: 'binary' },
                  contentUrl:     { type: 'string', example: 'https://github.com/...' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Submitted successfully' },
          200: { description: 'Submission updated (re-submit)' },
          403: { description: 'Window closed' },
        },
      },
    },

    // ── Student — Assessments ────────────────────────────────────
    '/student/assessments': {
      get: {
        tags: ['Student — Assessments'],
        summary: 'List assessments',
        security: secured,
        parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['TEST', 'EXAM'] } }],
        responses: { 200: { description: 'Assessments without questions/answers' } },
      },
    },
    '/student/assessments/{id}': {
      get: {
        tags: ['Student — Assessments'],
        summary: 'Get assessment with questions (no correct answers)',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Assessment object' } },
      },
    },
    '/student/assessments/{id}/submit': {
      post: {
        tags: ['Student — Assessments'],
        summary: 'Submit MCQ answers (auto-marked, one-shot)',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['answers'],
                properties: {
                  answers: {
                    type: 'object',
                    additionalProperties: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
                    example: { '0': 'A', '1': 'C', '2': 'A' },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Submitted' }, 409: { description: 'Already submitted' } },
      },
    },
    '/student/assessments/{id}/submit-file': {
      post: {
        tags: ['Student — Assessments'],
        summary: 'Submit file for file-upload assessment',
        security: secured,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['submissionType'],
                properties: {
                  submissionType: { type: 'string', enum: ['pdf', 'doc', 'url', 'image', 'video', 'code'] },
                  file:           { type: 'string', format: 'binary' },
                  contentUrl:     { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Submitted' }, 200: { description: 'Updated' }, 403: { description: 'Due date passed' } },
      },
    },

    // ── Student — Materials ──────────────────────────────────────
    '/student/materials': {
      get: {
        tags: ['Student — Materials'],
        summary: 'Get course-level materials (not week-specific)',
        security: secured,
        responses: { 200: { description: 'Array of materials' } },
      },
    },

    // ── Student — Attendance ─────────────────────────────────────
    '/student/attendance/check-in': {
      post: {
        tags: ['Student — Attendance'],
        summary: 'Check in to active session (IP validated)',
        security: secured,
        responses: {
          201: { description: 'Checked in' },
          403: { description: 'Wrong network' },
          404: { description: 'No active session' },
          409: { description: 'Already checked in' },
        },
      },
    },
    '/student/attendance': {
      get: {
        tags: ['Student — Attendance'],
        summary: 'Get own attendance history',
        security: secured,
        responses: { 200: { description: 'Attendance records' } },
      },
    },

    // ── Student — Grades ─────────────────────────────────────────
    '/student/grades': {
      get: {
        tags: ['Student — Grades'],
        summary: 'Submission history (grades hidden from students)',
        security: secured,
        responses: { 200: { description: '{ assignments: [], assessments: [] }' } },
      },
    },

  },
}
