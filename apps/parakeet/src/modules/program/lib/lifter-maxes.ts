// @spec docs/features/programs/spec-lifter-maxes.md
import { LifterMaxesInputSchema } from '@parakeet/shared-types';
import type { Lift } from '@parakeet/shared-types';
import { estimateOneRepMax_Epley } from '@parakeet/training-engine';
import { weightGramsToKg, weightKgToGrams } from '@shared/utils/weight';

import {
  fetchLatestLifterMaxes,
  getCurrentAuthUser,
  insertLifterMaxes,
} from '../data/lifter-maxes.repository';

interface LiftInput {
  type: '1rm' | '3rm';
  weightKg: number;
  reps?: number;
}

export interface LifterMaxesInput {
  squat: LiftInput;
  bench: LiftInput;
  deadlift: LiftInput;
}

type MaxSource = 'input_1rm' | 'input_3rm' | 'mixed';

/**
 * Resolves the 1RM from a lift input.
 * If the input is a 3RM with a rep count, applies the Epley formula.
 * Otherwise returns the raw weight as-is.
 *
 * @internal
 */
export function resolve1Rm(input: LiftInput): number {
  if (input.type === '3rm' && input.reps) {
    return estimateOneRepMax_Epley(input.weightKg, input.reps);
  }
  return input.weightKg;
}

/**
 * Infers the max source label from a set of lift inputs.
 * Returns 'input_1rm' if all lifts are 1RM, 'input_3rm' if all are 3RM,
 * and 'mixed' otherwise.
 *
 * @internal
 */
export function inferSource(input: LifterMaxesInput): MaxSource {
  const types = [input.squat.type, input.bench.type, input.deadlift.type];
  if (types.every((t) => t === '1rm')) return 'input_1rm';
  if (types.every((t) => t === '3rm')) return 'input_3rm';
  return 'mixed';
}

export async function submitMaxes(input: LifterMaxesInput) {
  const parsed = LifterMaxesInputSchema.safeParse({
    squat: {
      type: input.squat.type,
      weight_kg: input.squat.weightKg,
      ...(input.squat.type === '3rm' ? { reps: input.squat.reps } : {}),
    },
    bench: {
      type: input.bench.type,
      weight_kg: input.bench.weightKg,
      ...(input.bench.type === '3rm' ? { reps: input.bench.reps } : {}),
    },
    deadlift: {
      type: input.deadlift.type,
      weight_kg: input.deadlift.weightKg,
      ...(input.deadlift.type === '3rm' ? { reps: input.deadlift.reps } : {}),
    },
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid max input');
  }

  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Not authenticated');
  const userId = user.id;

  return insertLifterMaxes({
    user_id: userId,
    squat_1rm_grams: weightKgToGrams(resolve1Rm(input.squat)),
    bench_1rm_grams: weightKgToGrams(resolve1Rm(input.bench)),
    deadlift_1rm_grams: weightKgToGrams(resolve1Rm(input.deadlift)),
    squat_input_grams: weightKgToGrams(input.squat.weightKg),
    squat_input_reps:
      input.squat.type === '3rm' ? (input.squat.reps ?? null) : null,
    bench_input_grams: weightKgToGrams(input.bench.weightKg),
    bench_input_reps:
      input.bench.type === '3rm' ? (input.bench.reps ?? null) : null,
    deadlift_input_grams: weightKgToGrams(input.deadlift.weightKg),
    deadlift_input_reps:
      input.deadlift.type === '3rm' ? (input.deadlift.reps ?? null) : null,
    source: inferSource(input),
    recorded_at: new Date().toISOString(),
  });
}

export async function getCurrentMaxes(userId: string) {
  return fetchLatestLifterMaxes(userId);
}

export async function getCurrentOneRmKg(
  userId: string,
  lift: Lift
): Promise<number | null> {
  const maxes = await getCurrentMaxes(userId);
  if (!maxes) return null;
  const grams = maxes[`${lift}_1rm_grams`] as number | undefined;
  return grams != null ? weightGramsToKg(grams) : null;
}
