/**
 * Given a cohort startDate and a week number (1-12),
 * returns the openAt (Friday) and closeAt (Monday 23:59) for that week's assignment.
 */
export function weekAssignmentWindow(cohortStartDate, week) {
  const start = new Date(cohortStartDate)
  // Week N starts at cohortStart + (N-1)*7 days
  const weekStart = new Date(start)
  weekStart.setDate(start.getDate() + (week - 1) * 7)

  // Find the Friday of that week (day 5)
  const day = weekStart.getDay() // 0=Sun,1=Mon,...,6=Sat
  const daysToFriday = (5 - day + 7) % 7
  const friday = new Date(weekStart)
  friday.setDate(weekStart.getDate() + daysToFriday)
  friday.setHours(0, 0, 0, 0)

  // Close at Monday 23:59:59 (3 days after Friday)
  const monday = new Date(friday)
  monday.setDate(friday.getDate() + 3)
  monday.setHours(23, 59, 59, 999)

  return { openAt: friday, closeAt: monday }
}

export function isAssignmentOpen(assignment) {
  const now = new Date()
  return now >= new Date(assignment.openAt) && now <= new Date(assignment.closeAt)
}
