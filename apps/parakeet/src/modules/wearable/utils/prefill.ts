import type { ReadinessLevel } from '@parakeet/training-engine';

// Thresholds here are UI calibration for the 1–5 subjective pill UX, not
// training-science constants — intentionally distinct from the engine's
// wearable adjuster bands (see adjustments/wearable-readiness-adjuster.ts).

export function mapSleepDurationToLevel(
  durationMin: number | null
): ReadinessLevel | null {
  if (
    durationMin === null ||
    !Number.isFinite(durationMin) ||
    durationMin < 0
  ) {
    return null;
  }
  const hours = durationMin / 60;
  if (hours < 4) return 1;
  if (hours < 5.5) return 2;
  if (hours < 7) return 3;
  if (hours < 8.5) return 4;
  return 5;
}

export function mapAutonomicToLevel(
  hrvPctChange: number | null,
  rhrPctChange: number | null
): ReadinessLevel | null {
  const hrv =
    hrvPctChange !== null && Number.isFinite(hrvPctChange)
      ? hrvPctChange
      : null;
  const rhr =
    rhrPctChange !== null && Number.isFinite(rhrPctChange)
      ? rhrPctChange
      : null;

  let score: number;
  if (hrv !== null && rhr !== null) {
    score = (hrv + -rhr) / 2;
  } else if (hrv !== null) {
    score = hrv;
  } else if (rhr !== null) {
    score = -rhr;
  } else {
    return null;
  }

  if (score <= -20) return 1;
  if (score <= -10) return 2;
  if (score < 5) return 3;
  if (score < 15) return 4;
  return 5;
}
