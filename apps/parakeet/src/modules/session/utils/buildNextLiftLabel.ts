import type { AuxiliaryWork } from '../model/types';
import { fmtKg } from './fmtKg';
import { formatExerciseName } from './formatExerciseName';

/**
 * Builds a "next lift" label for the rest timer showing what comes after rest.
 *
 * Main: "Next: Set 3 — 52.5kg × 5"
 * Aux:  "Next: Barbell Rows — 40kg × 8"
 * Bodyweight: "Next: Chin Ups × 10"
 */
export function buildNextLiftLabel({
  pendingMainSetNumber,
  plannedSets,
  pendingAuxExercise,
  pendingAuxSetNumber,
  auxiliaryWork,
}: {
  pendingMainSetNumber: number | null;
  plannedSets: { weight_kg: number; reps: number }[];
  pendingAuxExercise: string | null;
  pendingAuxSetNumber: number | null;
  auxiliaryWork: AuxiliaryWork[];
}) {
  if (pendingMainSetNumber !== null) {
    const nextPlanned = plannedSets[pendingMainSetNumber];
    if (!nextPlanned) return undefined;
    if (nextPlanned.weight_kg === 0)
      return `Next: Set ${pendingMainSetNumber + 1} × ${nextPlanned.reps}`;
    return `Next: Set ${pendingMainSetNumber + 1} — ${fmtKg(nextPlanned.weight_kg)}kg × ${nextPlanned.reps}`;
  }

  if (pendingAuxExercise !== null && pendingAuxSetNumber !== null) {
    const aw = auxiliaryWork.find((a) => a.exercise === pendingAuxExercise);
    const nextAuxSet = aw?.sets[pendingAuxSetNumber];
    if (!nextAuxSet) return undefined;
    const name = formatExerciseName(pendingAuxExercise);
    if (nextAuxSet.weight_kg === 0) return `Next: ${name} × ${nextAuxSet.reps}`;
    return `Next: ${name} — ${fmtKg(nextAuxSet.weight_kg)}kg × ${nextAuxSet.reps}`;
  }

  return undefined;
}
