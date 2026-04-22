// @spec docs/features/session/spec-set-persistence.md
import { adaptAuxRemainingPlan } from '@parakeet/training-engine';
import { useSessionStore } from '../store/sessionStore';
import { weightGramsToKg, weightKgToGrams } from '@shared/utils/weight';

import type { AuxiliaryWork } from '../model/types';

// ---------------------------------------------------------------------------
// Auxiliary failure — shared across post-rest and first-set-confirmation paths
// ---------------------------------------------------------------------------

/**
 * Writes an auxiliary set failure to the store (with `failed: true` and
 * RPE 10), then computes a 10% weight reduction for remaining uncompleted
 * sets of the same exercise and stores the adaptation.
 *
 * Callers are responsible for resolving the correct weight and set number
 * before calling this — the two aux failure paths differ in how they
 * determine those values.
 */
export function writeAuxFailureAndAdapt(
  exercise: string,
  failedSetNumber: number,
  weightGrams: number,
  actualReps: number,
  auxiliaryWork: AuxiliaryWork[]
): void {
  const state = useSessionStore.getState();

  // Mark the failed set
  state.updateAuxiliarySet(exercise, failedSetNumber, {
    weight_grams: weightGrams,
    reps_completed: actualReps,
    is_completed: true,
    rpe_actual: 10,
    failed: true,
  });

  // Adapt remaining sets for this exercise
  const auxWork = auxiliaryWork.find((aw) => aw.exercise === exercise);
  if (!auxWork) return;

  const completedSetNumbers = new Set(
    state.auxiliarySets
      .filter((s) => s.exercise === exercise && s.is_completed)
      .map((s) => s.set_number)
  );
  // The set we just marked is also completed
  completedSetNumbers.add(failedSetNumber);

  const remainingSets = auxWork.sets
    .map((s, i) => ({ ...s, set_number: i + 1 }))
    .filter((s) => !completedSetNumbers.has(s.set_number));

  if (remainingSets.length === 0) return;

  const adapted = adaptAuxRemainingPlan({
    exercise,
    failedWeightKg: weightGramsToKg(weightGrams),
    remainingSets,
  });

  if (adapted.adaptationType !== 'none') {
    state.setAuxAdaptation(exercise, adapted);

    // Write adapted weights to uncompleted sets in the store
    for (const adaptedSet of adapted.sets) {
      state.updateAuxiliarySet(exercise, adaptedSet.set_number, {
        weight_grams: weightKgToGrams(adaptedSet.weight_kg),
      });
    }
  }
}
