export function scoreMCQ(correctAnswers, studentAnswers) {
  if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) return null
  const answers = typeof studentAnswers === 'string' ? JSON.parse(studentAnswers) : studentAnswers
  let correct = 0
  correctAnswers.forEach((expected, i) => {
    if ((answers[String(i)] || '').toUpperCase() === expected) correct++
  })
  return Math.round((correct / correctAnswers.length) * 100)
}
