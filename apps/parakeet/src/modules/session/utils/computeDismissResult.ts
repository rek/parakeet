// @spec docs/features/session/spec-missed.md
import type { PostRestState } from '../model/types';

export function computeDismissResult(
  postRestState: PostRestState | null,
  now: number
) {
  const totalRest = postRestState
    ? postRestState.actualRestSeconds +
      Math.round((now - postRestState.liftStartedAt) / 1000)
    : 0;
  const prevSetNumber = postRestState?.pendingMainSetNumber ?? null;
  const auxExercise = postRestState?.pendingAuxExercise ?? null;
  const auxSetNumber = postRestState?.pendingAuxSetNumber ?? null;
  // Post-warmup overlay: no pending main set and no aux — use stored nextSetNumber
  const nextSetNumber =
    prevSetNumber != null
      ? prevSetNumber + 1
      : auxExercise == null
        ? (postRestState?.nextSetNumber ?? null)
        : null;
  return { totalRest, prevSetNumber, nextSetNumber, auxExercise, auxSetNumber };
}
