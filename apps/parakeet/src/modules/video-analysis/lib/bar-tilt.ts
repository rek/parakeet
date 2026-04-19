// @spec docs/features/video-analysis/spec-metrics.md
import { LANDMARK, type PoseFrame } from './pose-types';

/**
 * Minimum wrist visibility for a frame to contribute to tilt measurement.
 * Matches the rep-detector convention so signal coverage lines up.
 */
const VIS_THRESHOLD = 0.5;

/**
 * Radians → degrees.
 */
const RAD_TO_DEG = 180 / Math.PI;

export interface BarTiltSeries {
  /** Worst absolute tilt across the rep window, in degrees. */
  maxDeg: number;
  /** Mean absolute tilt across the rep window, in degrees. */
  meanDeg: number;
  /** Number of frames that contributed (both wrists visible ≥ threshold). */
  framesUsed: number;
}

/**
 * Compute bar-tilt angle series for a front-on bench rep.
 *
 * From the front, the bar lies across the two wrists. Its angle relative
 * to horizontal is `atan2(rightWrist.y - leftWrist.y, rightWrist.x - leftWrist.x)`.
 * Absolute value lets the caller ignore which side is low — we care about
 * magnitude, not handedness.
 *
 * Returns `{ maxDeg: 0, meanDeg: 0, framesUsed: 0 }` when no frames in the
 * window have both wrists visible — the caller can treat zero framesUsed
 * as "no signal, don't emit a fault".
 *
 * This metric is only meaningful from the front (`sagittalConfidence < 0.5`).
 * From the side, the L/R wrists project onto nearly the same image point
 * and the angle is dominated by noise.
 */
export function computeBarTiltSeries({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}): BarTiltSeries {
  let sumAbsDeg = 0;
  let maxAbsDeg = 0;
  let framesUsed = 0;

  const lo = Math.max(0, startFrame);
  const hi = Math.min(frames.length - 1, endFrame);

  for (let i = lo; i <= hi; i++) {
    const frame = frames[i];
    const lw = frame[LANDMARK.LEFT_WRIST];
    const rw = frame[LANDMARK.RIGHT_WRIST];
    if (lw.visibility < VIS_THRESHOLD || rw.visibility < VIS_THRESHOLD) {
      continue;
    }
    const dx = rw.x - lw.x;
    const dy = rw.y - lw.y;
    if (Math.hypot(dx, dy) < 1e-6) continue;
    const absDeg = Math.abs(Math.atan2(dy, dx) * RAD_TO_DEG);
    sumAbsDeg += absDeg;
    if (absDeg > maxAbsDeg) maxAbsDeg = absDeg;
    framesUsed++;
  }

  if (framesUsed === 0) {
    return { maxDeg: 0, meanDeg: 0, framesUsed: 0 };
  }

  return {
    maxDeg: maxAbsDeg,
    meanDeg: sumAbsDeg / framesUsed,
    framesUsed,
  };
}
