import { describe, expect, it } from 'vitest';

import type { PrescriptionTrace } from '@parakeet/training-engine';

import { formatPrescriptionTrace } from './format-trace';

function makeTrace(overrides?: Partial<PrescriptionTrace>): PrescriptionTrace {
  return {
    sessionId: 'sess-1',
    strategy: 'formula',
    primaryLift: 'bench',
    intensityType: 'heavy',
    blockNumber: 2,
    oneRmKg: 100,
    rationale: [],
    warnings: [],
    baseConfig: { sets: 2, reps: 3, pct: 0.85 },
    mainLift: {
      weightDerivation: null,
      volumeChanges: [],
      sets: [],
      isRecoveryMode: false,
      isSkipped: false,
    },
    auxiliaries: [],
    warmup: null,
    rest: {
      mainLift: {
        formulaBaseSeconds: 210,
        userOverrideSeconds: null,
        llmDeltaSeconds: null,
        finalSeconds: 210,
      },
      auxiliarySeconds: 90,
    },
    ...overrides,
  };
}

describe('formatPrescriptionTrace — basePrescription', () => {
  it('formats single-rep value when no repsMax', () => {
    const { basePrescription } = formatPrescriptionTrace(makeTrace());
    expect(basePrescription).toBe('2 sets × 3 reps @ 85% 1RM');
  });

  it('formats rep range when repsMax is present', () => {
    const { basePrescription } = formatPrescriptionTrace(
      makeTrace({ baseConfig: { sets: 3, reps: 8, repsMax: 12, pct: 0.7 } })
    );
    expect(basePrescription).toBe('3 sets × 8–12 reps @ 70% 1RM');
  });

  it('returns null when baseConfig is null', () => {
    const { basePrescription } = formatPrescriptionTrace(
      makeTrace({ baseConfig: null })
    );
    expect(basePrescription).toBeNull();
  });

  it('returns null when session is skipped', () => {
    const { basePrescription } = formatPrescriptionTrace(
      makeTrace({
        mainLift: {
          weightDerivation: null,
          volumeChanges: [],
          sets: [],
          isRecoveryMode: false,
          isSkipped: true,
        },
      })
    );
    expect(basePrescription).toBeNull();
  });

  it('returns null when session is in recovery mode', () => {
    const { basePrescription } = formatPrescriptionTrace(
      makeTrace({
        mainLift: {
          weightDerivation: null,
          volumeChanges: [],
          sets: [],
          isRecoveryMode: true,
          isSkipped: false,
        },
      })
    );
    expect(basePrescription).toBeNull();
  });

  it('rounds pct to whole number', () => {
    const { basePrescription } = formatPrescriptionTrace(
      makeTrace({ baseConfig: { sets: 2, reps: 6, pct: 0.699 } })
    );
    expect(basePrescription).toBe('2 sets × 6 reps @ 70% 1RM');
  });

  it('handles undefined baseConfig (historical rows from DB)', () => {
    const trace = makeTrace();
    // Simulate historical row where baseConfig was not stored
    (trace as unknown as Record<string, unknown>)['baseConfig'] = undefined;
    const { basePrescription } = formatPrescriptionTrace(trace);
    expect(basePrescription).toBeNull();
  });
});
