import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weekAssignmentWindow, isAssignmentOpen } from '../src/services/curriculum-dates.js'
import { parseMCQFile } from '../src/services/mcq-parser.js'
import { scoreMCQ } from '../src/services/mcq-score.js'

// ── weekAssignmentWindow ──────────────────────────────────────────────────────
// Use local Date constructor to avoid UTC-midnight timezone traps

test('weekAssignmentWindow: week 1 from a Monday opens that Friday', () => {
  const monday = new Date(2025, 0, 6) // Jan 6, 2025 — Monday
  assert.equal(monday.getDay(), 1)

  const { openAt, closeAt } = weekAssignmentWindow(monday, 1)

  assert.equal(openAt.getDay(), 5, 'openAt must be Friday')
  assert.equal(openAt.getDate(), 10, 'Jan 10')
  assert.equal(openAt.getHours(), 0)
  assert.equal(openAt.getMinutes(), 0)
  assert.equal(closeAt.getDay(), 1, 'closeAt must be Monday')
  assert.equal(closeAt.getDate(), 13, 'Jan 13')
  assert.equal(closeAt.getHours(), 23)
  assert.equal(closeAt.getMinutes(), 59)
})

test('weekAssignmentWindow: week 1 from a Friday opens same day (daysToFriday = 0)', () => {
  const friday = new Date(2025, 0, 10) // Jan 10, 2025 — Friday
  assert.equal(friday.getDay(), 5)

  const { openAt } = weekAssignmentWindow(friday, 1)
  assert.equal(openAt.getDay(), 5)
  assert.equal(openAt.getDate(), 10)
})

test('weekAssignmentWindow: week 1 from a Saturday skips to next Friday', () => {
  const saturday = new Date(2025, 0, 11) // Jan 11, 2025 — Saturday
  assert.equal(saturday.getDay(), 6)

  const { openAt } = weekAssignmentWindow(saturday, 1)
  assert.equal(openAt.getDay(), 5)
  assert.equal(openAt.getDate(), 17, 'Jan 17 — next Friday')
})

test('weekAssignmentWindow: week 2 opens exactly 7 days after week 1', () => {
  const monday = new Date(2025, 0, 6)
  const w1 = weekAssignmentWindow(monday, 1)
  const w2 = weekAssignmentWindow(monday, 2)
  const diff = w2.openAt.getTime() - w1.openAt.getTime()
  assert.equal(diff, 7 * 24 * 60 * 60 * 1000)
})

test('weekAssignmentWindow: closeAt is always a Monday for all 12 weeks', () => {
  const monday = new Date(2025, 0, 6)
  for (let week = 1; week <= 12; week++) {
    const { closeAt } = weekAssignmentWindow(monday, week)
    assert.equal(closeAt.getDay(), 1, `week ${week}: closeAt should be Monday`)
  }
})

// ── isAssignmentOpen ──────────────────────────────────────────────────────────

test('isAssignmentOpen: true when now is inside the window', () => {
  const openAt = new Date(Date.now() - 60_000).toISOString()
  const closeAt = new Date(Date.now() + 60_000).toISOString()
  assert.ok(isAssignmentOpen({ openAt, closeAt }))
})

test('isAssignmentOpen: false when window has not opened yet', () => {
  const openAt = new Date(Date.now() + 60_000).toISOString()
  const closeAt = new Date(Date.now() + 120_000).toISOString()
  assert.equal(isAssignmentOpen({ openAt, closeAt }), false)
})

test('isAssignmentOpen: false when window has already closed', () => {
  const openAt = new Date(Date.now() - 120_000).toISOString()
  const closeAt = new Date(Date.now() - 60_000).toISOString()
  assert.equal(isAssignmentOpen({ openAt, closeAt }), false)
})

// ── parseMCQFile — CSV ────────────────────────────────────────────────────────

