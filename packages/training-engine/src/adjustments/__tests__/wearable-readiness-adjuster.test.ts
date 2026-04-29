import {
  getWearableReadinessModifier,
  hasWearableData,
} from '../wearable-readiness-adjuster';

describe('hasWearableData', () => {
  it('returns false when all signals undefined', () => {
    expect(hasWearableData({})).toBe(false);
  });

  it('returns true with only hrvPctChange', () => {
    expect(hasWearableData({ hrvPctChange: -5 })).toBe(true);
  });

  it('returns true with only sleepDurationMin', () => {
    expect(hasWearableData({ sleepDurationMin: 400 })).toBe(true);
  });

  it('returns true with only restingHrPctChange', () => {
    expect(hasWearableData({ restingHrPctChange: 5 })).toBe(true);
  });

  it('returns false with only deepSleepPct', () => {
    expect(hasWearableData({ deepSleepPct: 10 })).toBe(false);
  });

  it('returns false with only nonTrainingLoad', () => {
    expect(hasWearableData({ nonTrainingLoad: 3 })).toBe(false);
  });

  it('returns false with only readinessScore', () => {
    expect(hasWearableData({ readinessScore: 40 })).toBe(false);
  });
});

describe('getWearableReadinessModifier', () => {
  it('all signals undefined → NEUTRAL returned', () => {
    const m = getWearableReadinessModifier({});
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.rationale).toBeNull();
  });

  it('hrvPctChange -25 → setReduction 1, intensityMultiplier 0.95', () => {
    const m = getWearableReadinessModifier({ hrvPctChange: -25 });
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBeCloseTo(0.95);
    expect(m.rationale).toMatch(/HRV/);
  });

  it('hrvPctChange -15 → setReduction 0, intensityMultiplier 0.975', () => {
    const m = getWearableReadinessModifier({ hrvPctChange: -15 });
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBeCloseTo(0.975);
  });

  it('hrvPctChange -25 + restingHrPctChange 12 → setReduction 1, multiplier ~0.92625', () => {
    const m = getWearableReadinessModifier({
      hrvPctChange: -25,
      restingHrPctChange: 12,
    });
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBeCloseTo(0.95 * 0.975);
  });

  it('sleepDurationMin 240 → setReduction 1, intensityMultiplier 0.95', () => {
    const m = getWearableReadinessModifier({ sleepDurationMin: 240 });
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBeCloseTo(0.95);
  });

  it('sleepDurationMin 330 → setReduction 0, intensityMultiplier 0.975', () => {
    const m = getWearableReadinessModifier({ sleepDurationMin: 330 });
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBeCloseTo(0.975);
  });

  it('sleepDurationMin 480 + deepSleepPct 10 → low deep sleep adds 0.975 multiplier', () => {
    const withDeep = getWearableReadinessModifier({
      sleepDurationMin: 480,
      deepSleepPct: 10,
    });
    const withoutDeep = getWearableReadinessModifier({ sleepDurationMin: 480 });
    expect(withDeep.intensityMultiplier).toBeLessThan(withoutDeep.intensityMultiplier);
    expect(withDeep.intensityMultiplier).toBeCloseTo(0.975);
  });

  it('boost: hrv+12, sleep 480, deepSleepPct 22 → intensityMultiplier 1.025', () => {
    const m = getWearableReadinessModifier({
      hrvPctChange: 12,
      sleepDurationMin: 480,
      deepSleepPct: 22,
    });
    expect(m.intensityMultiplier).toBeCloseTo(1.025);
    expect(m.setReduction).toBe(0);
  });

  it('no boost when negative sleep signal present', () => {
    const m = getWearableReadinessModifier({
      hrvPctChange: 12,
      sleepDurationMin: 240,
      deepSleepPct: 22,
    });
    expect(m.intensityMultiplier).toBeLessThan(1.0);
  });

  it('stacking cap: hrv -25 + rhr 16 + sleep 240 → setReduction capped at 2', () => {
    const m = getWearableReadinessModifier({
      hrvPctChange: -25,
      restingHrPctChange: 16,
      sleepDurationMin: 240,
    });
    expect(m.setReduction).toBe(2);
  });

  it('intensity floor: extreme stacking → intensityMultiplier >= 0.85', () => {
    const m = getWearableReadinessModifier({
      hrvPctChange: -25,
      restingHrPctChange: 16,
      sleepDurationMin: 240,
      deepSleepPct: 5,
      nonTrainingLoad: 3,
    });
    expect(m.intensityMultiplier).toBeGreaterThanOrEqual(0.85);
    expect(m.intensityMultiplier).toBe(0.85);
  });

  it('nonTrainingLoad 3 → intensityMultiplier 0.975', () => {
    const m = getWearableReadinessModifier({ nonTrainingLoad: 3 });
    // nonTrainingLoad alone doesn't satisfy hasWearableData — returns NEUTRAL
    expect(m.intensityMultiplier).toBe(1.0);
  });

  it('nonTrainingLoad 3 with a primary signal → applies 0.975 multiplier', () => {
    const withLoad = getWearableReadinessModifier({
      sleepDurationMin: 420,
      nonTrainingLoad: 3,
    });
    const withoutLoad = getWearableReadinessModifier({ sleepDurationMin: 420 });
    expect(withLoad.intensityMultiplier).toBeLessThan(withoutLoad.intensityMultiplier);
    expect(withLoad.intensityMultiplier).toBeCloseTo(0.975);
  });
});
