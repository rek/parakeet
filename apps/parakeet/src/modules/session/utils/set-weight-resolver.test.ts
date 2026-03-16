import {
  resolveNextAuxSetWeight,
  resolveNextSetWeight,
} from './set-weight-resolver';

describe('resolveNextSetWeight', () => {
  it('Set 1 (no previous completed) → uses planned weight', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [],
        nextSetNumber: 1,
        plannedWeightKg: 100,
      })
    ).toBe(100_000);
  });

  it('Set 2 with Set 1 at planned weight → carries forward', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [
          { set_number: 1, weight_grams: 100_000, is_completed: true },
        ],
        nextSetNumber: 2,
        plannedWeightKg: 100,
      })
    ).toBe(100_000);
  });

  it('Set 2 with Set 1 adjusted from 100kg to 95kg → carries forward 95kg', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [
          { set_number: 1, weight_grams: 95_000, is_completed: true },
        ],
        nextSetNumber: 2,
        plannedWeightKg: 100,
      })
    ).toBe(95_000);
  });

  it('Set 3 picks up the most recent completed set', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [
          { set_number: 1, weight_grams: 95_000, is_completed: true },
          { set_number: 2, weight_grams: 97_500, is_completed: true },
        ],
        nextSetNumber: 3,
        plannedWeightKg: 100,
      })
    ).toBe(97_500);
  });

  it('Set 3 with Set 2 incomplete → falls back to Set 1 weight', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [
          { set_number: 1, weight_grams: 95_000, is_completed: true },
          { set_number: 2, weight_grams: 100_000, is_completed: false },
        ],
        nextSetNumber: 3,
        plannedWeightKg: 100,
      })
    ).toBe(95_000);
  });

  it('all previous sets incomplete → uses planned weight', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [
          { set_number: 1, weight_grams: 95_000, is_completed: false },
          { set_number: 2, weight_grams: 95_000, is_completed: false },
        ],
        nextSetNumber: 3,
        plannedWeightKg: 100,
      })
    ).toBe(100_000);
  });

  it('planned weight with sub-gram precision rounds to nearest gram', () => {
    expect(
      resolveNextSetWeight({
        completedSets: [],
        nextSetNumber: 1,
        plannedWeightKg: 112.5,
      })
    ).toBe(112_500);
  });
});

describe('resolveNextAuxSetWeight', () => {
  it('Set 1 of Leg Press (no previous) → uses planned weight', () => {
    expect(
      resolveNextAuxSetWeight({
        auxiliarySets: [],
        exercise: 'Leg Press',
        nextSetNumber: 1,
        plannedWeightKg: 80,
      })
    ).toBe(80_000);
  });

  it('Set 2 of Leg Press with Set 1 adjusted → carries forward', () => {
    expect(
      resolveNextAuxSetWeight({
        auxiliarySets: [
          {
            exercise: 'Leg Press',
            set_number: 1,
            weight_grams: 75_000,
            is_completed: true,
          },
        ],
        exercise: 'Leg Press',
        nextSetNumber: 2,
        plannedWeightKg: 80,
      })
    ).toBe(75_000);
  });

  it('different exercise completed sets do not leak through', () => {
    expect(
      resolveNextAuxSetWeight({
        auxiliarySets: [
          {
            exercise: 'Dips',
            set_number: 1,
            weight_grams: 50_000,
            is_completed: true,
          },
        ],
        exercise: 'Leg Press',
        nextSetNumber: 1,
        plannedWeightKg: 80,
      })
    ).toBe(80_000);
  });

  it('mixed exercises — only same exercise sets considered', () => {
    expect(
      resolveNextAuxSetWeight({
        auxiliarySets: [
          {
            exercise: 'Dips',
            set_number: 1,
            weight_grams: 50_000,
            is_completed: true,
          },
          {
            exercise: 'Leg Press',
            set_number: 1,
            weight_grams: 70_000,
            is_completed: true,
          },
          {
            exercise: 'Dips',
            set_number: 2,
            weight_grams: 55_000,
            is_completed: true,
          },
        ],
        exercise: 'Leg Press',
        nextSetNumber: 2,
        plannedWeightKg: 80,
      })
    ).toBe(70_000);
  });
});
