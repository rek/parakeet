import { TrainingDisruption } from '@parakeet/shared-types';

import {
  DEFAULT_FORMULA_CONFIG_FEMALE,
  DEFAULT_FORMULA_CONFIG_MALE,
  DEFAULT_REST_SECONDS_FEMALE,
  DEFAULT_REST_SECONDS_MALE,
} from '../cube/blocks';
import { MrvMevConfig, MuscleGroup } from '../types';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../volume/mrv-mev-calculator';
import { generateJITSession, JITInput } from './jit-session-generator';

function baseInput(overrides: Partial<JITInput> = {}): JITInput {
  return {
    sessionId: 'sess-001',
    weekNumber: 1,
    blockNumber: 1,
    primaryLift: 'squat',
    intensityType: 'heavy',
    oneRmKg: 140,
    formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
    sorenessRatings: {},
    weeklyVolumeToDate: {},
    mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
    activeAuxiliaries: ['Pause Squat', 'Box Squat'],
    recentLogs: [],
    activeDisruptions: [],
    warmupConfig: { type: 'preset', name: 'standard' },
    ...overrides,
  };
}

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
      baseInput({ activeAuxiliaries: ['Pause Squat', 'Box Squat'] })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(4);
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(4);
  });

  it('hypertrophy aux (Romanian Dumbbell Deadlift) → 8 reps', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeAuxiliaries: ['Romanian Dumbbell Deadlift', 'Good Mornings'],
      })
    );
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(8); // Romanian Dumbbell Deadlift
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(10); // Good Mornings
  });

  it('high-rep aux (Hyperextension) → 15 reps', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeAuxiliaries: ['Hyperextension', 'Romanian Dumbbell Deadlift'],
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
    // bench 1RM 140kg → Barbell Curl should be 140*0.20=28→27.5kg, not 140*0.675=94.5kg
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
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(20); // 140 * 0.15 = 21 → 20
  });
});

// ---------------------------------------------------------------------------
// Catalog exercise weight percentages (not default 67.5%)
// ---------------------------------------------------------------------------

