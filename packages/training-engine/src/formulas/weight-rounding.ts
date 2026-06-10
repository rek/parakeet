import { PLATE_SIZES_KG, type PlateKg } from './plate-calculator';

/** Default rounding increment in kg. Matches a standard IWF plate stack
 *  including 1.25kg fractionals (`2 × smallest plate`). Single source of
 *  truth — used by the rounder, the plate-increment helper's fallback,
 *  and the formula config in `cube/blocks.ts`. */
export const DEFAULT_ROUNDING_INCREMENT_KG = 2.5;

export function roundToNearest(
  weightKg: number,
  incrementKg = DEFAULT_ROUNDING_INCREMENT_KG
): number {
  return Math.round(weightKg / incrementKg) * incrementKg;
}

/** Rounds UP to the next reachable increment. Use when honouring a user-set
 *  ceiling (e.g. Rehab Mode cap, GH#220) — if the cap is 82.5kg and the lifter
 *  has 5kg increments, prescription becomes 85kg rather than 80kg. The lifter
 *  chose the cap knowing their plate situation; rounding down would silently
 *  lose meaningful work. */
export function roundUpToNearest(
  weightKg: number,
  incrementKg = DEFAULT_ROUNDING_INCREMENT_KG
): number {
  return Math.ceil(weightKg / incrementKg) * incrementKg;
}

/** Smallest reachable weight step given the user's available plate set.
 *  Returns `2 × smallest enabled plate` because barbells must load symmetrically.
 *  When no plate constraints are passed, falls back to the default 2.5kg
 *  (matches a standard plate stack that includes 1.25kg fractionals).
 *
 *  GH#209: a prescribed 52.5kg requires 1.25kg plates per side. If the lifter
 *  has no 1.25s, 52.5 is unreachable; the next reachable value is 50 or 55.
 *  Pass the result of this fn as the second arg to `roundToNearest`. */
export function plateIncrementKg(
  disabledPlatesKg?: readonly PlateKg[]
): number {
  const disabled = new Set(disabledPlatesKg ?? []);
  const enabled = PLATE_SIZES_KG.filter((p) => !disabled.has(p));
  if (enabled.length === 0) return DEFAULT_ROUNDING_INCREMENT_KG;
  const smallest = Math.min(...enabled);
  return smallest * 2;
}

/** Effective rounding increment for a given JIT input. Takes the more
 *  restrictive of the formula config's `rounding_increment_kg` (program
 *  policy) and the lifter's plate-derived increment (hard constraint). */
export function effectiveIncrementKg(input: {
  weightIncrementKg?: number;
  formulaConfig?: { rounding_increment_kg?: number };
}): number {
  const formula =
    input.formulaConfig?.rounding_increment_kg ?? DEFAULT_ROUNDING_INCREMENT_KG;
  const plate = input.weightIncrementKg ?? formula;
  return Math.max(formula, plate);
}

export function gramsToKg(grams: number): number {
  return grams / 1000;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

export function estimateWorkingWeight(
  oneRmKg: number,
  workingPct = 0.8
): number {
  return Math.round(oneRmKg * workingPct * 2) / 2;
}
