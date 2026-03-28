import type { VideoAnalysisResult } from '@parakeet/shared-types';

import { extractBarPath, smoothBarPath, computeBarDrift } from './bar-path';
import { detectReps } from './rep-detector';
import { computeForwardLean, computeHipAngle, computeKneeAngle } from './angle-calculator';
import { detectSquatDepth } from './depth-detector';
import { detectFaults } from './fault-detector';
import type { PoseFrame } from './pose-types';

const ANALYSIS_VERSION = 1;
// Approx cm per normalized unit (170cm person filling 70% of frame height)
const CM_PER_UNIT = 243;

/**
 * Run the full video analysis pipeline on a sequence of pose frames.
 *
 * Steps:
 * 1. Extract and smooth the bar path from wrist landmarks
 * 2. Detect rep boundaries from hip/wrist Y periodicity
 * 3. For each rep: compute key angles, depth (squat), bar metrics, and faults
 * 4. Return a VideoAnalysisResult ready for storage in the analysis JSONB column
 */
export function assembleAnalysis({
  frames,
  fps,
  lift,
}: {
  frames: PoseFrame[];
  fps: number;
  lift: 'squat' | 'bench' | 'deadlift';
}) {
  const rawPath = extractBarPath({ frames });
  const barPath = smoothBarPath({ path: rawPath });
  const repBoundsList = detectReps({ frames, lift });

  const reps = repBoundsList.map(({ startFrame, endFrame }, index) => {
    // Clamp to valid frame indices
    const safeStart = Math.max(0, Math.min(startFrame, frames.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(endFrame, frames.length - 1));

    // Bar path segment for this rep
    const repPath = barPath.filter((p) => p.frame >= safeStart && p.frame <= safeEnd);
    const barDriftNormalized = computeBarDrift({ path: repPath });
    const barDriftCm = barDriftNormalized * CM_PER_UNIT;

    // Midpoint frame for representative angle measurements
    const midFrame = Math.round((safeStart + safeEnd) / 2);

    // Forward lean at the deepest/hardest point (midpoint approximation)
    const forwardLeanDeg = computeForwardLean({ frame: frames[midFrame] });

    // Knee angle at midpoint — captures bottom position for squat/deadlift
    const kneeAngleAtMid = computeKneeAngle({ frame: frames[midFrame] });

    // Hip angle at end frame for lockout assessment
    const hipAngleAtEnd = computeHipAngle({ frame: frames[safeEnd] });

    // Squat-specific: depth at bottom frame
    let maxDepthCm: number | undefined;
    if (lift === 'squat') {
      // Find bottom frame = frame with highest average hip Y in rep window
      let maxHipY = -Infinity;
      let bottomFrame = safeStart;
      for (let i = safeStart; i <= safeEnd; i++) {
        const f = frames[i];
        const hipY = (f[23].y + f[24].y) / 2;
        if (hipY > maxHipY) {
          maxHipY = hipY;
          bottomFrame = i;
        }
      }
      const { depthCm } = detectSquatDepth({ frame: frames[bottomFrame] });
      maxDepthCm = depthCm;
    }

    // Range of motion: vertical travel of bar path (top to bottom)
    const pathYValues = repPath.map((p) => p.y);
    const romNormalized =
      pathYValues.length > 1 ? Math.max(...pathYValues) - Math.min(...pathYValues) : 0;
    const romCm = romNormalized * CM_PER_UNIT;

    const faults = detectFaults({
      frames,
      repBounds: { startFrame: safeStart, endFrame: safeEnd },
      barPath,
      lift,
    });

    return {
      repNumber: index + 1,
      startFrame: safeStart,
      endFrame: safeEnd,
      barPath: repPath,
      maxDepthCm,
      forwardLeanDeg,
      barDriftCm,
      romCm,
      // Expose computed angles for downstream use / LLM coaching (Phase 2)
      kneeAngleDeg: kneeAngleAtMid,
      hipAngleAtLockoutDeg: hipAngleAtEnd,
      faults,
    };
  });

  return {
    reps,
    fps,
    cameraAngle: 'side' as const,
    analysisVersion: ANALYSIS_VERSION,
  } satisfies VideoAnalysisResult;
}
