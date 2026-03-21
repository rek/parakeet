/**
 * Resolves what SetRow should display given its current state.
 *
 * Two modes:
 * - **Editing** (isCompletedExternal=false): display local edited values
 * - **Externally completed** (isCompletedExternal=true): display actual
 *   values from props, ignoring local edits
 */
export function resolveSetRowDisplay({
  plannedWeightKg,
  plannedReps,
  localWeightKg,
  localWeightText,
  localReps,
  localIsCompleted,
  isCompletedExternal,
}: {
  plannedWeightKg: number;
  plannedReps: number;
  localWeightKg: number;
  localWeightText: string;
  localReps: number;
  localIsCompleted: boolean;
  isCompletedExternal: boolean;
}) {
  if (isCompletedExternal) {
    return {
      displayReps: plannedReps,
      displayWeightKg: plannedWeightKg,
      displayWeightText: plannedWeightKg === 0 ? '' : String(plannedWeightKg),
      displayCompleted: true,
    };
  }

  return {
    displayReps: localReps,
    displayWeightKg: localWeightKg,
    displayWeightText: localWeightText,
    displayCompleted: localIsCompleted,
  };
}
