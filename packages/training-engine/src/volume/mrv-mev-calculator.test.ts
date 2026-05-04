import {
  applyTrainingAgeMultiplier,
  classifyVolumeStatus,
  computeRemainingCapacity,
  computeWeeklyVolume,
  DEFAULT_MRV_MEV_CONFIG,
  DEFAULT_MRV_MEV_CONFIG_FEMALE,
  DEFAULT_MRV_MEV_CONFIG_MALE,
} from './mrv-mev-calculator';
import {
  createMuscleMapper,
  getMusclesForExercise,
  getMusclesForLift,
} from './muscle-mapper';
import { rpeSetMultiplier } from './rpe-scaler';

// Helper for calibration tests: asserts a value is within a reasonable range
// around a center point. Use for secondary muscle volumes that depend on
// contribution factors which may be retuned.
function expectInRange(actual: number, min: number, max: number) {
  expect(actual).toBeGreaterThanOrEqual(min);
  expect(actual).toBeLessThanOrEqual(max);
}

describe('computeWeeklyVolume', () => {
  it('3 squat sessions × 5 sets → quads: 15 (primary, exact)', () => {
    const logs = Array.from({ length: 3 }, () => ({
      lift: 'squat' as const,
      completedSets: 5,
    }));
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(15); // primary muscle, contribution = 1.0
    expectInRange(volume.glutes, 5, 12); // secondary, contribution varies
    expectInRange(volume.hamstrings, 5, 10); // secondary
    expectInRange(volume.lower_back, 5, 10); // secondary
  });

  it('1 bench session × 3 sets → chest: 3 (primary), triceps/shoulders secondary', () => {
    const logs = [{ lift: 'bench' as const, completedSets: 3 }];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.chest).toBe(3); // primary, exact
    expectInRange(volume.triceps, 1, 2); // secondary, ~0.4 contribution
    expectInRange(volume.shoulders, 1, 2); // secondary
  });

  it('initialises all muscle groups to 0 when no logs provided', () => {
    const volume = computeWeeklyVolume([], getMusclesForLift);
    expect(volume.quads).toBe(0);
    expect(volume.biceps).toBe(0);
  });

  it('accumulates across multiple sessions', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'deadlift' as const, completedSets: 3 },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    // glutes get secondary contributions from both lifts
    expectInRange(volume.glutes, 3, 7);
    // hamstrings: squat secondary + deadlift primary
    expect(volume.hamstrings).toBeGreaterThanOrEqual(4);
    expect(volume.hamstrings).toBeLessThanOrEqual(6);
  });

  it('setRpes scales effective sets — moderate RPE reduces volume vs full RPE', () => {
    const fullRpe = [
      {
        lift: 'squat' as const,
        completedSets: 4,
        setRpes: [10, 10, 10, 10] as (number | undefined)[],
      },
    ];
    const moderateRpe = [
      {
        lift: 'squat' as const,
        completedSets: 4,
        setRpes: [7, 7, 7, 7] as (number | undefined)[],
      },
    ];
    const fullVolume = computeWeeklyVolume(fullRpe, getMusclesForLift);
    const moderateVolume = computeWeeklyVolume(moderateRpe, getMusclesForLift);

    // Key invariant: moderate RPE produces less volume than max RPE
    expect(moderateVolume.quads).toBeLessThan(fullVolume.quads);
    // But still produces some volume (RPE 7 is within effective range)
    expect(moderateVolume.quads).toBeGreaterThan(0);
  });

  it('setRpes with mixed RPEs — RPE 5 sets dont count', () => {
    // 2 sets at RPE 9 (1.0) + 2 sets at RPE 5 (0.0) → effective = 2
    const logs = [
      {
        lift: 'bench' as const,
        completedSets: 4,
        setRpes: [9, 9, 5, 5] as (number | undefined)[],
      },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.chest).toBe(2); // RPE 5=0.0, RPE 9=1.0 are invariant endpoints
  });

  it('setRpes with undefined falls back to 1.0 per set', () => {
    const logs = [
      {
        lift: 'deadlift' as const,
        completedSets: 3,
        setRpes: [undefined, undefined, undefined] as (number | undefined)[],
      },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.hamstrings).toBe(3); // primary, undefined RPE = 1.0
  });

  it('missing setRpes uses completedSets as before', () => {
    const logs = [{ lift: 'squat' as const, completedSets: 5 }];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(5);
  });

  it('session with 0 completedSets contributes nothing', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'squat' as const, completedSets: 0 },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(4);
  });

  it('full week: squat + bench + deadlift, 4 sets each → primary exact, secondary in range', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'bench' as const, completedSets: 4 },
      { lift: 'deadlift' as const, completedSets: 4 },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(4); // squat primary
    expect(volume.chest).toBe(4); // bench primary
    expectInRange(volume.glutes, 3, 7); // squat + deadlift secondary
    expect(volume.hamstrings).toBeGreaterThanOrEqual(5); // squat secondary + deadlift primary
    expect(volume.lower_back).toBeGreaterThanOrEqual(5); // squat secondary + deadlift primary
    expectInRange(volume.upper_back, 2, 4); // deadlift secondary
    expect(volume.biceps).toBe(0); // not mapped to any main lift
  });
});

