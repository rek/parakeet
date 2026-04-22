/**
 * Compute daily macro + kcal targets for the current lifter given a
 * chosen diet protocol.
 *
 * **All numeric constants in this file (activity multipliers, goal
 * deltas, protocol splits, protein g/kg, training-day bump, keto
 * ceiling) are documented in the domain doc — update both together:**
 *   → `docs/domain/nutrition.md`
 *
 * Pure function. All inputs optional except bodyweight + sex. Missing
 * height / lean-mass / activity / goal fall back to documented
 * defaults (see MacroTargetDefaults below).
 *
 * BMR strategy:
 *   1. Katch-McArdle (if lean_mass_kg known) — most accurate.
 *   2. Mifflin-St Jeor (height + age known) — standard clinical default.
 *   3. Fallback (bodyweight × sex-specific multiplier) — only when
 *      neither above is possible; explicit low-confidence flag returned.
 *
 * Lipedema note: bioimpedance body-comp readings are unreliable on
 * affected limbs (see docs/features/nutrition/design.md + labs.md).
 * Use DEXA-derived lean mass if available; otherwise fall back to
 * Mifflin-St Jeor rather than trusting scale-based "lean mass".
 */

export type BiologicalSex = 'female' | 'male';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
export type Goal = 'cut' | 'maintain' | 'bulk';
export type DietProtocolSlug = 'keto' | 'rad' | 'standard';

export interface MacroTargetInput {
  bodyweight_kg: number;
  biological_sex: BiologicalSex;
  age_years?: number | null;
  height_cm?: number | null;
  lean_mass_kg?: number | null;
  activity_level?: ActivityLevel | null;
  goal?: Goal | null;
  protocol: DietProtocolSlug;
  /**
   * Training day today. Bumps protein by +10% per ISSN position stand
   * on protein timing & training demands.
   */
  training_day?: boolean;
  /**
   * Manual kcal target override. When set (> 0), bypasses BMR × activity
   * × goal and uses this value as `kcal` directly. BMR + TDEE are still
   * computed for display so the calculator UI can show what the fn
   * *would* have prescribed vs what the user pinned.
   */
  kcal_override?: number | null;
}

export interface MacroTarget {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  /** Net carbs (carb - fiber estimate). Keto-relevant. */
  net_carb_g_cap: number | null;
  /** Upstream values used — surfaced for the UI explanation copy. */
  bmr_kcal: number;
  tdee_kcal: number;
  bmr_method: 'katch_mcardle' | 'mifflin_st_jeor' | 'fallback';
  /**
   * True if we couldn't use a validated BMR formula. UI should show
   * a 'rough estimate' badge and nudge the user to fill missing
   * profile fields.
   */
  low_confidence: boolean;
  /**
   * True iff `kcal_override` was applied. UI may show a "pinned kcal"
   * badge and the delta vs BMR × activity × goal.
   */
  kcal_overridden: boolean;
}

export const MacroTargetDefaults = {
  activity_level: 'moderate' as ActivityLevel,
  goal: 'maintain' as Goal,
  /**
   * Fallback age when date_of_birth is missing. Chosen to produce a
   * conservative (slightly-lower) BMR than a young adult, to avoid
   * over-prescribing calories for older users with no DOB on file.
   */
  age_years_fallback: 45,
} as const;

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_KCAL_DELTA: Record<Goal, number> = {
  cut: -0.15,
  maintain: 0,
  bulk: 0.1,
};

// ---------------------------------------------------------------------------
// Protocol config
// ---------------------------------------------------------------------------

interface ProtocolConfig {
  /** g/kg of reference mass for protein. */
  protein_g_per_kg: number;
  /** Fixed carb ceiling in grams (keto only). null = percentage-based. */
  carb_ceiling_g: number | null;
  /** Net carb cap for display (keto only). */
  net_carb_g_cap: number | null;
  /** Fraction of kcal allocated to carbs before fat (standard). null = fat-first. */
  carb_pct: number | null;
  /** Fraction of kcal allocated to fat before carbs (RAD). null = carb-first. */
  fat_pct: number | null;
}

const PROTOCOL_CONFIG: Record<DietProtocolSlug, ProtocolConfig> = {
  // Cannataro 2021 — ~30% kcal from protein; hard carb ceiling defines ketosis.
  keto: {
    protein_g_per_kg: 1.4,
    carb_ceiling_g: 50,
    net_carb_g_cap: 20,
    carb_pct: null,
    fat_pct: null,
  },
  // RAD = Rare Adipose Disorders Diet (Herbst). Mediterranean-style, low-GI,
  // anti-inflammatory. Designed for lipedema / Dercum's / MSL — NOT a general
  // powerlifting protocol.
  //
  // Fat 40%: standard Mediterranean allocation. Clinical lipedema trials
  // (LIPODIET, Sørlie 2022) used 70–75% fat (closer to keto); 40% is the
  // Mediterranean floor. Choose keto if higher fat restriction is prescribed.
  //
  // Protein 1.4 g/kg: adapted from Cannataro 2021 (keto-lipedema, 22-month
  // follow-up) — the only lipedema-specific protein figure in the literature.
  // Standard LIPODIET data implies ~1.0–1.1 g/kg; 1.4 g/kg is a conservative
  // upward adjustment for resistance-training load. This is NOT sourced from
  // Helms 2014 (natural bodybuilding), which was erroneously cited here before.
  rad: {
    protein_g_per_kg: 1.4,
    carb_ceiling_g: null,
    net_carb_g_cap: null,
    carb_pct: null,
    fat_pct: 0.4,
  },
  // Stokes et al. ISSN 2018 — carb-forward, standard diet for amateur strength athletes.
  standard: {
    protein_g_per_kg: 1.8,
    carb_ceiling_g: null,
    net_carb_g_cap: null,
    carb_pct: 0.45,
    fat_pct: null,
  },
};

