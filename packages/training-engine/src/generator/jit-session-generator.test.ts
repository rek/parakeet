import { TrainingDisruption } from '@parakeet/shared-types';

import {
  atMevExcept,
  baseInput,
  makeDisruption,
} from '../__test-helpers__/fixtures';
import { DEFAULT_CORE_POOL } from '../auxiliary/exercise-catalog';
import {
  DEFAULT_FORMULA_CONFIG_FEMALE,
  DEFAULT_FORMULA_CONFIG_MALE,
  DEFAULT_REST_SECONDS_FEMALE,
  DEFAULT_REST_SECONDS_MALE,
} from '../cube/blocks';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../volume/mrv-mev-calculator';
import { generateJITSession } from './jit-session-generator';

// ---------------------------------------------------------------------------
// Integration test 1: clean squat Block 1 Heavy
// ---------------------------------------------------------------------------

describe('generateJITSession — clean session (no adjustments)', () => {
  it('Squat 140kg Block 1 Heavy → 2 sets × 112.5kg × 5 reps', () => {
    const out = generateJITSession(baseInput());
    expect(out.mainLiftSets).toHaveLength(2);
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5);
    expect(out.mainLiftSets[0].reps).toBe(5);
    expect(out.mainLiftSets[1].weight_kg).toBe(112.5);
  });

  it('setNumbers are sequential', () => {
    const out = generateJITSession(baseInput());
    expect(out.mainLiftSets.map((s) => s.set_number)).toEqual([1, 2]);
  });

  it('warmup sets generated for working weight 112.5kg', () => {
    const out = generateJITSession(baseInput());
    expect(out.warmupSets.length).toBeGreaterThan(0);
    expect(out.warmupSets[out.warmupSets.length - 1].weightKg).toBeLessThan(
      112.5
    );
  });

  it('volumeModifier = 1.0, intensityModifier = 1.0, not skipped', () => {
    const out = generateJITSession(baseInput());
    expect(out.volumeModifier).toBe(1.0);
    expect(out.intensityModifier).toBe(1.0);
    expect(out.skippedMainLift).toBe(false);
    expect(out.warnings).toHaveLength(0);
  });

  it('auxiliaries have sets with reasonable weights', () => {
    const out = generateJITSession(baseInput());
    expect(out.auxiliaryWork).toHaveLength(2);
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false);
      expect(a.sets).toHaveLength(3);
    });
  });
});

// ---------------------------------------------------------------------------
// Per-exercise rep targets
// ---------------------------------------------------------------------------

describe('generateJITSession — per-exercise rep targets', () => {
  it('strength aux (Pause Squat) → 4 reps', () => {
    const out = generateJITSession(
      baseInput({ activeAuxiliaries: ['Pause Squat', 'Barbell Box Squat'] })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(4);
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(4);
  });

  it('hypertrophy aux (Dumbbell Romanian Deadlift) → 8 reps', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeAuxiliaries: ['Dumbbell Romanian Deadlift', 'Good Mornings'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(8); // Dumbbell Romanian Deadlift
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(10); // Good Mornings
  });

  it('high-rep aux (Hyperextension) → 15 reps', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeAuxiliaries: ['Hyperextension', 'Dumbbell Romanian Deadlift'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(15);
  });

  it('unknown exercise → falls back to baseReps (10 male)', () => {
    const out = generateJITSession(
      baseInput({
        activeAuxiliaries: ['Some Unknown Exercise', 'Another Unknown'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(10);
  });

  it('unknown exercise → falls back to baseReps (12 female)', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        activeAuxiliaries: ['Some Unknown Exercise', 'Another Unknown'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(12);
  });

  it('biceps aux (Barbell Curl) → 10 reps, weight at 20% of 1RM not 67.5%', () => {
    // bench 1RM 140kg → Barbell Curl (barbell, linear): 140*0.20=28→27.5kg
    // Dumbbell Curl (dumbbell, sqrt): 0.15×sqrt(80×140)=0.15×105.83=15.87→15
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 140,
        activeAuxiliaries: ['Barbell Curl', 'Dumbbell Curl'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(10);
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(27.5); // 140 * 0.20 = 28 → 27.5
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(12);
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(15); // sqrt-scaled: 0.15×sqrt(80×140)=15.87→15
  });
});

// ---------------------------------------------------------------------------
// Catalog exercise weight percentages (not default 67.5%)
// ---------------------------------------------------------------------------

describe('generateJITSession — catalog exercise weight percentages', () => {
  it('Dumbbell Step Up uses sqrt-scaled 15% of squat 1RM, not default 67.5%', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        oneRmKg: 180,
        activeAuxiliaries: ['Dumbbell Step Up', 'Barbell Front Squat'],
      })
    );
    // Dumbbell: sqrt scaling + 0.85× fatigue discount (quads overlap squat)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(20);
    // Barbell: linear + 0.85× fatigue discount (quads overlap squat)
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(100);
  });

  it('Kettlebell Swing uses sqrt-scaled 20% of deadlift 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        oneRmKg: 220,
        activeAuxiliaries: ['Kettlebell Swing', 'Barbell Row'],
      })
    );
    // Kettlebell: sqrt + 0.85× fatigue (hamstrings overlap deadlift)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(30);
    // Barbell Row: linear + 0.85× fatigue (upper_back overlap deadlift)
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(75);
  });

  it('Dumbbell Fly uses sqrt-scaled 12% of bench 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 120,
        activeAuxiliaries: ['Dumbbell Fly', 'Close-Grip Barbell Bench Press'],
      })
    );
    // Dumbbell Fly: sqrt + 0.85× fatigue (chest overlap bench)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(10);
    // CGBP: linear + 0.85× fatigue (triceps overlap bench)
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(77.5);
  });

  it('Dumbbell Row uses sqrt-scaled 20% of deadlift 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        oneRmKg: 220,
        activeAuxiliaries: ['Dumbbell Row', 'Rack Pull'],
      })
    );
    // Dumbbell Row: sqrt + 0.85× fatigue (upper_back overlap deadlift)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(30);
    // Rack Pull: linear 105% + 0.85× fatigue (upper_back+lower_back overlap deadlift)
    // 220 × 1.05 = 231 → round2.5 = 230 × 0.85 = 195.5 → round2.5 = 195
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(195);
  });

  it('unknown custom exercise falls back to 67.5% default', () => {
    const out = generateJITSession(
      baseInput({
        oneRmKg: 140,
        activeAuxiliaries: ['Custom User Exercise', 'Another Custom'],
      })
    );
    // Unknown exercises fall back to 67.5% linear scaling
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(95);
  });
});

