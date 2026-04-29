import type { ReadinessModifier } from './readiness-adjuster';

export interface WearableReadinessInput {
  hrvPctChange?: number;
  restingHrPctChange?: number;
  sleepDurationMin?: number;
  deepSleepPct?: number;
  spo2Avg?: number;
  nonTrainingLoad?: number;
  readinessScore?: number;
}

const NEUTRAL: ReadinessModifier = {
  setReduction: 0,
  intensityMultiplier: 1.0,
  rationale: null,
};

const SET_REDUCTION_CAP = 2;
const INTENSITY_FLOOR = 0.85;

/**
 * Returns true when at least one adjuster-relevant signal is present.
 * Note: spo2Avg, readinessScore, nonTrainingLoad, deepSleepPct alone do NOT
 * count — they're modifiers / informational and never the sole basis for adjustment.
 */
export function hasWearableData(input: WearableReadinessInput): boolean {
  return (
    input.hrvPctChange !== undefined ||
    input.sleepDurationMin !== undefined ||
    input.restingHrPctChange !== undefined
  );
}

export function getWearableReadinessModifier(
  input: WearableReadinessInput
): ReadinessModifier {
  if (!hasWearableData(input)) return NEUTRAL;

  const reasons: string[] = [];
  let setReduction = 0;
  let intensityMultiplier = 1.0;
  let hrvPositive = false;
  let anyNegative = false;

  // ── HRV ────────────────────────────────────────────────────────────────────
  const hrv = input.hrvPctChange;
  if (hrv !== undefined) {
    if (hrv <= -20) {
      setReduction += 1;
      intensityMultiplier *= 0.95;
      reasons.push('HRV significantly below baseline');
      anyNegative = true;
    } else if (hrv <= -10) {
      intensityMultiplier *= 0.975;
      reasons.push('HRV below baseline');
      anyNegative = true;
    } else if (hrv >= 10) {
      hrvPositive = true;
    }
  }

  // ── Resting HR ─────────────────────────────────────────────────────────────
  const rhr = input.restingHrPctChange;
  if (rhr !== undefined) {
    if (rhr >= 15) {
      setReduction += 1;
      intensityMultiplier *= 0.975;
      reasons.push('Resting heart rate significantly elevated');
      anyNegative = true;
    } else if (rhr >= 10) {
      intensityMultiplier *= 0.975;
      reasons.push('Resting heart rate elevated');
      anyNegative = true;
    }
  }

  // ── Sleep duration ─────────────────────────────────────────────────────────
  const sleep = input.sleepDurationMin;
  if (sleep !== undefined) {
    if (sleep < 300) {
      setReduction += 1;
      intensityMultiplier *= 0.95;
      reasons.push('Very short sleep');
      anyNegative = true;
    } else if (sleep < 360) {
      intensityMultiplier *= 0.975;
      reasons.push('Short sleep');
      anyNegative = true;
    }
  }

  // ── Deep sleep (only meaningful with sleep duration present) ───────────────
  if (sleep !== undefined && input.deepSleepPct !== undefined && input.deepSleepPct < 15) {
    intensityMultiplier *= 0.975;
    reasons.push('Low deep sleep percentage');
    anyNegative = true;
  }

  // ── Non-training load ──────────────────────────────────────────────────────
  if (input.nonTrainingLoad === 3) {
    intensityMultiplier *= 0.975;
    reasons.push('High non-training physical load');
    anyNegative = true;
  }

  // ── Boost (gated: all positive) ────────────────────────────────────────────
  if (
    !anyNegative &&
    hrvPositive &&
    sleep !== undefined && sleep >= 420 &&
    input.deepSleepPct !== undefined && input.deepSleepPct >= 20
  ) {
    intensityMultiplier *= 1.025;
    reasons.push('Strong recovery signals — boosted');
  }

  // ── Caps ───────────────────────────────────────────────────────────────────
  if (setReduction > SET_REDUCTION_CAP) setReduction = SET_REDUCTION_CAP;
  if (intensityMultiplier < INTENSITY_FLOOR) intensityMultiplier = INTENSITY_FLOOR;

  if (reasons.length === 0) return NEUTRAL;

  return {
    setReduction,
    intensityMultiplier,
    rationale: reasons.join('; '),
  };
}
