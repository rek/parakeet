import { useCallback, useRef, useState } from 'react';

import type { PostRestState } from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import { captureException } from '@platform/utils/captureException';

import { useVideoAnalysis } from './useVideoAnalysis';

/**
 * Manages post-rest video capture and deferred processing.
 *
 * Records a video during the rest overlay, then processes it after the
 * lifter taps "complete" or "failed". Uses a ref for plannedReps to avoid
 * a stale closure race condition: handleLiftComplete() may trigger a state
 * update that clears postRestState before processPendingVideo reads it.
 */
export function usePostRestVideoCapture({
  sessionId,
  lift,
  postRestState,
}: {
  sessionId: string;
  lift: Lift | string;
  postRestState: PostRestState | null;
}) {
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);

  // Ref so the pending-video callback sees the latest value even after
  // postRestState is cleared by the lift-complete state update.
  const plannedRepsRef = useRef<number>(postRestState?.plannedReps ?? 3);
  if (postRestState !== null) {
    plannedRepsRef.current = postRestState.plannedReps;
  }

  const setNumber = postRestState?.nextSetNumber ?? 1;
  const weightGrams = postRestState?.plannedWeightKg
    ? Math.round(postRestState.plannedWeightKg * 1000)
    : undefined;

  const { processRecordedVideo } = useVideoAnalysis({
    sessionId,
    lift,
    setNumber,
    setContext: weightGrams
      ? {
          weightGrams,
          reps: postRestState?.plannedReps ?? 0,
        }
      : null,
  });

  const handleVideoRecorded = useCallback((videoUri: string) => {
    setPendingVideoUri(videoUri);
  }, []);

  const processPendingVideo = useCallback(async () => {
    if (!pendingVideoUri) return;
    const uri = pendingVideoUri;
    setPendingVideoUri(null);
    try {
      const estimatedDuration = plannedRepsRef.current * 2;
      await processRecordedVideo({ videoUri: uri, durationSec: estimatedDuration });
    } catch (err) {
      captureException(err);
    }
  }, [pendingVideoUri, processRecordedVideo]);

  const wrapLiftComplete = useCallback(
    (originalHandler: () => void) =>
      () => {
        originalHandler();
        processPendingVideo();
      },
    [processPendingVideo]
  );

  const wrapLiftFailed = useCallback(
    (originalHandler: (reps: number) => void) =>
      (reps: number) => {
        originalHandler(reps);
        processPendingVideo();
      },
    [processPendingVideo]
  );

  return {
    handleVideoRecorded,
    wrapLiftComplete,
    wrapLiftFailed,
    pendingVideoUri,
  };
}
