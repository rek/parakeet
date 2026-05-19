import { describe, expect, it } from 'vitest';

import type { AuxiliaryActualSet } from '../store/sessionStore';
import { resolveAuxRestSeconds } from './resolveAuxRestSeconds';

const baseSet = (
  exercise: string,
  setNumber: number,
  prescribed?: number
): AuxiliaryActualSet => ({
  exercise,
  set_number: setNumber,
  weight_grams: 0,
  reps_completed: 0,
  is_completed: false,
  ...(prescribed != null ? { prescribed_rest_seconds: prescribed } : {}),
});

describe('resolveAuxRestSeconds', () => {
  it('returns the prescribed rest from the matching aux set when present', () => {
    const sets = [
      baseSet('Assault Bike', 1, 20),
      baseSet('Assault Bike', 2, 20),
    ];

    const out = resolveAuxRestSeconds({
      exercise: 'Assault Bike',
      setNumber: 1,
      auxiliarySets: sets,
      fallback: 90,
    });

    expect(out).toBe(20);
  });

  it('falls back when the matching set has no prescribed rest', () => {
    const sets = [baseSet('Dumbbell Curl', 1)];

    const out = resolveAuxRestSeconds({
      exercise: 'Dumbbell Curl',
      setNumber: 1,
      auxiliarySets: sets,
      fallback: 90,
    });

    expect(out).toBe(90);
  });

  it('falls back when no set matches exercise/setNumber', () => {
    const sets = [baseSet('Assault Bike', 1, 20)];

    const out = resolveAuxRestSeconds({
      exercise: 'Ski Erg',
      setNumber: 1,
      auxiliarySets: sets,
      fallback: 90,
    });

    expect(out).toBe(90);
  });
});
