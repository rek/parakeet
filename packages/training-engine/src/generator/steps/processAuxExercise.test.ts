import { describe, expect, it } from 'vitest';

import { baseInput } from '../../__test-helpers__/fixtures';
import { generateJITSession } from '../jit-session-generator';
import { getPostMainFatigueFactor } from './processAuxExercise';

describe('getPostMainFatigueFactor', () => {
  it('returns 0.85 for heavy (preserves historical behavior)', () => {
    expect(getPostMainFatigueFactor('heavy')).toBe(0.85);
  });

  it('tapers toward 1.0 as main-lift intensity drops', () => {
    expect(getPostMainFatigueFactor('rep')).toBeGreaterThan(
      getPostMainFatigueFactor('heavy')
    );
    expect(getPostMainFatigueFactor('explosive')).toBeGreaterThan(
      getPostMainFatigueFactor('rep')
    );
    expect(getPostMainFatigueFactor('deload')).toBe(1.0);
  });
});

describe('post-main fatigue: aux weight by intensity type', () => {
  it('explosive day produces heavier aux than heavy day for the same lift+1RM', () => {
    const heavy = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 120,
        intensityType: 'heavy',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
      })
    );
    const explosive = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        oneRmKg: 120,
        intensityType: 'explosive',
        activeAuxiliaries: ['Close-Grip Barbell Bench Press', 'Dumbbell Fly'],
      })
    );

    // Both aux exercises share muscles with bench, so both feel the discount.
    // Explosive's discount is smaller, so aux weight should be ≥ heavy's.
    expect(explosive.auxiliaryWork[0].sets[0].weight_kg).toBeGreaterThanOrEqual(
      heavy.auxiliaryWork[0].sets[0].weight_kg
    );
    expect(explosive.auxiliaryWork[1].sets[0].weight_kg).toBeGreaterThanOrEqual(
      heavy.auxiliaryWork[1].sets[0].weight_kg
    );

    // Strictly greater for at least one — sanity check the fix actually moves
    // a number. (Rounding to 2.5 kg can absorb small deltas on tiny weights.)
    const heavySum =
      heavy.auxiliaryWork[0].sets[0].weight_kg +
      heavy.auxiliaryWork[1].sets[0].weight_kg;
    const explosiveSum =
      explosive.auxiliaryWork[0].sets[0].weight_kg +
      explosive.auxiliaryWork[1].sets[0].weight_kg;
    expect(explosiveSum).toBeGreaterThan(heavySum);
  });
});
