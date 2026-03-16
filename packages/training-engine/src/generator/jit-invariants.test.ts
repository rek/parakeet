import { Lift, IntensityType } from '@parakeet/shared-types';

import { baseInput } from '../__test-helpers__/fixtures';
import { generateJITSession } from './jit-session-generator';

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift'];
const INTENSITIES: IntensityType[] = ['heavy', 'explosive', 'rep'];
const ONE_RMS = [60, 100, 140, 220];

const cases = LIFTS.flatMap((lift) =>
  INTENSITIES.flatMap((intensity) =>
    ONE_RMS.map((orm) => ({
      lift,
      intensity,
      orm,
      label: `${lift} ${intensity} ${orm}kg`,
    }))
  )
);

describe('JIT output invariants — structural', () => {
  it.each(cases)(
    'weight is always a multiple of 2.5kg ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      for (const s of out.mainLiftSets) {
        expect(s.weight_kg % 2.5).toBe(0);
      }
    }
  );

  it.each(cases)(
    'weight never exceeds 1RM ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      for (const s of out.mainLiftSets) {
        expect(s.weight_kg).toBeLessThanOrEqual(orm);
      }
    }
  );

  it.each(cases)(
    'weight is always >= 0 ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      for (const s of out.mainLiftSets) {
        expect(s.weight_kg).toBeGreaterThanOrEqual(0);
      }
    }
  );

  it.each(cases)(
    'at least 1 set unless skipped ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      if (!out.skippedMainLift) {
        expect(out.mainLiftSets.length).toBeGreaterThanOrEqual(1);
      }
    }
  );

  it.each(cases)(
    'RPE target between 5.0 and 10.0 ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      for (const s of out.mainLiftSets) {
        expect(s.rpe_target).toBeGreaterThanOrEqual(5.0);
        expect(s.rpe_target).toBeLessThanOrEqual(10.0);
      }
    }
  );

  it.each(cases)(
    'set numbers are sequential starting at 1 ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      const nums = out.mainLiftSets.map((s) => s.set_number);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
  );

  it.each(cases)(
    'main rest recommendations count matches set count ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      expect(out.restRecommendations.mainLift.length).toBe(
        out.mainLiftSets.length
      );
    }
  );

  it.each(cases)(
    'auxiliary rest recommendations count matches aux count ($label)',
    ({ lift, intensity, orm }) => {
      const out = generateJITSession(
        baseInput({ primaryLift: lift, intensityType: intensity, oneRmKg: orm })
      );
      expect(out.restRecommendations.auxiliary.length).toBe(
        out.auxiliaryWork.length
      );
    }
  );
});

describe('JIT output invariants — recovery mode', () => {
  it.each(LIFTS)('soreness 5 on %s → exactly 3 sets at RPE 5.0', (lift) => {
    const primaryMuscles: Record<Lift, string> = {
      squat: 'quads',
      bench: 'chest',
      deadlift: 'hamstrings',
    };
    const out = generateJITSession(
      baseInput({
        primaryLift: lift,
        sorenessRatings: { [primaryMuscles[lift]]: 5 } as any,
      })
    );
    expect(out.mainLiftSets).toHaveLength(3);
    for (const s of out.mainLiftSets) {
      expect(s.rpe_target).toBe(5.0);
      expect(s.weight_kg).toBeGreaterThanOrEqual(20); // bar weight floor
    }
  });
});
