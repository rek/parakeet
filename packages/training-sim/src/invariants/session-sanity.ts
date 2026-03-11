import { InvariantViolation, SimulationLog } from '../types';

export function checkSessionSanity(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const session of log.sessions) {
    if (session.skipped) continue;

    const totalWorkingSets =
      session.mainLiftSets.length +
      session.auxiliaryWork.reduce(
        (sum, a) => sum + (a.skipped ? 0 : a.sets.length),
        0
      );

    // Rule: Total working sets per session should be 1-35 (generous bounds)
    if (totalWorkingSets > 35) {
      violations.push({
        category: 'session_sanity',
        rule: 'too_many_sets',
        severity: 'error',
        message: `Session on day ${session.day} has ${totalWorkingSets} working sets (max 35)`,
        weekNumber: session.weekNumber,
        day: session.day,
        expected: '<= 35',
        actual: `${totalWorkingSets}`,
      });
    }

    // Rule: Non-deload sessions should have at least 1 working set (unless MRV skipped)
    if (
      totalWorkingSets === 0 &&
      !session.isDeload &&
      !session.jitOutput.skippedMainLift
    ) {
      violations.push({
        category: 'session_sanity',
        rule: 'empty_session',
        severity: 'error',
        message: `Non-deload session on day ${session.day} has 0 working sets`,
        weekNumber: session.weekNumber,
        day: session.day,
      });
    }

    // Rule: No session should have more than 6 exercises total
    const exerciseCount =
      (session.mainLiftSets.length > 0 ? 1 : 0) +
      session.auxiliaryWork.filter((a) => !a.skipped).length;

    if (exerciseCount > 6) {
      violations.push({
        category: 'session_sanity',
        rule: 'too_many_exercises',
        severity: 'warning',
        message: `Session on day ${session.day} has ${exerciseCount} exercises (recommend max 6)`,
        weekNumber: session.weekNumber,
        day: session.day,
        expected: '<= 6',
        actual: `${exerciseCount}`,
      });
    }

    // Rule: Warmup sets should come before working sets (implicit — they're separate arrays)
    // Rule: Main lift weight should be > 0 for non-recovery sessions
    if (session.mainLiftSets.length > 0 && !session.jitOutput.skippedMainLift) {
      const firstWeight = session.mainLiftSets[0].weight_kg;
      if (firstWeight <= 0) {
        violations.push({
          category: 'session_sanity',
          rule: 'zero_weight',
          severity: 'error',
          message: `${session.primaryLift} main lift has 0kg weight on day ${session.day}`,
          weekNumber: session.weekNumber,
          day: session.day,
        });
      }
    }

    // Rule: All set weights should be positive multiples of 2.5
    for (const set of session.mainLiftSets) {
      if (set.weight_kg > 0 && set.weight_kg % 2.5 !== 0) {
        violations.push({
          category: 'session_sanity',
          rule: 'weight_not_rounded',
          severity: 'warning',
          message: `${session.primaryLift} set weight ${set.weight_kg}kg is not a multiple of 2.5kg on day ${session.day}`,
          weekNumber: session.weekNumber,
          day: session.day,
        });
      }
    }
  }

  return violations;
}
