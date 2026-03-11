import { getCyclePhaseModifier } from './cycle-phase-adjuster';

describe('getCyclePhaseModifier', () => {
  it('undefined → neutral', () => {
    const m = getCyclePhaseModifier(undefined);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.volumeModifier).toBe(0);
    expect(m.rationale).toBeNull();
  });

  it('menstrual → 0.95x, −1 set', () => {
    const m = getCyclePhaseModifier('menstrual');
    expect(m.intensityMultiplier).toBe(0.95);
    expect(m.volumeModifier).toBe(-1);
    expect(m.rationale).not.toBeNull();
  });

  it('follicular → neutral', () => {
    const m = getCyclePhaseModifier('follicular');
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.volumeModifier).toBe(0);
    expect(m.rationale).toBeNull();
  });

  it('ovulatory → neutral', () => {
    const m = getCyclePhaseModifier('ovulatory');
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.volumeModifier).toBe(0);
    expect(m.rationale).toBeNull();
  });

  it('luteal → 0.975x, 0 sets', () => {
    const m = getCyclePhaseModifier('luteal');
    expect(m.intensityMultiplier).toBe(0.975);
    expect(m.volumeModifier).toBe(0);
    expect(m.rationale).not.toBeNull();
  });

  it('late_luteal → 0.95x, −1 set', () => {
    const m = getCyclePhaseModifier('late_luteal');
    expect(m.intensityMultiplier).toBe(0.95);
    expect(m.volumeModifier).toBe(-1);
    expect(m.rationale).not.toBeNull();
  });
});
