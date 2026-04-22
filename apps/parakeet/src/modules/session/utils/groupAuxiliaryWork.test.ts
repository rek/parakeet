import type { AuxiliaryActualSet } from '../store/sessionStore';
import { describe, expect, it } from 'vitest';

import type { AuxiliaryWork } from '../model/types';
import { groupAuxiliaryWork } from './groupAuxiliaryWork';

const makePlannedSet = () => ({ weight_kg: 60, reps: 10 });

describe('groupAuxiliaryWork', () => {
  it('returns empty groups for empty inputs', () => {
    expect(groupAuxiliaryWork([], [])).toEqual({
      regularAux: [],
      topUpAux: [],
    });
  });

  it('splits regular and top-up exercises into separate groups', () => {
    const auxiliaryWork: AuxiliaryWork[] = [
      { exercise: 'dumbbell_row', sets: [makePlannedSet()], skipped: false },
      {
        exercise: 'face_pull',
        sets: [makePlannedSet()],
        skipped: false,
        isTopUp: true,
        topUpReason: 'below MEV',
      },
    ];
    const { regularAux, topUpAux } = groupAuxiliaryWork(auxiliaryWork, []);
    expect(regularAux).toHaveLength(1);
    expect(regularAux[0].exercise).toBe('dumbbell_row');
    expect(topUpAux).toHaveLength(1);
    expect(topUpAux[0].exercise).toBe('face_pull');
  });

  it('attaches matching actual sets to the correct exercise', () => {
    const auxiliaryWork: AuxiliaryWork[] = [
      {
        exercise: 'lat_pulldown',
        sets: [makePlannedSet(), makePlannedSet()],
        skipped: false,
      },
      { exercise: 'tricep_pushdown', sets: [makePlannedSet()], skipped: false },
    ];
    const actualSets: AuxiliaryActualSet[] = [
      {
        exercise: 'lat_pulldown',
        set_number: 1,
        weight_grams: 50000,
        reps_completed: 10,
        is_completed: true,
      },
      {
        exercise: 'lat_pulldown',
        set_number: 2,
        weight_grams: 50000,
        reps_completed: 8,
        is_completed: true,
      },
      {
        exercise: 'tricep_pushdown',
        set_number: 1,
        weight_grams: 30000,
        reps_completed: 12,
        is_completed: false,
      },
    ];
    const { regularAux } = groupAuxiliaryWork(auxiliaryWork, actualSets);
    const latPulldown = regularAux.find((e) => e.exercise === 'lat_pulldown')!;
    const tricep = regularAux.find((e) => e.exercise === 'tricep_pushdown')!;
    expect(latPulldown.actualSets).toHaveLength(2);
    expect(tricep.actualSets).toHaveLength(1);
  });

  it('preserves the origIndex of each entry', () => {
    const auxiliaryWork: AuxiliaryWork[] = [
      { exercise: 'curl', sets: [makePlannedSet()], skipped: false },
      {
        exercise: 'press',
        sets: [makePlannedSet()],
        skipped: false,
        isTopUp: true,
      },
      { exercise: 'row', sets: [makePlannedSet()], skipped: false },
    ];
    const { regularAux, topUpAux } = groupAuxiliaryWork(auxiliaryWork, []);
    expect(regularAux[0].origIndex).toBe(0);
    expect(topUpAux[0].origIndex).toBe(1);
    expect(regularAux[1].origIndex).toBe(2);
  });
});
