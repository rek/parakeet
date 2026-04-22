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
    expect(r.bmr_method).toBe('katch_mcardle');
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
    // Lean-mass protein: 48 * 1.4 = 67.2 → 67
    expect(withLean.protein_g).toBe(67);
    // Bodyweight protein: 70 * 1.4 = 98
    expect(withoutLean.protein_g).toBe(98);
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

  it('training-day bump composes with Katch-McArdle branch', () => {
    const off = computeMacroTargets({
      ...baseFemale,
      lean_mass_kg: 48,
      protocol: 'rad',
    });
    const on = computeMacroTargets({
      ...baseFemale,
      lean_mass_kg: 48,
      training_day: true,
      protocol: 'rad',
    });
    expect(on.protein_g).toBe(Math.round(off.protein_g * 1.1));
    // Both should use Katch-McArdle BMR regardless of training day.
    expect(on.bmr_method).toBe('katch_mcardle');
    expect(off.bmr_method).toBe('katch_mcardle');
  });

  it('keto + bulk with small lifter keeps fat >= 0 (no negative macros)', () => {
    // Low bodyweight + bulk can push kcal below (protein + carb) if keto
    // protein is very high. Guard: fat_g must never go negative.
    const r = computeMacroTargets({
      bodyweight_kg: 45,
      biological_sex: 'female',
      age_years: 25,
      height_cm: 150,
      activity_level: 'sedentary',
      goal: 'bulk',
      training_day: true,
      protocol: 'keto',
    });
    expect(r.fat_g).toBeGreaterThanOrEqual(0);
    expect(r.protein_g).toBeGreaterThan(0);
    expect(r.carb_g).toBe(50);
  });

  it('kcal_override pins the daily target and flags kcal_overridden', () => {
    const r = computeMacroTargets({
      ...baseFemale,
      protocol: 'keto',
      kcal_override: 2000,
    });
    expect(r.kcal).toBe(2000);
    expect(r.kcal_overridden).toBe(true);
    // Macros re-computed against the 2000 target, not the derived TDEE.
    const sum = r.protein_g * 4 + r.fat_g * 9 + r.carb_g * 4;
    expect(Math.abs(sum - r.kcal)).toBeLessThan(6);
  });

  it('kcal_override null / 0 falls back to derived kcal', () => {
    const baseline = computeMacroTargets({ ...baseFemale, protocol: 'rad' });
    const nulled = computeMacroTargets({
      ...baseFemale,
      protocol: 'rad',
      kcal_override: null,
    });
    const zeroed = computeMacroTargets({
      ...baseFemale,
      protocol: 'rad',
      kcal_override: 0,
    });
    expect(nulled.kcal).toBe(baseline.kcal);
    expect(zeroed.kcal).toBe(baseline.kcal);
    expect(nulled.kcal_overridden).toBe(false);
    expect(zeroed.kcal_overridden).toBe(false);
  });

  it('kcal_override preserves bmr_kcal and tdee_kcal for display', () => {
    // User can see what the fn *would* have prescribed vs what they pinned.
    const r = computeMacroTargets({
      ...baseFemale,
      protocol: 'keto',
      kcal_override: 2500,
    });
    expect(r.bmr_kcal).toBeGreaterThan(0);
    expect(r.tdee_kcal).toBeGreaterThan(r.bmr_kcal);
    expect(r.kcal).toBe(2500);
  });

  it('keto at 2000 kcal for a 70kg lifter matches hand math', () => {
    const r = computeMacroTargets({
      bodyweight_kg: 70,
      biological_sex: 'female',
      protocol: 'keto',
      kcal_override: 2000,
    });
    // protein = 70 × 1.4 = 98 g
    expect(r.protein_g).toBe(98);
    // carb = 50 g (hard ceiling)
    expect(r.carb_g).toBe(50);
    // fat = (2000 − 98×4 − 50×4) / 9 = 1408 / 9 ≈ 156.4 → 156
    expect(r.fat_g).toBe(156);
  });

  it('returns sane output even with zero bodyweight (no NaN propagation)', () => {
    // Boundary: defensive, not a supported usage path. We just don't
    // want NaN leaking to the UI.
    const r = computeMacroTargets({
      bodyweight_kg: 0,
      biological_sex: 'female',
      age_years: 35,
      height_cm: 160,
      protocol: 'rad',
    });
    expect(Number.isFinite(r.kcal)).toBe(true);
    expect(Number.isFinite(r.protein_g)).toBe(true);
    expect(Number.isFinite(r.fat_g)).toBe(true);
    expect(Number.isFinite(r.carb_g)).toBe(true);
  });
});
