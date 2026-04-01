import type { BarPathPoint } from '@parakeet/shared-types';

import { LANDMARK, type PoseFrame } from './pose-types';

/** Target ~500ms smoothing regardless of FPS (15 frames at 30fps, 2 at 4fps).
 * Increased from 167ms — real landmark data has significantly more jitter than
 * synthetic sine-wave fixtures. At 4fps, 167ms yields only 1 frame of smoothing
 * (effectively none). 500ms gives 2-frame smoothing at 4fps and 15 at 30fps. */
const SMOOTH_TIME_MS = 500;

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
 * for a physically stable bar. The window targets ~167ms — short enough not
 * to smear real drift but long enough to kill noise. At 30fps → 5 frames,
 * at 15fps → 3 frames. Pass `fps` to auto-compute; explicit `windowSize`
 * overrides.
 */
export function smoothBarPath({
  path,
  fps,
  windowSize,
}: {
  path: BarPathPoint[];
  fps?: number;
  windowSize?: number;
}) {
  if (path.length === 0) return [];

  const effectiveWindow =
    windowSize ?? Math.max(3, Math.round((fps ?? 30) * (SMOOTH_TIME_MS / 1000)));
  const half = Math.floor(effectiveWindow / 2);
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
 * Compute maximum perpendicular deviation from the bar's travel axis.
 *
 * Strategy depends on whether the bar path is a one-way trip (deadlift,
 * bench concentric) or a loop (squat — bar goes down then comes back up):
 *
 * - **One-way path** (start and end Y differ significantly): draws a line
 *   from first to last point and measures perpendicular deviation. This is
 *   camera-angle-invariant — a straight diagonal bar path from a non-
 *   perpendicular camera reads as zero drift.
 *
 * - **Loop path** (start ≈ end, e.g. full squat rep): measures deviation
 *   from a vertical line through the mean X. Camera parallax shifts the
 *   mean X but doesn't increase deviation from it.
 *
 * Returns the worst-case drift in normalized coordinates.
 * The caller converts to physical units (1 normalized unit ≈ 243cm).
 */
export function computeBarDrift({ path }: { path: BarPathPoint[] }) {
  if (path.length < 2) return 0;

  const start = path[0];
  const end = path[path.length - 1];

  // Direction vector of the travel axis
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Detect loop vs one-way: if the Y-range is large but start→end distance
  // is small relative to Y-range, the bar went down and came back up (loop).
  const yMin = Math.min(...path.map((p) => p.y));
  const yMax = Math.max(...path.map((p) => p.y));
  const yRange = yMax - yMin;
  const isLoop = yRange > 0.02 && len < yRange * 0.5;

  if (isLoop) {
    // Loop path: deviation from vertical line through mean X
    const meanX = path.reduce((sum, p) => sum + p.x, 0) / path.length;
    let maxDrift = 0;
    for (const point of path) {
      const drift = Math.abs(point.x - meanX);
      if (drift > maxDrift) maxDrift = drift;
    }
    return maxDrift;
  }

  // One-way path: perpendicular deviation from start→end line
  // Unit normal to the travel axis
  const nx = -dy / len;
  const ny = dx / len;

  let maxDrift = 0;
  for (const point of path) {
    const projX = point.x - start.x;
    const projY = point.y - start.y;
    const perpDist = Math.abs(projX * nx + projY * ny);
    if (perpDist > maxDrift) maxDrift = perpDist;
  }

  return maxDrift;
}

/**
 * Binary-search lower bound: first index where `barPath[i].frame >= target`.
 */
function lowerBound(arr: BarPathPoint[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].frame < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Binary-search upper bound: first index where `barPath[i].frame > target`.
 */
function upperBound(arr: BarPathPoint[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].frame <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Slice a bar path to the frames within [startFrame, endFrame] using binary
 * search. O(log n + slice length) instead of O(n) filter over the full array.
 * Handles both contiguous and non-contiguous (subsampled) frame indices.
 */
export function sliceBarPath({
  barPath,
  startFrame,
  endFrame,
}: {
  barPath: BarPathPoint[];
  startFrame: number;
  endFrame: number;
}) {
  const lo = lowerBound(barPath, startFrame);
  const hi = upperBound(barPath, endFrame);
  return barPath.slice(lo, hi);
}