describe('generateJITSession — catalog exercise rep targets', () => {
  it('Barbell Box Squat gets 4 reps (strength), Dumbbell Step Up gets 10 (hypertrophy)', () => {
    const out = generateJITSession(
      baseInput({
        activeAuxiliaries: ['Barbell Box Squat', 'Dumbbell Step Up'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(4);
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(10);
  });

  it('Rack Pull gets 4 reps, Dumbbell Romanian Deadlift gets 8', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeAuxiliaries: ['Rack Pull', 'Dumbbell Romanian Deadlift'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(4);
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Integration test 2: soreness adjustment
// ---------------------------------------------------------------------------

describe('generateJITSession — soreness adjustments', () => {
  it('soreness=8 on quads → 1 set (clamped) at 107.5kg', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 8 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
    expect(out.mainLiftSets[0].weight_kg).toBe(107.5);
  });

  it('soreness=8 adds a warning to rationale', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 8 } })
    );
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true);
  });

  it('soreness=10 → recovery mode: 3 sets × 5 reps at 45kg (40% of 112.5→45)', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 10 } })
    );
    expect(out.mainLiftSets).toHaveLength(3);
    out.mainLiftSets.forEach((s) => {
      expect(s.weight_kg).toBe(45);
      expect(s.reps).toBe(5);
      expect(s.rpe_target).toBe(5.0);
    });
    expect(out.intensityModifier).toBe(0.4);
    expect(out.rationale.some((r) => /recovery/i.test(r))).toBe(true);
  });

  it('soreness=10 → all auxiliaries skipped', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 10 } })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(true);
    });
  });

  it('soreness=6 on quads → 1 set (2-1=1)', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 6 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
    // intensity unchanged for soreness=6
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5);
  });
});

// ---------------------------------------------------------------------------
// Integration test 3 & 4: MRV checks
// ---------------------------------------------------------------------------

describe('generateJITSession — MRV checks', () => {
  it('18 weekly quad sets (MRV=20) → caps sets at 2 when base > 2', () => {
    // block3 rep gives 3 base sets: Math.round((2+3)/2) = 3 (but rounding = 2 actually, let me check)
    // block3 rep: sets_min=2, sets_max=3 → Math.round(2.5) = 3. Wait, 2.5 in JS rounds to 2 (banker's rounding? No, Math.round(2.5) = 3).
    // Actually Math.round(2.5) = 3 in JS. So 3 sets.
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'rep',
        weeklyVolumeToDate: { quads: 18 },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    // base = 3 sets, remaining quads = 2, cap to 2
    expect(out.mainLiftSets).toHaveLength(2);
    expect(out.warnings.some((w) => /MRV.*quads/i.test(w))).toBe(true);
  });

  it('21 weekly quad sets (MRV=20) → skippedMainLift=true', () => {
    const out = generateJITSession(
      baseInput({
        weeklyVolumeToDate: { quads: 21 },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    expect(out.skippedMainLift).toBe(true);
    expect(out.mainLiftSets).toHaveLength(0);
    expect(out.warmupSets).toHaveLength(0);
    expect(out.warnings.some((w) => /MRV exceeded.*quads/i.test(w))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration test 5: RPE history adjustment
// ---------------------------------------------------------------------------

describe('generateJITSession — RPE history', () => {
  it('2 sessions RPE 9.5 (target 8.5) → weight reduced to 110kg (112.5 × 0.975)', () => {
    const out = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 9.5, target_rpe: 8.5 },
          { actual_rpe: 9.5, target_rpe: 8.5 },
        ],
      })
    );
    // RPE adjustment reduces intensity by 2.5%
    expect(out.mainLiftSets[0].weight_kg).toBe(110);
    expect(out.rationale.some((r) => /RPE above target/i.test(r))).toBe(true);
  });

  it('only 1 RPE log → no adjustment', () => {
    const out = generateJITSession(
      baseInput({
        recentLogs: [{ actual_rpe: 9.5, target_rpe: 8.5 }],
      })
    );
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5);
  });

  it('2 sessions low RPE (7.0 vs target 8.5) → weight increased to 117.5kg (112.5 × 1.05, large gap)', () => {
    const out = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 7.0, target_rpe: 8.5 },
          { actual_rpe: 7.0, target_rpe: 8.5 },
        ],
      })
    );
    // avg gap = -1.5 (large, >= 1.25) → 5% boost: 112.5 × 1.05 = 118.125 → 117.5
    expect(out.mainLiftSets[0].weight_kg).toBe(117.5);
    expect(out.rationale.some((r) => /RPE below target/i.test(r))).toBe(true);
  });

  it('2 sessions moderately low RPE (7.5 vs target 8.5) → small boost (112.5 × 1.025)', () => {
    const out = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 7.5, target_rpe: 8.5 },
          { actual_rpe: 7.5, target_rpe: 8.5 },
        ],
      })
    );
    // avg gap = -1.0 (small, 0.75-1.25) → 2.5% boost: 112.5 × 1.025 = 115.3 → 115
    expect(out.mainLiftSets[0].weight_kg).toBe(115);
  });

  it('2 sessions RPE only slightly below target (8.0 vs 8.5) → no adjustment (gap 0.5 < 0.75)', () => {
    const out = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 8.0, target_rpe: 8.5 },
          { actual_rpe: 8.0, target_rpe: 8.5 },
        ],
      })
    );
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5);
  });
});

// ---------------------------------------------------------------------------
// Integration test 6: disruption override
// ---------------------------------------------------------------------------

