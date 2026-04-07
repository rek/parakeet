interface PlannedSet {
  weight_kg: number;
  reps: number;
}

interface ActualSet {
  is_completed: boolean;
  weight_grams: number;
}

interface Adaptation {
  adaptationType: string;
  sets: Array<{ weight_kg: number }>;
}

/**
 * Single source of truth for "what weight/reps should set N show right now?"
 *
 * Accounts for intra-session adaptations (weight_reduced, sets_capped) by
 * mapping the 0-based set index to the correct offset into adaptation.sets[].
 *
 * Every display site (SetRow, rest timer label, post-rest overlay) must call
 * this instead of reading plannedSets directly.
 */
export function getEffectivePlannedSet(
  index: number,
  plannedSets: PlannedSet[],
  actualSets: ActualSet[],
  currentAdaptation: Adaptation | null
): PlannedSet | undefined {
  const planned = plannedSets[index];
  if (!planned) return undefined;

  const actual = actualSets[index];

  if (
    currentAdaptation === null ||
    (currentAdaptation.adaptationType !== 'weight_reduced' &&
      currentAdaptation.adaptationType !== 'sets_capped')
  ) {
    // No weight-modifying adaptation. Use actualSet.weight_grams for incomplete sets —
    // it's initialised from planned but may have been bumped via weight autoregulation accept.
    if (!actual?.is_completed) {
      return { weight_kg: actual.weight_grams / 1000, reps: planned.reps };
    }
    return planned;
  }

  if (actual?.is_completed) return planned;

  // Count uncompleted sets before this index to find offset into adaptation.sets[]
  let uncompletedBefore = 0;
  for (let i = 0; i < index; i++) {
    if (!actualSets[i]?.is_completed) uncompletedBefore++;
  }

  const adaptedSet = currentAdaptation.sets[uncompletedBefore];
  if (!adaptedSet) return planned;

  return { weight_kg: adaptedSet.weight_kg, reps: planned.reps };
}
