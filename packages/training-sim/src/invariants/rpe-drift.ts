import { InvariantViolation, SimulationLog } from '../types';

/**
 * Detects RPE drift — when simulated RPE consistently deviates from targets.
 * This catches situations where the programming is too hard or too easy
 * for the athlete over time.
 */
export function checkRpeDrift(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  const trainedSessions = log.sessions.filter(
    (s) => !s.skipped && !s.isDeload && s.mainLiftSets.length > 0
  );

  if (trainedSessions.length < 3) return violations;

  // Check rolling 3-session RPE deviation
  for (let i = 2; i < trainedSessions.length; i++) {
    const window = trainedSessions.slice(i - 2, i + 1);
    const deviations = window.map((s) => {
      const targetRpe = s.mainLiftSets[0]?.rpe_target ?? 8;
      return s.simulatedRpe - targetRpe;
    });
    const avgDeviation =
      deviations.reduce((a, b) => a + b, 0) / deviations.length;

    // Rule: Average RPE deviation > 1.5 over 3 sessions → error (too hard)
    if (avgDeviation > 1.5) {
      const session = trainedSessions[i];
      violations.push({
        category: 'intensity_coherence',
        rule: 'rpe_drift_high',
        severity: 'error',
        message: `RPE running ${avgDeviation.toFixed(1)} above target over 3 sessions ending day ${session.day} — programming may be too aggressive`,
        weekNumber: session.weekNumber,
        day: session.day,
        expected: 'RPE deviation < 1.5',
        actual: `+${avgDeviation.toFixed(1)}`,
      });
    }

    // Rule: Average RPE deviation < -2.0 over 3 sessions → warning (too easy)
    if (avgDeviation < -2.0) {
      const session = trainedSessions[i];
      violations.push({
        category: 'intensity_coherence',
        rule: 'rpe_drift_low',
        severity: 'warning',
        message: `RPE running ${Math.abs(avgDeviation).toFixed(1)} below target over 3 sessions ending day ${session.day} — programming may be too conservative`,
        weekNumber: session.weekNumber,
        day: session.day,
        expected: 'RPE deviation > -2.0',
        actual: `${avgDeviation.toFixed(1)}`,
      });
    }
  }

  return violations;
}
