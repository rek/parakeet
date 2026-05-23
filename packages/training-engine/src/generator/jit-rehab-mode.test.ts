// @spec docs/features/rehab-mode/spec-engine.md
import { baseInput, makeDisruption } from '../__test-helpers__/fixtures';
import type { RehabCap } from '../types';
import { generateJITSession } from './jit-session-generator';

function rehabCap(overrides?: Partial<RehabCap>): RehabCap {
  return {
    lift: 'squat',
    capKg: 80,
    startedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('Rehab Mode — main lift weight clamp (GH#220)', () => {
  it('clamps prescribed weight to the cap when formula would exceed it', () => {
    // Squat block 1 heavy at 140kg 1RM → ~112.5kg working weight. Cap = 80.
    const out = generateJITSession(
      baseInput({ activeRehabCap: rehabCap({ capKg: 80 }) })
    );
    expect(out.mainLiftSets[0].weight_kg).toBe(80);
    expect(out.cappedByRehab).toBe(true);
    expect(out.rehabCapKg).toBe(80);
    expect(out.rationale.some((r) => /Capped at 80kg by Rehab Mode/i.test(r))).toBe(
      true
    );
  });

  it('does not clamp when formula weight is below the cap', () => {
    // Set a very high cap above formula weight — cap should not bite.
    const out = generateJITSession(
      baseInput({ activeRehabCap: rehabCap({ capKg: 200 }) })
    );
    expect(out.cappedByRehab).toBeUndefined();
    expect(out.rehabCapKg).toBeUndefined();
    expect(out.mainLiftSets[0].weight_kg).toBeGreaterThan(100);
  });

  it('rounds the cap UP to the lifter\'s plate increment (GH#220 decision)', () => {
    // Cap = 82.5, plate increment = 5 (no 1.25 plates) → prescription = 85
    const out = generateJITSession(
      baseInput({
        activeRehabCap: rehabCap({ capKg: 82.5 }),
        weightIncrementKg: 5,
      })
    );
    expect(out.mainLiftSets[0].weight_kg).toBe(85);
    expect(out.cappedByRehab).toBe(true);
    expect(out.rehabCapKg).toBe(85);
  });

  it('cap on a different lift does not affect today\'s session', () => {
    // Squat day, but the rehab cap is on bench → no cap behavior.
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        activeRehabCap: rehabCap({ lift: 'bench', capKg: 50 }),
      })
    );
    expect(out.cappedByRehab).toBeUndefined();
    expect(out.mainLiftSets[0].weight_kg).toBeGreaterThan(100);
  });
});

describe('Rehab Mode — suppression of adaptive steps', () => {
  it('Step 2 RPE auto-progression does not raise weight when cap is active', () => {
    const withCap = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 6, target_rpe: 8 },
          { actual_rpe: 6, target_rpe: 8 },
        ],
        activeRehabCap: rehabCap({ capKg: 80 }),
      })
    );
    // The RPE auto-progression rationale should not appear.
    expect(
      withCap.rationale.some((r) => /Recent RPE below target/i.test(r))
    ).toBe(false);
  });

  it('Step 0 volume calibration does not add sets when cap is active', () => {
    const withoutCap = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 6, target_rpe: 8 },
          { actual_rpe: 6, target_rpe: 8 },
        ],
        sleepQuality: 5,
        energyLevel: 5,
        sorenessRatings: { quads: 1, glutes: 1, lower_back: 1 },
      })
    );
    const withCap = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 6, target_rpe: 8 },
          { actual_rpe: 6, target_rpe: 8 },
        ],
        sleepQuality: 5,
        energyLevel: 5,
        sorenessRatings: { quads: 1, glutes: 1, lower_back: 1 },
        activeRehabCap: rehabCap({ capKg: 80 }),
      })
    );
    // Without cap: calibration should add sets given strong positive signals.
    // With cap: set count stays at base.
    expect(withCap.mainLiftSets.length).toBeLessThanOrEqual(
      withoutCap.mainLiftSets.length
    );
    expect(
      withCap.rationale.some((r) => /Volume calibration: increase/i.test(r))
    ).toBe(false);
  });

  it('Step 2b rep-range boost does not fire on rep days when cap is active', () => {
    const out = generateJITSession(
      baseInput({
        intensityType: 'rep',
        recentLogs: [
          { actual_rpe: 6.5, target_rpe: 8 },
          { actual_rpe: 6.5, target_rpe: 8 },
        ],
        activeRehabCap: rehabCap({ capKg: 80 }),
      })
    );
    expect(
      out.rationale.some((r) => /Recent RPE well below target — prescribing/i.test(r))
    ).toBe(false);
  });
});

