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
  const nextSetNumber = prevSetNumber != null ? prevSetNumber + 1 : null;
  const auxExercise = postRestState?.pendingAuxExercise ?? null;
  const auxSetNumber = postRestState?.pendingAuxSetNumber ?? null;
  return { totalRest, prevSetNumber, nextSetNumber, auxExercise, auxSetNumber };
}
