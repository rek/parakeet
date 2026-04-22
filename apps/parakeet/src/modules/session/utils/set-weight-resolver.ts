// @spec docs/features/intra-session/spec-weight-autoregulation.md
import { weightKgToGrams } from '@shared/utils/weight';

/**
 * Resolves the weight for the next main lift set, respecting explicit changes.
 *
 * If the next set's weight was explicitly changed (e.g. via weight autoregulation
 * accept or manual edit), it is preserved. Otherwise, carries forward the most
 * recently completed set's weight so user deviations propagate.
 */
export function resolveWeightForNextSet({
  actualSets,
  plannedSets,
  nextSetNumber,
  effectiveWeightKg,
}: {
  actualSets: Array<{
    set_number: number;
    weight_grams: number;
    is_completed: boolean;
  }>;
  plannedSets: Array<{ weight_kg: number }>;
  nextSetNumber: number;
  effectiveWeightKg: number;
}): number {
  const nextActualSet = actualSets.find(
    (s) => s.set_number === nextSetNumber
  );
  const originalPlannedGrams = weightKgToGrams(
    plannedSets[nextSetNumber - 1]?.weight_kg ?? 0
  );
  const wasExplicitlyChanged =
    nextActualSet != null &&
    nextActualSet.weight_grams !== originalPlannedGrams;

  if (wasExplicitlyChanged) {
    return nextActualSet.weight_grams;
  }
  return resolveNextSetWeight({
    completedSets: actualSets,
    nextSetNumber,
    plannedWeightKg: effectiveWeightKg,
  });
}

/**
 * Carries forward the user's actual weight from the most recently completed set
 * (they may have adjusted from planned). Falls back to planned weight if no
 * previous set is completed.
 */
export function resolveNextSetWeight({
  completedSets,
  nextSetNumber,
  plannedWeightKg,
}: {
  completedSets: Array<{
    set_number: number;
    weight_grams: number;
    is_completed: boolean;
  }>;
  nextSetNumber: number;
  plannedWeightKg: number;
}) {
  const lastCompleted = completedSets
    .filter((s) => s.is_completed && s.set_number < nextSetNumber)
    .sort((a, b) => b.set_number - a.set_number)[0];
  return lastCompleted?.weight_grams ?? weightKgToGrams(plannedWeightKg);
}

/**
 * Resolves the weight for the next auxiliary set, scoped to a specific exercise.
 *
 * Same carry-forward logic as main sets, but only considers completed sets
 * for the same exercise name.
 */
export function resolveNextAuxSetWeight({
  auxiliarySets,
  exercise,
  nextSetNumber,
  plannedWeightKg,
}: {
  auxiliarySets: Array<{
    exercise: string;
    set_number: number;
    weight_grams: number;
    is_completed: boolean;
  }>;
  exercise: string;
  nextSetNumber: number;
  plannedWeightKg: number;
}) {
  const lastCompleted = auxiliarySets
    .filter(
      (s) =>
        s.exercise === exercise &&
        s.is_completed &&
        s.set_number < nextSetNumber
    )
    .sort((a, b) => b.set_number - a.set_number)[0];
  return lastCompleted?.weight_grams ?? weightKgToGrams(plannedWeightKg);
}