describe('Rehab Mode — stacking with other modifiers', () => {
  it('moderate disruption intensity reduction stacks under the cap', () => {
    // Moderate injury now applies ×0.60 (finding #1). With formula ~112.5 →
    // 112.5 × 0.6 = 67.5. Set cap below 67.5 so the cap is the binding
    // constraint, confirming Rehab still wins when the disruption alone
    // would land above the cap.
    const out = generateJITSession(
      baseInput({
        activeRehabCap: rehabCap({ capKg: 60 }),
        activeDisruptions: [makeDisruption('moderate', 'squat')],
      })
    );
    expect(out.mainLiftSets[0].weight_kg).toBe(60);
    expect(out.cappedByRehab).toBe(true);
  });

  it('moderate disruption can reduce below the cap (cap does not fire)', () => {
    // Moderate injury ×0.60 → 67.5kg. Cap = 110 → cap doesn't bite.
    const out = generateJITSession(
      baseInput({
        activeRehabCap: rehabCap({ capKg: 110 }),
        activeDisruptions: [makeDisruption('moderate', 'squat')],
      })
    );
    expect(out.mainLiftSets[0].weight_kg).toBeLessThan(110);
    expect(out.cappedByRehab).toBeUndefined();
  });

  it('severe soreness recovery mode bases the 40% on the capped weight', () => {
    // Severe soreness triggers recovery mode (3×5 @ 40% × base). With a cap,
    // recovery weight = 40% × min(formulaBase=112.5, cap=80) = 40% × 80 = 32
    // → rounded to 2.5 = 32.5, bar weight floor max(20, 32.5) = 32.5.
    const out = generateJITSession(
      baseInput({
        activeRehabCap: rehabCap({ capKg: 80 }),
        sorenessRatings: { quads: 10 },
      })
    );
    expect(out.mainLiftSets).toHaveLength(3);
    expect(out.mainLiftSets[0].weight_kg).toBe(32.5);
    expect(out.mainLiftSets[0].reps).toBe(5);
  });

  it('severe soreness without cap uses 40% of uncapped formula weight', () => {
    // Control: 40% × 112.5 = 45kg, rounded to 2.5 = 45.
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 10 } })
    );
    expect(out.mainLiftSets[0].weight_kg).toBe(45);
  });
});

describe('Rehab Mode — recentLogs filtering after cap is lifted', () => {
  it('Step 2 RPE auto-progression ignores rehab-tagged history', () => {
    // No active cap (rehab ended), but recentLogs are from when it was active.
    // Without the filter, two RPE-10 sessions would trigger ×0.95 weight cut.
    // With the filter, both are excluded → no auto-progression fires.
    const polluted = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 10, target_rpe: 8, containedRehabSets: true },
          { actual_rpe: 10, target_rpe: 8, containedRehabSets: true },
        ],
      })
    );
    const clean = generateJITSession(baseInput());
    expect(polluted.mainLiftSets[0].weight_kg).toBe(
      clean.mainLiftSets[0].weight_kg
    );
    expect(
      polluted.rationale.some((r) => /Recent RPE above target/i.test(r))
    ).toBe(false);
  });

  it('Step 0 volume calibration ignores rehab-tagged history', () => {
    // Two RPE-6 (target 8) sessions tagged as rehab — without filter would
    // signal "easy work, add sets". With filter, calibration sees no signal.
    const polluted = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 6, target_rpe: 8, containedRehabSets: true },
          { actual_rpe: 6, target_rpe: 8, containedRehabSets: true },
        ],
        sleepQuality: 5,
        energyLevel: 5,
        sorenessRatings: { quads: 1, glutes: 1, lower_back: 1 },
      })
    );
    expect(
      polluted.rationale.some((r) => /below target — \+/i.test(r))
    ).toBe(false);
  });

  it('clean sessions in recentLogs still drive auto-progression normally', () => {
    // Mix of clean + rehab-tagged; the two clean ones must be enough to
    // surface the RPE signal even though the rehab ones are present.
    const out = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 10, target_rpe: 8, containedRehabSets: false },
          { actual_rpe: 10, target_rpe: 8, containedRehabSets: false },
          { actual_rpe: 6, target_rpe: 8, containedRehabSets: true }, // noise
        ],
      })
    );
    // Two clean RPE-10 sessions → "RPE above target" cut should fire
    expect(
      out.rationale.some((r) => /Recent RPE above target/i.test(r))
    ).toBe(true);
  });
});
