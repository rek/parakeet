// @spec docs/features/jit-pipeline/spec-generator.md
import type { BiologicalSex } from '@modules/profile';
import type { Lift } from '@parakeet/shared-types';
import { roundToNearest } from '@shared/utils/weight';

const DEFAULT_BODYWEIGHT_KG: Record<BiologicalSex, number> = {
  female: 70,
  male: 85,
};

const LIFT_BODYWEIGHT_MULTIPLIERS: Record<
  BiologicalSex,
  Record<Lift, number>
> = {
  female: {
    squat: 1.05,
    bench: 0.65,
    deadlift: 1.25,
  },
  male: {
    squat: 1.35,
    bench: 1.0,
    deadlift: 1.65,
  },
};

const MIN_ESTIMATED_MAX_KG: Record<Lift, number> = {
  squat: 40,
  bench: 30,
  deadlift: 50,
};

function getAgeFromDob(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age -= 1;

  return age >= 0 ? age : null;
}

function getAgeMultiplier(age: number | null): number {
  if (age === null) return 0.95;
  if (age < 20) return 0.92;
  if (age <= 29) return 1.0;
  if (age <= 39) return 0.97;
  if (age <= 49) return 0.92;
  if (age <= 59) return 0.86;
  return 0.78;
}

interface EstimateInput {
  lift: Lift;
  biologicalSex: BiologicalSex | null;
  dateOfBirth: string | null;
  bodyweightKg?: number | null;
  /**
   * When provided, callers signal that the lifter has a training-experience
   * signal (e.g. confirmed novice / intermediate / advanced). When omitted, we
   * scale the estimate down to a conservative novice baseline (see NOVICE_SCALE).
   */
  hasTrainingExperienceSignal?: boolean;
}

/**
 * Conservative scaling applied when the lifter has not yet confirmed any
 * training-experience signal. Multipliers in this file assume an intermediate
 * lifter; when we don't know the lifter's level we assume novice and ship a
 * lighter starting estimate that they can grow into.
 */
const NOVICE_SCALE = 0.6;

export function estimateOneRmKgFromProfile(input: EstimateInput): number {
  // When biological_sex is missing we default to 'female' for safety: the
  // female multipliers/defaults produce a smaller estimate, so first working
  // sets stay lighter until the lifter confirms their sex. This is
  // intentional — an over-estimate is far more dangerous than an under-estimate.
  const sex: BiologicalSex = input.biologicalSex ?? 'female';
  const bodyweightKg =
    input.bodyweightKg != null && input.bodyweightKg > 0
      ? input.bodyweightKg
      : DEFAULT_BODYWEIGHT_KG[sex];

  const base = bodyweightKg * LIFT_BODYWEIGHT_MULTIPLIERS[sex][input.lift];
  const age = getAgeFromDob(input.dateOfBirth);
  const withAge = base * getAgeMultiplier(age);
  // No training-experience signal → assume novice and produce a conservative
  // estimate. The lifter can correct upward once they're calibrated.
  const noviceScaled = input.hasTrainingExperienceSignal
    ? withAge
    : withAge * NOVICE_SCALE;
  const rounded = roundToNearest(noviceScaled, 2.5);

  return Math.max(rounded, MIN_ESTIMATED_MAX_KG[input.lift]);
}
