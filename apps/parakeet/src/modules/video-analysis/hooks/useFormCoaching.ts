import { useCallback, useState } from 'react';

import {
  getSession,
  getSessionLog,
  parseJitInputSnapshot,
} from '@modules/session';
import type { FormCoachingResult } from '@parakeet/shared-types';
import { generateFormCoaching } from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';

import { assembleCoachingContext } from '../application/assemble-coaching-context';
import {
  getVideosForLift,
  updateSessionVideoCoaching,
} from '../data/video.repository';
import type { SessionVideo } from '../model/types';

const VALID_LIFTS = ['squat', 'bench', 'deadlift'] as const;
type CoachingLift = (typeof VALID_LIFTS)[number];

function isCoachingLift(value: string): value is CoachingLift {
  return (VALID_LIFTS as readonly string[]).includes(value);
}

/**
 * Hook that orchestrates LLM form coaching for a video analysis.
 *
 * Fetches session context (weight, RPE, soreness, block/week), assembles
 * coaching context with longitudinal data from previous videos, calls the
 * LLM generator, and persists the result to the DB.
 */
export function useFormCoaching({
  sessionId,
  lift,
}: {
  sessionId: string;
  lift: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coaching, setCoaching] = useState<FormCoachingResult | null>(null);

  const generateCoaching = useCallback(
    async ({ video }: { video: SessionVideo }) => {
      if (!video.analysis) return;
      if (!isCoachingLift(lift)) return;

      try {
        setError(null);
        setIsGenerating(true);

        // 1. Fetch session context
        const [session, log] = await Promise.all([
          getSession(sessionId),
          getSessionLog(sessionId),
        ]);

        const jitSnapshot = session
          ? parseJitInputSnapshot(session.jit_input_snapshot)
          : null;

        // 2. Fetch previous videos for longitudinal context
        const previousVideos = await getVideosForLift({ lift });
        const previousAnalyses = previousVideos
          .filter((v) => v.id !== video.id && v.analysis != null)
          .map((v) => v.analysis!);

        // 3. Assemble coaching context
        const context = assembleCoachingContext({
          analysis: video.analysis,
          lift,
          session,
          log,
          jitSnapshot,
          previousAnalyses,
          setContext: {
            weightGrams: video.setWeightGrams,
            reps: video.setReps,
            rpe: video.setRpe,
          },
        });

        // 4. Generate coaching via LLM
        const { result } = await generateFormCoaching({ context });

        // 5. Persist to DB
        await updateSessionVideoCoaching({
          id: video.id,
          coachingResponse: result,
        });

        setCoaching(result);
      } catch (err) {
        captureException(err);
        const message =
          err instanceof Error ? err.message : 'Failed to generate coaching';
        setError(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [sessionId, lift]
  );

  return {
    generateCoaching,
    isGenerating,
    error,
    coaching,
    setCoaching,
  };
}
