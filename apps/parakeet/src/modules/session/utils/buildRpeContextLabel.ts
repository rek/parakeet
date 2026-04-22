// @spec docs/features/session/spec-planned-set-display.md
import type { AuxiliaryActualSet } from '@platform/store/sessionStore';
import { weightGramsToKg } from '@shared/utils/weight';

import type { AuxiliaryWork } from '../model/types';
import { fmtKg } from './fmtKg';
import { formatExerciseName } from './formatExerciseName';

/**
 * Builds a context label for the RPE picker showing which set was just completed.
 *
 * Main: "Set 2/5 — 50kg × 5"
 * Aux:  "Barbell Rows Set 3/4 — 40kg × 8"
 * Bodyweight aux: "Chin Ups Set 2/3 × 10"
 */
export function buildRpeContextLabel({
  pendingRpeSetNumber,
  pendingAuxRpe,
  actualSets,
  auxiliarySets,
  auxiliaryWork,
  plannedSetsCount,
}: {
  pendingRpeSetNumber: number | null;
  pendingAuxRpe: { exercise: string; setNumber: number } | null;
  actualSets: { weight_grams: number; reps_completed: number }[];
  auxiliarySets: AuxiliaryActualSet[];
  auxiliaryWork: AuxiliaryWork[];
  plannedSetsCount: number;
}) {
  if (pendingRpeSetNumber !== null) {
    const set = actualSets[pendingRpeSetNumber - 1];
    if (!set) return undefined;
    const kg = weightGramsToKg(set.weight_grams);
    if (kg === 0)
      return `Set ${pendingRpeSetNumber}/${plannedSetsCount} × ${set.reps_completed}`;
    return `Set ${pendingRpeSetNumber}/${plannedSetsCount} — ${fmtKg(kg)}kg × ${set.reps_completed}`;
  }

  if (pendingAuxRpe !== null) {
    const auxSet = auxiliarySets.find(
      (s) =>
        s.exercise === pendingAuxRpe.exercise &&
        s.set_number === pendingAuxRpe.setNumber
    );
    const aw = auxiliaryWork.find((a) => a.exercise === pendingAuxRpe.exercise);
    const total = aw?.sets.length ?? 0;
    const name = formatExerciseName(pendingAuxRpe.exercise);

    if (!auxSet) return `${name} Set ${pendingAuxRpe.setNumber}/${total}`;

    const kg = weightGramsToKg(auxSet.weight_grams);
    if (kg === 0)
      return `${name} Set ${pendingAuxRpe.setNumber}/${total} × ${auxSet.reps_completed}`;
    return `${name} Set ${pendingAuxRpe.setNumber}/${total} — ${fmtKg(kg)}kg × ${auxSet.reps_completed}`;
  }

  return undefined;
}