describe('rpeSetMultiplier', () => {
  // Anchor points — these are exact values at defined anchor RPEs
  it('undefined → 1.0 (conservative)', () =>
    expect(rpeSetMultiplier(undefined)).toBe(1.0));
  it('5 → 0.0 (not a hard set)', () => expect(rpeSetMultiplier(5)).toBe(0.0));
  it('6 → 0.15', () => expect(rpeSetMultiplier(6)).toBe(0.15));
  it('6.5 → 0.30', () => expect(rpeSetMultiplier(6.5)).toBe(0.3));
  it('7 → 0.65', () => expect(rpeSetMultiplier(7)).toBe(0.65));
  it('8 → 0.85', () => expect(rpeSetMultiplier(8)).toBe(0.85));
  it('9 → 1.0', () => expect(rpeSetMultiplier(9)).toBe(1.0));
  it('10 → 1.0', () => expect(rpeSetMultiplier(10)).toBe(1.0));

  // Interpolated half-point values
  it('7.5 → 0.75', () => expect(rpeSetMultiplier(7.5)).toBe(0.75));
  it('8.5 → 0.925', () => expect(rpeSetMultiplier(8.5)).toBeCloseTo(0.925));

  // Quarter-point interpolation
  it('6.25 → 0.225 (between 6.0 and 6.5)', () =>
    expect(rpeSetMultiplier(6.25)).toBeCloseTo(0.225));
  it('6.75 → 0.475 (between 6.5 and 7.0)', () =>
    expect(rpeSetMultiplier(6.75)).toBeCloseTo(0.475));

  // Boundary: just below 6.0
  it('5.9 → 0.0', () => expect(rpeSetMultiplier(5.9)).toBe(0.0));
  it('9.5 → 1.0', () => expect(rpeSetMultiplier(9.5)).toBe(1.0));

  // Invariants that hold regardless of specific curve values
  it('monotonically non-decreasing across full range', () => {
    const rpes = [5, 6, 6.25, 6.5, 6.75, 7, 7.5, 8, 8.5, 9, 9.5, 10];
    const values = rpes.map(rpeSetMultiplier);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it('RPE 9-10 always = 1.0 (hard sets are full sets)', () => {
    expect(rpeSetMultiplier(9)).toBe(1.0);
    expect(rpeSetMultiplier(10)).toBe(1.0);
  });

  it('RPE < 6 always = 0.0 (junk volume excluded)', () => {
    expect(rpeSetMultiplier(4)).toBe(0.0);
    expect(rpeSetMultiplier(3)).toBe(0.0);
    expect(rpeSetMultiplier(0)).toBe(0.0);
  });
});

describe('getMusclesForLift — exercise name lookup', () => {
  it('falls back to lift map when no exercise given', () => {
    const muscles = getMusclesForLift('bench');
    expect(muscles.find((m) => m.muscle === 'chest')?.contribution).toBe(1.0);
    // Triceps/shoulders are secondary — just verify they exist and are < 1.0
    const triceps = muscles.find((m) => m.muscle === 'triceps');
    expect(triceps).toBeDefined();
    expect(triceps!.contribution).toBeLessThan(1.0);
    expect(triceps!.contribution).toBeGreaterThan(0);
  });

  it('uses per-exercise map when exercise name is known', () => {
    const muscles = getMusclesForLift(
      'bench',
      'Close-Grip Barbell Bench Press'
    );
    expect(muscles.find((m) => m.muscle === 'triceps')?.contribution).toBe(1.0);
    expect(muscles.find((m) => m.muscle === 'chest')?.contribution).toBe(0.5);
  });

  it('falls back to lift map when exercise name is unknown', () => {
    const muscles = getMusclesForLift('squat', 'Some Unknown Exercise');
    expect(muscles.find((m) => m.muscle === 'quads')?.contribution).toBe(1.0);
  });

  it('null lift with no exercise returns empty array', () => {
    expect(getMusclesForLift(null)).toEqual([]);
  });

  it('null lift with unknown exercise returns empty array', () => {
    expect(getMusclesForLift(null, 'Some Unknown Exercise')).toEqual([]);
  });

  it('null lift with known exercise still uses catalog', () => {
    const muscles = getMusclesForLift(null, 'Close-Grip Barbell Bench Press');
    expect(muscles.find((m) => m.muscle === 'triceps')?.contribution).toBe(1.0);
    expect(muscles.find((m) => m.muscle === 'chest')?.contribution).toBe(0.5);
  });

  it('Barbell Overhead Press maps to shoulders primary, not chest', () => {
    const muscles = getMusclesForLift('bench', 'Barbell Overhead Press');
    expect(muscles.find((m) => m.muscle === 'shoulders')?.contribution).toBe(
      1.0
    );
    expect(muscles.find((m) => m.muscle === 'chest')).toBeUndefined();
  });

  it('Romanian DL maps hamstrings + glutes primary, lower_back secondary', () => {
    const muscles = getMusclesForLift('deadlift', 'Dumbbell Romanian Deadlift');
    expect(muscles.find((m) => m.muscle === 'hamstrings')?.contribution).toBe(
      1.0
    );
    expect(muscles.find((m) => m.muscle === 'glutes')?.contribution).toBe(1.0);
    expect(muscles.find((m) => m.muscle === 'lower_back')?.contribution).toBe(
      0.5
    );
  });
});

describe('getMusclesForExercise', () => {
  it('returns empty array for unknown exercise', () => {
    expect(getMusclesForExercise('Unknown')).toEqual([]);
  });

  it('Bulgarian Split Squat: quads + glutes primary, hamstrings secondary, no lower_back', () => {
    const m = getMusclesForExercise('Bulgarian Split Squat');
    expect(m.find((x) => x.muscle === 'quads')?.contribution).toBe(1.0);
    expect(m.find((x) => x.muscle === 'glutes')?.contribution).toBe(1.0);
    expect(m.find((x) => x.muscle === 'hamstrings')?.contribution).toBe(0.5);
    expect(m.find((x) => x.muscle === 'lower_back')).toBeUndefined();
  });

  it('Rack Pull: upper_back + lower_back primary only', () => {
    const m = getMusclesForExercise('Rack Pull');
    expect(m.find((x) => x.muscle === 'upper_back')?.contribution).toBe(1.0);
    expect(m.find((x) => x.muscle === 'lower_back')?.contribution).toBe(1.0);
    expect(m.find((x) => x.muscle === 'hamstrings')).toBeUndefined();
  });
});

describe('createMuscleMapper — custom exercise map', () => {
  it('credits registered muscles for a custom exercise at contribution 1.0', () => {
    const mapper = createMuscleMapper({
      'Banded Hip Thrust': ['glutes', 'hamstrings'],
    });
    const m = mapper(null, 'Banded Hip Thrust');
    expect(m).toHaveLength(2);
    expect(m.find((x) => x.muscle === 'glutes')?.contribution).toBe(1.0);
    expect(m.find((x) => x.muscle === 'hamstrings')?.contribution).toBe(1.0);
  });

  it('returns [] for unknown exercise when neither catalog nor map matches', () => {
    const mapper = createMuscleMapper({ 'Custom Move': ['chest'] });
    expect(mapper(null, 'Other Custom Move')).toEqual([]);
  });

  it('catalog exercise takes priority over custom map entry with same name', () => {
    // Bulgarian Split Squat is in catalog with quads + glutes + hamstrings
    const mapper = createMuscleMapper({ 'Bulgarian Split Squat': ['biceps'] });
    const m = mapper(null, 'Bulgarian Split Squat');
    // Catalog entry preserved — no biceps, has quads
    expect(m.find((x) => x.muscle === 'quads')).toBeDefined();
    expect(m.find((x) => x.muscle === 'biceps')).toBeUndefined();
  });

  it('Pec Deck on a deadlift day still credits chest, not deadlift muscles', () => {
    // Regression: previously, custom exercises fell through to the day's lift
    // map, so chest accessory work on a deadlift day would credit hamstrings
    // / lower back instead of chest.
    const mapper = createMuscleMapper({ 'Pec Deck': ['chest'] });
    const m = mapper('deadlift', 'Pec Deck');
    expect(m).toHaveLength(1);
    expect(m[0]).toEqual({ muscle: 'chest', contribution: 1.0 });
  });

  it('default mapper has no customs and falls back to lift map', () => {
    const m = getMusclesForLift('bench', 'Pec Deck');
    // Falls back to bench muscles: chest 1.0, triceps 0.4, shoulders 0.4
    expect(m.find((x) => x.muscle === 'chest')?.contribution).toBe(1.0);
  });

  it('catalog-only getMusclesForExercise does not see custom map', () => {
    // Standalone export is the catalog-only mapper. Callers that need user
    // customs must build their own mapper via createMuscleMapper.
    expect(getMusclesForExercise('Pec Deck')).toEqual([]);
  });
});

describe('computeWeeklyVolume — aux exercise entries', () => {
  it('aux Close-Grip Bench Press entry counts triceps primary, chest secondary', () => {
    const logs = [
      { lift: 'bench' as const, completedSets: 4 },
      {
        lift: 'bench' as const,
        completedSets: 3,
        exercise: 'Close-Grip Barbell Bench Press',
      },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    // chest: bench 4×1.0 + cgb 3×0.5 = 5.5 → round ≈ 5-6
    expectInRange(volume.chest, 5, 7);
    // triceps: bench 4×~0.4 + cgb 3×1.0 → ~4.6
    expectInRange(volume.triceps, 4, 6);
  });

  it('Barbell Curl aux entry counts biceps > 0', () => {
    const logs = [
      { lift: 'bench' as const, completedSets: 3, exercise: 'Barbell Curl' },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.biceps).toBe(3); // curl = biceps 1.0
  });

  it('full week with curl aux → biceps no longer 0', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'bench' as const, completedSets: 4 },
      { lift: 'bench' as const, completedSets: 3, exercise: 'Barbell Curl' },
      { lift: 'deadlift' as const, completedSets: 4 },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.biceps).toBe(3); // curl = biceps 1.0
  });
});

