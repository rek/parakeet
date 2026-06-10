import { MuscleGroup } from '@parakeet/training-engine';

import { InvariantViolation, SimulationLog } from '../types';

/**
 * Checks that auxiliary exercise rotation provides balanced muscle coverage
 * across each 3-week block. Every muscle group that has MEV > 0 should
 * receive some auxiliary work over the course of a block.
 */
export function checkMuscleCoverage(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  const trainedSessions = log.sessions.filter((s) => !s.skipped);

  // Group sessions into 3-week blocks
  const blockSessions = new Map<number, typeof trainedSessions>();
  for (const session of trainedSessions) {
    const blockNum = session.blockNumber ?? Math.ceil(session.weekNumber / 3);
    const existing = blockSessions.get(blockNum) ?? [];
    existing.push(session);
    blockSessions.set(blockNum, existing);
  }

  // Muscles that are typically trained directly by the big-three + standard
  // aux rotation; obscure muscles are excluded to keep this a loose check.
  const coreMuscles: MuscleGroup[] = [
    'quads',
    'hamstrings',
    'chest',
    'upper_back',
    'triceps',
    'shoulders',
  ];

  for (const [blockNum, sessions] of blockSessions) {
    if (sessions.length === 0) continue;

    // Collect every muscle that received any volume in any session of this
    // block. weeklyVolumeSnapshot resets each training week, so coverage must
    // be accumulated across the whole block rather than read from the final
    // session alone — otherwise a block ending on a fresh-week lower-body day
    // would falsely report the upper-body muscles as uncovered.
    const musclesHit = new Set<string>();
    for (const session of sessions) {
      for (const [muscle, vol] of Object.entries(
        session.weeklyVolumeSnapshot
      )) {
        if (vol && vol > 0) musclesHit.add(muscle);
      }
    }

    // Flag core muscles that got zero volume across the entire block.
    for (const muscle of coreMuscles) {
      if (!musclesHit.has(muscle)) {
        violations.push({
          category: 'auxiliary_balance',
          rule: 'muscle_zero_coverage',
          severity: 'warning',
          message: `${muscle} received zero volume in block ${blockNum}`,
          weekNumber: sessions[0].weekNumber,
        });
      }
    }
  }

  return violations;
}
