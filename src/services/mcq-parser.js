import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdf = require('pdf-parse')
import mammoth from 'mammoth'
import { parse as csvParse } from 'csv-parse/sync'

/**
 * Extract raw question text from a PDF or DOCX for display in frontend.
 * Used for practical/open-ended assignments (not MCQ).
 */
export async function parseQuestionDoc(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdf(buffer)
    return data.text.trim()
  }
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  }
  throw new Error('Unsupported format for question doc. Use .pdf or .docx')
}

/**
 * Parse uploaded file buffer into MCQ questions.
 * Returns { questions, correctAnswers } where:
 *   questions      = [{ q, options: [A,B,C,D] }]  — sent to students
 *   correctAnswers = ['A','B',...]                  — server-side only
 */
export async function parseMCQFile(buffer, mimetype) {
  if (mimetype === 'text/csv' || mimetype === 'application/vnd.ms-excel') {
    return parseCSV(buffer)
  }
  if (mimetype === 'application/pdf') {
    return parsePDF(buffer)
  }
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return parseDOCX(buffer)
  }
  throw new Error('Unsupported file type. Use .csv, .pdf, or .docx')
}

function parseCSV(buffer) {
  const records = csvParse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const questions = []
  const correctAnswers = []

  for (const [i, row] of records.entries()) {
    const q = row.question || row.Question
    const a = row.option_a || row.A
    const b = row.option_b || row.B
    const c = row.option_c || row.C
    const d = row.option_d || row.D
    const correct = (row.correct || row.Correct || row.answer || row.Answer || '').toUpperCase().trim()

    if (!q || !a || !b || !c || !d || !correct) {
      throw new Error(`Row ${i + 2}: missing required columns. Expected: question, option_a, option_b, option_c, option_d, correct`)
    }
    if (!['A', 'B', 'C', 'D'].includes(correct)) {
      throw new Error(`Row ${i + 2}: 'correct' must be A, B, C, or D — got "${correct}"`)
    }

    questions.push({ q, options: [a, b, c, d] })
    correctAnswers.push(correct)
  }

  if (questions.length === 0) throw new Error('No questions found in CSV')
  return { questions, correctAnswers }
}

async function parsePDF(buffer) {
  const data = await pdf(buffer)
  return parseStructuredText(data.text)
}

async function parseDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return parseStructuredText(result.value)
}

/**
 * Parses structured text format:
 *
 * Q: What is X?
 * A: Option one
 * B: Option two
 * C: Option three
 * D: Option four
 * Answer: A
 */
function parseStructuredText(text) {
  const questions = []
  const correctAnswers = []

  // Split on blank lines between questions
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

    let q = null, a = null, b = null, c = null, d = null, correct = null

    for (const line of lines) {
      if (/^Q:/i.test(line))      q       = line.replace(/^Q:\s*/i, '').trim()
      else if (/^A:/i.test(line)) a       = line.replace(/^A:\s*/i, '').trim()
      else if (/^B:/i.test(line)) b       = line.replace(/^B:\s*/i, '').trim()
      else if (/^C:/i.test(line)) c       = line.replace(/^C:\s*/i, '').trim()
      else if (/^D:/i.test(line)) d       = line.replace(/^D:\s*/i, '').trim()
      else if (/^Answer:/i.test(line)) correct = line.replace(/^Answer:\s*/i, '').toUpperCase().trim()
    }

    if (!q || !a || !b || !c || !d || !correct) continue
    if (!['A', 'B', 'C', 'D'].includes(correct)) continue

    questions.push({ q, options: [a, b, c, d] })
    correctAnswers.push(correct)
  }

  if (questions.length === 0) throw new Error('No valid questions found. Check the format: Q: / A: / B: / C: / D: / Answer:')
  return { questions, correctAnswers }
}
