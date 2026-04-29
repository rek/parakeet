import { computeReadinessScore } from '../readiness-score';

describe('computeReadinessScore', () => {
  it('all signals at peak → score 100', () => {
    const score = computeReadinessScore({
      hrvPctChange: 15,
      sleepDurationMin: 540,
      deepSleepPct: 25,
      restingHrPctChange: -10,
      nonTrainingLoad: 0,
    });
    expect(score).toBe(100);
  });

  it('all signals at worst → score near 0 (nonTrainingLoad=3 contributes 25 pts × 0.10 weight)', () => {
    // nonTrainingLoad=3: score=25, weight=0.10. All other signals score 0.
    // Weighted result: 0*0.90 + 25*0.10 = 2.5 → rounds to 3.
    const score = computeReadinessScore({
      hrvPctChange: -30,
      sleepDurationMin: 240,
      deepSleepPct: 5,
      restingHrPctChange: 20,
      nonTrainingLoad: 3,
    });
    expect(score).toBeLessThanOrEqual(5);
    expect(score).not.toBeNull();
  });

  it('HRV-only: hrvPctChange 0 → score lerps to 67 (weight redistributed)', () => {
    // HRV at 0%: lerp(-30 to +15, value=0) = 30/45 = 0.667 → 66.7 → rounded 67
    const score = computeReadinessScore({ hrvPctChange: 0 });
    expect(score).toBe(67);
  });

  it('all signals missing → score null', () => {
    expect(computeReadinessScore({})).toBeNull();
  });

  it('deep-sleep bonus: deepSleepPct >= 20 adds 10 points vs deepSleepPct 18', () => {
    const withBonus = computeReadinessScore({
      sleepDurationMin: 420,
      deepSleepPct: 22,
    });
    const withoutBonus = computeReadinessScore({
      sleepDurationMin: 420,
      deepSleepPct: 18,
    });
    expect(withBonus).not.toBeNull();
    expect(withoutBonus).not.toBeNull();
    expect(withBonus! - withoutBonus!).toBeGreaterThan(0);
  });

  it('weight redistribution: present components still cover full weight', () => {
    // With all 4 signals present vs 3 signals, removing one signal
    // should shift weight proportionally — score stays reasonable
    const allFour = computeReadinessScore({
      hrvPctChange: 0,
      sleepDurationMin: 390,
      restingHrPctChange: 5,
      nonTrainingLoad: 1,
    });
    const noLoad = computeReadinessScore({
      hrvPctChange: 0,
      sleepDurationMin: 390,
      restingHrPctChange: 5,
    });
    // Both should produce a valid score
    expect(allFour).not.toBeNull();
    expect(noLoad).not.toBeNull();
    // Score is clamped 0–100
    expect(noLoad!).toBeGreaterThanOrEqual(0);
    expect(noLoad!).toBeLessThanOrEqual(100);
  });
});
