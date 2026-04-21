import { describe, expect, it } from 'vitest';

import { computeMacroTargets } from '../macro-targets';

describe('computeMacroTargets', () => {
  const baseFemale = {
    bodyweight_kg: 70,
    biological_sex: 'female' as const,
    age_years: 35,
    height_cm: 165,
    activity_level: 'moderate' as const,
    goal: 'maintain' as const,
  };

  it('Mifflin-St Jeor BMR for a 35yo 70kg 165cm female', () => {
    // 10*70 + 6.25*165 - 5*35 - 161 = 700 + 1031.25 - 175 - 161 = 1395.25
    const r = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    expect(r.bmr_method).toBe('mifflin_st_jeor');
    expect(r.bmr_kcal).toBe(1395);
  });

  it('Mifflin-St Jeor BMR for a 35yo 80kg 180cm male differs correctly', () => {
    const r = computeMacroTargets({
      bodyweight_kg: 80,
      biological_sex: 'male',
      age_years: 35,
      height_cm: 180,
      protocol: 'rad',
    });
    // 10*80 + 6.25*180 - 5*35 + 5 = 800 + 1125 - 175 + 5 = 1755
    expect(r.bmr_kcal).toBe(1755);
  });

  it('uses Katch-McArdle when lean mass is known', () => {
    const r = computeMacroTargets({
      ...baseFemale,
      lean_mass_kg: 48,
      protocol: 'rad',
    });
    expect(r.bmr_method).toBe('katch_mccardle');
    // 370 + 21.6 * 48 = 1406.8
    expect(r.bmr_kcal).toBe(1407);
  });

  it('falls back to bodyweight-only BMR when no height or lean mass', () => {
    const r = computeMacroTargets({
      bodyweight_kg: 70,
      biological_sex: 'female',
      protocol: 'rad',
    });
    expect(r.bmr_method).toBe('fallback');
    expect(r.low_confidence).toBe(true);
    // 22 * 70 = 1540
    expect(r.bmr_kcal).toBe(1540);
  });

  it('applies activity multiplier to get TDEE', () => {
    const mod = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const sed = computeMacroTargets({
      ...baseFemale,
      activity_level: 'sedentary',
      protocol: 'rad',
    });
    expect(mod.tdee_kcal).toBeGreaterThan(sed.tdee_kcal);
    // Moderate ≈ BMR × 1.55, sedentary ≈ BMR × 1.2
    const ratio = mod.tdee_kcal / sed.tdee_kcal;
    expect(ratio).toBeCloseTo(1.55 / 1.2, 2);
  });

  it('goal cut reduces kcal by ~15% of TDEE', () => {
    const m = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const c = computeMacroTargets({
      ...baseFemale,
      goal: 'cut',
      protocol: 'rad',
    });
    // Allow ±1 kcal for rounding order
    const expected = Math.round(m.tdee_kcal * 0.85);
    expect(Math.abs(c.kcal - expected)).toBeLessThanOrEqual(1);
  });

  it('goal bulk raises kcal by ~10% of TDEE', () => {
    const m = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const b = computeMacroTargets({
      ...baseFemale,
      goal: 'bulk',
      protocol: 'rad',
    });
    const expected = Math.round(m.tdee_kcal * 1.1);
    expect(Math.abs(b.kcal - expected)).toBeLessThanOrEqual(1);
  });

  it('keto enforces hard carb ceiling (50g total / 20g net)', () => {
    const r = computeMacroTargets({ ...baseFemale, protocol: 'keto' });
    expect(r.carb_g).toBe(50);
    expect(r.net_carb_g_cap).toBe(20);
  });

  it('keto fat is residual after protein + carb kcal', () => {
    const r = computeMacroTargets({ ...baseFemale, protocol: 'keto' });
    const expected_fat_kcal = r.kcal - r.protein_g * 4 - r.carb_g * 4;
    expect(r.fat_g).toBe(Math.round(expected_fat_kcal / 9));
  });

  it('RAD fat is 40% kcal, carb backs off to maintain energy balance', () => {
    const r = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const fat_kcal = r.fat_g * 9;
    // ~40% of kcal, with ±1% rounding tolerance
    expect(fat_kcal / r.kcal).toBeCloseTo(0.4, 1);
    // Sum of macro kcal equals total kcal within rounding
    const macro_kcal = r.protein_g * 4 + r.fat_g * 9 + r.carb_g * 4;
    expect(Math.abs(macro_kcal - r.kcal)).toBeLessThan(5);
  });

  it('net_carb_g_cap is null on RAD, set on keto', () => {
    const rad = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const keto = computeMacroTargets({ ...baseFemale, protocol: 'keto' });
    expect(rad.net_carb_g_cap).toBeNull();
    expect(keto.net_carb_g_cap).toBe(20);
  });

  it('protein uses lean-mass basis when known', () => {
    const withLean = computeMacroTargets({
      ...baseFemale,
      lean_mass_kg: 48,
      protocol: 'rad',
    });
    const withoutLean = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    // Lean-mass protein: 48 * 1.8 = 86.4 → 86
    expect(withLean.protein_g).toBe(86);
    // Bodyweight protein: 70 * 1.8 = 126
    expect(withoutLean.protein_g).toBe(126);
  });

  it('training day bumps protein by 10%', () => {
    const off = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const on = computeMacroTargets({
      ...baseFemale,
      training_day: true,
      protocol: 'rad',
    });
    expect(on.protein_g).toBe(Math.round(off.protein_g * 1.1));
  });

  it('low_confidence flag set when age_years missing but height present', () => {
    const r = computeMacroTargets({
      bodyweight_kg: 70,
      biological_sex: 'female',
      height_cm: 165,
      protocol: 'rad',
    });
    expect(r.bmr_method).toBe('mifflin_st_jeor');
    expect(r.low_confidence).toBe(true);
  });

  it('low_confidence cleared when all inputs present', () => {
    const r = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    expect(r.low_confidence).toBe(false);
  });
});
