import { InvariantViolation, SimulationLog } from '../types';

export function checkCyclePhaseCompliance(
  log: SimulationLog
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Only applies to female athletes with cycle data
  if (log.persona.biologicalSex !== 'female') return violations;

  const sessionsWithPhase = log.sessions.filter(
    (s) => !s.skipped && s.cyclePhase != null
  );

  for (const session of sessionsWithPhase) {
    const phase = session.cyclePhase!;

    // Rule: Menstrual/late_luteal phases should have cycle phase rationale
    // The intensity modifier compounds multiple adjustments, so we check
    // that the JIT rationale mentions cycle phase rather than checking the
    // final compounded number.
    if (phase === 'menstrual' || phase === 'late_luteal') {
      const hasCycleRationale = session.jitOutput.rationale.some(
        (r: string) =>
          r.toLowerCase().includes('cycle') ||
          r.toLowerCase().includes('menstrual') ||
          r.toLowerCase().includes('luteal')
      );
      if (!hasCycleRationale) {
        violations.push({
          category: 'cycle_phase',
          rule: 'menstrual_no_adjustment',
          severity: 'warning',
          message: `${phase} phase but no cycle-phase adjustment in JIT rationale on day ${session.day}`,
          weekNumber: session.weekNumber,
          day: session.day,
        });
      }
    }
  }

  return violations;
}
