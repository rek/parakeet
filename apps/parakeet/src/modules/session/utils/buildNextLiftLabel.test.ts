import { describe, expect, it } from 'vitest';

import { buildNextLiftLabel } from './buildNextLiftLabel';

const planned = [
  { weight_kg: 100, reps: 5 },
  { weight_kg: 100, reps: 5 },
  { weight_kg: 100, reps: 5 },
];

const allUncompleted = [
  { is_completed: false },
  { is_completed: false },
  { is_completed: false },
];

const firstCompleted = [
  { is_completed: true },
  { is_completed: false },
  { is_completed: false },
];

const auxWork = [
  {
    exercise: 'barbell_row',
    sets: [
      { weight_kg: 60, reps: 10 },
      { weight_kg: 60, reps: 10 },
    ],
    skipped: false,
  },
  {
    exercise: 'chin_up',
    sets: [{ weight_kg: 0, reps: 8 }],
    skipped: false,
  },
];

const baseArgs = {
  pendingMainSetNumber: null as number | null,
  plannedSets: planned,
  actualSets: allUncompleted,
  currentAdaptation: null,
  pendingAuxExercise: null as string | null,
  pendingAuxSetNumber: null as number | null,
  auxiliaryWork: auxWork,
};

describe('buildNextLiftLabel', () => {
  it('returns undefined when no pending set', () => {
    expect(buildNextLiftLabel(baseArgs)).toBeUndefined();
  });

  it('builds main lift label with weight', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingMainSetNumber: 1,
    });
    expect(result).toBe('Next: Set 2 — 100kg × 5');
  });

  it('builds main lift label without weight (bodyweight)', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      plannedSets: [
        { weight_kg: 0, reps: 10 },
        { weight_kg: 0, reps: 10 },
      ],
      pendingMainSetNumber: 1,
    });
    expect(result).toBe('Next: Set 2 × 10');
  });

  it('returns undefined for out-of-bounds main set index', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingMainSetNumber: 10,
    });
    expect(result).toBeUndefined();
  });

  it('uses adapted weight when weight_reduced adaptation is active', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingMainSetNumber: 1,
      actualSets: firstCompleted,
      currentAdaptation: {
        adaptationType: 'weight_reduced',
        sets: [{ weight_kg: 90 }, { weight_kg: 90 }],
      },
    });
    expect(result).toBe('Next: Set 2 — 90kg × 5');
  });

  it('uses base weight when extended_rest adaptation is active', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingMainSetNumber: 1,
      currentAdaptation: {
        adaptationType: 'extended_rest',
        sets: [{ weight_kg: 90 }],
      },
    });
    expect(result).toBe('Next: Set 2 — 100kg × 5');
  });

  it('builds aux label with weight', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingAuxExercise: 'barbell_row',
      pendingAuxSetNumber: 0,
    });
    expect(result).toBe('Next: Barbell Row — 60kg × 10');
  });

  it('builds aux label without weight (bodyweight)', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingAuxExercise: 'chin_up',
      pendingAuxSetNumber: 0,
    });
    expect(result).toBe('Next: Chin Up × 8');
  });

  it('returns undefined for unknown aux exercise', () => {
    const result = buildNextLiftLabel({
      ...baseArgs,
      pendingAuxExercise: 'nonexistent',
      pendingAuxSetNumber: 0,
    });
    expect(result).toBeUndefined();
  });
});
