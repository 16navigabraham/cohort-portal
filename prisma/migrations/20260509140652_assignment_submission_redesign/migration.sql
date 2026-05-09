/*
  Warnings:

  - Added the required column `updatedAt` to the `AssessmentResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "questionText" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL DEFAULT 'file',
    "cloudinaryUrl" TEXT,
    "publicId" TEXT,
    "contentUrl" TEXT,
    "score" INTEGER,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentResult" ("answers", "assessmentId", "id", "score", "studentId", "submittedAt") SELECT "answers", "assessmentId", "id", "score", "studentId", "submittedAt" FROM "AssessmentResult";
DROP TABLE "AssessmentResult";
ALTER TABLE "new_AssessmentResult" RENAME TO "AssessmentResult";
CREATE UNIQUE INDEX "AssessmentResult_studentId_assessmentId_key" ON "AssessmentResult"("studentId", "assessmentId");
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "questionText" TEXT,
    "questionDocUrl" TEXT,
    "allowedSubmissionTypes" TEXT NOT NULL DEFAULT '["pdf","doc","url","image","video","code"]',
    "curriculumId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "openAt" DATETIME NOT NULL,
    "closeAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("closeAt", "cohortId", "courseId", "createdAt", "curriculumId", "description", "id", "openAt", "title") SELECT "closeAt", "cohortId", "courseId", "createdAt", "curriculumId", "description", "id", "openAt", "title" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE UNIQUE INDEX "Assignment_curriculumId_key" ON "Assignment"("curriculumId");
CREATE TABLE "new_Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL DEFAULT 'file',
    "cloudinaryUrl" TEXT,
    "publicId" TEXT,
    "contentUrl" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "grade" INTEGER,
    "feedback" TEXT,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Submission" ("assignmentId", "cloudinaryUrl", "feedback", "grade", "id", "publicId", "studentId", "submittedAt") SELECT "assignmentId", "cloudinaryUrl", "feedback", "grade", "id", "publicId", "studentId", "submittedAt" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
CREATE UNIQUE INDEX "Submission_studentId_assignmentId_key" ON "Submission"("studentId", "assignmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
