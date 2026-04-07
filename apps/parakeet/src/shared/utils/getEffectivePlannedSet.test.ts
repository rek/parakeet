import { describe, expect, it } from 'vitest';

import { getEffectivePlannedSet } from './getEffectivePlannedSet';

const planned = [
  { weight_kg: 100, reps: 5 },
  { weight_kg: 100, reps: 5 },
  { weight_kg: 100, reps: 5 },
];

function makeActual(completedFlags: boolean[], weightGrams = 100000) {
  return completedFlags.map((c) => ({ is_completed: c, weight_grams: weightGrams }));
}

describe('getEffectivePlannedSet', () => {
  it('returns actualSet weight for incomplete sets when no adaptation', () => {
    const actual = makeActual([true, false, false]);
    const result = getEffectivePlannedSet(1, planned, actual, null);
    expect(result).toEqual({ weight_kg: 100, reps: 5 });
  });

  it('returns bumped actualSet weight when no adaptation and weight_grams differs from planned', () => {
    const actual = makeActual([true, false, false], 105000); // bumped to 105kg
    const result = getEffectivePlannedSet(1, planned, actual, null);
    expect(result).toEqual({ weight_kg: 105, reps: 5 });
  });

  it('returns planned for completed sets when no adaptation', () => {
    const actual = makeActual([true, false, false], 105000);
    const result = getEffectivePlannedSet(0, planned, actual, null);
    expect(result).toEqual({ weight_kg: 100, reps: 5 }); // completed → planned, not bumped
  });

  it('returns undefined for out-of-bounds index', () => {
    const result = getEffectivePlannedSet(5, planned, [], null);
    expect(result).toBeUndefined();
  });

  it('returns base planned set for extended_rest adaptation', () => {
    const actual = makeActual([true, false, false]);
    const adaptation = {
      adaptationType: 'extended_rest' as const,
      sets: [{ weight_kg: 80 }],
    };
    const result = getEffectivePlannedSet(1, planned, actual, adaptation);
    expect(result).toEqual({ weight_kg: 100, reps: 5 });
  });

  it('returns base planned set for none adaptation', () => {
    const actual = makeActual([true, false, false]);
    const adaptation = {
      adaptationType: 'none' as const,
      sets: [],
    };
    const result = getEffectivePlannedSet(1, planned, actual, adaptation);
    expect(result).toEqual({ weight_kg: 100, reps: 5 });
  });

  it('returns adapted weight for weight_reduced on uncompleted set', () => {
    const actual = makeActual([true, false, false]);
    const adaptation = {
      adaptationType: 'weight_reduced' as const,
      sets: [{ weight_kg: 90 }, { weight_kg: 90 }],
    };
    // index 1 is first uncompleted → adaptation.sets[0]
    const result = getEffectivePlannedSet(1, planned, actual, adaptation);
    expect(result).toEqual({ weight_kg: 90, reps: 5 });
  });

  it('returns adapted weight for sets_capped on uncompleted set', () => {
    const actual = makeActual([true, false, false]);
    const adaptation = {
      adaptationType: 'sets_capped' as const,
      sets: [{ weight_kg: 85 }, { weight_kg: 85 }],
    };
    const result = getEffectivePlannedSet(1, planned, actual, adaptation);
    expect(result).toEqual({ weight_kg: 85, reps: 5 });
  });

  it('maps uncompleted index correctly with mixed completion', () => {
    // sets: [completed, completed, uncompleted, uncompleted, uncompleted]
    const fivePlanned = [
      { weight_kg: 100, reps: 5 },
      { weight_kg: 100, reps: 5 },
      { weight_kg: 100, reps: 5 },
      { weight_kg: 100, reps: 5 },
      { weight_kg: 100, reps: 5 },
    ];
    const actual = makeActual([true, true, false, false, false]);
    const adaptation = {
      adaptationType: 'weight_reduced' as const,
      sets: [{ weight_kg: 90 }, { weight_kg: 85 }, { weight_kg: 80 }],
    };
    // index 2 → 0 uncompleted before → adaptation.sets[0] = 90
    expect(getEffectivePlannedSet(2, fivePlanned, actual, adaptation)).toEqual({
      weight_kg: 90,
      reps: 5,
    });
    // index 3 → 1 uncompleted before (index 2) → adaptation.sets[1] = 85
    expect(getEffectivePlannedSet(3, fivePlanned, actual, adaptation)).toEqual({
      weight_kg: 85,
      reps: 5,
    });
    // index 4 → 2 uncompleted before → adaptation.sets[2] = 80
    expect(getEffectivePlannedSet(4, fivePlanned, actual, adaptation)).toEqual({
      weight_kg: 80,
      reps: 5,
    });
  });

  it('returns base planned for completed set even with weight_reduced adaptation', () => {
    const actual = makeActual([true, false, false]);
    const adaptation = {
      adaptationType: 'weight_reduced' as const,
      sets: [{ weight_kg: 90 }, { weight_kg: 90 }],
    };
    // index 0 is completed → return base planned
    const result = getEffectivePlannedSet(0, planned, actual, adaptation);
    expect(result).toEqual({ weight_kg: 100, reps: 5 });
  });

  it('falls back to base planned if adaptation.sets is shorter than expected', () => {
    const actual = makeActual([false, false, false]);
    const adaptation = {
      adaptationType: 'weight_reduced' as const,
      sets: [{ weight_kg: 90 }], // only 1 adapted set for 3 uncompleted
    };
    // index 0 → adaptation.sets[0] = 90
    expect(getEffectivePlannedSet(0, planned, actual, adaptation)).toEqual({
      weight_kg: 90,
      reps: 5,
    });
    // index 1 → adaptation.sets[1] = undefined → fallback
    expect(getEffectivePlannedSet(1, planned, actual, adaptation)).toEqual({
      weight_kg: 100,
      reps: 5,
    });
  });
});
