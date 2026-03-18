import { CalibrationReviewSchema } from '@parakeet/shared-types';
import type { CalibrationReview } from '@parakeet/shared-types';
import { generateText, Output } from 'ai';

import { JIT_MODEL } from '../ai/models';
import type { CalibrationResult } from '../analysis/modifier-effectiveness';

export type { CalibrationReview };

// On LLM failure, reject the adjustment (don't auto-apply uncertain changes)
const DEFAULT_REJECT: CalibrationReview = {
  apply: false,
  confidence: 'low',
  askUser: false,
  reason: 'LLM review unavailable — keeping current adjustment',
};

const CALIBRATION_REVIEW_PROMPT = `You are a sports science expert reviewing a proposed calibration adjustment to a powerlifting training system.

The system tracks how each modifier (soreness, readiness, cycle phase, disruption) affects workout prescriptions. After enough sessions, it proposes per-athlete adjustments to these modifiers based on actual RPE outcomes.

You are reviewing a proposed adjustment. Consider:
1. Is the sample size sufficient for this magnitude of change?
2. Could confounding factors explain the bias (program change, technique change, seasonal variation)?
3. Is the adjustment direction reasonable (e.g., reducing soreness penalty makes sense if the athlete consistently outperforms when sore)?
4. Should the athlete be asked for input before applying?

Only set askUser=true for large adjustments (>5%) or when you suspect confounding factors the athlete could clarify.`;

export async function reviewCalibrationAdjustment({ calibration, currentAdjustment }: {
  calibration: CalibrationResult;
  currentAdjustment: number;
}) {
  try {
    const prompt = JSON.stringify({
      modifierSource: calibration.modifierSource,
      sampleCount: calibration.sampleCount,
      meanBias: calibration.meanBias,
      suggestedAdjustment: calibration.suggestedAdjustment,
      currentAdjustment,
      confidence: calibration.confidence,
    });

    const { output: review } = await generateText({
      model: JIT_MODEL,
      output: Output.object({ schema: CalibrationReviewSchema }),
      system: CALIBRATION_REVIEW_PROMPT,
      prompt,
      abortSignal: AbortSignal.timeout(8000),
    });

    return review ?? DEFAULT_REJECT;
  } catch {
    return DEFAULT_REJECT;
  }
}