describe('computeWeeklyVolume — ad-hoc sessions (null lift)', () => {
  it('null lift with catalog exercise attributes volume correctly', () => {
    const logs = [
      {
        lift: null,
        completedSets: 4,
        exercise: 'Close-Grip Barbell Bench Press',
      },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    // triceps 4×1.0 = 4, chest 4×0.5 = 2, shoulders 4×0.5 = 2
    expect(volume.triceps).toBe(4);
    expect(volume.chest).toBe(2);
    expect(volume.shoulders).toBe(2);
    expect(volume.quads).toBe(0);
  });

  it('null lift with unknown exercise contributes zero volume', () => {
    const logs = [
      { lift: null, completedSets: 5, exercise: 'My Custom Exercise' },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(0);
    expect(volume.chest).toBe(0);
    expect(volume.triceps).toBe(0);
  });

  it('null lift with no exercise contributes zero volume', () => {
    const logs = [{ lift: null, completedSets: 5 }];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(0);
    expect(volume.chest).toBe(0);
  });
});

describe('getMusclesForExercise — curl exercises', () => {
  it('Barbell Curl → biceps 1.0 only', () => {
    const m = getMusclesForExercise('Barbell Curl');
    expect(m).toHaveLength(1);
    expect(m[0]).toEqual({ muscle: 'biceps', contribution: 1.0 });
  });

  it('Dumbbell Curl → biceps 1.0', () => {
    expect(getMusclesForExercise('Dumbbell Curl')[0].muscle).toBe('biceps');
  });

  it('Cable Curl → biceps 1.0', () => {
    expect(getMusclesForExercise('Cable Curl')[0].muscle).toBe('biceps');
  });

  it('EZ-Bar Curl → biceps 1.0', () => {
    expect(getMusclesForExercise('EZ-Bar Curl')[0].muscle).toBe('biceps');
  });
});

describe('classifyVolumeStatus', () => {
  it('12 quad sets (MEV=8, MRV=20) → in_range', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 12,
    };
    const status = classifyVolumeStatus(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(status.quads).toBe('in_range');
  });

  it('19 quad sets (MRV=20) → approaching_mrv', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 19,
    };
    const status = classifyVolumeStatus(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(status.quads).toBe('approaching_mrv');
  });

  it('18 quad sets (MRV=20) → approaching_mrv (within 2)', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 18,
    };
    const status = classifyVolumeStatus(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(status.quads).toBe('approaching_mrv');
  });

  it('20 quad sets (MRV=20) → at_mrv', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 20,
    };
    const status = classifyVolumeStatus(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(status.quads).toBe('at_mrv');
  });

  it('21 quad sets (MRV=20) → exceeded_mrv', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 21,
    };
    const status = classifyVolumeStatus(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(status.quads).toBe('exceeded_mrv');
  });

  it('4 quad sets (MEV=8) → below_mev', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 4,
    };
    const status = classifyVolumeStatus(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(status.quads).toBe('below_mev');
  });
});

