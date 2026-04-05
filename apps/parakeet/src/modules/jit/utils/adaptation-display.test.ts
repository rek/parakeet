import { describe, expect, it } from 'vitest';

import { computeDisplayWeights } from './adaptation-display';

const makeActual = (overrides: {
  is_completed?: boolean;
  weight_grams?: number;
  set_number?: number;
}) => ({
  is_completed: overrides.is_completed ?? false,
  weight_grams: overrides.weight_grams ?? 100000,
  set_number: overrides.set_number ?? 1,
});

const makePlanned = (weight_kg: number) => ({ weight_kg, reps: 5 });

describe('computeDisplayWeights', () => {
  it('uses planned weights when there is no adaptation', () => {
    const result = computeDisplayWeights(
      [
        makeActual({ weight_grams: 80000 }),
        makeActual({ weight_grams: 80000 }),
      ],
      [makePlanned(100), makePlanned(105)],
      null
    );
    expect(result).toEqual([
      { displayWeightKg: 100, originalIndex: 0 },
      { displayWeightKg: 105, originalIndex: 1 },
    ]);
  });

  it('falls back to actualSet.weight_grams / 1000 when no planned set exists at that index', () => {
    const result = computeDisplayWeights(
      [makeActual({ weight_grams: 90000 })],
      [],
      null
    );
    expect(result).toEqual([{ displayWeightKg: 90, originalIndex: 0 }]);
  });

  it('applies adapted weights for uncompleted sets on weight_reduced adaptation', () => {
    const adaptation = {
      adaptationType: 'weight_reduced',
      sets: [{ weight_kg: 85 }, { weight_kg: 85 }],
    };
    const result = computeDisplayWeights(
      [
        makeActual({ is_completed: false }),
        makeActual({ is_completed: false }),
      ],
      [makePlanned(100), makePlanned(100)],
      adaptation
    );
    expect(result).toEqual([
      { displayWeightKg: 85, originalIndex: 0 },
      { displayWeightKg: 85, originalIndex: 1 },
    ]);
  });

  it('applies adapted weights for uncompleted sets on sets_capped adaptation', () => {
    const adaptation = {
      adaptationType: 'sets_capped',
      sets: [{ weight_kg: 90 }],
    };
    const result = computeDisplayWeights(
      [makeActual({ is_completed: false })],
      [makePlanned(100)],
      adaptation
    );
    expect(result).toEqual([{ displayWeightKg: 90, originalIndex: 0 }]);
  });

  it('does not apply adaptation to completed sets', () => {
    const adaptation = {
      adaptationType: 'weight_reduced',
      sets: [{ weight_kg: 75 }],
    };
    const result = computeDisplayWeights(
      [makeActual({ is_completed: true, weight_grams: 100000 })],
      [makePlanned(100)],
      adaptation
    );
    expect(result).toEqual([{ displayWeightKg: 100, originalIndex: 0 }]);
  });

  it('only applies adaptation to uncompleted sets; uncompleted index tracks independently', () => {
    const adaptation = {
      adaptationType: 'weight_reduced',
      sets: [{ weight_kg: 80 }, { weight_kg: 80 }],
    };
    const result = computeDisplayWeights(
      [
        makeActual({ is_completed: true }), // index 0 — completed, skipped
        makeActual({ is_completed: false }), // index 1 — uncompleted, gets adaptation.sets[0]
        makeActual({ is_completed: false }), // index 2 — uncompleted, gets adaptation.sets[1]
      ],
      [makePlanned(100), makePlanned(100), makePlanned(100)],
      adaptation
    );
    expect(result[0].displayWeightKg).toBe(100); // completed → planned
    expect(result[1].displayWeightKg).toBe(80); // adaptation.sets[0]
    expect(result[2].displayWeightKg).toBe(80); // adaptation.sets[1]
  });

  it('does not override weight for reps_reduced adaptation type', () => {
    const adaptation = {
      adaptationType: 'reps_reduced',
      sets: [{ weight_kg: 70 }],
    };
    const result = computeDisplayWeights(
      [makeActual({ is_completed: false })],
      [makePlanned(100)],
      adaptation
    );
    expect(result).toEqual([{ displayWeightKg: 100, originalIndex: 0 }]);
  });

  it('uses planned weight when adaptation has fewer adapted sets than uncompleted sets', () => {
    const adaptation = {
      adaptationType: 'weight_reduced',
      sets: [{ weight_kg: 85 }], // only one adapted set, but two uncompleted
    };
    const result = computeDisplayWeights(
      [
        makeActual({ is_completed: false }),
        makeActual({ is_completed: false }),
      ],
      [makePlanned(100), makePlanned(100)],
      adaptation
    );
    expect(result[0].displayWeightKg).toBe(85); // adaptation.sets[0]
    expect(result[1].displayWeightKg).toBe(100); // no adaptedSet at index 1 → planned
  });

  it('preserves originalIndex for each output entry', () => {
    const result = computeDisplayWeights(
      [makeActual({}), makeActual({}), makeActual({})],
      [makePlanned(100), makePlanned(105), makePlanned(110)],
      null
    );
    expect(result.map((s) => s.originalIndex)).toEqual([0, 1, 2]);
  });
});
