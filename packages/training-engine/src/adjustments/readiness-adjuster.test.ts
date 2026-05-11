import { getReadinessModifier } from './readiness-adjuster';

describe('getReadinessModifier (1-5 native scale)', () => {
  it('both Drained (1,1) → -1 set, 0.95x intensity', () => {
    const m = getReadinessModifier(1, 1);
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(0.95);
    expect(m.rationale).not.toBeNull();
  });

  it('both Low (2,2) → -1 set, 0.95x intensity (both poor band)', () => {
    const m = getReadinessModifier(2, 2);
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(0.95);
  });

  it('Drained sleep + Low energy (1,2) → -1 set, 0.95x (both poor)', () => {
    const m = getReadinessModifier(1, 2);
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(0.95);
  });

  it('Drained sleep + OK energy (1,3) → poor sleep only, 0.975x', () => {
    const m = getReadinessModifier(1, 3);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(0.975);
    expect(m.rationale).toMatch(/sleep/i);
  });

  it('Low sleep + OK energy (2,3) → poor sleep only, 0.975x', () => {
    const m = getReadinessModifier(2, 3);
    expect(m.intensityMultiplier).toBe(0.975);
    expect(m.rationale).toMatch(/sleep/i);
  });

  it('OK sleep + Drained energy (3,1) → low energy only, 0.975x', () => {
    const m = getReadinessModifier(3, 1);
    expect(m.intensityMultiplier).toBe(0.975);
    expect(m.rationale).toMatch(/energy/i);
  });

  it('OK sleep + Low energy (3,2) → low energy only, 0.975x', () => {
    const m = getReadinessModifier(3, 2);
    expect(m.intensityMultiplier).toBe(0.975);
    expect(m.rationale).toMatch(/energy/i);
  });

  it('OK / OK (3,3) → neutral', () => {
    const m = getReadinessModifier(3, 3);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.rationale).toBeNull();
  });

  it('Good / Good (4,4) → boost 1.025x', () => {
    const m = getReadinessModifier(4, 4);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(1.025);
  });

  it('High / High (5,5) → boost 1.025x', () => {
    const m = getReadinessModifier(5, 5);
    expect(m.intensityMultiplier).toBe(1.025);
  });

  it('Good sleep + OK energy (4,3) → neutral (boost needs both 4+)', () => {
    const m = getReadinessModifier(4, 3);
    expect(m.intensityMultiplier).toBe(1.0);
  });

  it('High sleep + OK energy (5,3) → neutral (boost needs both 4+)', () => {
    expect(getReadinessModifier(5, 3).intensityMultiplier).toBe(1.0);
  });

  it('undefined inputs default to neutral → no change', () => {
    const m = getReadinessModifier(undefined, undefined);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.setReduction).toBe(0);
    expect(m.rationale).toBeNull();
  });

  it('only one side defined uses other as neutral (3)', () => {
    expect(getReadinessModifier(1, undefined).intensityMultiplier).toBe(0.975);
    expect(getReadinessModifier(undefined, 1).intensityMultiplier).toBe(0.975);
    expect(getReadinessModifier(5, undefined).intensityMultiplier).toBe(1.0);
    expect(getReadinessModifier(undefined, 5).intensityMultiplier).toBe(1.0);
  });
});
