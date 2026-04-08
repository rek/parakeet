import { weightGramsToKg } from './weight';

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
 * For all sets (completed or not), returns actualSet.weight_grams as the
 * weight — it's initialised from planned, may be bumped via autoregulation,
 * and for completed sets is the weight that was actually lifted.
 *
 * Accounts for intra-session adaptations (weight_reduced, sets_capped) by
 * mapping the 0-based set index to the correct offset into adaptation.sets[].
 *
 * Every display site (SetRow, rest timer label, post-rest overlay) must call
 * this instead of reading plannedSets or actualSets directly.
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
    if (!actual) return planned;
    return { weight_kg: weightGramsToKg(actual.weight_grams), reps: planned.reps };
  }

  if (actual?.is_completed) {
    return { weight_kg: weightGramsToKg(actual.weight_grams), reps: planned.reps };
  }

  // Count uncompleted sets before this index to find offset into adaptation.sets[]
  let uncompletedBefore = 0;
  for (let i = 0; i < index; i++) {
    if (!actualSets[i]?.is_completed) uncompletedBefore++;
  }

  const adaptedSet = currentAdaptation.sets[uncompletedBefore];
  if (!adaptedSet) return planned;

  return { weight_kg: adaptedSet.weight_kg, reps: planned.reps };
}
