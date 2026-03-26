import { describe, expect, it } from 'vitest';

import { evaluateWeightAutoregulation, WeightAutoregulationContext } from './weight-autoregulation';

function makeCtx(overrides: Partial<WeightAutoregulationContext> = {}): WeightAutoregulationContext {
  return {
    rpeActual: 6.5,
    rpeTarget: 8.0,
    currentWeightKg: 80,
    primaryLift: 'bench',
    remainingSetCount: 2,
    isDeload: false,
    isRecoveryMode: false,
    hasAlreadyAdjusted: false,
    ...overrides,
  };
}

describe('evaluateWeightAutoregulation', () => {
  // -- Bench increments --
  it('bench, gap >= 1.0 → +2.5 kg', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ rpeActual: 7.0, rpeTarget: 8.0 }));
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(2.5);
    expect(result!.suggestedWeightKg).toBe(82.5);
  });

  it('bench, gap >= 1.5 → +5 kg', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ rpeActual: 6.5, rpeTarget: 8.0 }));
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(5);
    expect(result!.suggestedWeightKg).toBe(85);
  });

  // -- Squat increments --
  it('squat, gap >= 1.0 → +5 kg', () => {
    const result = evaluateWeightAutoregulation(
      makeCtx({ primaryLift: 'squat', rpeActual: 7.0, rpeTarget: 8.0, currentWeightKg: 100 }),
    );
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(5);
    expect(result!.suggestedWeightKg).toBe(105);
  });

  it('squat, gap >= 1.5 → +10 kg', () => {
    const result = evaluateWeightAutoregulation(
      makeCtx({ primaryLift: 'squat', rpeActual: 6.5, rpeTarget: 8.0, currentWeightKg: 100 }),
    );
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(10);
    expect(result!.suggestedWeightKg).toBe(110);
  });

  // -- Deadlift increments --
  it('deadlift, gap >= 1.0 → +5 kg', () => {
    const result = evaluateWeightAutoregulation(
      makeCtx({ primaryLift: 'deadlift', rpeActual: 6.0, rpeTarget: 7.0, currentWeightKg: 120 }),
    );
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(5);
    expect(result!.suggestedWeightKg).toBe(125);
  });

  it('deadlift, gap >= 1.5 → +10 kg', () => {
    const result = evaluateWeightAutoregulation(
      makeCtx({ primaryLift: 'deadlift', rpeActual: 6.0, rpeTarget: 8.0, currentWeightKg: 120 }),
    );
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(10);
    expect(result!.suggestedWeightKg).toBe(130);
  });

  // -- No suggestion cases --
  it('gap < 1.0 → null', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ rpeActual: 7.5, rpeTarget: 8.0 }));
    expect(result).toBeNull();
  });

  it('gap exactly 1.0 → suggests', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ rpeActual: 7.0, rpeTarget: 8.0 }));
    expect(result).not.toBeNull();
  });

  it('remainingSetCount === 0 → null', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ remainingSetCount: 0 }));
    expect(result).toBeNull();
  });

  it('isDeload → null', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ isDeload: true }));
    expect(result).toBeNull();
  });

  it('isRecoveryMode → null', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ isRecoveryMode: true }));
    expect(result).toBeNull();
  });

  it('hasAlreadyAdjusted → null', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ hasAlreadyAdjusted: true }));
    expect(result).toBeNull();
  });

  // -- Weight rounding --
  it('suggested weight rounded to nearest 2.5 kg', () => {
    // 81.3 + 2.5 = 83.8 → rounds to 85.0
    const result = evaluateWeightAutoregulation(
      makeCtx({ currentWeightKg: 81.3, rpeActual: 7.0, rpeTarget: 8.0 }),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedWeightKg % 2.5).toBe(0);
  });

  // -- Rationale format --
  it('rationale includes RPE values and delta', () => {
    const result = evaluateWeightAutoregulation(makeCtx({ rpeActual: 6.5, rpeTarget: 8.0 }));
    expect(result).not.toBeNull();
    expect(result!.rationale).toContain('6.5');
    expect(result!.rationale).toContain('8');
    expect(result!.rationale).toContain('+5');
  });
});
