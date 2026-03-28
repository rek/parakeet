import { describe, expect, it } from 'vitest';

import { estimateOneRmKgFromProfile } from './max-estimation';

// Multipliers (from source):
//   male:   squat 1.35, bench 1.0, deadlift 1.65
//   female: squat 1.05, bench 0.65, deadlift 1.25
// Default bodyweight: male 85 kg, female 70 kg
// Age multipliers: <20 → 0.92, 20-29 → 1.0, 30-39 → 0.97, 40-49 → 0.92,
//                  50-59 → 0.86, 60+ → 0.78, null → 0.95
// Result is rounded to nearest 2.5 kg, floored at MIN_ESTIMATED_MAX_KG

function isoDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

describe('estimateOneRmKgFromProfile', () => {
  describe('male estimates', () => {
    it('returns a positive number for a typical male lifter', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'squat',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(28),
        bodyweightKg: 85,
      });
      expect(result).toBeGreaterThan(0);
    });

    it('uses male bodyweight multiplier for squat (age 25, 85 kg bw)', () => {
      // 85 * 1.35 * 1.0 = 114.75 → rounds to 115
      const result = estimateOneRmKgFromProfile({
        lift: 'squat',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      });
      expect(result).toBe(115);
    });

    it('uses male bodyweight multiplier for bench (age 25, 85 kg bw)', () => {
      // 85 * 1.0 * 1.0 = 85.0 → rounds to 85
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      });
      expect(result).toBe(85);
    });

    it('uses male bodyweight multiplier for deadlift (age 25, 85 kg bw)', () => {
      // 85 * 1.65 * 1.0 = 140.25 → rounds to 140
      const result = estimateOneRmKgFromProfile({
        lift: 'deadlift',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      });
      expect(result).toBe(140);
    });
  });

  describe('female estimates', () => {
    it('returns a positive number for a typical female lifter', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'deadlift',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(28),
        bodyweightKg: 70,
      });
      expect(result).toBeGreaterThan(0);
    });

    it('uses female bodyweight multiplier for squat (age 25, 70 kg bw)', () => {
      // 70 * 1.05 * 1.0 = 73.5 → rounds to 72.5
      const result = estimateOneRmKgFromProfile({
        lift: 'squat',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 70,
      });
      expect(result).toBe(72.5);
    });

    it('uses female bodyweight multiplier for bench (age 25, 70 kg bw)', () => {
      // 70 * 0.65 * 1.0 = 45.5 → rounds to 45
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 70,
      });
      expect(result).toBe(45);
    });

    it('uses female bodyweight multiplier for deadlift (age 25, 70 kg bw)', () => {
      // 70 * 1.25 * 1.0 = 87.5 → rounds to 87.5
      const result = estimateOneRmKgFromProfile({
        lift: 'deadlift',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 70,
      });
      expect(result).toBe(87.5);
    });

    it('produces a lower estimate than male for the same lift and bodyweight', () => {
      const male = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 80,
      });
      const female = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 80,
      });
      expect(female).toBeLessThan(male);
    });
  });

  describe('missing bodyweight falls back to default', () => {
    it('uses default male bodyweight (85 kg) when bodyweightKg is null', () => {
      const withDefault = estimateOneRmKgFromProfile({
        lift: 'squat',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: null,
      });
      const withExplicit = estimateOneRmKgFromProfile({
        lift: 'squat',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      });
      expect(withDefault).toBe(withExplicit);
    });

    it('uses default female bodyweight (70 kg) when bodyweightKg is omitted', () => {
      const withDefault = estimateOneRmKgFromProfile({
        lift: 'deadlift',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(25),
      });
      const withExplicit = estimateOneRmKgFromProfile({
        lift: 'deadlift',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 70,
      });
      expect(withDefault).toBe(withExplicit);
    });

    it('ignores a zero bodyweight and uses default', () => {
      const withZero = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 0,
      });
      const withDefault = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: null,
      });
      expect(withZero).toBe(withDefault);
    });
  });

  describe('different lifts produce different estimates', () => {
    it('squat, bench, and deadlift return distinct values for a male lifter', () => {
      const shared = {
        biologicalSex: 'male' as const,
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      };
      const squat = estimateOneRmKgFromProfile({ lift: 'squat', ...shared });
      const bench = estimateOneRmKgFromProfile({ lift: 'bench', ...shared });
      const deadlift = estimateOneRmKgFromProfile({ lift: 'deadlift', ...shared });

      expect(squat).not.toBe(bench);
      expect(bench).not.toBe(deadlift);
      expect(squat).not.toBe(deadlift);
    });

    it('deadlift estimate exceeds squat, which exceeds bench (male)', () => {
      const shared = {
        biologicalSex: 'male' as const,
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      };
      const squat = estimateOneRmKgFromProfile({ lift: 'squat', ...shared });
      const bench = estimateOneRmKgFromProfile({ lift: 'bench', ...shared });
      const deadlift = estimateOneRmKgFromProfile({ lift: 'deadlift', ...shared });

      expect(deadlift).toBeGreaterThan(squat);
      expect(squat).toBeGreaterThan(bench);
    });
  });

  describe('age multipliers', () => {
    it('applies no penalty for age 20-29 (multiplier 1.0)', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 1.0 = 100
      expect(result).toBe(100);
    });

    it('applies 0.92 multiplier for age under 20', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(17),
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 0.92 = 92 → rounds to 92.5
      expect(result).toBe(92.5);
    });

    it('applies 0.97 multiplier for age 30-39', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(35),
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 0.97 = 97 → rounds to 97.5
      expect(result).toBe(97.5);
    });

    it('applies 0.92 multiplier for age 40-49', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(45),
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 0.92 = 92 → rounds to 92.5
      expect(result).toBe(92.5);
    });

    it('applies 0.86 multiplier for age 50-59', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(55),
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 0.86 = 86 → rounds to 85
      expect(result).toBe(85);
    });

    it('applies 0.78 multiplier for age 60+', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(65),
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 0.78 = 78 → rounds to 77.5
      expect(result).toBe(77.5);
    });

    it('applies 0.95 fallback multiplier when dateOfBirth is null', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: null,
        bodyweightKg: 100,
      });
      // 100 * 1.0 * 0.95 = 95 → rounds to 95
      expect(result).toBe(95);
    });

    it('applies 0.95 fallback multiplier when dateOfBirth is undefined', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: undefined as unknown as null,
        bodyweightKg: 100,
      });
      expect(result).toBe(95);
    });

    it('applies 0.95 fallback multiplier for an invalid date string', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: 'not-a-date',
        bodyweightKg: 100,
      });
      expect(result).toBe(95);
    });
  });

  describe('minimum floor enforcement', () => {
    it('never returns below squat minimum (40 kg)', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'squat',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(65),
        bodyweightKg: 30,
      });
      expect(result).toBeGreaterThanOrEqual(40);
    });

    it('never returns below bench minimum (30 kg)', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(65),
        bodyweightKg: 30,
      });
      expect(result).toBeGreaterThanOrEqual(30);
    });

    it('never returns below deadlift minimum (50 kg)', () => {
      const result = estimateOneRmKgFromProfile({
        lift: 'deadlift',
        biologicalSex: 'female',
        dateOfBirth: isoDateYearsAgo(65),
        bodyweightKg: 30,
      });
      expect(result).toBeGreaterThanOrEqual(50);
    });
  });

  describe('null biologicalSex', () => {
    it('defaults to male when biologicalSex is null', () => {
      const withNull = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: null,
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      });
      const withMale = estimateOneRmKgFromProfile({
        lift: 'bench',
        biologicalSex: 'male',
        dateOfBirth: isoDateYearsAgo(25),
        bodyweightKg: 85,
      });
      expect(withNull).toBe(withMale);
    });
  });

  describe('output rounding', () => {
    it('result is always a multiple of 2.5', () => {
      const lifts = ['squat', 'bench', 'deadlift'] as const;
      for (const lift of lifts) {
        const result = estimateOneRmKgFromProfile({
          lift,
          biologicalSex: 'male',
          dateOfBirth: isoDateYearsAgo(28),
          bodyweightKg: 90,
        });
        expect(result % 2.5).toBeCloseTo(0, 5);
      }
    });
  });
});
