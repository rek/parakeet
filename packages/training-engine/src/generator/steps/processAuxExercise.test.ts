import { describe, expect, it } from 'vitest';

import { baseInput } from '../../__test-helpers__/fixtures';
import type { AuxAnchorResult } from '../../auxiliary/anchor';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../../volume/mrv-mev-calculator';
import { createMuscleMapper } from '../../volume/muscle-mapper';
import { generateJITSession } from '../jit-session-generator';
import {
  getPostMainFatigueFactor,
  processAuxExercise,
} from './processAuxExercise';

function anchor(
  source: AuxAnchorResult['source'],
  anchorKg: number,
  formulaWeightKg: number
): AuxAnchorResult {
  return {
    anchorKg,
    source,
    sessionsUsed: source === 'formula' ? 0 : 3,
    confidence: source === 'snap' ? 'high' : 'medium',
    formulaWeightKg,
    snapDetected: source === 'snap',
    decayApplied: false,
    rationale: 'test',
  };
}

function processOpts(extra: {
  exercise?: string;
  intensityType?: 'heavy' | 'rep' | 'explosive' | 'deload';
  anchorResult?: AuxAnchorResult;
  worstSoreness?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}) {
  return {
    exercise: extra.exercise ?? 'Close-Grip Barbell Bench Press',
    worstSoreness: extra.worstSoreness ?? 1,
    primaryMuscles: ['chest', 'triceps'] as ('chest' | 'triceps')[],
    weeklyVolumeToDate: {},
    mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
    mainLiftSetCount: 3,
    oneRmKg: 120,
    biologicalSex: 'male' as const,
    hasNoEquipment: false,
    warnings: [] as string[],
    primaryLift: 'bench' as const,
    muscleMapper: createMuscleMapper(),
    weightIncrementKg: 2.5,
    intensityType: extra.intensityType ?? ('heavy' as const),
    anchorResult: extra.anchorResult,
  };
}

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

describe('processAuxExercise — history anchor (GH#221)', () => {
  it('source=history on heavy day → fatigue discount NOT applied, weight = anchor', () => {
    // formula would compute 120 * 0.75 = 90, with 0.85 fatigue = 76.5 → rounded
    // to 75. Anchor of 95 should pass through with NO fatigue discount.
    const result = processAuxExercise(
      processOpts({
        anchorResult: anchor('history', 95, 90),
        intensityType: 'heavy',
      })
    );
    expect(result.skipped).toBe(false);
    expect(result.sets[0].weight_kg).toBe(95);
    expect(result.anchor?.source).toBe('history');
    expect(result.anchor?.formulaWeightKg).toBe(90);
  });

  it('source=blend on heavy day → fatigue discount STILL applies', () => {
    // Anchor is in the "blend" state — we still trust the formula context,
    // so fatigue discount must apply on top.
    const result = processAuxExercise(
      processOpts({
        anchorResult: anchor('blend', 100, 90),
        intensityType: 'heavy',
      })
    );
    // 100 (anchor) * 0.85 (heavy fatigue) = 85 → rounded to 85
    expect(result.sets[0].weight_kg).toBe(85);
    expect(result.anchor?.source).toBe('blend');
  });

  it('source=snap takes precedence over fatigue regardless of intensity', () => {
    const result = processAuxExercise(
      processOpts({
        anchorResult: anchor('snap', 100, 90),
        intensityType: 'heavy',
      })
    );
    expect(result.sets[0].weight_kg).toBe(100);
    expect(result.anchor?.source).toBe('snap');
  });

  it('source=formula → existing formula path (no anchor change)', () => {
    const noAnchorResult = processAuxExercise(processOpts({}));
    const formulaSourceResult = processAuxExercise(
      processOpts({
        anchorResult: anchor('formula', 90, 90),
      })
    );
    // Both should produce identical weights — formula path with fatigue discount.
    expect(formulaSourceResult.sets[0].weight_kg).toBe(
      noAnchorResult.sets[0].weight_kg
    );
    // Formula-source anchor metadata still propagates so UI can show "exploring".
    expect(formulaSourceResult.anchor?.source).toBe('formula');
  });

  it('severe soreness skip still propagates anchor metadata for UI', () => {
    const result = processAuxExercise(
      processOpts({
        anchorResult: anchor('history', 95, 90),
        worstSoreness: 9,
      })
    );
    expect(result.skipped).toBe(true);
    expect(result.anchor?.source).toBe('history');
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
