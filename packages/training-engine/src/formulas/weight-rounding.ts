import { PLATE_SIZES_KG, type PlateKg } from './plate-calculator';

export function roundToNearest(weightKg: number, incrementKg = 2.5): number {
  return Math.round(weightKg / incrementKg) * incrementKg;
}

/** Smallest reachable weight step given the user's available plate set.
 *  Returns `2 × smallest enabled plate` because barbells must load symmetrically.
 *  When no plate constraints are passed, falls back to the default 2.5kg
 *  (matches a standard plate stack that includes 1.25kg fractionals).
 *
 *  GH#209: a prescribed 52.5kg requires 1.25kg plates per side. If the lifter
 *  has no 1.25s, 52.5 is unreachable; the next reachable value is 50 or 55.
 *  Pass the result of this fn as the second arg to `roundToNearest`. */
export function plateIncrementKg(disabledPlatesKg?: readonly PlateKg[]): number {
  const disabled = new Set(disabledPlatesKg ?? []);
  const enabled = PLATE_SIZES_KG.filter((p) => !disabled.has(p));
  if (enabled.length === 0) return 2.5;
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
  const formula = input.formulaConfig?.rounding_increment_kg ?? 2.5;
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
