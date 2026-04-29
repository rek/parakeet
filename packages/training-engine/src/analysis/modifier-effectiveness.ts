// Tracks modifier effectiveness per athlete by comparing trace predictions
// against actual RPE outcomes. Computes calibration bias and proposed adjustments.

export type ModifierSource =
  | 'rpe_history'
  | 'readiness'
  | 'wearable-readiness'
  | 'cycle_phase'
  | 'soreness'
  | 'disruption';

export type CalibrationConfidence = 'exploring' | 'low' | 'medium' | 'high';

export interface ModifierSample {
  modifierSource: ModifierSource;
  multiplier: number;
  rpeTarget: number;
  rpeActual: number;
  /** For soreness: the soreness level that triggered the modifier (1-10). */
  sorenessLevel?: number;
}

export interface CalibrationResult {
  modifierSource: ModifierSource;
  sampleCount: number;
  /** Average RPE delta (actual - target). Negative = too easy, positive = too hard. */
  meanBias: number;
  /** Proposed adjustment to the default multiplier. Positive = make less aggressive. */
  suggestedAdjustment: number;
  confidence: CalibrationConfidence;
}

const CONFIDENCE_THRESHOLDS = {
  low: 5,
  medium: 10,
  high: 20,
} as const;

/** Maximum auto-apply adjustment (absolute). Changes larger than this require LLM review. */
const AUTO_APPLY_THRESHOLD = 0.05;

/** RPE delta → multiplier adjustment scaling. A -1.0 RPE bias suggests the modifier
 *  should be ~0.05 less aggressive (i.e., multiplier closer to 1.0). */
const BIAS_TO_ADJUSTMENT_SCALE = 0.05;

/**
 * Compute calibration bias from a set of modifier outcome samples.
 *
 * Mean RPE delta tells us whether the modifier is systematically too aggressive
 * (negative delta = athlete finds it too easy) or too conservative (positive delta).
 */
export function computeCalibrationBias({
  samples,
}: {
  samples: ModifierSample[];
}) {
  if (samples.length === 0) {
    return {
      modifierSource: 'soreness' as ModifierSource,
      sampleCount: 0,
      meanBias: 0,
      suggestedAdjustment: 0,
      confidence: 'exploring' as CalibrationConfidence,
    };
  }

  const source = samples[0].modifierSource;
  const n = samples.length;
  const meanBias =
    samples.reduce((sum, s) => sum + (s.rpeActual - s.rpeTarget), 0) / n;

  // Convert bias to multiplier adjustment:
  // Negative bias (too easy) → positive adjustment (make modifier less aggressive, closer to 1.0)
  // Positive bias (too hard) → negative adjustment (make modifier more aggressive, further from 1.0)
  const rawAdjustment = -meanBias * BIAS_TO_ADJUSTMENT_SCALE;

  // Clamp to prevent wild swings
  const suggestedAdjustment = Math.max(-0.15, Math.min(0.15, rawAdjustment));

  const confidence: CalibrationConfidence =
    n >= CONFIDENCE_THRESHOLDS.high
      ? 'high'
      : n >= CONFIDENCE_THRESHOLDS.medium
        ? 'medium'
        : n >= CONFIDENCE_THRESHOLDS.low
          ? 'low'
          : 'exploring';

  return {
    modifierSource: source,
    sampleCount: n,
    meanBias,
    suggestedAdjustment,
    confidence,
  } satisfies CalibrationResult;
}

/**
 * Determine whether a proposed calibration adjustment should trigger LLM review
 * before being applied, or can be auto-applied silently.
 *
 * Auto-apply: confidence >= medium AND adjustment < 5% (AUTO_APPLY_THRESHOLD)
 * Review needed: large adjustments, low confidence, or bias direction flipped
 */
export function shouldTriggerReview({
  calibration,
  previousAdjustment,
}: {
  calibration: CalibrationResult;
  /** The last applied adjustment (if any). Used to detect direction flips. */
  previousAdjustment?: number;
}) {
  // Always review if confidence is too low
  if (calibration.confidence === 'exploring') return false; // not enough data to even propose
  if (calibration.confidence === 'low') return true;

  // Large adjustment → review
  if (Math.abs(calibration.suggestedAdjustment) > AUTO_APPLY_THRESHOLD)
    return true;

  // Direction flip → review (was making it less aggressive, now more aggressive or vice versa)
  if (previousAdjustment !== undefined && previousAdjustment !== 0) {
    const flipped =
      Math.sign(calibration.suggestedAdjustment) !==
      Math.sign(previousAdjustment);
    if (flipped) return true;
  }

  return false;
}

/**
 * Determine whether a calibration result can be auto-applied without review.
 */
export function canAutoApply({
  calibration,
}: {
  calibration: CalibrationResult;
}) {
  if (
    calibration.confidence === 'exploring' ||
    calibration.confidence === 'low'
  )
    return false;
  if (Math.abs(calibration.suggestedAdjustment) > AUTO_APPLY_THRESHOLD)
    return false;
  return true;
}

/**
 * Extract modifier outcome samples from a prescription trace and actual session RPE.
 * This is the bridge between trace data and the calibration system.
 */
export function extractModifierSamples({
  modifiers,
  rpeTarget,
  rpeActual,
}: {
  modifiers: Array<{
    source: ModifierSource;
    multiplier: number;
    reason: string;
  }>;
  rpeTarget: number;
  rpeActual: number;
}) {
  return modifiers.map(
    (mod) =>
      ({
        modifierSource: mod.source,
        multiplier: mod.multiplier,
        rpeTarget,
        rpeActual,
      }) satisfies ModifierSample
  );
}

/**
 * Apply a calibration adjustment to a default modifier multiplier.
 * The adjustment shifts the multiplier toward 1.0 (less aggressive) or
 * away from 1.0 (more aggressive).
 *
 * Example: default ×0.85 + adjustment +0.07 → ×0.92 (less aggressive)
 */
export function applyCalibrationAdjustment({
  defaultMultiplier,
  adjustment,
}: {
  defaultMultiplier: number;
  adjustment: number;
}) {
  return Math.max(0.5, Math.min(1.2, defaultMultiplier + adjustment));
}
