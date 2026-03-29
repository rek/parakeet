import { useCallback, useState } from 'react';

import { generateFormCoaching } from '@parakeet/training-engine';
import type { FormCoachingInput } from '@parakeet/training-engine';
import type { FormCoachingResult } from '@parakeet/shared-types';
import { getSession, getSessionLog } from '@modules/session';
import { parseJitInputSnapshot } from '@modules/session';
import { captureException } from '@platform/utils/captureException';

import { assembleCoachingContext } from '../application/assemble-coaching-context';
import {
  getVideosForLift,
  updateSessionVideoCoaching,
} from '../data/video.repository';
import type { SessionVideo } from '../model/types';

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

  const generateCoaching = useCallback(async ({
    video,
  }: {
    video: SessionVideo;
  }) => {
    if (!video.analysis) return;

    try {
      setError(null);
      setIsGenerating(true);

      // 1. Fetch session context
      const [session, log] = await Promise.all([
        getSession(sessionId),
        getSessionLog(sessionId),
      ]);

      const jitSnapshot = session
        ? parseJitInputSnapshot((session as Record<string, unknown>).jit_input_snapshot)
        : null;

      // 2. Fetch previous videos for longitudinal context
      const previousVideos = await getVideosForLift({ lift });
      const previousAnalyses = previousVideos
        .filter((v) => v.id !== video.id && v.analysis != null)
        .map((v) => v.analysis!);

      // 3. Assemble coaching context
      const context = assembleCoachingContext({
        analysis: video.analysis,
        lift: lift as 'squat' | 'bench' | 'deadlift',
        session: session as {
          block_number: number | null;
          week_number: number | null;
          intensity_type: string | null;
          is_deload: boolean | null;
        } | null,
        log: log as {
          session_rpe: number | null;
          actual_sets: Array<{ weight_grams?: number; weight_kg?: number }>;
        } | null,
        jitSnapshot,
        previousAnalyses,
      });

      // 4. Generate coaching via LLM
      const result = await generateFormCoaching({
        context: context as FormCoachingInput,
      });

      // 5. Persist to DB
      await updateSessionVideoCoaching({
        id: video.id,
        coachingResponse: result,
      });

      setCoaching(result);
    } catch (err) {
      captureException(err);
      const message = err instanceof Error ? err.message : 'Failed to generate coaching';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, lift]);

  return {
    generateCoaching,
    isGenerating,
    error,
    coaching,
    setCoaching,
  };
}
