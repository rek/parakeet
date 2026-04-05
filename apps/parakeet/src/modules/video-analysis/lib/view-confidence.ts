import { LANDMARK, type PoseFrame } from './pose-types';

/**
 * Maximum expected landmark separation (normalized units) for a pure front view.
 * At ~170cm person filling 70% of frame, 0.30 ≈ ~73cm — well beyond
 * shoulder width, providing headroom for near-front angles.
 */
const MAX_SEPARATION = 0.3;

/**
 * Compute a continuous sagittal confidence score (0-1) from pose landmarks.
 *
 * 1.0 = pure side view (shoulders overlap in X)
 * 0.0 = pure front view (shoulders maximally separated)
 * 0.5 = ~45° angle
 *
 * Uses shoulder X-separation (70% weight) and hip X-separation (30% weight)
 * as a secondary confirmation signal. Hips are less reliable but help when
 * one shoulder is occluded.
 *
 * Replaces the binary `detectCameraAngle()` which failed at intermediate angles.
 */
export function computeSagittalConfidence({
  frames,
}: {
  frames: PoseFrame[];
}): number {
  const SAMPLE_COUNT = Math.min(frames.length, 10);

  if (SAMPLE_COUNT === 0) return 0.8; // default: assume mostly side

  let shoulderTotal = 0;
  let shoulderCount = 0;
  let hipTotal = 0;
  let hipCount = 0;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const ls = frames[i][LANDMARK.LEFT_SHOULDER];
    const rs = frames[i][LANDMARK.RIGHT_SHOULDER];
    const lh = frames[i][LANDMARK.LEFT_HIP];
    const rh = frames[i][LANDMARK.RIGHT_HIP];

    if (ls.visibility >= 0.5 && rs.visibility >= 0.5) {
      shoulderTotal += Math.abs(ls.x - rs.x);
      shoulderCount++;
    }

    if (lh.visibility >= 0.5 && rh.visibility >= 0.5) {
      hipTotal += Math.abs(lh.x - rh.x);
      hipCount++;
    }
  }

  // If no valid frames at all, assume mostly side
  if (shoulderCount === 0 && hipCount === 0) return 0.8;

  // Compute weighted average separation
  // Shoulder: 70% weight (more reliable), Hip: 30% weight (confirmation)
  let weightedSep = 0;
  let totalWeight = 0;

  if (shoulderCount > 0) {
    weightedSep += (shoulderTotal / shoulderCount) * 0.7;
    totalWeight += 0.7;
  }
  if (hipCount > 0) {
    weightedSep += (hipTotal / hipCount) * 0.3;
    totalWeight += 0.3;
  }

  const avgSeparation = weightedSep / totalWeight;

  // Normalize to 0-1: 0 separation → 1.0 (pure side), MAX_SEPARATION → 0.0 (pure front)
  return Math.max(0, Math.min(1, 1 - avgSeparation / MAX_SEPARATION));
}

/**
 * Derive a binary camera angle from sagittal confidence.
 * Backwards compatibility helper for code that still uses 'side' | 'front'.
 */
export function deriveCameraAngle(
  sagittalConfidence: number
): 'side' | 'front' {
  return sagittalConfidence >= 0.5 ? 'side' : 'front';
}

/**
 * @deprecated Use `computeSagittalConfidence` + `deriveCameraAngle` instead.
 * Kept for backwards compatibility during migration.
 */
export function detectCameraAngle({
  frames,
}: {
  frames: PoseFrame[];
}): 'side' | 'front' {
  return deriveCameraAngle(computeSagittalConfidence({ frames }));
}
