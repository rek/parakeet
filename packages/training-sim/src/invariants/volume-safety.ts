import { MuscleGroup } from '@parakeet/training-engine'
import { InvariantViolation, SimulationLog } from '../types'

export function checkVolumeSafety(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  // Group sessions by week
  const sessionsByWeek = new Map<number, typeof log.sessions>()
  for (const session of log.sessions) {
    if (session.skipped) continue
    const existing = sessionsByWeek.get(session.weekNumber) ?? []
    existing.push(session)
    sessionsByWeek.set(session.weekNumber, existing)
  }

  const weekNumbers = [...sessionsByWeek.keys()].sort((a, b) => a - b)
  const consecutiveMrvExceeded: Partial<Record<MuscleGroup, number>> = {}

  for (const weekNum of weekNumbers) {
    const weekSessions = sessionsByWeek.get(weekNum)!
    const lastSession = weekSessions[weekSessions.length - 1]
    if (!lastSession) continue

    const volumeStatus = lastSession.volumeStatusSnapshot

    for (const [muscle, status] of Object.entries(volumeStatus)) {
      const m = muscle as MuscleGroup

      // Rule: MRV exceeded for >1 consecutive week → error
      if (status === 'exceeded_mrv') {
        consecutiveMrvExceeded[m] = (consecutiveMrvExceeded[m] ?? 0) + 1
        if (consecutiveMrvExceeded[m]! > 1) {
          violations.push({
            category: 'volume_safety',
            rule: 'mrv_exceeded_consecutive',
            severity: 'error',
            message: `${m} exceeded MRV for ${consecutiveMrvExceeded[m]} consecutive weeks`,
            weekNumber: weekNum,
            expected: 'MRV exceeded max 1 consecutive week',
            actual: `${consecutiveMrvExceeded[m]} consecutive weeks`,
          })
        }
      } else {
        consecutiveMrvExceeded[m] = 0
      }

      // Rule: MRV exceeded at all → warning
      if (status === 'exceeded_mrv') {
        violations.push({
          category: 'volume_safety',
          rule: 'mrv_exceeded',
          severity: 'warning',
          message: `${m} exceeded MRV in week ${weekNum}`,
          weekNumber: weekNum,
        })
      }
    }
  }

  return violations
}
