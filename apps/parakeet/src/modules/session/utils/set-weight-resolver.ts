/**
 * Resolves the weight for the next main lift set.
 *
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
  return lastCompleted?.weight_grams ?? Math.round(plannedWeightKg * 1000);
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
  return lastCompleted?.weight_grams ?? Math.round(plannedWeightKg * 1000);
}