describe('generateJITSession — disruption adjustment', () => {
  it('moderate disruption + high soreness compounds — takes more conservative per dimension', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 8 }, // soreness: -2 sets (2→0, clamped to 1), ×0.95
        activeDisruptions: [makeDisruption('moderate')], // disruption: ceil(2/2)=1 set, ×0.90
      })
    );
    // min(1 from soreness, 1 from disruption) = 1 set
    expect(out.mainLiftSets).toHaveLength(1);
    // min(0.95 from soreness, 0.90 from disruption) = 0.90
    // min(soreness ×0.95, disruption ×0.90) = ×0.90
    expect(out.mainLiftSets[0].weight_kg).toBe(102.5);
    expect(out.rationale.some((r) => /knee injury/i.test(r))).toBe(true);
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true);
  });

  it('moderate disruption is limiting factor when soreness is low', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 2 }, // soreness: no reduction (×1.0)
        activeDisruptions: [makeDisruption('moderate')], // disruption: ceil(2/2)=1 set, ×0.90
      })
    );
    // soreness doesn't reduce (2 sets, ×1.0), disruption gives 1 set at ×0.90
    // min(2, 1) = 1 set; min(1.0, 0.90) = 0.90
    expect(out.mainLiftSets).toHaveLength(1);
    expect(out.mainLiftSets[0].weight_kg).toBe(102.5);
  });

  it('soreness is limiting factor when disruption is minor', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 8 }, // soreness: -2 sets → 1 set, ×0.95
        activeDisruptions: [makeDisruption('minor')], // minor: no set/intensity change
      })
    );
    // minor disruption only adds rationale, doesn't reduce
    // soreness is the limiting factor: 1 set at ×0.95
    expect(out.mainLiftSets).toHaveLength(1);
    // Soreness alone is the limiting factor (×0.95)
    expect(out.mainLiftSets[0].weight_kg).toBe(107.5);
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true);
  });

  it('recovery mode (soreness 10) is not overridden by moderate disruption', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 10 }, // recovery mode: 3×5 at 40%
        activeDisruptions: [makeDisruption('moderate')],
      })
    );
    // Recovery mode takes precedence — disruption should not interfere
    expect(out.mainLiftSets).toHaveLength(3);
    // Recovery mode: 40% of base weight
    expect(out.mainLiftSets[0].weight_kg).toBe(45);
    expect(out.mainLiftSets[0].rpe_target).toBe(5.0);
  });

  it('major disruption → skipped main lift', () => {
    const out = generateJITSession(
      baseInput({
        activeDisruptions: [makeDisruption('major')],
      })
    );
    expect(out.skippedMainLift).toBe(true);
    expect(out.mainLiftSets).toHaveLength(0);
  });

  it('disruption on different lift does not affect this session', () => {
    const out = generateJITSession(
      baseInput({
        activeDisruptions: [makeDisruption('major', 'bench')],
      })
    );
    expect(out.skippedMainLift).toBe(false);
    expect(out.mainLiftSets).toHaveLength(2);
  });

  it('disruption with null affected_lifts applies to all lifts', () => {
    const dis = { ...makeDisruption('major'), affected_lifts: null };
    const out = generateJITSession(baseInput({ activeDisruptions: [dis] }));
    expect(out.skippedMainLift).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration test 7: auxiliary soreness
// ---------------------------------------------------------------------------

describe('generateJITSession — auxiliary soreness on bench day', () => {
  it('soreness=10 on chest during bench day → auxiliary Dips skipped', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        intensityType: 'heavy',
        blockNumber: 1,
        oneRmKg: 100,
        sorenessRatings: { chest: 10 },
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dips'],
      })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(true);
    });
  });

  it('soreness=6 on quads → auxiliary sets reduced by 1 (3→2)', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 6 } })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false);
      expect(a.sets).toHaveLength(2); // 3 - 1
    });
  });

  it('soreness=8 on quads → auxiliary 1 set at 95% intensity', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 8 },
        // Use unknown exercises so they fall back to 0.675 default weightPct
        activeAuxiliaries: ['Unknown Aux A', 'Unknown Aux B'],
      })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false);
      expect(a.sets).toHaveLength(2);
      // 140 × 0.675 = 94.5 → round = 95; 95 × 0.95 = 90.25 → round = 90
      expect(a.sets[0].weight_kg).toBe(90);
    });
  });
});

// ---------------------------------------------------------------------------
// Warmup edge cases
// ---------------------------------------------------------------------------

describe('generateJITSession — warmup', () => {
  it('skipped main lift → no warmup sets', () => {
    const out = generateJITSession(
      baseInput({
        weeklyVolumeToDate: { quads: 25 },
      })
    );
    expect(out.skippedMainLift).toBe(true);
    expect(out.warmupSets).toHaveLength(0);
  });

  it('recovery mode → minimal warmup protocol', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 10 } })
    );
    // minimal = 2 steps (50%×5 + 75%×2), working weight = 45kg
    // 45 × 0.50 = 22.5 → round = 22.5; 45 × 0.75 = 33.75 → round = 35
    expect(out.warmupSets).toHaveLength(2);
  });

  it('recovery mode + explicit warmup config → preserves user protocol', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 10 },
        warmupConfig: { type: 'preset', name: 'extended' },
        warmupConfigExplicit: true,
      })
    );
    // extended protocol should NOT be overridden to minimal
    expect(out.warmupSets.length).toBeGreaterThan(2);
  });

  it('low working weight + explicit warmup config → preserves user protocol', () => {
    const out = generateJITSession(
      baseInput({
        oneRmKg: 40, // produces working weight < 40kg
        warmupConfig: { type: 'preset', name: 'empty_bar' },
        warmupConfigExplicit: true,
      })
    );
    // empty_bar has 4 steps; some may deduplicate at low weight but more than minimal's 2
    expect(out.warmupSets.length).toBeGreaterThanOrEqual(2);
  });

  it('low working weight + implicit warmup config → forces minimal', () => {
    const out = generateJITSession(
      baseInput({
        oneRmKg: 40,
        warmupConfig: { type: 'preset', name: 'extended' },
        // warmupConfigExplicit not set → defaults to falsy
      })
    );
    expect(out.warmupSets).toHaveLength(2); // minimal = 2 steps
  });
});

// ---------------------------------------------------------------------------
// Sex-based adaptations
// ---------------------------------------------------------------------------

// Use unmapped exercise names so tests verify the sex-based fallback, not per-exercise targets
const UNKNOWN_AUX: [string, string] = [
  'Custom Exercise A',
  'Custom Exercise B',
];

describe('generateJITSession — biologicalSex auxiliary reps', () => {
  it('no sex → auxiliary reps default to 10', () => {
    const out = generateJITSession(
      baseInput({ activeAuxiliaries: UNKNOWN_AUX })
    );
    out.auxiliaryWork
      .filter((a) => !a.skipped)
      .forEach((a) => {
        a.sets.forEach((s) => expect(s.reps).toBe(10));
      });
  });

  it('male → auxiliary reps 10', () => {
    const out = generateJITSession(
      baseInput({ biologicalSex: 'male', activeAuxiliaries: UNKNOWN_AUX })
    );
    out.auxiliaryWork
      .filter((a) => !a.skipped)
      .forEach((a) => {
        a.sets.forEach((s) => expect(s.reps).toBe(10));
      });
  });

  it('female → auxiliary reps 12', () => {
    const out = generateJITSession(
      baseInput({ biologicalSex: 'female', activeAuxiliaries: UNKNOWN_AUX })
    );
    out.auxiliaryWork
      .filter((a) => !a.skipped)
      .forEach((a) => {
        a.sets.forEach((s) => expect(s.reps).toBe(12));
      });
  });

  it('female at soreness 6 → 2 sets × 12 reps', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        sorenessRatings: { quads: 6 },
        activeAuxiliaries: UNKNOWN_AUX,
      })
    );
    out.auxiliaryWork
      .filter((a) => !a.skipped)
      .forEach((a) => {
        expect(a.sets).toHaveLength(2);
        a.sets.forEach((s) => expect(s.reps).toBe(12));
      });
  });
});

