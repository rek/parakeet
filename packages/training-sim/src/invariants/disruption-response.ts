import { InvariantViolation, SimulationLog } from '../types'

export function checkDisruptionResponse(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  for (const disruption of log.disruptions) {
    // Find sessions that occurred during the disruption window
    const duringSessions = log.sessions.filter(
      (s) => !s.skipped && s.day >= disruption.day && s.day < disruption.resolvedDay,
    )

    if (duringSessions.length === 0) continue // all sessions skipped — that's valid

    if (disruption.disruption.severity === 'major') {
      // Rule: Major disruptions affecting a lift should skip the main lift
      for (const session of duringSessions) {
        const affectsThisLift =
          !disruption.disruption.affectedLifts ||
          disruption.disruption.affectedLifts.includes(session.primaryLift)

        if (affectsThisLift && !session.jitOutput.skippedMainLift && session.mainLiftSets.length > 0) {
          violations.push({
            category: 'disruption_response',
            rule: 'major_disruption_not_skipped',
            severity: 'error',
            message: `Major ${disruption.disruption.type} disruption active but ${session.primaryLift} main lift was not skipped on day ${session.day}`,
            weekNumber: session.weekNumber,
            day: session.day,
            expected: 'Main lift skipped',
            actual: `${session.mainLiftSets.length} sets programmed`,
          })
        }
      }
    }

    if (disruption.disruption.severity === 'moderate') {
      // Rule: Moderate disruptions should reduce volume or intensity
      for (const session of duringSessions) {
        const affectsThisLift =
          !disruption.disruption.affectedLifts ||
          disruption.disruption.affectedLifts.includes(session.primaryLift)

        if (!affectsThisLift) continue

        // Check that JIT rationale mentions disruption adjustment
        const hasDisruptionRationale = session.jitOutput.rationale.some(
          (r: string) => r.toLowerCase().includes('disrupt') ||
                 r.toLowerCase().includes('reduced') ||
                 r.toLowerCase().includes('injury') ||
                 r.toLowerCase().includes('illness'),
        )

        if (!hasDisruptionRationale && session.mainLiftSets.length > 0) {
          violations.push({
            category: 'disruption_response',
            rule: 'moderate_disruption_no_adjustment',
            severity: 'warning',
            message: `Moderate ${disruption.disruption.type} disruption active but no adjustment visible in JIT rationale for ${session.primaryLift} on day ${session.day}`,
            weekNumber: session.weekNumber,
            day: session.day,
          })
        }
      }
    }
  }

  return violations
}