describe('applyTrainingAgeMultiplier', () => {
  it('beginner produces lower MEV and MRV than intermediate', () => {
    const beginner = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'beginner',
    });
    const intermediate = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'intermediate',
    });
    expect(beginner.quads.mrv).toBeLessThan(intermediate.quads.mrv);
    expect(beginner.quads.mev).toBeLessThanOrEqual(intermediate.quads.mev);
  });

  it('intermediate leaves config unchanged', () => {
    const result = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'intermediate',
    });
    expect(result.quads.mev).toBe(DEFAULT_MRV_MEV_CONFIG_MALE.quads.mev);
    expect(result.quads.mrv).toBe(DEFAULT_MRV_MEV_CONFIG_MALE.quads.mrv);
  });

  it('advanced produces higher MEV and MRV than intermediate', () => {
    const advanced = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'advanced',
    });
    const intermediate = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'intermediate',
    });
    expect(advanced.quads.mrv).toBeGreaterThan(intermediate.quads.mrv);
    expect(advanced.quads.mev).toBeGreaterThanOrEqual(intermediate.quads.mev);
  });

  it('works with female defaults — beginner MRV < intermediate', () => {
    const beginner = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_FEMALE,
      trainingAge: 'beginner',
    });
    expect(beginner.quads.mrv).toBeLessThan(
      DEFAULT_MRV_MEV_CONFIG_FEMALE.quads.mrv
    );
  });

  it('rounds values to integers', () => {
    const result = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'advanced',
    });
    for (const muscle of Object.keys(result)) {
      const { mev, mrv } = result[muscle as keyof typeof result];
      expect(Number.isInteger(mev)).toBe(true);
      expect(Number.isInteger(mrv)).toBe(true);
    }
  });

  it('ordering holds for all muscles: beginner ≤ intermediate ≤ advanced MRV', () => {
    const b = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'beginner',
    });
    const i = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'intermediate',
    });
    const a = applyTrainingAgeMultiplier({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      trainingAge: 'advanced',
    });
    for (const muscle of Object.keys(b)) {
      const m = muscle as keyof typeof b;
      expect(b[m].mrv).toBeLessThanOrEqual(i[m].mrv);
      expect(i[m].mrv).toBeLessThanOrEqual(a[m].mrv);
    }
  });
});

describe('computeRemainingCapacity', () => {
  it('18 quad sets logged, MRV=20 → remaining: 2', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 18,
    };
    const remaining = computeRemainingCapacity(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(remaining.quads).toBe(2);
  });

  it('22 quad sets logged, MRV=20 → remaining: -2 (exceeded)', () => {
    const volume = {
      ...Object.fromEntries(
        Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])
      ),
      quads: 22,
    };
    const remaining = computeRemainingCapacity(
      volume as ReturnType<typeof computeWeeklyVolume>,
      DEFAULT_MRV_MEV_CONFIG
    );
    expect(remaining.quads).toBe(-2);
  });
});
