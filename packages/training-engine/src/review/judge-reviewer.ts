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
      abortSignal: abortAfter(8000),
    });
    return review ?? SILENT_PASS;
  } catch (err) {
    reportEngineError(err, {
      source: 'JudgeReviewer',
      sessionId: input.sessionId,
    });
    return SILENT_PASS;
  }
}
