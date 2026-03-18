import { generateText } from 'ai';

import { JIT_MODEL } from '../ai/models';
import type { CalibrationResult, ModifierSource } from '../analysis/modifier-effectiveness';

export interface CalibrationReviewResult {
  apply: boolean;
  confidence: 'high' | 'medium' | 'low';
  askUser: boolean;
  reason: string;
}

const DEFAULT_PASS: CalibrationReviewResult = {
  apply: true,
  confidence: 'high',
  askUser: false,
  reason: 'Adjustment within safe range',
};

const CALIBRATION_REVIEW_PROMPT = `You are a sports science expert reviewing a proposed calibration adjustment to a powerlifting training system.

The system tracks how each modifier (soreness, readiness, cycle phase, disruption) affects workout prescriptions. After enough sessions, it proposes per-athlete adjustments to these modifiers based on actual RPE outcomes.

You are reviewing a proposed adjustment. Consider:
1. Is the sample size sufficient for this magnitude of change?
2. Could confounding factors explain the bias (program change, technique change, seasonal variation)?
3. Is the adjustment direction reasonable (e.g., reducing soreness penalty makes sense if the athlete consistently outperforms when sore)?
4. Should the athlete be asked for input before applying?

Respond with JSON: { "apply": boolean, "confidence": "high"|"medium"|"low", "askUser": boolean, "reason": string }

Only set askUser=true for large adjustments (>5%) or when you suspect confounding factors the athlete could clarify.`;

export async function reviewCalibrationAdjustment({ calibration, currentAdjustment }: {
  calibration: CalibrationResult;
  /** The currently applied adjustment (if any). */
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

    const { text } = await generateText({
      model: JIT_MODEL,
      system: CALIBRATION_REVIEW_PROMPT,
      prompt,
      abortSignal: AbortSignal.timeout(8000),
    });

    const parsed = JSON.parse(text) as CalibrationReviewResult;
    return parsed;
  } catch {
    // On error, default to safe pass (don't block calibration on LLM failure)
    return DEFAULT_PASS;
  }
}
