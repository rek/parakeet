import { getReadinessModifier } from './readiness-adjuster';

describe('getReadinessModifier', () => {
  it('both poor (1,1) → -1 set, 0.95x intensity', () => {
    const m = getReadinessModifier(1, 1);
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(0.95);
    expect(m.rationale).not.toBeNull();
  });

  it('poor sleep, ok energy (1,2) → 0 sets, 0.975x', () => {
    const m = getReadinessModifier(1, 2);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(0.975);
  });

  it('poor sleep, high energy (1,3) → 0.975x', () => {
    expect(getReadinessModifier(1, 3).intensityMultiplier).toBe(0.975);
  });

  it('ok sleep, low energy (2,1) → 0.975x', () => {
    expect(getReadinessModifier(2, 1).intensityMultiplier).toBe(0.975);
  });

  it('great sleep, low energy (3,1) → 0.975x', () => {
    expect(getReadinessModifier(3, 1).intensityMultiplier).toBe(0.975);
  });

  it('normal/normal (2,2) → neutral', () => {
    const m = getReadinessModifier(2, 2);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.rationale).toBeNull();
  });

  it('both great (3,3) → 0 sets, 1.025x', () => {
    const m = getReadinessModifier(3, 3);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(1.025);
    expect(m.rationale).not.toBeNull();
  });

  it('great sleep, ok energy (3,2) → neutral', () => {
    const m = getReadinessModifier(3, 2);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.setReduction).toBe(0);
  });

  it('undefined inputs default to normal → neutral', () => {
    const m = getReadinessModifier(undefined, undefined);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.setReduction).toBe(0);
    expect(m.rationale).toBeNull();
  });
});
