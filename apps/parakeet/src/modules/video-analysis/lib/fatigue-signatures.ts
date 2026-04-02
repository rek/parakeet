import type { RepAnalysis } from '@parakeet/shared-types';

/**
 * Cross-rep fatigue signatures computed from first vs last rep deltas.
 *
 * Each field captures a different dimension of fatigue accumulation across
 * a set. All nullable — returns null when the underlying metric is missing
 * from one or both comparison reps.
 */
export interface FatigueSignatures {
  /** lean[last] - lean[first]. Positive = increasing lean (posterior chain fatigue). */
  forwardLeanDriftDeg: number | null;
  /** drift[last] - drift[first]. Increasing = motor control loss. */
  barDriftIncreaseCm: number | null;
  /** rom[first] - rom[last]. Positive = reps getting shorter (cheating / fatigue). */
  romCompressionCm: number | null;
  /** Ratio of last eccentric duration to first. >1 = slowing down, <1 = rushing. */
  descentSpeedChange: number | null;
  /** lockout[first] - lockout[last]. Positive = lockout getting worse. */
  lockoutDegradationDeg: number | null;
  /** Monotonicity of velocity loss across reps. */
  velocityLossTrend: 'increasing' | 'stable' | 'decreasing' | null;
}

/**
 * Compute fatigue signatures from a set's rep-level metrics.
 *
 * Requires at least 2 reps with valid data. Compares first rep to last rep
 * for scalar deltas, and examines the full velocity loss series for trend.
 */
export function computeFatigueSignatures({
  reps,
}: {
  reps: RepAnalysis[];
}): FatigueSignatures | null {
  if (reps.length < 2) return null;

  const first = reps[0];
  const last = reps[reps.length - 1];

  return {
    forwardLeanDriftDeg: delta(last.forwardLeanDeg, first.forwardLeanDeg),
    barDriftIncreaseCm: delta(last.barDriftCm, first.barDriftCm),
    romCompressionCm: delta(first.romCm, last.romCm),
    descentSpeedChange: ratio(
      last.eccentricDurationSec,
      first.eccentricDurationSec
    ),
    lockoutDegradationDeg: delta(
      first.hipAngleAtLockoutDeg,
      last.hipAngleAtLockoutDeg
    ),
    velocityLossTrend: classifyVelocityTrend({ reps }),
  };
}

/** a - b, rounded to 1 decimal. Null if either input missing. */
function delta(a: number | undefined, b: number | undefined) {
  if (a == null || b == null) return null;
  return Math.round((a - b) * 10) / 10;
}

/** a / b, rounded to 2 decimals. Null if either input missing or b is zero. */
function ratio(a: number | undefined, b: number | undefined) {
  if (a == null || b == null || b === 0) return null;
  return Math.round((a / b) * 100) / 100;
}

/**
 * Classify velocity loss trend by counting consecutive increases vs decreases.
 *
 * Uses a simple monotonicity test: if ≥60% of transitions go in one direction,
 * that's the trend. Otherwise "stable".
 */
function classifyVelocityTrend({ reps }: { reps: RepAnalysis[] }) {
  const losses = reps
    .map((r) => r.velocityLossPct)
    .filter((v): v is number => v != null);

  if (losses.length < 3) return null;

  let increasing = 0;
  let decreasing = 0;
  for (let i = 1; i < losses.length; i++) {
    if (losses[i] > losses[i - 1]) increasing++;
    else if (losses[i] < losses[i - 1]) decreasing++;
  }

  const transitions = losses.length - 1;
  const threshold = transitions * 0.6;

  if (increasing >= threshold) return 'increasing' as const;
  if (decreasing >= threshold) return 'decreasing' as const;
  return 'stable' as const;
}
