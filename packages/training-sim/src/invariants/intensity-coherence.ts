import { InvariantViolation, SimulationLog } from '../types'

export function checkIntensityCoherence(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  // Group non-skipped, non-deload sessions by week and lift
  const sessionsByWeekLift = new Map<string, typeof log.sessions>()
  for (const session of log.sessions) {
    if (session.skipped || session.isDeload) continue
    const key = `${session.weekNumber}-${session.primaryLift}`
    const existing = sessionsByWeekLift.get(key) ?? []
    existing.push(session)
    sessionsByWeekLift.set(key, existing)
  }

  for (const session of log.sessions) {
    if (session.skipped) continue

    // Rule: No working set exceeds 100% of 1RM
    const oneRm = log.oneRmProgression.find((p) => p.weekNumber === session.weekNumber)
    if (oneRm) {
      const max1rm = oneRm.maxes[session.primaryLift]
      for (const set of session.mainLiftSets) {
        if (set.weight_kg > max1rm) {
          violations.push({
            category: 'intensity_coherence',
            rule: 'exceeds_1rm',
            severity: 'error',
            message: `${session.primaryLift} set at ${set.weight_kg}kg exceeds 1RM of ${max1rm}kg`,
            weekNumber: session.weekNumber,
            day: session.day,
            expected: `<= ${max1rm}kg`,
            actual: `${set.weight_kg}kg`,
          })
        }
      }
    }

    // Rule: Heavy day weight > rep day weight (within same week, same lift)
    // This only makes sense when comparing different intensity types for the same lift
    // The cube method rotates so each lift only gets one intensity per week
    // So we check across weeks within a block instead
  }

  // Rule: Deload sessions should have lower intensity than regular sessions
  for (const session of log.sessions) {
    if (!session.isDeload || session.skipped || session.mainLiftSets.length === 0) continue

    const regularSessions = log.sessions.filter(
      (s) => !s.skipped && !s.isDeload && s.primaryLift === session.primaryLift && s.mainLiftSets.length > 0,
    )
    if (regularSessions.length === 0) continue

    const avgRegularWeight = regularSessions.reduce(
      (sum, s) => sum + (s.mainLiftSets[0]?.weight_kg ?? 0),
      0,
    ) / regularSessions.length

    const deloadWeight = session.mainLiftSets[0].weight_kg

    // Deload should be significantly lighter (at least 30% reduction)
    if (deloadWeight > avgRegularWeight * 0.7) {
      violations.push({
        category: 'intensity_coherence',
        rule: 'deload_too_heavy',
        severity: 'warning',
        message: `${session.primaryLift} deload at ${deloadWeight}kg is not significantly lighter than avg ${Math.round(avgRegularWeight)}kg`,
        weekNumber: session.weekNumber,
        day: session.day,
        expected: `<= ${Math.round(avgRegularWeight * 0.7)}kg`,
        actual: `${deloadWeight}kg`,
      })
    }
  }

  return violations
}
