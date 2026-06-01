// @spec docs/features/social/spec-film-for-partner.md
import { useCallback, useState } from 'react';

import { captureException } from '@platform/utils/captureException';

import { filmForPartner } from '../application/partner-filming.service';

type FilmingState =
  | { type: 'idle' }
  | { type: 'recording' }
  | { type: 'analyzing'; progress: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

function filmingErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.includes('partner')) {
    return 'Partnership no longer active';
  }
  if (err instanceof Error) return err.message;
  return 'Failed to process video';
}

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
    }: {
      videoUri: string;
      durationSec: number;
      lift: string;
      setNumber: number;
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
          onProgress: (pct) => setState({ type: 'analyzing', progress: pct }),
        });
        setState({ type: 'done' });
        return true;
      } catch (err) {
        captureException(err);
        setState({ type: 'error', message: filmingErrorMessage(err) });
        return false;
      }
    },
    [partnerId, sessionId]
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
