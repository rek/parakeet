interface PlannedSet {
  weight_kg: number;
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
 * when present. Adaptation weights replace planned weights for uncompleted sets
 * when the adaptation type is weight_reduced or sets_capped.
 */
export function computeDisplayWeights(
  actualSets: ActualSet[],
  plannedSets: PlannedSet[],
  currentAdaptation: Adaptation | null
): DisplaySet[] {
  let uncompletedIndex = 0;
  return actualSets.map((actualSet, index) => {
    const planned = plannedSets[index];
    let displayWeightKg = planned?.weight_kg ?? actualSet.weight_grams / 1000;

    if (
      !actualSet.is_completed &&
      currentAdaptation !== null &&
      (currentAdaptation.adaptationType === 'weight_reduced' ||
        currentAdaptation.adaptationType === 'sets_capped')
    ) {
      const adaptedSet = currentAdaptation.sets[uncompletedIndex];
      if (adaptedSet != null) {
        displayWeightKg = adaptedSet.weight_kg;
      }
      uncompletedIndex += 1;
    }

    return { displayWeightKg, originalIndex: index };
  });
}
