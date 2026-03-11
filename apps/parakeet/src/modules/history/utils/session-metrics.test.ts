import { describe, expect, it } from 'vitest';
import {
  estimateBestOneRm,
  computeSessionVolume,
  computeHeaviestLift,
  getSessionJoin,
} from './session-metrics';

// Epley formula: weight_kg * (1 + reps / 30)
// gramsToKg: grams / 1000

describe('estimateBestOneRm', () => {
  it('returns 0 for non-array input', () => {
    expect(estimateBestOneRm(null)).toBe(0);
    expect(estimateBestOneRm(undefined)).toBe(0);
    expect(estimateBestOneRm(42)).toBe(0);
    expect(estimateBestOneRm({})).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(estimateBestOneRm([])).toBe(0);
  });

  it('returns best estimated 1RM across valid sets', () => {
    // 100 kg × (1 + 5/30) = 116.666…
    // 80 kg × (1 + 10/30) = 106.666…
    const sets = [
      { weight_grams: 100_000, reps_completed: 5 },
      { weight_grams: 80_000, reps_completed: 10 },
    ];
    const result = estimateBestOneRm(sets);
    expect(result).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it('skips sets with zero weight_grams', () => {
    const sets = [{ weight_grams: 0, reps_completed: 5 }];
    expect(estimateBestOneRm(sets)).toBe(0);
  });

  it('skips sets with null weight_grams', () => {
    const sets = [{ weight_grams: null, reps_completed: 5 }];
    expect(estimateBestOneRm(sets)).toBe(0);
  });

  it('skips sets with zero reps_completed', () => {
    const sets = [{ weight_grams: 100_000, reps_completed: 0 }];
    expect(estimateBestOneRm(sets)).toBe(0);
  });

  it('skips sets with null reps_completed', () => {
    const sets = [{ weight_grams: 100_000, reps_completed: null }];
    expect(estimateBestOneRm(sets)).toBe(0);
  });

  it('skips sets where reps_completed > 20', () => {
    const sets = [{ weight_grams: 100_000, reps_completed: 21 }];
    expect(estimateBestOneRm(sets)).toBe(0);
  });

  it('accepts sets with reps_completed exactly at 20', () => {
    const sets = [{ weight_grams: 60_000, reps_completed: 20 }];
    // 60 * (1 + 20/30) = 100
    expect(estimateBestOneRm(sets)).toBeCloseTo(60 * (1 + 20 / 30), 5);
  });
});

describe('computeSessionVolume', () => {
  it('returns 0 for non-array input', () => {
    expect(computeSessionVolume(null)).toBe(0);
    expect(computeSessionVolume('string')).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeSessionVolume([])).toBe(0);
  });

  it('sums weight_kg * reps for valid sets', () => {
    // 100kg * 5 + 80kg * 8 = 500 + 640 = 1140
    const sets = [
      { weight_grams: 100_000, reps_completed: 5 },
      { weight_grams: 80_000, reps_completed: 8 },
    ];
    expect(computeSessionVolume(sets)).toBeCloseTo(1140, 5);
  });

  it('skips sets with missing or zero weight', () => {
    const sets = [
      { weight_grams: 0, reps_completed: 5 },
      { weight_grams: null, reps_completed: 5 },
      { weight_grams: 100_000, reps_completed: 5 },
    ];
    expect(computeSessionVolume(sets)).toBeCloseTo(500, 5);
  });

  it('skips sets with zero or missing reps', () => {
    const sets = [
      { weight_grams: 100_000, reps_completed: 0 },
      { weight_grams: 100_000, reps_completed: null },
    ];
    expect(computeSessionVolume(sets)).toBe(0);
  });
});

describe('computeHeaviestLift', () => {
  it('returns 0 for non-array input', () => {
    expect(computeHeaviestLift(null)).toBe(0);
    expect(computeHeaviestLift(42)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeHeaviestLift([])).toBe(0);
  });

  it('returns the heaviest weight in kg', () => {
    const sets = [
      { weight_grams: 80_000, reps_completed: 5 },
      { weight_grams: 120_000, reps_completed: 3 },
      { weight_grams: 100_000, reps_completed: 4 },
    ];
    expect(computeHeaviestLift(sets)).toBe(120);
  });

  it('skips sets with missing weight_grams', () => {
    const sets = [
      { weight_grams: null },
      { weight_grams: 0 },
      { weight_grams: 90_000 },
    ];
    expect(computeHeaviestLift(sets)).toBe(90);
  });
});

describe('getSessionJoin', () => {
  it('returns null for null input', () => {
    expect(getSessionJoin(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getSessionJoin(undefined)).toBeNull();
  });

  it('returns first element for an array', () => {
    const first = { intensity_type: 'heavy' };
    const second = { intensity_type: 'rep' };
    expect(getSessionJoin([first, second])).toBe(first);
  });

  it('returns the object directly when not an array', () => {
    const obj = { intensity_type: 'explosive' };
    expect(getSessionJoin(obj)).toBe(obj);
  });
});
