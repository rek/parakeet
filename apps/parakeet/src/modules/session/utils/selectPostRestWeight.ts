import { getEffectivePlannedSet } from '@shared/utils/getEffectivePlannedSet';
import type { SessionState } from '@platform/store/sessionStore';

/**
 * Pure selector: derive the weight to display during post-rest countdown.
 * Reflects live weight from adaptation or weight suggestion.
 */
export function selectPostRestWeight(
  state: Pick<
    SessionState,
    'postRestState' | 'plannedSets' | 'actualSets' | 'currentAdaptation'
  >
): number | null {
  const { postRestState } = state;

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
    state.plannedSets,
    state.actualSets,
    state.currentAdaptation
  );

  return liveSet?.weight_kg ?? null;
}
