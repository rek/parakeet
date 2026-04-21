/**
 * Compute daily macro + kcal targets for the current lifter given a
 * chosen diet protocol.
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
export type DietProtocolSlug = 'keto' | 'rad';

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
  bmr_method: 'katch_mccardle' | 'mifflin_st_jeor' | 'fallback';
  /**
   * True if we couldn't use a validated BMR formula. UI should show
   * a 'rough estimate' badge and nudge the user to fill missing
   * profile fields.
   */
  low_confidence: boolean;
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
function bodyweightFallback(
  bodyweight_kg: number,
  sex: BiologicalSex,
): number {
  return sex === 'male' ? 24 * bodyweight_kg : 22 * bodyweight_kg;
}

// ---------------------------------------------------------------------------
// Protein
// ---------------------------------------------------------------------------

interface ProteinTarget {
  g_per_day: number;
  g_per_kg: number;
  basis: 'lean_mass' | 'bodyweight';
}

function proteinTarget(
  bodyweight_kg: number,
  lean_mass_kg: number | null | undefined,
  protocol: DietProtocolSlug,
  training_day: boolean,
): ProteinTarget {
  // Target g/kg — midpoint of accepted ranges. Lean-mass basis is
  // preferred when known (1.4 g/kg lean ≈ 2.0 g/kg bodyweight at 30% bf).
  const basePerKg =
    protocol === 'keto'
      ? lean_mass_kg != null
        ? 1.4 // keto-on-lean-mass midpoint
        : 1.4 // keto-on-bodyweight (Cannataro used ~30% kcal = ~1.4 g/kg bw)
      : lean_mass_kg != null
        ? 1.8
        : 1.8; // RAD more protein-permissive

  const trainingBump = training_day ? 1.1 : 1;
  const perKg = basePerKg * trainingBump;

  if (lean_mass_kg != null) {
    return {
      g_per_day: Math.round(lean_mass_kg * perKg),
      g_per_kg: perKg,
      basis: 'lean_mass',
    };
  }
  return {
    g_per_day: Math.round(bodyweight_kg * perKg),
    g_per_kg: perKg,
    basis: 'bodyweight',
  };
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

  // 1. BMR
  let bmr: number;
  let bmr_method: MacroTarget['bmr_method'];
  let low_confidence = false;
  if (lean_mass_kg != null && lean_mass_kg > 0) {
    bmr = katchMcCardle(lean_mass_kg);
    bmr_method = 'katch_mccardle';
  } else if (height_cm != null && height_cm > 0) {
    const age = age_years ?? MacroTargetDefaults.age_years_fallback;
    bmr = mifflinStJeor(bodyweight_kg, height_cm, age, biological_sex);
    bmr_method = 'mifflin_st_jeor';
    if (age_years == null) low_confidence = true;
  } else {
    bmr = bodyweightFallback(bodyweight_kg, biological_sex);
    bmr_method = 'fallback';
    low_confidence = true;
  }

  // 2. TDEE
  const activity = activity_level ?? MacroTargetDefaults.activity_level;
  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];

  // 3. Goal-adjusted kcal
  const goalT = goal ?? MacroTargetDefaults.goal;
  const kcal = Math.round(tdee * (1 + GOAL_KCAL_DELTA[goalT]));

  // 4. Protein
  const protein = proteinTarget(
    bodyweight_kg,
    lean_mass_kg,
    protocol,
    training_day,
  );
  const protein_g = protein.g_per_day;
  const protein_kcal = protein_g * 4;

  // 5. Carb + Fat by protocol
  let carb_g: number;
  let fat_g: number;
  let net_carb_g_cap: number | null;

  if (protocol === 'keto') {
    // Hard ceiling: 50g total / 20g net. Fat = residual.
    carb_g = 50;
    net_carb_g_cap = 20;
    const carb_kcal = carb_g * 4;
    fat_g = Math.max(0, Math.round((kcal - protein_kcal - carb_kcal) / 9));
  } else {
    // RAD: 40% fat / 30% carb / protein already set (~25–30%).
    // If protein already exceeds 30% (small lifter, high g/kg), carbs
    // are reduced — fat stays at 40% floor.
    const fat_kcal = kcal * 0.4;
    fat_g = Math.round(fat_kcal / 9);
    const carb_kcal = Math.max(0, kcal - protein_kcal - fat_kcal);
    carb_g = Math.round(carb_kcal / 4);
    net_carb_g_cap = null;
  }

  return {
    kcal,
    protein_g,
    fat_g,
    carb_g,
    net_carb_g_cap,
    bmr_kcal: Math.round(bmr),
    tdee_kcal: Math.round(tdee),
    bmr_method,
    low_confidence,
  };
}
