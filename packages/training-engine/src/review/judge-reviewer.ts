import { JudgeReviewSchema } from '@parakeet/shared-types';
import type { JudgeReview } from '@parakeet/shared-types';
import { generateText, Output } from 'ai';

import { abortAfter } from '../ai/abort-timeout';
import { reportEngineError } from '../ai/error-reporter';
import { getJITModel } from '../ai/models';
import { JUDGE_REVIEW_SYSTEM_PROMPT } from '../ai/prompts';
import type { JITInput, JITOutput } from '../generator/jit-session-generator';

export type { JudgeReview };

export const SILENT_PASS: JudgeReview = {
  score: 100,
  verdict: 'accept',
  concerns: [],
  suggestedOverrides: null,
};

export async function reviewJITDecision(
  input: JITInput,
  output: JITOutput
): Promise<JudgeReview> {
  try {
    const { output: review } = await generateText({
      model: getJITModel(),
      output: Output.object({ schema: JudgeReviewSchema }),
      system: JUDGE_REVIEW_SYSTEM_PROMPT,
      prompt: JSON.stringify({ input, output }),
      abortSignal: abortAfter(12000),
    });
    if (!review) return SILENT_PASS;
    return groundReview(review, input, output);
  } catch (err) {
    reportEngineError(err, {
      source: 'JudgeReviewer',
      sessionId: input.sessionId,
    });
    return SILENT_PASS;
  }
}

// Filters out concerns the LLM hallucinated against the actual numbers.
// See gh#216: the judge fabricated "intensity and volume reduce for mild
// soreness" on a session where soreness was 1/1/1 and no modifier fired.
export function groundReview(
  review: JudgeReview,
  input: JITInput,
  output: JITOutput
): JudgeReview {
  const hasReduction =
    output.intensityModifier < 1.0 ||
    output.volumeModifier < 1.0 ||
    output.skippedMainLift;
  const worstSoreness = Math.max(
    1,
    ...Object.values(input.sorenessRatings ?? {}).filter(
      (v): v is number => typeof v === 'number'
    )
  );
  const sleep = input.sleepQuality ?? 3;
  const energy = input.energyLevel ?? 3;

  const REDUCTION = /\b(reduc|cutting|lowered|decreas)/i;
  const SORE_REF = /\b(sore|soreness)\b/i;
  const LOW_ENERGY = /\blow energy\b|\bpoor energy\b/i;
  const LOW_SLEEP = /\blow sleep\b|\bpoor sleep\b/i;
  // GH#217: "aux outvolumes main" patterns — only valid if some non-top-up aux
  // actually has more sets than the main lift in the output.
  const AUX_OUTVOLUMES =
    /\baux(iliary)?\b.*\b(out\s?volum|outvolum|exceed|more sets|larger volume|outweigh)/i;
  const mainSetsCount = output.mainLiftSets?.length ?? 0;
  const auxOutvolumes = (output.auxiliaryWork ?? []).some(
    (a) => !a.skipped && !a.isTopUp && a.sets.length > mainSetsCount
  );

  const grounded = review.concerns.filter((c) => {
    if (!hasReduction && REDUCTION.test(c)) return false;
    if (worstSoreness <= 4 && SORE_REF.test(c)) return false;
    if (energy >= 3 && LOW_ENERGY.test(c)) return false;
    if (sleep >= 3 && LOW_SLEEP.test(c)) return false;
    if (!auxOutvolumes && AUX_OUTVOLUMES.test(c)) return false;
    return true;
  });

  if (grounded.length === review.concerns.length) return review;

  if (grounded.length === 0 && review.verdict === 'flag') {
    return {
      ...review,
      concerns: [],
      verdict: 'accept',
      score: Math.max(review.score, 85),
    };
  }
  return { ...review, concerns: grounded };
}
