import {
  effectiveIncrementKg,
  estimateWorkingWeight,
  gramsToKg,
  kgToGrams,
  plateIncrementKg,
  roundToNearest,
  roundUpToNearest,
} from './weight-rounding';

describe('roundToNearest', () => {
  it('rounds to 2.5 kg by default', () => {
    expect(roundToNearest(101)).toBe(100);
    expect(roundToNearest(103.75)).toBe(105);
  });

  it('rounds to custom increment', () => {
    expect(roundToNearest(101, 5)).toBe(100);
  });
});

describe('roundUpToNearest (GH#220)', () => {
  it('rounds up to default 2.5kg', () => {
    expect(roundUpToNearest(82.5)).toBe(82.5);
    expect(roundUpToNearest(81)).toBe(82.5);
    expect(roundUpToNearest(80.1)).toBe(82.5);
  });

  it('rounds up to 5kg increment when 1.25 plates disabled', () => {
    expect(roundUpToNearest(82.5, 5)).toBe(85);
    expect(roundUpToNearest(80.1, 5)).toBe(85);
  });

  it('leaves a value that already lands on the increment unchanged', () => {
    expect(roundUpToNearest(80, 5)).toBe(80);
    expect(roundUpToNearest(100, 2.5)).toBe(100);
  });

  it('rounds up to 10kg when only 5s remain', () => {
    expect(roundUpToNearest(82.5, 10)).toBe(90);
  });
});

describe('gramsToKg / kgToGrams', () => {
  it('converts grams to kg', () => {
    expect(gramsToKg(140000)).toBe(140);
  });

  it('converts kg to grams', () => {
    expect(kgToGrams(140)).toBe(140000);
  });
});

describe('plateIncrementKg (GH#209)', () => {
  it('defaults to 2.5kg when no disabled plates passed', () => {
    expect(plateIncrementKg()).toBe(2.5);
    expect(plateIncrementKg([])).toBe(2.5);
  });

  it('returns 2.5kg when 1.25kg plates are enabled', () => {
    expect(plateIncrementKg([25])).toBe(2.5);
    expect(plateIncrementKg([25, 20])).toBe(2.5);
  });

  it('returns 5kg when 1.25kg plates are disabled', () => {
    expect(plateIncrementKg([1.25])).toBe(5);
  });

  it('returns 10kg when both 1.25 and 2.5 are disabled', () => {
    expect(plateIncrementKg([1.25, 2.5])).toBe(10);
  });

  it('returns 20kg when only 10s remain', () => {
    expect(plateIncrementKg([25, 20, 15, 5, 2.5, 1.25])).toBe(20);
  });

  it('falls back to 2.5kg when every plate is disabled', () => {
    expect(plateIncrementKg([25, 20, 15, 10, 5, 2.5, 1.25])).toBe(2.5);
  });
});

describe('effectiveIncrementKg', () => {
  it('uses formula config increment when no plate constraint', () => {
    expect(
      effectiveIncrementKg({ formulaConfig: { rounding_increment_kg: 2.5 } })
    ).toBe(2.5);
  });

  it('uses plate-derived increment when more restrictive than formula', () => {
    expect(
      effectiveIncrementKg({
        weightIncrementKg: 5,
        formulaConfig: { rounding_increment_kg: 2.5 },
      })
    ).toBe(5);
  });

  it('uses formula increment when more restrictive than plate', () => {
    expect(
      effectiveIncrementKg({
        weightIncrementKg: 2.5,
        formulaConfig: { rounding_increment_kg: 5 },
      })
    ).toBe(5);
  });

  it('GH#209: a 52.5 prescription is rounded off the 1.25-plate ladder', () => {
    // With plates that can't reach 52.5 (smallest enabled 2.5kg per side,
    // so increment 5), 52.5 rounds to a 5kg-multiple reachable weight.
    const increment = effectiveIncrementKg({ weightIncrementKg: 5 });
    const result = roundToNearest(52.5, increment);
    expect(result % 5).toBe(0);
    expect([50, 55]).toContain(result);
  });

  it('GH#209: 52.5 stays 52.5 with default increment 2.5', () => {
    const increment = effectiveIncrementKg({});
    expect(roundToNearest(52.5, increment)).toBe(52.5);
  });

  it('GH#209: 52 rounds to 50 when 1.25 plates disabled', () => {
    const increment = effectiveIncrementKg({ weightIncrementKg: 5 });
    expect(roundToNearest(52, increment)).toBe(50);
  });

  it('defaults to 2.5kg when nothing supplied', () => {
    expect(effectiveIncrementKg({})).toBe(2.5);
  });
});

describe('estimateWorkingWeight', () => {
  it('defaults to 80% of 1RM, rounded to nearest 0.5 kg', () => {
    expect(estimateWorkingWeight(100)).toBe(80);
    expect(estimateWorkingWeight(137.5)).toBe(110);
    // 137.5 * 0.8 = 110.0 → 110
  });

  it('accepts custom working percentage', () => {
    expect(estimateWorkingWeight(100, 0.7)).toBe(70);
  });

  it('rounds to nearest 0.5 kg', () => {
    // 93 * 0.8 = 74.4 → round(74.4 * 2) / 2 = round(148.8) / 2 = 149/2 = 74.5
    expect(estimateWorkingWeight(93)).toBe(74.5);
  });
});
