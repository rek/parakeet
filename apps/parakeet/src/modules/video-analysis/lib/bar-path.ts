import type { BarPathPoint } from '@parakeet/shared-types';

import { LANDMARK, type PoseFrame } from './pose-types';

/**
 * Extract bar position from wrist landmark averages per frame.
 *
 * MediaPipe wrist landmarks track the bar within ~2cm — averaging left + right
 * wrist gives a robust bar center estimate without plate-detection complexity.
 */
export function extractBarPath({ frames }: { frames: PoseFrame[] }) {
  return frames.map((frame, index) => {
    const lw = frame[LANDMARK.LEFT_WRIST];
    const rw = frame[LANDMARK.RIGHT_WRIST];
    return {
      x: (lw.x + rw.x) / 2,
      y: (lw.y + rw.y) / 2,
      frame: index,
    } satisfies BarPathPoint;
  });
}

/**
 * Apply a moving-average filter to a bar path.
 *
 * Smoothing is needed because raw landmark output has per-frame jitter even
 * for a physically stable bar. Window of 5 frames at 30fps is ~167ms —
 * short enough not to smear real drift but long enough to kill noise.
 */
export function smoothBarPath({
  path,
  windowSize = 5,
}: {
  path: BarPathPoint[];
  windowSize?: number;
}) {
  if (path.length === 0) return [];

  const half = Math.floor(windowSize / 2);
  return path.map((point, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(path.length - 1, i + half);
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sumX += path[j].x;
      sumY += path[j].y;
      count++;
    }
    return {
      x: sumX / count,
      y: sumY / count,
      frame: point.frame,
    } satisfies BarPathPoint;
  });
}

/**
 * Compute maximum horizontal deviation from the starting bar position.
 *
 * Returns the worst-case lateral drift in normalized coordinates.
 * The caller converts to physical units (1 normalized unit ≈ 243cm for a
 * 170cm person filling 70% of frame height).
 */
export function computeBarDrift({ path }: { path: BarPathPoint[] }) {
  if (path.length === 0) return 0;

  const startX = path[0].x;
  let maxDrift = 0;

  for (const point of path) {
    const drift = Math.abs(point.x - startX);
    if (drift > maxDrift) maxDrift = drift;
  }

  return maxDrift;
}