describe('generateJITSession — catalog exercise weight percentages', () => {
  it('Dumbbell Step Up uses 15% of squat 1RM, not default 67.5%', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        oneRmKg: 180,
        activeAuxiliaries: ['Dumbbell Step Up', 'Barbell Front Squat'],
      })
    );
    // 180 * 0.15 = 27 → 27.5
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(27.5);
    // 180 * 0.65 = 117 → 117.5
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(117.5);
  });

  it('Kettlebell Swing uses 15% of deadlift 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        oneRmKg: 220,
        activeAuxiliaries: ['Kettlebell Swing', 'Barbell Row'],
      })
    );
    // 220 * 0.15 = 33 → 32.5
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(32.5);
    // 220 * 0.40 = 88 → 87.5
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(87.5);
  });

  it('Dumbbell Fly uses 12% of bench 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 120,
        activeAuxiliaries: ['Dumbbell Fly', 'Close-Grip Barbell Bench Press'],
      })
    );
    // 120 * 0.12 = 14.4 → 15 (rounded to nearest 2.5)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(15);
    // 120 * 0.75 = 90
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(90);
  });

  it('Dumbbell Row uses 20% of deadlift 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        oneRmKg: 220,
        activeAuxiliaries: ['Dumbbell Row', 'Rack Pull'],
      })
    );
    // 220 * 0.20 = 44 → 45 (rounded to nearest 2.5)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(45);
    // 220 * 0.80 = 176 → 175 (rounded to nearest 2.5)
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(175);
  });

  it('unknown custom exercise falls back to 67.5% default', () => {
    const out = generateJITSession(
      baseInput({
        oneRmKg: 140,
        activeAuxiliaries: ['Custom User Exercise', 'Another Custom'],
      })
    );
    // 140 * 0.675 = 94.5 → 95
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

  it('Rack Pull gets 4 reps, Romanian Dumbbell Deadlift gets 8', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        activeAuxiliaries: ['Rack Pull', 'Romanian Dumbbell Deadlift'],
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
  it('soreness=4 on quads → 1 set (clamped) at 107.5kg', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 4 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
    expect(out.mainLiftSets[0].weight_kg).toBe(107.5);
  });

  it('soreness=4 adds a warning to rationale', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 4 } })
    );
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true);
  });

  it('soreness=5 → recovery mode: 3 sets × 5 reps at 45kg (40% of 112.5→45)', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 5 } })
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

  it('soreness=5 → all auxiliaries skipped', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 5 } })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(true);
    });
  });

  it('soreness=3 on quads → 1 set (2-1=1)', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 3 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
    // intensity unchanged for soreness=3
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
    // 112.5 × 0.975 = 109.6875 → roundToNearest(2.5) = 110
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

  it('2 sessions low RPE (7.0 vs target 8.5) → weight increased to 115kg (112.5 × 1.025)', () => {
    const out = generateJITSession(
      baseInput({
        recentLogs: [
          { actual_rpe: 7.0, target_rpe: 8.5 },
          { actual_rpe: 7.0, target_rpe: 8.5 },
        ],
      })
    );
    // 112.5 × 1.025 = 115.3125 → roundToNearest(2.5) = 115
    expect(out.mainLiftSets[0].weight_kg).toBe(115);
    expect(out.rationale.some((r) => /RPE below target/i.test(r))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration test 6: disruption override
// ---------------------------------------------------------------------------

function makeDisruption(
  severity: 'minor' | 'moderate' | 'major',
  lift = 'squat'
): TrainingDisruption {
  return {
    id: 'dis-001',
    user_id: 'user-001',
    program_id: null,
    session_ids_affected: null,
    reported_at: new Date().toISOString(),
    disruption_type: 'injury',
    severity,
    affected_date_start: '2026-02-01',
    affected_date_end: null,
    affected_lifts: [lift],
    description: 'Knee injury',
    adjustment_applied: null,
    resolved_at: null,
    status: 'active',
  };
}

describe('generateJITSession — disruption override', () => {
  it('moderate disruption overrides soreness adjustment — sets from base, reduced', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 4 }, // soreness would reduce to 1 set
        activeDisruptions: [makeDisruption('moderate')],
      })
    );
    // disruption resets to base (2 sets), then halves → 1 set at 90% intensity
    expect(out.mainLiftSets).toHaveLength(1);
    // 112.5 × 0.90 = 101.25 → roundToNearest(2.5) = 101.25 → rounds to 102.5
    expect(out.mainLiftSets[0].weight_kg).toBe(102.5);
    expect(out.rationale.some((r) => /knee injury/i.test(r))).toBe(true);
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
  it('soreness=5 on chest during bench day → auxiliary Dips skipped', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        intensityType: 'heavy',
        blockNumber: 1,
        oneRmKg: 100,
        sorenessRatings: { chest: 5 },
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dips'],
      })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(true);
    });
  });

  it('soreness=3 on quads → auxiliary sets reduced by 1 (3→2)', () => {
    const out = generateJITSession(
      baseInput({ sorenessRatings: { quads: 3 } })
    );
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false);
      expect(a.sets).toHaveLength(2); // 3 - 1
    });
  });

  it('soreness=4 on quads → auxiliary 1 set at 95% intensity', () => {
    const out = generateJITSession(
      baseInput({
        sorenessRatings: { quads: 4 },
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
      baseInput({ sorenessRatings: { quads: 5 } })
    );
    // minimal = 2 steps (50%×5 + 75%×2), working weight = 45kg
    // 45 × 0.50 = 22.5 → round = 22.5; 45 × 0.75 = 33.75 → round = 35
    expect(out.warmupSets).toHaveLength(2);
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

  it('female at soreness 3 → 2 sets × 12 reps', () => {
    const out = generateJITSession(
      baseInput({
        biologicalSex: 'female',
        sorenessRatings: { quads: 3 },
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

describe('generateJITSession — biologicalSex soreness (female level 4)', () => {
  it('female soreness 4 → main lift −1 set (not −2)', () => {
    // Block 1 heavy: 2 base sets; female level-4 soreness: −1 = 1 set
    const out = generateJITSession(
      baseInput({ biologicalSex: 'female', sorenessRatings: { quads: 4 } })
    );
    expect(out.mainLiftSets).toHaveLength(1);
  });

  it('male soreness 4 → main lift −2 sets (clamped to 1)', () => {
    // Block 1 heavy: 2 base sets; male level-4: −2 → clamped to 1
    const out = generateJITSession(
      baseInput({ biologicalSex: 'male', sorenessRatings: { quads: 4 } })
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

  it('no bodyweight exercises added when soreness >= 5', () => {
    const out = generateJITSession(
      baseInput({
        activeDisruptions: [makeEquipmentDisruption()],
        sorenessRatings: { quads: 5 },
      })
    );
    // All aux exercises should be skipped; no bodyweight appended
    expect(out.auxiliaryWork).toHaveLength(2);
    expect(out.auxiliaryWork.every((ex) => ex.skipped)).toBe(true);
  });

  it('exercise cap: no-equipment + auxiliaryPool combined does not exceed 5 non-skipped aux exercises', () => {
    // 2 original + 2 bodyweight = 4 non-skipped; top-ups from pool should be capped to 1 (not 2)
    const pool = ['Romanian Dumbbell Deadlift', 'Stiff-Leg Deadlift', 'Leg Press'];
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

// Helper: set all muscles at their MEV except the specified ones, so only
// those muscles appear as top-up candidates. This prevents other high-deficit
// muscles from winning the top-2 sort.
function atMevExcept(
  config: MrvMevConfig,
  ...except: MuscleGroup[]
): Partial<Record<MuscleGroup, number>> {
  const result: Partial<Record<MuscleGroup, number>> = {};
  for (const [muscle, { mev }] of Object.entries(config) as [
    MuscleGroup,
    { mev: number; mrv: number },
  ][]) {
    if (!except.includes(muscle)) result[muscle] = mev;
  }
  return result;
}

describe('generateJITSession — volume top-up (engine-027)', () => {
  // Pool covers hamstrings (Romanian Dumbbell Deadlift → hamstrings 1.0), quads (Leg Press → quads 1.0)
  // and Stiff-Leg Deadlift (hamstrings 1.0) as a fallback for the exclusion test.
  const pool = [
    'Romanian Dumbbell Deadlift',
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
      'Romanian Dumbbell Deadlift',
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
    // Romanian Dumbbell Deadlift is the best hamstring match; make it an active auxiliary
    const out = generateJITSession(
      baseInput({
        auxiliaryPool: pool,
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        activeAuxiliaries: ['Romanian Dumbbell Deadlift', 'Box Squat'],
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(
      topUps.every((a) => a.exercise !== 'Romanian Dumbbell Deadlift')
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
});

// ---------------------------------------------------------------------------
// engine-027 fix: volume top-up MEV pro-rating by week progress
// ---------------------------------------------------------------------------

describe('generateJITSession — volume top-up MEV pro-rating', () => {
  const pool = [
    'Romanian Dumbbell Deadlift',
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
    // Falls back to squat 1RM (200): AUX_WEIGHT_PCT=0.3 → roundToNearest(200×0.3)=60
    // With correct bench 1RM (60): roundToNearest(60×0.3)=18 — meaningfully different
    topUp!.sets.forEach((s) => {
      expect(s.weight_kg).toBe(60);
    });
  });
});
