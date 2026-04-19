// @spec docs/features/video-analysis/spec-lift-label.md
import { LANDMARK, type PoseFrame } from './pose-types';

export type DetectableLift = 'squat' | 'bench' | 'deadlift';

export interface LiftDetection {
  /** Detected lift, or null when we have too little signal to decide. */
  lift: DetectableLift | null;
  /** 0..1. UX should only warn on mismatch when `confidence >= WARN_CONFIDENCE`. */
  confidence: number;
  /** One-line explanation of the decision — surfaced in Alert copy + telemetry. */
  reason: string;
  /** Minimal features the decision was made from. Consumed by the caller only for logging. */
  features: {
    framesUsed: number;
    wrsMedian: number | null;
    wrsP90: number | null;
  };
}

/**
 * Minimum number of frames with both wrists + both shoulders + both hips
 * visible (each ≥ 0.5) before we're willing to decide.
 */
const MIN_FRAMES = 8;

/**
 * Landmark visibility threshold. Matches the rep-detector convention so
 * features computed here line up with features used downstream.
 */
const VIS_THRESHOLD = 0.5;

/**
 * UX threshold — the screen should only prompt the user about a label
 * mismatch when we cross this level of confidence. Below this, the
 * prediction is still available for telemetry / debugging but silent.
 */
export const WARN_CONFIDENCE = 0.75;

/**
 * Decision boundaries, tuned against the calibrated fixtures in
 * `test-videos/manifest.json`. The signal is `(wristY - shoulderY) / torso`:
 *
 *   ≤ -0.1           → bench (wrists above shoulders throughout)
 *   [-0.1 .. 0.4]    → squat (wrists near shoulders)
 *   ≥ 0.4 median, or ≥ 1.0 p90 → deadlift
 *
 * Noise-dominated clips land close to the boundaries and are intentionally
 * given low confidence so the UX warning stays silent.
 */
const BENCH_MAX_WRS_P90 = -0.1;
const DEADLIFT_MIN_WRS_P90 = 1.0;
const DEADLIFT_MIN_WRS_MEDIAN = 0.4;

/** Below this number of usable frames, confidence is scaled down proportionally. */
const CONFIDENT_FRAMES = 20;

/**
 * Shared confidence mapping. Every branch uses the same floor + linear ramp
 * so the only per-branch knob is how `strength` is computed. `strength` is
 * already normalised so that 0 = exactly on the decision boundary and 1 =
 * unambiguously in-class.
 */
const CONFIDENCE_FLOOR = 0.5;
function boundaryConfidence(strength: number, framesFactor: number): number {
  const raw = CONFIDENCE_FLOOR + (1 - CONFIDENCE_FLOOR) * clamp01(strength);
  return clamp01(raw * framesFactor);
}

/** Midpoint of two landmarks if both pass the visibility threshold. */
function midpoint(
  frame: PoseFrame,
  a: number,
  b: number
): { x: number; y: number } | null {
  const la = frame[a];
  const lb = frame[b];
  if (la.visibility < VIS_THRESHOLD || lb.visibility < VIS_THRESHOLD) {
    return null;
  }
  return { x: (la.x + lb.x) / 2, y: (la.y + lb.y) / 2 };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Classify what lift is being performed based on pose geometry alone.
 *
 * Primary feature: `(wristY - shoulderY) / torsoLength` — the vertical offset
 * of the wrist midpoint from the shoulder midpoint, normalised by torso length
 * so the signal is scale-invariant. The feature cleanly separates the three
 * competition lifts because the bar lives in very different places:
 *
 *   - Squat:    bar on traps → wrists stay at shoulder height → ratio ≈ 0
 *   - Bench:    bar pressed up → wrists always above shoulders → ratio < 0
 *   - Deadlift: bar at floor/hip → wrists well below shoulders → ratio > 0
 *
 * We use the 90th percentile and median rather than min/max because pose
 * landmarks are noisy — a single misdetected frame can drag either extreme
 * by ±2 torso-lengths.
 *
 * Returns `{ lift: null }` when fewer than MIN_FRAMES frames carry usable
 * wrist+shoulder+hip landmarks; the caller should keep the user's declared
 * lift and skip the mismatch warning.
 */
export function detectLift({ frames }: { frames: PoseFrame[] }): LiftDetection {
  const wrsValues: number[] = [];

  for (const frame of frames) {
    const shoulder = midpoint(frame, LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER);
    const hip = midpoint(frame, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP);
    if (!shoulder || !hip) continue;

    const dx = shoulder.x - hip.x;
    const dy = shoulder.y - hip.y;
    const torsoLen = Math.hypot(dx, dy);
    if (torsoLen < 0.01) continue;

    const wrist = midpoint(frame, LANDMARK.LEFT_WRIST, LANDMARK.RIGHT_WRIST);
    if (!wrist) continue;
    wrsValues.push((wrist.y - shoulder.y) / torsoLen);
  }

  const framesUsed = wrsValues.length;

  if (framesUsed < MIN_FRAMES) {
    return {
      lift: null,
      confidence: 0,
      reason: `Only ${framesUsed} frames with visible wrists — cannot detect lift`,
      features: { framesUsed, wrsMedian: null, wrsP90: null },
    };
  }

  const sorted = [...wrsValues].sort((a, b) => a - b);
  const wrsMedian = percentile(sorted, 0.5);
  const wrsP90 = percentile(sorted, 0.9);

  const features = { framesUsed, wrsMedian, wrsP90 };
  const framesFactor = Math.min(1, framesUsed / CONFIDENT_FRAMES);

  // Bench: wrists above (or level with) shoulders across virtually the whole
  // clip. `strength` saturates at 1 once p90 sits a full torso-length below
  // the boundary — that's where a front-on bench typically lands.
  if (wrsP90 <= BENCH_MAX_WRS_P90) {
    const strength = (BENCH_MAX_WRS_P90 - wrsP90) / 0.9;
    return {
      lift: 'bench',
      confidence: boundaryConfidence(strength, framesFactor),
      reason: `Wrists above shoulders throughout (p90=${wrsP90.toFixed(2)})`,
      features,
    };
  }

  // Deadlift: wrists reach far below shoulders at some frame (floor), or the
  // median sits clearly below the shoulder line (lifter mostly bent over).
  // Take the max of both strength signals so fixtures that are strong on
  // either axis still land with high confidence.
  if (wrsP90 >= DEADLIFT_MIN_WRS_P90 || wrsMedian >= DEADLIFT_MIN_WRS_MEDIAN) {
    const p90Strength = (wrsP90 - 0.3) / 1.5;
    const medianStrength = (wrsMedian - 0.2) / 0.5;
    const strength = Math.max(p90Strength, medianStrength);
    const reason =
      wrsP90 >= DEADLIFT_MIN_WRS_P90
        ? `Wrists reach well below shoulders (p90=${wrsP90.toFixed(2)})`
        : `Wrists typically below shoulders (median=${wrsMedian.toFixed(2)})`;
    return {
      lift: 'deadlift',
      confidence: boundaryConfidence(strength, framesFactor),
      reason,
      features,
    };
  }

  // Default: squat. Strength is 1 when the median sits exactly at zero and
  // decays to 0 as it drifts a third of a torso-length toward either
  // neighbouring band.
  const centerDist = Math.abs(wrsMedian);
  const squatStrength = 1 - centerDist * 3;
  return {
    lift: 'squat',
    confidence: boundaryConfidence(squatStrength, framesFactor),
    reason: `Wrists near shoulders (median=${wrsMedian.toFixed(2)})`,
    features,
  };
}
