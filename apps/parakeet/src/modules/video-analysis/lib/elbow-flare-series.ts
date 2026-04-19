// @spec docs/features/video-analysis/spec-metrics.md
import { computeAngle } from './angle-calculator';
import { LANDMARK, type PoseFrame } from './pose-types';

const VIS_THRESHOLD = 0.5;

export interface ElbowFlareSeries {
  minDeg: number;
  maxDeg: number;
  meanDeg: number;
  framesUsed: number;
}

/**
 * Compute elbow flare angle every frame across a rep window, returning
 * the min/max/mean.
 *
 * Flare is the angle at the shoulder between the upper arm
 * (shoulder→elbow) and the torso (shoulder→hip). Left and right are
 * averaged per frame when both sides are visible; otherwise the visible
 * side carries the frame.
 *
 * The v4 analysis sampled this metric at a single midpoint frame, which
 * underreported peak flare (it often happens mid-concentric, not at mid-
 * time-index) and overreported benign warm-up flare on the first rep.
 * Series sampling matches what the fault thresholds actually care about.
 *
 * Returns zeros with `framesUsed: 0` when no frame in the window has one
 * usable side.
 */
export function computeElbowFlareSeries({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}): ElbowFlareSeries {
  let minDeg = Infinity;
  let maxDeg = -Infinity;
  let sumDeg = 0;
  let framesUsed = 0;

  const lo = Math.max(0, startFrame);
  const hi = Math.min(frames.length - 1, endFrame);

  for (let i = lo; i <= hi; i++) {
    const frame = frames[i];
    const ls = frame[LANDMARK.LEFT_SHOULDER];
    const le = frame[LANDMARK.LEFT_ELBOW];
    const lh = frame[LANDMARK.LEFT_HIP];
    const rs = frame[LANDMARK.RIGHT_SHOULDER];
    const re = frame[LANDMARK.RIGHT_ELBOW];
    const rh = frame[LANDMARK.RIGHT_HIP];

    const leftVis =
      ls.visibility >= VIS_THRESHOLD &&
      le.visibility >= VIS_THRESHOLD &&
      lh.visibility >= VIS_THRESHOLD;
    const rightVis =
      rs.visibility >= VIS_THRESHOLD &&
      re.visibility >= VIS_THRESHOLD &&
      rh.visibility >= VIS_THRESHOLD;

    if (!leftVis && !rightVis) continue;

    let sum = 0;
    let sides = 0;
    if (leftVis) {
      sum += computeAngle({ a: le, b: ls, c: lh });
      sides++;
    }
    if (rightVis) {
      sum += computeAngle({ a: re, b: rs, c: rh });
      sides++;
    }
    const flareDeg = sum / sides;

    if (flareDeg < minDeg) minDeg = flareDeg;
    if (flareDeg > maxDeg) maxDeg = flareDeg;
    sumDeg += flareDeg;
    framesUsed++;
  }

  if (framesUsed === 0) {
    return { minDeg: 0, maxDeg: 0, meanDeg: 0, framesUsed: 0 };
  }

  return {
    minDeg,
    maxDeg,
    meanDeg: sumDeg / framesUsed,
    framesUsed,
  };
}