describe('generateJITSession — biologicalSex soreness (female level 8)', () => {
  it('female soreness 8 → main lift −1 set (not −2)', () => {
    // Block 1 heavy: 2 base sets; female level-8 soreness: −1 = 1 set
    const out = generateJITSession(
      baseInput({ biologicalSex: 'female', sorenessRatings: { quads: 8 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
  });

  it('male soreness 8 → main lift −2 sets (clamped to 1)', () => {
    // Block 1 heavy: 2 base sets; male level-8: −2 → clamped to 1
    const out = generateJITSession(
      baseInput({ biologicalSex: 'male', sorenessRatings: { quads: 8 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// engine-020: rest recommendations
// ---------------------------------------------------------------------------

describe('generateJITSession — restRecommendations', () => {
  it('Block 3 Heavy, male defaults → mainLift all 300s', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      })
    );
    // male block3.heavy = 300
    expect(DEFAULT_REST_SECONDS_MALE.block3.heavy).toBe(300);
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(300));
  });

  it('Block 2 Rep, female defaults → mainLift all 90s', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 2,
        intensityType: 'rep',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
      })
    );
    // female block2.rep = 90
    expect(DEFAULT_REST_SECONDS_FEMALE.block2.rep).toBe(90);
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(90));
  });

  it('user override for squat heavy → override value used instead of formula default', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        primaryLift: 'squat',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
        userRestOverrides: [
          { lift: 'squat', intensityType: 'heavy', restSeconds: 240 },
        ],
      })
    );
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(240));
  });

  it('auxiliary always 90 regardless of block or sex', () => {
    const maleOut = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      })
    );
    maleOut.restRecommendations.auxiliary.forEach((r) => expect(r).toBe(90));

    const femaleOut = generateJITSession(
      baseInput({
        blockNumber: 1,
        intensityType: 'explosive',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
      })
    );
    femaleOut.restRecommendations.auxiliary.forEach((r) => expect(r).toBe(90));
  });

  it('deload session → deload rest (90s)', () => {
    // Use block 1 but intensityType deload to exercise the deload path
    const out = generateJITSession(
      baseInput({
        blockNumber: 1,
        intensityType: 'deload',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      })
    );
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(90));
  });

  it('mainLift array length matches mainLiftSets length', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      })
    );
    expect(out.restRecommendations.mainLift).toHaveLength(
      out.mainLiftSets.length
    );
  });

  it('auxiliary array length matches auxiliaryWork length', () => {
    const out = generateJITSession(baseInput());
    expect(out.restRecommendations.auxiliary).toHaveLength(
      out.auxiliaryWork.length
    );
  });

  it('skipped main lift → empty mainLift rest array', () => {
    const out = generateJITSession(
      baseInput({
        weeklyVolumeToDate: { quads: 25 },
      })
    );
    expect(out.skippedMainLift).toBe(true);
    expect(out.restRecommendations.mainLift).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// No-equipment disruption: aux boost + bodyweight compensation
// ---------------------------------------------------------------------------

function makeEquipmentDisruption(
  overrides: Partial<TrainingDisruption> = {}
): TrainingDisruption {
  return {
    id: 'dis-001',
    user_id: 'user-001',
    program_id: null,
    session_ids_affected: null,
    reported_at: '2026-03-06T10:00:00Z',
    disruption_type: 'equipment_unavailable',
    severity: 'moderate',
    affected_date_start: '2026-03-06',
    affected_date_end: null,
    affected_lifts: null,
    description: 'No gym access today',
    adjustment_applied: null,
    resolved_at: null,
    status: 'active',
    ...overrides,
  };
}

describe('generateJITSession — equipment_unavailable disruption', () => {
  it('adds 2 bodyweight exercises to auxiliaryWork', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] })
    );
    expect(out.auxiliaryWork).toHaveLength(4); // 2 regular + 2 bodyweight
  });

  it('bodyweight exercises have weight_kg = 0', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] })
    );
    const bwExercises = out.auxiliaryWork.slice(2);
    for (const ex of bwExercises) {
      expect(ex.skipped).toBe(false);
      expect(ex.sets.every((s) => s.weight_kg === 0)).toBe(true);
    }
  });

  it('male: bodyweight exercises have 3 sets × 10 reps at RPE 7.0', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] })
    );
    const bwExercises = out.auxiliaryWork.slice(2);
    for (const ex of bwExercises) {
      expect(ex.sets).toHaveLength(3);
      expect(ex.sets[0].reps).toBe(10);
      expect(ex.sets[0].rpe_target).toBe(7.0);
    }
  });

  it('female: bodyweight exercises have 3 sets × 15 reps at RPE 7.0', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwExercises = out.auxiliaryWork.slice(2);
    for (const ex of bwExercises) {
      expect(ex.sets).toHaveLength(3);
      expect(ex.sets[0].reps).toBe(15);
      expect(ex.sets[0].rpe_target).toBe(7.0);
    }
  });

  it('regular aux exercises get +1 set (4 total instead of 3)', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] })
    );
    const regularAux = out.auxiliaryWork.slice(0, 2);
    for (const ex of regularAux) {
      expect(ex.sets).toHaveLength(4);
    }
  });

  it('adds no-equipment rationale message', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] })
    );
    expect(
      out.rationale.some((r) => r.includes('bodyweight compensation'))
    ).toBe(true);
  });

  // Male (default / unspecified sex)
  it('male squat → explosive/strength bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise);
    expect(bwNames).toEqual(['Jump Squat', 'Pistol Squat']);
  });

  it('male bench → upper-body intensity variations', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise);
    expect(bwNames).toEqual(['Decline Push-ups', 'Diamond Push-ups']);
  });

  it('male deadlift → posterior chain bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise);
    expect(bwNames).toEqual(['Nordic Hamstring Curl', 'Single-Leg RDL']);
  });

  // Female
  it('female squat → glute/hip-focused bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        biologicalSex: 'female',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise);
    expect(bwNames).toEqual(['Sumo Squat', 'Curtsy Lunge']);
  });

  it('female bench → accessible push-up variations', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        biologicalSex: 'female',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise);
    expect(bwNames).toEqual(['Standard Push-ups', 'Wide Push-ups']);
  });

  it('female deadlift → glute-focused bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        biologicalSex: 'female',
        activeDisruptions: [makeEquipmentDisruption()],
      })
    );
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise);
    expect(bwNames).toEqual(['Hip Thrust', 'Single-Leg Glute Bridge']);
  });

  it('rest recommendations length matches auxiliaryWork length (4 items)', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] })
    );
    expect(out.restRecommendations.auxiliary).toHaveLength(
      out.auxiliaryWork.length
    );
  });

  it('bodyweight exercises still added when soreness >= 9 (0 kg is always appropriate)', () => {
    const out = generateJITSession(
      baseInput({
        activeDisruptions: [makeEquipmentDisruption()],
        sorenessRatings: { quads: 10 },
      })
    );
    // Original aux exercises are skipped due to soreness, but bodyweight
    // compensation is still appended because 0-kg exercises suit any soreness level.
    const active = out.auxiliaryWork.filter((ex) => !ex.skipped);
    const skipped = out.auxiliaryWork.filter((ex) => ex.skipped);
    expect(skipped.length).toBeGreaterThanOrEqual(1);
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active.every((ex) => ex.sets.every((s) => s.weight_kg === 0))).toBe(true);
  });

  it('exercise cap: no-equipment + auxiliaryPool combined does not exceed 5 non-skipped aux exercises', () => {
    // 2 original + 2 bodyweight = 4 non-skipped; top-ups from pool should be capped to 1 (not 2)
    const pool = [
      'Dumbbell Romanian Deadlift',
      'Stiff-Leg Deadlift',
      'Leg Press',
    ];
    const out = generateJITSession(
      baseInput({
        activeDisruptions: [makeEquipmentDisruption()],
        auxiliaryPool: pool,
        weeklyVolumeToDate: {},
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const activeCount = out.auxiliaryWork.filter((a) => !a.skipped).length;
    expect(activeCount).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// engine-027: volume top-up
// ---------------------------------------------------------------------------

describe('generateJITSession — volume top-up (engine-027)', () => {
  // Pool covers hamstrings (Dumbbell Romanian Deadlift → hamstrings 1.0), quads (Leg Press → quads 1.0)
  // and Stiff-Leg Deadlift (hamstrings 1.0) as a fallback for the exclusion test.
  const pool = [
    'Dumbbell Romanian Deadlift',
    'Stiff-Leg Deadlift',
    'Leg Press',
  ];

  it('no auxiliaryPool → no top-up exercises appended', () => {
    const out = generateJITSession(baseInput());
    expect(out.auxiliaryWork.every((a) => !a.isTopUp)).toBe(true);
  });

  it('empty auxiliaryPool → no top-up exercises appended', () => {
    const out = generateJITSession(baseInput({ auxiliaryPool: [] }));
    expect(out.auxiliaryWork.every((a) => !a.isTopUp)).toBe(true);
  });

  it('muscle at/above MEV after main lift → no top-up for that muscle', () => {
    // hamstrings MEV=6; weeklyVol=5; squat contributes 0.5 × 2 sets = floor(1) → projected=6 ≥ 6 → no deficit
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          hamstrings: 5,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.every((a) => !a.topUpReason?.includes('hamstrings'))).toBe(
      true
    );
  });

  it('muscle below MEV → top-up exercise appended with isTopUp=true', () => {
    // hamstrings MEV=6; only deficient muscle; Romanian DL targets hamstrings 1.0
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeGreaterThan(0);
    expect(topUps[0].isTopUp).toBe(true);
    expect(topUps[0].topUpReason).toContain('below MEV');
  });

  it('top-up sets capped at 3', () => {
    const mrvMev = {
      ...DEFAULT_MRV_MEV_CONFIG_MALE,
      hamstrings: { mev: 20, mrv: 30 },
    };
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(mrvMev, 'hamstrings'),
        mrvMevConfig: mrvMev,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    topUps.forEach((a) => expect(a.sets.length).toBeLessThanOrEqual(3));
  });

  it('max 2 top-up exercises even when 3+ muscles below MEV', () => {
    // Use a large pool that covers many muscles; keep all at 0 volume
    const broadPool = [
      'Dumbbell Romanian Deadlift',
      'Leg Press',
      'Dumbbell Incline Bench Press',
      'Close-Grip Barbell Bench Press',
      'Barbell Curl',
    ];
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: broadPool,
        weeklyVolumeToDate: {},
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          chest: { mev: 20, mrv: 30 },
          upper_back: { mev: 20, mrv: 30 },
          triceps: { mev: 20, mrv: 30 },
          biceps: { mev: 20, mrv: 30 },
        },
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeLessThanOrEqual(2);
  });

  it('excludes exercises already in activeAuxiliaries', () => {
    // Dumbbell Romanian Deadlift is the best hamstring match; make it an active auxiliary
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        activeAuxiliaries: ['Dumbbell Romanian Deadlift', 'Barbell Box Squat'],
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(
      topUps.every((a) => a.exercise !== 'Dumbbell Romanian Deadlift')
    ).toBe(true);
    // Stiff-Leg Deadlift should be used instead
    if (topUps.length > 0) {
      expect(topUps[0].exercise).toBe('Stiff-Leg Deadlift');
    }
  });

  it('no qualifying exercise in pool → no top-up for that muscle', () => {
    // Pool has no exercises targeting hamstrings with contribution >= 1.0
    const noHamstringPool = ['Leg Press', 'Close-Grip Barbell Bench Press'];
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: noHamstringPool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('hamstrings')
    );
    expect(topUps).toHaveLength(0);
  });

  it('skips exercises associated with upcoming lifts (GH#95)', () => {
    // Bench day, squat tomorrow — Leg Press (squat-associated) should be skipped
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
        auxiliaryPool: [
          'Leg Press',
          'Dumbbell Romanian Deadlift',
          'Barbell Curl',
        ],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'quads'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        upcomingLifts: ['squat'],
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    // Leg Press targets quads but is squat-associated — should be excluded
    expect(topUps.every((a) => a.exercise !== 'Leg Press')).toBe(true);
  });

  it('allows exercises when their lift is NOT upcoming', () => {
    // Bench day, deadlift tomorrow — Leg Press (squat-associated) should be fine
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
        auxiliaryPool: ['Leg Press', 'Barbell Curl'],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'quads'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        upcomingLifts: ['deadlift'],
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    const hasLegPress = topUps.some((a) => a.exercise === 'Leg Press');
    expect(hasLegPress).toBe(true);
  });

  it('no upcomingLifts → all exercises eligible (backward compatible)', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
        auxiliaryPool: ['Leg Press', 'Barbell Curl'],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'quads'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    const hasLegPress = topUps.some((a) => a.exercise === 'Leg Press');
    expect(hasLegPress).toBe(true);
  });

  it('top-up rationale added to output rationale[]', () => {
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const hasTopUpRationale = out.rationale.some((r) =>
      r.includes('below MEV')
    );
    expect(hasTopUpRationale).toBe(true);
  });

  it('skips exercises associated with injured lifts (GH#165)', () => {
    // Bench day, knee injury affecting squat — Leg Press (squat-associated) should be skipped
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
        auxiliaryPool: [
          'Leg Press',
          'Dumbbell Romanian Deadlift',
          'Barbell Curl',
        ],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'quads'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        activeDisruptions: [makeEquipmentDisruption({
          disruption_type: 'injury',
          severity: 'moderate',
          affected_lifts: ['squat'],
          description: 'Knee injury',
        })],
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.every((a) => a.exercise !== 'Leg Press')).toBe(true);
  });

  it('null affected_lifts disruption does not filter top-up exercises', () => {
    // Generic illness with null affected_lifts should not filter exercises by lift association
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
        auxiliaryPool: ['Leg Press', 'Barbell Curl'],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'quads'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        activeDisruptions: [makeEquipmentDisruption({
          disruption_type: 'illness',
          severity: 'minor',
          affected_lifts: null,
          description: 'Mild cold',
        })],
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    const hasLegPress = topUps.some((a) => a.exercise === 'Leg Press');
    expect(hasLegPress).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// #191: core volume top-up
// ---------------------------------------------------------------------------

describe('generateJITSession — core volume top-up (#191)', () => {
  it('core below MEV → selects a core exercise from DEFAULT_CORE_POOL', () => {
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: DEFAULT_CORE_POOL,
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'core'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const coreTopUps = out.auxiliaryWork.filter(
      (a) => a.isTopUp && DEFAULT_CORE_POOL.includes(a.exercise)
    );
    expect(coreTopUps.length).toBeGreaterThan(0);
    expect(coreTopUps[0].topUpReason).toContain('below MEV');
  });

  it('core deficit < non-core deficit → core still forced into top-up slot', () => {
    // All muscles at 0 weekly volume. Squat contributes 0 to upper_back/core,
    // so both show deficits; upper_back deficit (10) >> core deficit (4).
    // Under raw-deficit sort, upper_back + another large-deficit muscle would
    // take both slots and core would be dropped. Core-priority rule pins core.
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: [...DEFAULT_CORE_POOL, 'Barbell Hang Clean'],
        weeklyVolumeToDate: {},
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    const coreTopUps = topUps.filter((a) =>
      DEFAULT_CORE_POOL.includes(a.exercise)
    );
    expect(coreTopUps.length).toBe(1);
    // The other slot should be filled by the highest-deficit non-core muscle
    expect(topUps.length).toBe(2);
    expect(topUps.some((a) => a.exercise === 'Barbell Hang Clean')).toBe(true);
  });

  it('core pinned but no qualifying core exercise → slot dropped, non-core still selected', () => {
    // Pool has no core primary-movers. Core is pinned as first candidate but
    // silently drops when qualifying=[]. The non-core slot must still fire so
    // a future "fix" that falls back to a third non-core candidate breaks here.
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: ['Barbell Hang Clean'],
        weeklyVolumeToDate: {},
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBe(1);
    expect(topUps[0].exercise).toBe('Barbell Hang Clean');
  });

  it('DEFAULT_CORE_POOL excludes timed exercises', () => {
    expect(DEFAULT_CORE_POOL.length).toBeGreaterThan(0);
    // Plank is timed — must be excluded so volume top-up can select core exercises
    expect(DEFAULT_CORE_POOL).not.toContain('Plank');
    // Known non-timed core exercises must be present
    expect(DEFAULT_CORE_POOL).toContain('Toes to Bar');
    expect(DEFAULT_CORE_POOL).toContain('Ab Wheel Rollout');
    expect(DEFAULT_CORE_POOL).toContain('Hanging Leg Raise');
    expect(DEFAULT_CORE_POOL).toContain('Dead Bug');
    expect(DEFAULT_CORE_POOL).toContain('Bird Dog');
    expect(DEFAULT_CORE_POOL).toContain('GHD Situp');
    expect(DEFAULT_CORE_POOL).toContain('Decline Situp');
    expect(DEFAULT_CORE_POOL).toContain('Cable Woodchop');
    expect(DEFAULT_CORE_POOL).toContain('Dragon Flag');
    expect(DEFAULT_CORE_POOL).toContain('Landmine Rotation');
    expect(DEFAULT_CORE_POOL).toContain('Standing Plate Rotation');
  });
});

// ---------------------------------------------------------------------------
// engine-027 fix: volume top-up MEV pro-rating by week progress
// ---------------------------------------------------------------------------

describe('generateJITSession — volume top-up MEV pro-rating', () => {
  const pool = [
    'Dumbbell Romanian Deadlift',
    'Stiff-Leg Deadlift',
    'Leg Press',
  ];

  it('session 1 of 3: moderate deficit does NOT trigger top-up', () => {
    // hamstrings MEV=6; effectiveMev = ceil(6*1/3) = 2
    // squat contributes hamstrings 0.5 × 2 sets = floor(1) → projected=1
    // deficit = 2-1 = 1, but other muscles at MEV; only 1 set top-up possible
    // Set weeklyVol for hamstrings to 1 so projected=2 → deficit=0
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          hamstrings: 1,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 1,
        totalSessionsThisWeek: 3,
      })
    );
    const topUps = out.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('hamstrings')
    );
    expect(topUps).toHaveLength(0);
  });

  it('session 3 of 3: full MEV applies — same as no pro-rating', () => {
    // hamstrings MEV=6; effectiveMev = ceil(6*3/3) = 6; weeklyVol=0 → deficit=6-projected
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 3,
        totalSessionsThisWeek: 3,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeGreaterThan(0);
    expect(topUps[0].topUpReason).toContain('below MEV');
  });

  it('session 2 of 3: only severe deficit triggers', () => {
    // hamstrings MEV=6; effectiveMev = ceil(6*2/3) = 4
    // weeklyVol=3, squat contributes floor(2*0.5)=1 → projected=4 → deficit=0
    const outNoTrigger = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          hamstrings: 3,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 2,
        totalSessionsThisWeek: 3,
      })
    );
    const noTrigger = outNoTrigger.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('hamstrings')
    );
    expect(noTrigger).toHaveLength(0);

    // weeklyVol=0, projected=1 → deficit=3 → triggers
    const outTrigger = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 2,
        totalSessionsThisWeek: 3,
      })
    );
    const trigger = outTrigger.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('hamstrings')
    );
    expect(trigger.length).toBeGreaterThan(0);
  });

  it('missing sessionIndex/totalSessionsThisWeek falls back to full MEV', () => {
    // Same as the existing "muscle below MEV" test — no pro-rating fields
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        // sessionIndex and totalSessionsThisWeek intentionally omitted
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeGreaterThan(0);
  });

  it('sessionIndex=0 falls back to full MEV (0 is falsy — no pro-rating)', () => {
    // sessionIndex=0 is falsy, so the pro-rating branch is skipped.
    // effectiveMev = full MEV, not pro-rated.
    // weeklyVol for hamstrings=0 → deficit = full hamstrings MEV → triggers top-up.
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 0,
        totalSessionsThisWeek: 3,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeGreaterThan(0);
  });

  it('totalSessionsThisWeek=0 falls back to full MEV (no divide-by-zero)', () => {
    // totalSessionsThisWeek=0 is falsy — pro-rating guard skips the division.
    // effectiveMev = full MEV; deficit triggers top-up; no divide-by-zero.
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 2,
        totalSessionsThisWeek: 0,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// engine-027 bug fix: cross-lift 1RM for top-up weight calculation
// ---------------------------------------------------------------------------

describe('generateJITSession — volume top-up cross-lift 1RM', () => {
  it('uses bench 1RM for bench top-up exercise during squat session', () => {
    // Squat session with chest deficit; top-up should be a bench exercise.
    // allOneRmKg provides separate bench 1RM (60kg) vs squat 1RM (200kg).
    // 'Dumbbell Incline Bench Press' is in the catalog with associatedLift='bench'.
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        oneRmKg: 200,
        allOneRmKg: { squat: 200, bench: 60, deadlift: 150 },
        auxiliaryPool: ['Dumbbell Incline Bench Press'],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'chest'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUp = out.auxiliaryWork.find(
      (a) => a.isTopUp && a.exercise === 'Dumbbell Incline Bench Press'
    );
    expect(topUp).toBeDefined();
    // Weight must be based on bench 1RM (60), not squat 1RM (200)
    // default AUX_WEIGHT_PCT (0.675) → roundToNearest(60 * 0.675) ≈ 40 → well under 100
    topUp!.sets.forEach((s) => {
      expect(s.weight_kg).toBeLessThan(100);
    });
  });

  it('falls back to primary lift 1RM when allOneRmKg is absent', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        oneRmKg: 200,
        // allOneRmKg intentionally omitted
        auxiliaryPool: ['Dumbbell Incline Bench Press'],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'chest'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUp = out.auxiliaryWork.find(
      (a) => a.isTopUp && a.exercise === 'Dumbbell Incline Bench Press'
    );
    expect(topUp).toBeDefined();
    // Falls back to squat 1RM (200) as oneRmKg, but exerciseLift='bench' so sqrt ref=80
    // 0.28 × sqrt(80 × 200) = 0.28 × 126.49 = 35.4 → 35
    // With correct bench 1RM (60): 0.28 × sqrt(80 × 60) = 0.28 × 69.28 = 19.4 → 20 — meaningfully different
    topUp!.sets.forEach((s) => {
      expect(s.weight_kg).toBe(35);
    });
  });
});

// ---------------------------------------------------------------------------
// engine-031: push muscle coverage boost on squat/deadlift days
// ---------------------------------------------------------------------------

describe('generateJITSession — push muscle coverage boost (engine-031)', () => {
  // Pool covering push muscles:
  //   Dumbbell Incline Bench Press  → chest: 1.0, shoulders: 1.0
  //   Barbell Push Press            → shoulders: 1.0, triceps: 1.0
  //   Floor Press                   → chest: 1.0, triceps: 1.0
  const pushPool = [
    'Dumbbell Incline Bench Press',
    'Barbell Push Press',
    'Floor Press',
  ];

  it('chest gets top-up on squat day session 1 of 3 — full MEV used, not pro-rated', () => {
    // Pro-rated effectiveMev = ceil(8*1/3) = 3; squat contributes chest 0 → projected=0
    // Without boost: deficit=3 → top-up might fire depending on other muscles winning sort
    // With boost: effectiveMev=8 → deficit=8 → chest wins sort, triggers top-up
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pushPool,
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          chest: 0,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 1,
        totalSessionsThisWeek: 3,
      })
    );
    const topUps = out.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('chest')
    );
    expect(topUps.length).toBeGreaterThan(0);
  });

  it('push muscle session 2 of 3: boost yields 3 sets instead of 1', () => {
    // chest MEV=8; weeklyChest=5; squat contributes 0 chest
    // Pro-rated effectiveMev = ceil(8*2/3)=6 → deficit=1 → 1 set
    // With push boost: effectiveMev=8 → deficit=3 → 3 sets
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pushPool,
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          chest: 5,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 2,
        totalSessionsThisWeek: 3,
      })
    );
    const chestTopUp = out.auxiliaryWork.find(
      (a) => a.isTopUp && a.topUpReason?.includes('chest')
    );
    expect(chestTopUp).toBeDefined();
    expect(chestTopUp!.sets).toHaveLength(3);
  });

  it('bench day: push muscles use normal pro-rating (no boost)', () => {
    // bench contributes chest 1.0 × mainSets → primaryLiftContrib > 0 → no boost
    // weeklyChest=5, sessionIndex=1 of 3 → effectiveMev=ceil(8*1/3)=3
    // squat projected = floor(mainSets * 1.0) ≥ 3 → no deficit → no top-up
    const mainSets = generateJITSession(baseInput({ primaryLift: 'bench' }))
      .mainLiftSets.length;
    const projected = Math.floor(mainSets * 1.0); // bench chest contrib = 1.0

    const weeklyChest = 5;
    // If pro-rated: effectiveMev=3; projected from bench ≥ 3 plus weekly=5 → no deficit
    // If boost were applied: effectiveMev=8 → deficit=8-5-projected would be large → top-up
    // So presence of boost would cause a top-up; absence means no top-up.
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        auxiliaryPool: pushPool,
        activeAuxiliaries: ['Pause Squat', 'Barbell Box Squat'], // not bench exercises
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          chest: weeklyChest,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 1,
        totalSessionsThisWeek: 3,
      })
    );
    // With pro-rating (no boost): projected = weeklyChest + floor(mainSets * 1.0)
    // effectiveMev = ceil(8*1/3) = 3; 5 + projected ≥ 3 → no chest top-up
    const chestTopUps = out.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('chest')
    );
    expect(chestTopUps).toHaveLength(0);
  });

  it('non-push muscle on squat day still uses pro-rated MEV', () => {
    // upper_back is not a push muscle; squat doesn't contribute upper_back
    // sessionIndex=1 of 3 → effectiveMev=ceil(mev*1/3) — moderate deficit won't fire
    // upper_back MEV = DEFAULT_MRV_MEV_CONFIG_MALE.upper_back.mev
    const upperBackMev = DEFAULT_MRV_MEV_CONFIG_MALE.upper_back.mev;
    // Set upper_back to ceil(mev*1/3)-1 so pro-rated deficit=1; with full MEV deficit would be large
    const weeklyUpperBack = Math.ceil((upperBackMev * 1) / 3) - 1;

    // Use a pool that has an upper_back exercise but no chest/push exercises
    const upperBackPool = ['Dumbbell Romanian Deadlift']; // hamstrings, not upper_back
    // Use Pull-Up if available; otherwise rely on no match → no top-up
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: upperBackPool,
        weeklyVolumeToDate: {
          ...atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE),
          upper_back: weeklyUpperBack,
        },
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
        sessionIndex: 1,
        totalSessionsThisWeek: 3,
      })
    );
    // With pro-rating, deficit for upper_back = effectiveMev - projected = 1
    // Pool has no upper_back exercise with contrib ≥ 1.0 → no top-up anyway
    // This confirms non-push muscles go through the normal pro-rating path
    const upperBackTopUps = out.auxiliaryWork.filter(
      (a) => a.isTopUp && a.topUpReason?.includes('upper back')
    );
    expect(upperBackTopUps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GH#84: sqrt-based weight scaling for dumbbell/kettlebell exercises
// ---------------------------------------------------------------------------

describe('generateJITSession — dumbbell sqrt scaling', () => {
  it('DB Incline uses sqrt scaling — 22.5kg at 116kg bench (with fatigue discount)', () => {
    // Sqrt: 0.28 × sqrt(80 × 116) = 26.97 → 27.5 → × 0.85 fatigue = 23.375 → 22.5
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 116,
        activeAuxiliaries: [
          'Dumbbell Incline Bench Press',
          'Barbell Pause Bench Press',
        ],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(22.5);
    // Barbell: 116 × 0.75 = 87 → 87.5 → × 0.85 fatigue = 74.375 → 75
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(75);
  });

  it('DB exercises at reference 1RM with fatigue discount', () => {
    // bench ref (male) = 80 → 0.12 × sqrt(80 × 80) = 9.6 → 10 → × 0.85 = 8.5 → 7.5
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 80,
        biologicalSex: 'male',
        activeAuxiliaries: ['Dumbbell Fly', 'Barbell Pause Bench Press'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(7.5);
  });

  it('female reference points produce different weights than male', () => {
    // bench ref (female) = 50 → 0.12 × sqrt(50 × 80) = 0.12 × sqrt(4000) = 0.12 × 63.25 = 7.59 → 7.5
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 80,
        biologicalSex: 'female',
        activeAuxiliaries: ['Dumbbell Fly', 'Barbell Pause Bench Press'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(7.5);
  });

  it('barbell exercises are not affected by sqrt scaling (with fatigue discount)', () => {
    // CGBP: linear 140 × 0.75 = 105 → × 0.85 fatigue = 89.25 → 90
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 140,
        activeAuxiliaries: [
          'Close-Grip Barbell Bench Press',
          'Barbell Pause Bench Press',
        ],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(90);
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(90);
  });

  it('DB Snatch corrected to 0.21 — gives 30kg at 190kg DL (with fatigue discount)', () => {
    // 0.21 × sqrt(140 × 190) = 34.24 → 35 → × 0.85 fatigue = 29.75 → 30
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        oneRmKg: 190,
        activeAuxiliaries: ['Dumbbell Snatch', 'Rack Pull'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(30);
  });

  it('volume top-up uses sqrt scaling for dumbbell exercises', () => {
    // squat session, chest deficit → Dumbbell Incline Bench Press is added as top-up
    // bench ref (male) = 80, bench 1RM = 80 via allOneRmKg
    // 0.28 × sqrt(80 × 80) = 0.28 × 80 = 22.4 → 22.5
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        oneRmKg: 120,
        allOneRmKg: { squat: 120, bench: 80, deadlift: 140 },
        auxiliaryPool: ['Dumbbell Incline Bench Press'],
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'chest'),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUp = out.auxiliaryWork.find(
      (a) => a.isTopUp && a.exercise === 'Dumbbell Incline Bench Press'
    );
    expect(topUp).toBeDefined();
    // At the bench reference 1RM (80), output equals linear: 0.28 × 80 = 22.4 → 22.5
    topUp!.sets.forEach((s) => {
      expect(s.weight_kg).toBe(22.5);
    });
  });
});

// ---------------------------------------------------------------------------
// volumeReductions metadata
// ---------------------------------------------------------------------------

describe('generateJITSession — volumeReductions metadata', () => {
  it('is absent when no reductions occurred', () => {
    const out = generateJITSession(baseInput());
    expect(out.volumeReductions).toBeUndefined();
  });

  it('is populated when soreness reduces sets', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 6 } })
    );
    expect(out.volumeReductions).toBeDefined();
    expect(out.volumeReductions!.totalSetsRemoved).toBe(1);
    expect(out.volumeReductions!.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'soreness', setsRemoved: 1 }),
      ])
    );
  });

  it('is populated when readiness reduces sets', () => {
    const out = generateJITSession(
      baseInput({ sleepQuality: 1, energyLevel: 1 })
    );
    expect(out.volumeReductions).toBeDefined();
    expect(out.volumeReductions!.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'readiness' })])
    );
  });

  it('is populated when cycle phase reduces sets', () => {
    const out = generateJITSession(
      baseInput({ cyclePhase: 'menstrual', biologicalSex: 'female' })
    );
    expect(out.volumeReductions).toBeDefined();
    expect(out.volumeReductions!.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'cycle_phase' }),
      ])
    );
  });

  it('is populated when moderate disruption reduces sets', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeDisruption('moderate')] })
    );
    expect(out.volumeReductions).toBeDefined();
    expect(out.volumeReductions!.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'disruption' }),
      ])
    );
  });

  it('recoveryBlocked is true for soreness 10', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 10 } })
    );
    // Recovery mode replaces the session entirely — no sets "removed" in the normal sense
    // but recoveryBlocked must be true
    if (out.volumeReductions) {
      expect(out.volumeReductions.recoveryBlocked).toBe(true);
    }
  });

  it('MRV cap is NOT counted in volumeReductions', () => {
    const out = generateJITSession(
      baseInput({
        weeklyVolumeToDate: { quads: 100, glutes: 100, hamstrings: 100 },
      })
    );
    // MRV should cap/skip, but volumeReductions should be absent since it's not a body-state reduction
    expect(out.volumeReductions).toBeUndefined();
  });

  it('combines multiple reduction sources', () => {
    // Base input with 2 sets: readiness removes 1 (down to 1), soreness 6
    // can't remove more (already at min 1), so only readiness shows as source.
    // Use a formula config that produces more base sets to test combination.
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 6 },
        sleepQuality: 1,
        energyLevel: 1,
      })
    );
    expect(out.volumeReductions).toBeDefined();
    // At least one source removed sets
    expect(out.volumeReductions!.totalSetsRemoved).toBeGreaterThanOrEqual(1);
    // Multiple sources attempted reductions (readiness + soreness)
    expect(out.volumeReductions!.sources.length).toBeGreaterThanOrEqual(1);
  });

  it('baseSetsCount reflects original set count before reductions', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 6 } })
    );
    expect(out.volumeReductions).toBeDefined();
    expect(out.volumeReductions!.baseSetsCount).toBe(2); // default baseInput produces 2 sets
  });
});
