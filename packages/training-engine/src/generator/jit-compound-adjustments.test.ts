import { baseInput, makeDisruption } from '../__test-helpers__/fixtures';
import { DEFAULT_FORMULA_CONFIG_FEMALE } from '../cube/blocks';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../volume/mrv-mev-calculator';
import { generateJITSession } from './jit-session-generator';

describe('JIT compound adjustments — multiple adjusters active', () => {
  it('worst realistic day: RPE high + poor readiness + menstrual + moderate soreness', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
        // RPE trending high (2 recent sessions well above target)
        recentLogs: [
          { actual_rpe: 9.5, target_rpe: 8.0 },
          { actual_rpe: 9.5, target_rpe: 8.0 },
        ],
        // Poor sleep + low energy
        sleepQuality: 1,
        energyLevel: 1,
        // Menstrual phase
        cyclePhase: 'menstrual',
        // Moderate quad soreness
        sorenessRatings: { quads: 6 },
      })
    );
    // Multiple reductions should compound — at least 2 rationale entries
    expect(out.rationale.length).toBeGreaterThanOrEqual(2);
    // Should still produce at least 1 set (clamped)
    expect(out.mainLiftSets.length).toBeGreaterThanOrEqual(1);
    // Weight should be significantly reduced from base
    // Female block 1 heavy base = 80% of 1RM = 112.5kg at 140kg 1RM
    // All multipliers compound: ~0.975 * 0.95 * 0.95 * 1.0 ≈ 0.88 → ~99kg → rounds to 100
    expect(out.mainLiftSets[0].weight_kg).toBeLessThanOrEqual(100);
  });

  it('readiness boost approximately cancels luteal phase reduction', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
        sleepQuality: 3,
        energyLevel: 3,
        cyclePhase: 'luteal',
      })
    );
    // Great readiness (×1.025) + luteal (×0.975) ≈ net ×1.0
    // Weight should be very close to unmodified base
    const clean = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
      })
    );
    // Within one rounding step (2.5kg)
    expect(
      Math.abs(out.mainLiftSets[0].weight_kg - clean.mainLiftSets[0].weight_kg)
    ).toBeLessThanOrEqual(2.5);
  });

  it('recovery mode short-circuits all other adjusters', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
        recentLogs: [
          { actual_rpe: 10, target_rpe: 8.0 },
          { actual_rpe: 10, target_rpe: 8.0 },
        ],
        sleepQuality: 1,
        energyLevel: 1,
        cyclePhase: 'menstrual',
        sorenessRatings: { quads: 10 }, // triggers recovery mode
        activeDisruptions: [makeDisruption('moderate')],
      })
    );
    // Recovery mode wins regardless of everything else
    expect(out.mainLiftSets).toHaveLength(3);
    expect(out.mainLiftSets[0].rpe_target).toBe(5.0);
    // Weight is 40% of base, floored at bar weight
    expect(out.mainLiftSets[0].weight_kg).toBeLessThanOrEqual(
      140 * 0.8 * 0.4 + 2.5
    );
  });

  it('MRV cap applies after adjuster reductions', () => {
    // Soreness -1 set reduces volume, then MRV cap should further limit
    const mrvConfig = { ...DEFAULT_MRV_MEV_CONFIG_MALE };
    // Set quad MRV very low so it triggers after soreness reduction
    mrvConfig.quads = { mev: 2, mrv: 3 };

    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 6 }, // -1 set
        weeklyVolumeToDate: { quads: 2 }, // already at 2, MRV is 3 → only 1 set of capacity
        mrvMevConfig: mrvConfig,
      })
    );
    // Soreness reduces, then MRV cap further limits — should be ≤ 1 set
    expect(out.mainLiftSets.length).toBeLessThanOrEqual(1);
  });

  it('disruption + soreness compound conservatively via min()', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 8 }, // -2 sets, ×0.95
        activeDisruptions: [
          {
            ...makeDisruption('moderate'),
            disruption_type: 'other',
            description: 'Hyrox race yesterday',
            affected_lifts: null, // affects all lifts
          },
        ],
      })
    );
    // Both soreness and disruption active — more conservative of each dimension
    expect(out.mainLiftSets.length).toBeGreaterThanOrEqual(1);
    // Rationale should mention both the disruption and soreness
    expect(out.rationale.some((r) => /hyrox/i.test(r))).toBe(true);
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true);
  });
});