// ---------------------------------------------------------------------------
// BMR
// ---------------------------------------------------------------------------

function katchMcCardle(lean_mass_kg: number): number {
  return 370 + 21.6 * lean_mass_kg;
}

function mifflinStJeor(
  bodyweight_kg: number,
  height_cm: number,
  age_years: number,
  sex: BiologicalSex,
): number {
  const base = 10 * bodyweight_kg + 6.25 * height_cm - 5 * age_years;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Bodyweight-only fallback. Only used when neither lean mass nor
 * height is available. Constants are rule-of-thumb averages, not
 * research-grade; the returned MacroTarget flags low_confidence=true.
 */
function bodyweightFallback(bodyweight_kg: number, sex: BiologicalSex): number {
  return sex === 'male' ? 24 * bodyweight_kg : 22 * bodyweight_kg;
}

function computeBmr(
  bodyweight_kg: number,
  biological_sex: BiologicalSex,
  height_cm: number | null | undefined,
  age_years: number | null | undefined,
  lean_mass_kg: number | null | undefined,
): { bmr: number; bmr_method: MacroTarget['bmr_method']; low_confidence: boolean } {
  if (lean_mass_kg != null && lean_mass_kg > 0) {
    return { bmr: katchMcCardle(lean_mass_kg), bmr_method: 'katch_mcardle', low_confidence: false };
  }
  if (height_cm != null && height_cm > 0) {
    const age = age_years ?? MacroTargetDefaults.age_years_fallback;
    return {
      bmr: mifflinStJeor(bodyweight_kg, height_cm, age, biological_sex),
      bmr_method: 'mifflin_st_jeor',
      low_confidence: age_years == null,
    };
  }
  return { bmr: bodyweightFallback(bodyweight_kg, biological_sex), bmr_method: 'fallback', low_confidence: true };
}

// ---------------------------------------------------------------------------
// Carb + Fat split
// ---------------------------------------------------------------------------

function computeCarbFat(
  config: ProtocolConfig,
  kcal: number,
  protein_kcal: number,
): { carb_g: number; fat_g: number } {
  if (config.carb_ceiling_g != null) {
    // Keto: fixed carb ceiling, fat fills residual.
    const carb_g = config.carb_ceiling_g;
    const fat_g = Math.max(0, Math.round((kcal - protein_kcal - carb_g * 4) / 9));
    return { carb_g, fat_g };
  }
  if (config.carb_pct != null) {
    // Standard: carb-first, fat fills residual.
    const carb_g = Math.round((kcal * config.carb_pct) / 4);
    const fat_g = Math.max(0, Math.round((kcal - protein_kcal - carb_g * 4) / 9));
    return { carb_g, fat_g };
  }
  // RAD: fat-first, carbs fill residual.
  const fat_pct = config.fat_pct ?? 0.4;
  const fat_g = Math.round((kcal * fat_pct) / 9);
  const carb_g = Math.max(0, Math.round((kcal - protein_kcal - fat_g * 9) / 4));
  return { carb_g, fat_g };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function computeMacroTargets(input: MacroTargetInput): MacroTarget {
  const {
    bodyweight_kg,
    biological_sex,
    age_years,
    height_cm,
    lean_mass_kg,
    activity_level = MacroTargetDefaults.activity_level,
    goal = MacroTargetDefaults.goal,
    protocol,
    training_day = false,
  } = input;

  const config = PROTOCOL_CONFIG[protocol];

  // 1. BMR
  const { bmr, bmr_method, low_confidence } = computeBmr(
    bodyweight_kg, biological_sex, height_cm, age_years, lean_mass_kg,
  );

  // 2. TDEE
  const activity = activity_level ?? MacroTargetDefaults.activity_level;
  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];

  // 3. Goal-adjusted kcal (or user override).
  const goalT = goal ?? MacroTargetDefaults.goal;
  const derivedKcal = Math.round(tdee * (1 + GOAL_KCAL_DELTA[goalT]));
  const kcal_override = input.kcal_override;
  const kcal =
    kcal_override != null && kcal_override > 0
      ? Math.round(kcal_override)
      : derivedKcal;

  // 4. Protein — lean-mass basis preferred when known.
  const perKg = config.protein_g_per_kg * (training_day ? 1.1 : 1);
  const ref_mass = lean_mass_kg != null && lean_mass_kg > 0 ? lean_mass_kg : bodyweight_kg;
  const protein_g = Math.round(ref_mass * perKg);
  const protein_kcal = protein_g * 4;

  // 5. Carb + Fat split by protocol.
  const { carb_g, fat_g } = computeCarbFat(config, kcal, protein_kcal);

  return {
    kcal,
    protein_g,
    fat_g,
    carb_g,
    net_carb_g_cap: config.net_carb_g_cap,
    bmr_kcal: Math.round(bmr),
    tdee_kcal: Math.round(tdee),
    bmr_method,
    low_confidence,
    kcal_overridden: kcal_override != null && kcal_override > 0,
  };
}
