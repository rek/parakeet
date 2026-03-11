import {
  classifyVolumeStatus,
  computeRemainingCapacity,
  computeWeeklyVolume,
  DEFAULT_MRV_MEV_CONFIG,
} from './mrv-mev-calculator';
import { getMusclesForExercise, getMusclesForLift } from './muscle-mapper';
import { rpeSetMultiplier } from './rpe-scaler';

describe('computeWeeklyVolume', () => {
  it('3 squat sessions × 5 sets → quads: 15', () => {
    const logs = Array.from({ length: 3 }, () => ({
      lift: 'squat' as const,
      completedSets: 5,
    }));
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(15);
    expect(volume.glutes).toBe(11); // round(15 × 0.75)
    expect(volume.hamstrings).toBe(8); // round(15 × 0.5)
    expect(volume.lower_back).toBe(8);
  });

  it('1 bench session × 3 sets → chest: 3, triceps: 1 (floor of 1.5), shoulders: 1', () => {
    const logs = [{ lift: 'bench' as const, completedSets: 3 }];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.chest).toBe(3);
    expect(volume.triceps).toBe(1); // floor(3 × 0.5) = 1
    expect(volume.shoulders).toBe(1);
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
    // glutes: squat 4×0.75 + deadlift 3×0.75 = 3 + 2 = 5 (floor)
    expect(volume.glutes).toBe(5);
    // hamstrings: squat 4×0.5 + deadlift 3×1.0 = 2 + 3 = 5
    expect(volume.hamstrings).toBe(5);
  });

  it('setRpes scales effective sets — RPE 7 = 0.5 per set', () => {
    // 4 sets all at RPE 7 → effectiveSets = 4 × 0.5 = 2.0
    const logs = [
      {
        lift: 'squat' as const,
        completedSets: 4,
        setRpes: [7, 7, 7, 7] as (number | undefined)[],
      },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(2); // floor(2.0 × 1.0)
    expect(volume.hamstrings).toBe(1); // floor(2.0 × 0.5)
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
    expect(volume.chest).toBe(2);
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
    expect(volume.hamstrings).toBe(3);
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

  it('full week: squat + bench + deadlift, 4 sets each → typical in-range volumes', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'bench' as const, completedSets: 4 },
      { lift: 'deadlift' as const, completedSets: 4 },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.quads).toBe(4); // squat primary
    expect(volume.chest).toBe(4); // bench primary
    expect(volume.glutes).toBe(6); // squat 4×0.75 + deadlift 4×0.75 = 3 + 3
    expect(volume.hamstrings).toBe(6); // squat 4×0.5 + deadlift 4×1.0 = 2 + 4
    expect(volume.lower_back).toBe(6); // squat 4×0.5 + deadlift 4×1.0 = 2 + 4
    expect(volume.upper_back).toBe(2); // deadlift 4×0.5
    expect(volume.biceps).toBe(0); // not mapped to any main lift
  });
});

describe('rpeSetMultiplier', () => {
  it('undefined → 1.0 (conservative)', () =>
    expect(rpeSetMultiplier(undefined)).toBe(1.0));
  it('5 → 0.0 (not a hard set)', () => expect(rpeSetMultiplier(5)).toBe(0.0));
  it('6 → 0.25', () => expect(rpeSetMultiplier(6)).toBe(0.25));
  it('7 → 0.5', () => expect(rpeSetMultiplier(7)).toBe(0.5));
  it('8 → 0.75', () => expect(rpeSetMultiplier(8)).toBe(0.75));
  it('9 → 1.0', () => expect(rpeSetMultiplier(9)).toBe(1.0));
  it('10 → 1.0', () => expect(rpeSetMultiplier(10)).toBe(1.0));
});

describe('getMusclesForLift — exercise name lookup', () => {
  it('falls back to lift map when no exercise given', () => {
    const muscles = getMusclesForLift('bench');
    expect(muscles.find((m) => m.muscle === 'chest')?.contribution).toBe(1.0);
    expect(muscles.find((m) => m.muscle === 'triceps')?.contribution).toBe(0.4);
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

  it('Overhead Press maps to shoulders primary, not chest', () => {
    const muscles = getMusclesForLift('bench', 'Overhead Press');
    expect(muscles.find((m) => m.muscle === 'shoulders')?.contribution).toBe(
      1.0
    );
    expect(muscles.find((m) => m.muscle === 'chest')).toBeUndefined();
  });

  it('Romanian DL maps hamstrings + glutes primary, lower_back secondary', () => {
    const muscles = getMusclesForLift('deadlift', 'Romanian Dumbbell Deadlift');
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

describe('computeWeeklyVolume — aux exercise entries', () => {
  it('aux Close-Grip Barbell Bench Press entry counts triceps 1.0, chest 0.5', () => {
    const logs = [
      { lift: 'bench' as const, completedSets: 4 },
      {
        lift: 'bench' as const,
        completedSets: 3,
        exercise: 'Close-Grip Barbell Bench Press',
      },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    // bench: chest 4×1.0 + cgb: chest 3×0.5 = 4+1.5=5.5 → round = 6
    expect(volume.chest).toBe(6);
    // bench: triceps 4×0.4 + cgb: triceps 3×1.0 = 1.6+3=4.6 → round = 5
    expect(volume.triceps).toBe(5);
  });

  it('Barbell Curl aux entry counts biceps > 0', () => {
    const logs = [
      { lift: 'bench' as const, completedSets: 3, exercise: 'Barbell Curl' },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.biceps).toBe(3);
  });

  it('full week with curl aux → biceps no longer 0', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'bench' as const, completedSets: 4 },
      { lift: 'bench' as const, completedSets: 3, exercise: 'Barbell Curl' },
      { lift: 'deadlift' as const, completedSets: 4 },
    ];
    const volume = computeWeeklyVolume(logs, getMusclesForLift);
    expect(volume.biceps).toBe(3);
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
