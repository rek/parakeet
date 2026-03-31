import type { BarPathPoint } from '@parakeet/shared-types';

import { CM_PER_UNIT } from './pose-types';

/**
 * Compute mean concentric velocity for a single rep from bar path Y data.
 *
 * Concentric phase = bar moving upward (Y decreasing in MediaPipe coords).
 * Finds the bottom (max Y) and top (min Y after bottom) of the rep, then
 * computes: displacement / time.
 *
 * Returns cm/s. Returns null if the rep has insufficient data.
 */
export function computeConcentricVelocity({
  repPath,
  fps,
}: {
  repPath: BarPathPoint[];
  fps: number;
}) {
  if (repPath.length < 3 || fps <= 0) return null;

  // Find the bottom of the rep (max Y = lowest position in MediaPipe coords)
  let bottomIdx = 0;
  let bottomY = repPath[0].y;
  for (let i = 1; i < repPath.length; i++) {
    if (repPath[i].y > bottomY) {
      bottomY = repPath[i].y;
      bottomIdx = i;
    }
  }

  // Find the top after the bottom (min Y after bottom = lockout)
  let topIdx = bottomIdx;
  let topY = bottomY;
  for (let i = bottomIdx + 1; i < repPath.length; i++) {
    if (repPath[i].y < topY) {
      topY = repPath[i].y;
      topIdx = i;
    }
  }

  // Need at least 2 frames of concentric phase
  const concentricFrames = topIdx - bottomIdx;
  if (concentricFrames < 2) return null;

  const displacementNormalized = bottomY - topY; // positive = upward
  const displacementCm = displacementNormalized * CM_PER_UNIT;
  const durationSec = concentricFrames / fps;

  return displacementCm / durationSec;
}

/**
 * Compute velocity loss % across a set of reps.
 *
 * Velocity loss = (v_first - v_current) / v_first × 100
 *
 * Returns per-rep velocity loss values. First rep is always 0%.
 */
export function computeVelocityLoss({
  velocities,
}: {
  velocities: (number | null)[];
}) {
  const valid = velocities.filter((v): v is number => v != null);
  if (valid.length < 2) return velocities.map(() => null);

  const firstVelocity = valid[0];
  if (firstVelocity <= 0) return velocities.map(() => null);

  return velocities.map((v) => {
    if (v == null) return null;
    return ((firstVelocity - v) / firstVelocity) * 100;
  });
}

/**
 * Estimate Reps-in-Reserve from velocity loss %.
 *
 * Based on well-established VBT research (Sanchez-Medina, Gonzalez-Badillo):
 *   ~10% velocity loss ≈ 4-5 RiR
 *   ~20% velocity loss ≈ 2-3 RiR
 *   ~30% velocity loss ≈ 1 RiR
 *   ~40%+ velocity loss ≈ 0 RiR (near failure)
 *
 * Uses linear interpolation between these anchor points.
 */
export function estimateRirFromVelocityLoss({
  velocityLossPct,
}: {
  velocityLossPct: number | null;
}) {
  if (velocityLossPct == null || velocityLossPct < 0) return null;

  // Anchor points: [velocityLoss%, RiR]
  const anchors: [number, number][] = [
    [0, 6],
    [10, 4.5],
    [20, 2.5],
    [30, 1],
    [40, 0],
  ];

  // Clamp to range
  if (velocityLossPct >= 40) return 0;

  // Find surrounding anchors and interpolate
  for (let i = 1; i < anchors.length; i++) {
    if (velocityLossPct <= anchors[i][0]) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      const t = (velocityLossPct - x0) / (x1 - x0);
      return Math.round((y0 + (y1 - y0) * t) * 10) / 10;
    }
  }

  return 0;
}
