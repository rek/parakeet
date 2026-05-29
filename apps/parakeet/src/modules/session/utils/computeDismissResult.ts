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
  const nextSetNumber = computeNextSetNumber(
    prevSetNumber,
    auxExercise,
    postRestState
  );
  return { totalRest, prevSetNumber, nextSetNumber, auxExercise, auxSetNumber };
}

function computeNextSetNumber(
  prevSetNumber: number | null,
  auxExercise: unknown,
  postRestState: PostRestState | null
): number | null {
  if (prevSetNumber != null) return prevSetNumber + 1;
  if (auxExercise == null) return postRestState?.nextSetNumber ?? null;
  return null;
}
