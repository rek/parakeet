import { FormCoachingResultSchema } from '@parakeet/shared-types';
import type {
  FormCoachingResult,
  VideoAnalysisResult,
} from '@parakeet/shared-types';
import { generateText, Output } from 'ai';

import { abortAfter } from '../ai/abort-timeout';
import { getCycleReviewModel } from '../ai/models';
import { FORM_COACHING_SYSTEM_PROMPT } from '../ai/prompts';

export type { FormCoachingResult };

/** Context fields serialized to JSON for the LLM prompt. */
export interface FormCoachingInput {
  analysis: VideoAnalysisResult;
  lift: string;
  sagittalConfidence: number;
  weightKg: number | null;
  oneRmKg: number | null;
  sessionRpe: number | null;
  biologicalSex: 'male' | 'female' | null;
  blockNumber: number | null;
  weekNumber: number | null;
  intensityType: string | null;
  isDeload: boolean;
  sorenessRatings: Record<string, number> | null;
  sleepQuality: number | null;
  energyLevel: number | null;
  activeDisruptions: Array<{
    disruption_type: string;
    severity: string;
  }> | null;
  previousVideoCount: number;
  averageBarDriftCm: number | null;
  averageDepthCm: number | null;
  averageForwardLeanDeg: number | null;
  competitionPassRate: number | null;
  failedCriteria: string[];
}

/**
 * Generate LLM-powered form coaching from video analysis metrics + training context.
 *
 * Uses gpt-5 (CYCLE_REVIEW_MODEL) because form coaching is a deep analysis task
 * that benefits from reasoning about biomechanics, fatigue correlation, and
 * longitudinal trends. Not time-sensitive — runs after video processing completes.
 *
 * The context object is serialized to JSON and sent as the user prompt.
 * The LLM returns structured output matching FormCoachingResultSchema.
 */
export async function generateFormCoaching({
  context,
}: {
  context: FormCoachingInput;
}) {
  const { output } = await generateText({
    model: getCycleReviewModel(),
    output: Output.object({ schema: FormCoachingResultSchema }),
    system: FORM_COACHING_SYSTEM_PROMPT,
    prompt: JSON.stringify(context),
    abortSignal: abortAfter(30000),
  });

  if (!output) throw new Error('LLM did not return valid form coaching');
  return output as FormCoachingResult;
}