const VALID_CSV = [
  'question,option_a,option_b,option_c,option_d,correct',
  'What is 2+2?,3,4,5,6,B',
  'Capital of Nigeria?,Lagos,Abuja,Ibadan,Kano,B',
].join('\n')

test('parseMCQFile: parses a valid CSV into questions + correctAnswers', async () => {
  const { questions, correctAnswers } = await parseMCQFile(Buffer.from(VALID_CSV), 'text/csv')
  assert.equal(questions.length, 2)
  assert.equal(correctAnswers.length, 2)
  assert.equal(questions[0].q, 'What is 2+2?')
  assert.deepEqual(questions[0].options, ['3', '4', '5', '6'])
  assert.equal(correctAnswers[0], 'B')
  assert.equal(correctAnswers[1], 'B')
})

test('parseMCQFile: normalises lowercase correct values to uppercase', async () => {
  const csv = 'question,option_a,option_b,option_c,option_d,correct\nWhat?,A,B,C,D,a'
  const { correctAnswers } = await parseMCQFile(Buffer.from(csv), 'text/csv')
  assert.equal(correctAnswers[0], 'A')
})

test('parseMCQFile: throws on a row missing option_d column', async () => {
  const csv = 'question,option_a,option_b,option_c,correct\nWhat?,A,B,C,A'
  await assert.rejects(
    () => parseMCQFile(Buffer.from(csv), 'text/csv'),
    /missing required columns/
  )
})

test('parseMCQFile: throws when correct value is not A-D', async () => {
  const csv = 'question,option_a,option_b,option_c,option_d,correct\nWhat?,A,B,C,D,E'
  await assert.rejects(
    () => parseMCQFile(Buffer.from(csv), 'text/csv'),
    /must be A, B, C, or D/
  )
})

test('parseMCQFile: throws on a CSV with no data rows', async () => {
  const csv = 'question,option_a,option_b,option_c,option_d,correct\n'
  await assert.rejects(
    () => parseMCQFile(Buffer.from(csv), 'text/csv'),
    /No questions found/
  )
})

test('parseMCQFile: throws on unsupported mimetype', async () => {
  await assert.rejects(
    () => parseMCQFile(Buffer.from(''), 'image/png'),
    /Unsupported file type/
  )
})

// ── scoreMCQ ──────────────────────────────────────────────────────────────────

test('scoreMCQ: all correct → 100', () => {
  assert.equal(scoreMCQ(['A', 'B', 'C'], { '0': 'A', '1': 'B', '2': 'C' }), 100)
})

test('scoreMCQ: none correct → 0', () => {
  assert.equal(scoreMCQ(['A', 'B', 'C'], { '0': 'B', '1': 'C', '2': 'A' }), 0)
})

test('scoreMCQ: partial correct → rounded percentage', () => {
  // 1 of 3 = 33.33… → rounds to 33
  assert.equal(scoreMCQ(['A', 'B', 'C'], { '0': 'A', '1': 'C', '2': 'A' }), 33)
})

test('scoreMCQ: 2 of 3 → 67', () => {
  assert.equal(scoreMCQ(['A', 'B', 'C'], { '0': 'A', '1': 'B', '2': 'A' }), 67)
})

test('scoreMCQ: lowercase student answers are normalised before comparison', () => {
  assert.equal(scoreMCQ(['A', 'B'], { '0': 'a', '1': 'b' }), 100)
})

test('scoreMCQ: answers supplied as a JSON string are parsed', () => {
  assert.equal(scoreMCQ(['A'], '{"0":"A"}'), 100)
})

test('scoreMCQ: missing answer for a question counts as wrong', () => {
  // Only answered question 0; question 1 has no entry
  assert.equal(scoreMCQ(['A', 'B'], { '0': 'A' }), 50)
})

test('scoreMCQ: returns null for empty correctAnswers array', () => {
  assert.equal(scoreMCQ([], { '0': 'A' }), null)
})
