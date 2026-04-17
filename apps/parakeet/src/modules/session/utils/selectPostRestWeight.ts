import { getEffectivePlannedSet } from '@shared/utils/getEffectivePlannedSet';
import type { PostRestState } from '../model/types';

/**
 * Pure selector: derive the weight to display during post-rest countdown.
 * Reflects live weight from adaptation or weight suggestion.
 */
export function selectPostRestWeight(opts: {
  postRestState: PostRestState | null;
  plannedSets: { weight_kg: number; reps: number }[];
  actualSets: { is_completed: boolean; weight_grams: number }[];
  currentAdaptation: {
    adaptationType: string;
    sets: Array<{ weight_kg: number }>;
  } | null;
}): number | null {
  const { postRestState } = opts;

  if (!postRestState) {
    return null;
  }

  // If no pending main set (warmup or aux post-rest), return planned weight
  if (postRestState.pendingMainSetNumber === null) {
    return postRestState.plannedWeightKg;
  }

  // Main set post-rest: resolve effective weight (adapted, suggested, or original)
  const nextIdx = postRestState.pendingMainSetNumber;
  const liveSet = getEffectivePlannedSet(
    nextIdx,
    opts.plannedSets,
    opts.actualSets,
    opts.currentAdaptation
  );

  return liveSet?.weight_kg ?? null;
}
