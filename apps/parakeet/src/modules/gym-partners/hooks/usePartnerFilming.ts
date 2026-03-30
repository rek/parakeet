import { useCallback, useState } from 'react';

import { captureException } from '@platform/utils/captureException';

import { filmForPartner } from '../application/partner-filming.service';

type FilmingState =
  | { type: 'idle' }
  | { type: 'recording' }
  | { type: 'analyzing'; progress: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

export function usePartnerFilming({
  partnerId,
  sessionId,
}: {
  partnerId: string;
  sessionId: string;
}) {
  const [state, setState] = useState<FilmingState>({ type: 'idle' });

  const startRecording = useCallback(() => {
    setState({ type: 'recording' });
  }, []);

  /** Returns true on success, false on failure (state set internally). */
  const processVideo = useCallback(
    async ({
      videoUri,
      durationSec,
      lift,
      setNumber,
      cameraAngle,
    }: {
      videoUri: string;
      durationSec: number;
      lift: string;
      setNumber: number;
      cameraAngle: 'side' | 'front';
    }) => {
      setState({ type: 'analyzing', progress: 0 });

      try {
        await filmForPartner({
          videoUri,
          durationSec,
          targetUserId: partnerId,
          sessionId,
          lift,
          setNumber,
          cameraAngle,
          onProgress: (pct) =>
            setState({ type: 'analyzing', progress: pct }),
        });
        setState({ type: 'done' });
        return true;
      } catch (err) {
        captureException(err);
        const message =
          err instanceof Error && err.message.includes('partner')
            ? 'Partnership no longer active'
            : err instanceof Error
              ? err.message
              : 'Failed to process video';
        setState({ type: 'error', message });
        return false;
      }
    },
    [partnerId, sessionId],
  );

  const reset = useCallback(() => {
    setState({ type: 'idle' });
  }, []);

  return {
    filmingState: state,
    startRecording,
    processVideo,
    reset,
  };
}
