// @spec docs/features/jit-pipeline/spec-adaptive-volume.md
import { getEffectivePlannedSet } from '@shared/utils/getEffectivePlannedSet';
import { weightGramsToKg } from '@shared/utils/weight';

interface PlannedSet {
  weight_kg: number;
  reps: number;
}

interface ActualSet {
  is_completed: boolean;
  weight_grams: number;
  set_number: number;
}

interface Adaptation {
  adaptationType: string;
  sets: Array<{ weight_kg: number }>;
}

export interface DisplaySet {
  displayWeightKg: number;
  originalIndex: number;
}

/**
 * Map actual sets to their display weights, applying intra-session adaptation
 * when present. Delegates per-set resolution to getEffectivePlannedSet.
 */
export function computeDisplayWeights(
  actualSets: ActualSet[],
  plannedSets: PlannedSet[],
  currentAdaptation: Adaptation | null
): DisplaySet[] {
  return actualSets.map((actualSet, index) => {
    const effective = getEffectivePlannedSet(
      index,
      plannedSets,
      actualSets,
      currentAdaptation
    );
    const displayWeightKg =
      effective?.weight_kg ?? weightGramsToKg(actualSet.weight_grams);

    return { displayWeightKg, originalIndex: index };
  });
}
