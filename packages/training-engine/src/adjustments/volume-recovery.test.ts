import { describe, expect, it } from 'vitest';

import {
  evaluateVolumeRecovery,
  VolumeRecoveryContext,
  VolumeReductions,
} from './volume-recovery';

function makeReductions(
  overrides?: Partial<VolumeReductions>
): VolumeReductions {
  return {
    totalSetsRemoved: 2,
    baseSetsCount: 5,
    sources: [{ source: 'soreness', setsRemoved: 2 }],
    recoveryBlocked: false,
    ...overrides,
  };
}

function makeContext(
  overrides?: Partial<VolumeRecoveryContext>
): VolumeRecoveryContext {
  return {
    completedSets: [{ rpe_actual: 6.5, rpe_target: 8.5 }],
    volumeReductions: makeReductions(),
    currentWeightKg: 100,
    currentReps: 5,
    rpeTarget: 8.5,
    ...overrides,
  };
}

describe('evaluateVolumeRecovery', () => {
  it('returns null when recoveryBlocked is true', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        volumeReductions: makeReductions({ recoveryBlocked: true }),
      })
    );
    expect(result).toBeNull();
  });

  it('returns null when totalSetsRemoved is 0', () => {
    const result = evaluateVolumeRecovery(
      makeContext({ volumeReductions: makeReductions({ totalSetsRemoved: 0 }) })
    );
    expect(result).toBeNull();
  });

  it('returns null when no completed sets have RPE', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        completedSets: [{ rpe_actual: undefined, rpe_target: 8.5 }],
      })
    );
    expect(result).toBeNull();
  });

  it('returns null when RPE gap is below threshold', () => {
    // gap = 8.5 - 7.5 = 1.0, below 1.5 threshold
    const result = evaluateVolumeRecovery(
      makeContext({ completedSets: [{ rpe_actual: 7.5, rpe_target: 8.5 }] })
    );
    expect(result).toBeNull();
  });

  it('returns null when RPE gap is exactly 1.4', () => {
    const result = evaluateVolumeRecovery(
      makeContext({ completedSets: [{ rpe_actual: 7.1, rpe_target: 8.5 }] })
    );
    expect(result).toBeNull();
  });

  it('returns offer when RPE gap is exactly 1.5', () => {
    // gap = 8.5 - 7.0 = 1.5
    const result = evaluateVolumeRecovery(
      makeContext({ completedSets: [{ rpe_actual: 7.0, rpe_target: 8.5 }] })
    );
    expect(result).not.toBeNull();
    expect(result!.setsAvailable).toBe(2);
  });

  it('returns offer after just 1 completed set with sufficient gap', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        completedSets: [{ rpe_actual: 6.0, rpe_target: 8.5 }],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.setsAvailable).toBe(2);
  });

  it('averages RPE gap across multiple sets', () => {
    // set 1 gap: 8.5 - 6.0 = 2.5, set 2 gap: 8.5 - 8.0 = 0.5 → avg 1.5
    const result = evaluateVolumeRecovery(
      makeContext({
        completedSets: [
          { rpe_actual: 6.0, rpe_target: 8.5 },
          { rpe_actual: 8.0, rpe_target: 8.5 },
        ],
      })
    );
    expect(result).not.toBeNull();
  });

  it('returns null when average gap across sets is below threshold', () => {
    // set 1 gap: 8.5 - 6.0 = 2.5, set 2 gap: 8.5 - 8.5 = 0.0 → avg 1.25
    const result = evaluateVolumeRecovery(
      makeContext({
        completedSets: [
          { rpe_actual: 6.0, rpe_target: 8.5 },
          { rpe_actual: 8.5, rpe_target: 8.5 },
        ],
      })
    );
    expect(result).toBeNull();
  });

  it('recovered sets match current weight/reps/rpe_target', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        currentWeightKg: 97.5,
        currentReps: 3,
        rpeTarget: 9.0,
      })
    );
    expect(result).not.toBeNull();
    for (const s of result!.recoveredSets) {
      expect(s.weight_kg).toBe(97.5);
      expect(s.reps).toBe(3);
      expect(s.rpe_target).toBe(9.0);
    }
  });

  it('never offers more sets than totalSetsRemoved', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        volumeReductions: makeReductions({ totalSetsRemoved: 1 }),
      })
    );
    expect(result).not.toBeNull();
    expect(result!.setsAvailable).toBe(1);
    expect(result!.recoveredSets).toHaveLength(1);
  });

  it('includes source labels in rationale', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        volumeReductions: makeReductions({
          sources: [
            { source: 'readiness', setsRemoved: 1 },
            { source: 'cycle_phase', setsRemoved: 1 },
          ],
        }),
      })
    );
    expect(result).not.toBeNull();
    expect(result!.rationale).toContain('readiness');
    expect(result!.rationale).toContain('cycle phase');
  });

  it('includes disruption in rationale when disruption reduced sets', () => {
    const result = evaluateVolumeRecovery(
      makeContext({
        volumeReductions: makeReductions({
          sources: [{ source: 'disruption', setsRemoved: 2 }],
        }),
      })
    );
    expect(result).not.toBeNull();
    expect(result!.rationale).toContain('disruption');
  });

  it('skips sets without RPE when computing average', () => {
    // Only set 1 has RPE (gap 2.0 > 1.5), set 2 has no RPE → should still offer
    const result = evaluateVolumeRecovery(
      makeContext({
        completedSets: [
          { rpe_actual: 6.5, rpe_target: 8.5 },
          { rpe_actual: undefined, rpe_target: 8.5 },
        ],
      })
    );
    expect(result).not.toBeNull();
  });

  it('rounds recovered set weight to nearest 2.5 kg', () => {
    const result = evaluateVolumeRecovery(
      makeContext({ currentWeightKg: 101.3 })
    );
    expect(result).not.toBeNull();
    expect(result!.recoveredSets[0].weight_kg).toBe(102.5);
  });
});
