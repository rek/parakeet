import { describe, expect, it } from 'vitest';

import type { AuxiliaryActualSet } from '../store/sessionStore';
import { annotateTemplateRounds } from './annotateTemplateRounds';

function tmpl(
  exercise: string,
  setNumber: number,
  instance = 't-1'
): AuxiliaryActualSet {
  return {
    exercise,
    set_number: setNumber,
    weight_grams: 0,
    reps_completed: 0,
    is_completed: false,
    template_instance_id: instance,
  };
}

function plain(exercise: string, setNumber: number): AuxiliaryActualSet {
  return {
    exercise,
    set_number: setNumber,
    weight_grams: 0,
    reps_completed: 0,
    is_completed: false,
  };
}

describe('annotateTemplateRounds', () => {
  it('returns an empty array for an empty block', () => {
    expect(annotateTemplateRounds([], [])).toEqual([]);
  });

  it('numbers rounds 1..N when each exercise appears once per round', () => {
    const block = [
      tmpl('Assault Bike', 1),
      tmpl('Ski Erg', 1),
      tmpl('Assault Bike', 2),
      tmpl('Ski Erg', 2),
      tmpl('Assault Bike', 3),
      tmpl('Ski Erg', 3),
    ];

    const out = annotateTemplateRounds(block, block);

    expect(out.map((o) => o.round)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(out.every((o) => o.totalRounds === 3)).toBe(true);
  });

  it('setsInExercise reflects the session-global max, not just the block', () => {
    // Lifter had 2 ad-hoc Dumbbell Curls before dropping a 3-round template
    // that includes Dumbbell Curl. addTemplateBlock renumbered the template
    // entries to 3..5 globally.
    const adHoc = [plain('Dumbbell Curl', 1), plain('Dumbbell Curl', 2)];
    const block = [
      tmpl('Dumbbell Curl', 3),
      tmpl('Ski Erg', 1),
      tmpl('Dumbbell Curl', 4),
      tmpl('Ski Erg', 2),
      tmpl('Dumbbell Curl', 5),
      tmpl('Ski Erg', 3),
    ];
    const aux = [...adHoc, ...block];

    const out = annotateTemplateRounds(block, aux);

    const dbCurlTotals = out
      .filter((o) => o.entry.exercise === 'Dumbbell Curl')
      .map((o) => o.setsInExercise);
    expect(dbCurlTotals).toEqual([5, 5, 5]);

    const skiTotals = out
      .filter((o) => o.entry.exercise === 'Ski Erg')
      .map((o) => o.setsInExercise);
    expect(skiTotals).toEqual([3, 3, 3]);
  });

  it('round counter for an exercise tracks its occurrence within the block', () => {
    const block = [
      tmpl('Assault Bike', 3),
      tmpl('Ski Erg', 1),
      tmpl('Assault Bike', 4),
      tmpl('Ski Erg', 2),
    ];

    const out = annotateTemplateRounds(block, block);

    expect(
      out.filter((o) => o.entry.exercise === 'Assault Bike').map((o) => o.round)
    ).toEqual([1, 2]);
    expect(
      out.filter((o) => o.entry.exercise === 'Ski Erg').map((o) => o.round)
    ).toEqual([1, 2]);
  });

  it('falls back to entry.set_number when an exercise is absent from auxiliarySets', () => {
    // Defensive: should never happen in practice but the function shouldn't crash.
    const block = [tmpl('Mystery Move', 1)];
    const out = annotateTemplateRounds(block, []);

    expect(out[0].setsInExercise).toBe(1);
  });
});
