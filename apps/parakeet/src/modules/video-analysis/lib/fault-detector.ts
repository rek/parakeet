import type { BarPathPoint, FormFault } from '@parakeet/shared-types';

import { computeBarDrift, sliceBarPath } from './bar-path';
import { computeForwardLean, computeHipAngle } from './angle-calculator';
import { detectSquatDepth } from './depth-detector';
import { LANDMARK, type PoseFrame } from './pose-types';

// Thresholds from docs/design/video-form-analysis.md — Phase 1 fixed values.
const THRESHOLDS = {
  squat: {
    barDriftNormalized: 0.03, // ~5cm at 170cm/0.7 frame fill
    excessiveForwardLeanDeg: 55,
  },
  deadlift: {
    barDriftNormalized: 0.03,
    backRoundingDeviationDeg: 15,
    // MediaPipe ASIS landmark reads 10-15° below anatomical hip angle.
    // 160° here corresponds to ~175° true extension.
    incompleteLockoutHipDeg: 160,
  },
  bench: {
    barDriftNormalized: 0.03,
    inconsistentTouchVarianceNormalized: 0.02,
  },
} as const;

/**
 * Pre-computed per-rep data shared between the metrics assembler and fault
 * detector. Avoids recomputing bar path slicing, drift, and bottom frame.
 */
export interface RepContext {
  repPath: BarPathPoint[];
  barDrift: number;
  bottomFrame: number;
}

/** Find the frame index within [startFrame, endFrame] at which hip Y is highest. */
export function findBottomFrame({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}) {
  let maxY = -Infinity;
  let bottomFrame = startFrame;

  for (let i = startFrame; i <= Math.min(endFrame, frames.length - 1); i++) {
    const lh = frames[i][LANDMARK.LEFT_HIP];
    const rh = frames[i][LANDMARK.RIGHT_HIP];
    const hipY = (lh.y + rh.y) / 2;
    if (hipY > maxY) {
      maxY = hipY;
      bottomFrame = i;
    }
  }

  return bottomFrame;
}

function detectSquatFaults({
  frames,
  repBounds,
  barPath,
  repContext,
  cameraAngle = 'side',
}: {
  frames: PoseFrame[];
  repBounds: { startFrame: number; endFrame: number };
  barPath: BarPathPoint[];
  repContext?: RepContext;
  cameraAngle?: 'side' | 'front';
}) {
  const faults: FormFault[] = [];
  const { startFrame, endFrame } = repBounds;
  const isSideView = cameraAngle === 'side';

  // Depth check — only meaningful from side view (from front, hip/knee Y overlap)
  if (isSideView) {
    const bottomFrame =
      repContext?.bottomFrame ?? findBottomFrame({ frames, startFrame, endFrame });
    const { belowParallel } = detectSquatDepth({ frame: frames[bottomFrame] });
    if (!belowParallel) {
      faults.push({
        type: 'above_parallel',
        severity: 'critical',
        message: 'Hip crease did not reach parallel',
      });
    }
  }

  // Forward lean — only meaningful from side view (from front, lean saturates at 90°)
  if (isSideView) {
    let maxLean = 0;
    for (let i = startFrame; i <= Math.min(endFrame, frames.length - 1); i++) {
      const lean = computeForwardLean({ frame: frames[i] });
      if (lean > maxLean) maxLean = lean;
    }
    if (maxLean > THRESHOLDS.squat.excessiveForwardLeanDeg) {
      faults.push({
        type: 'excessive_lean',
        severity: 'warning',
        message: `Forward lean reached ${maxLean.toFixed(1)}°`,
        value: maxLean,
        threshold: THRESHOLDS.squat.excessiveForwardLeanDeg,
      });
    }
  }

  // Bar drift
  const drift =
    repContext?.barDrift ??
    computeBarDrift({
      path: sliceBarPath({ barPath, startFrame, endFrame }),
    });
  if (drift > THRESHOLDS.squat.barDriftNormalized) {
    faults.push({
      type: 'bar_drift',
      severity: 'warning',
      message: `Bar drifted ${(drift * 243).toFixed(1)}cm from start`,
      value: drift,
      threshold: THRESHOLDS.squat.barDriftNormalized,
    });
  }

  return faults;
}

function detectDeadliftFaults({
  frames,
  repBounds,
  barPath,
  repContext,
}: {
  frames: PoseFrame[];
  repBounds: { startFrame: number; endFrame: number };
  barPath: BarPathPoint[];
  repContext?: RepContext;
}) {
  const faults: FormFault[] = [];
  const { startFrame, endFrame } = repBounds;

  // Bar drift
  const drift =
    repContext?.barDrift ??
    computeBarDrift({
      path: sliceBarPath({ barPath, startFrame, endFrame }),
    });
  if (drift > THRESHOLDS.deadlift.barDriftNormalized) {
    faults.push({
      type: 'bar_drift',
      severity: 'warning',
      message: `Bar drifted ${(drift * 243).toFixed(1)}cm from start`,
      value: drift,
      threshold: THRESHOLDS.deadlift.barDriftNormalized,
    });
  }

  // Back rounding — detect if the torso angle gets WORSE (more flexed) during
  // the pull. Normal deadlift: hip angle increases (hips extend). Rounding:
  // hip angle decreases at some point (upper back caves while hips shoot up).
  // Compare the minimum hip angle in the first third of the pull to the
  // starting angle. A decrease means the back rounded under load.
  const startIdx = Math.min(startFrame, frames.length - 1);
  const thirdIdx = Math.min(
    Math.round(startFrame + (endFrame - startFrame) / 3),
    frames.length - 1,
  );
  const startHipAngle = computeHipAngle({ frame: frames[startIdx] });
  let minHipAngle = startHipAngle;
  for (let i = startIdx + 1; i <= thirdIdx; i++) {
    const angle = computeHipAngle({ frame: frames[i] });
    if (angle < minHipAngle) minHipAngle = angle;
  }
  // Only flag if the angle DECREASED (back rounded), not if it increased (normal extension)
  const roundingDeg = startHipAngle - minHipAngle;
  if (roundingDeg > THRESHOLDS.deadlift.backRoundingDeviationDeg) {
    faults.push({
      type: 'back_rounding',
      severity: 'warning',
      message: `Back rounded ${roundingDeg.toFixed(1)}° during initial pull`,
      value: roundingDeg,
      threshold: THRESHOLDS.deadlift.backRoundingDeviationDeg,
    });
  }

  // Incomplete lockout — hip angle at the final frame
  const endIdx = Math.min(endFrame, frames.length - 1);
  const lockoutHipAngle = computeHipAngle({ frame: frames[endIdx] });
  if (lockoutHipAngle < THRESHOLDS.deadlift.incompleteLockoutHipDeg) {
    faults.push({
      type: 'incomplete_lockout',
      severity: 'info',
      message: `Hip angle at lockout was ${lockoutHipAngle.toFixed(1)}°`,
      value: lockoutHipAngle,
      threshold: THRESHOLDS.deadlift.incompleteLockoutHipDeg,
    });
  }

  return faults;
}

function detectBenchFaults({
  barPath,
  repBounds,
  repContext,
}: {
  frames: PoseFrame[];
  repBounds: { startFrame: number; endFrame: number };
  barPath: BarPathPoint[];
  repContext?: RepContext;
}) {
  const faults: FormFault[] = [];
  const { startFrame, endFrame } = repBounds;

  // Bar drift
  const drift =
    repContext?.barDrift ??
    computeBarDrift({
      path: sliceBarPath({ barPath, startFrame, endFrame }),
    });
  if (drift > THRESHOLDS.bench.barDriftNormalized) {
    faults.push({
      type: 'bar_drift',
      severity: 'warning',
      message: `Bar drifted ${(drift * 243).toFixed(1)}cm from start`,
      value: drift,
      threshold: THRESHOLDS.bench.barDriftNormalized,
    });
  }

  return faults;
}

/**
 * Detect form faults for a single rep.
 *
 * Each fault includes a type, severity, human-readable message, and optional
 * measured value + threshold to support UI display and future LLM coaching.
 *
 * When `repContext` is provided (from the metrics assembler), pre-computed
 * bar path slice, drift, and bottom frame are reused instead of recomputed.
 */
export function detectFaults({
  frames,
  repBounds,
  barPath,
  lift,
  repContext,
  cameraAngle = 'side',
}: {
  frames: PoseFrame[];
  repBounds: { startFrame: number; endFrame: number };
  barPath: BarPathPoint[];
  lift: 'squat' | 'bench' | 'deadlift';
  repContext?: RepContext;
  cameraAngle?: 'side' | 'front';
}) {
  if (lift === 'squat') {
    return detectSquatFaults({ frames, repBounds, barPath, repContext, cameraAngle });
  }
  if (lift === 'deadlift') {
    return detectDeadliftFaults({ frames, repBounds, barPath, repContext });
  }
  return detectBenchFaults({ frames, repBounds, barPath, repContext });
}

/**
 * Compute variance of bar X positions at the bottom of each rep (bench only).
 *
 * Used to flag inconsistent touch points across multiple reps — a common
 * bench fault that increases injury risk and reduces power transfer.
 */
export function computeTouchPointVariance({
  frames,
  repBoundsList,
  barPath,
}: {
  frames: PoseFrame[];
  repBoundsList: { startFrame: number; endFrame: number }[];
  barPath: BarPathPoint[];
}) {
  if (repBoundsList.length < 2) return 0;

  // Find the bar X at the bottom of each rep (highest wrist Y = bar at chest)
  const touchXValues = repBoundsList.map(({ startFrame, endFrame }) => {
    const repPath = sliceBarPath({ barPath, startFrame, endFrame });
    if (repPath.length === 0) return 0;

    // Bottom = point with highest Y in path
    const bottom = repPath.reduce((best, p) => (p.y > best.y ? p : best), repPath[0]);
    return bottom.x;
  });

  // Variance of touch X values
  const mean = touchXValues.reduce((s, x) => s + x, 0) / touchXValues.length;
  const variance =
    touchXValues.reduce((s, x) => s + (x - mean) ** 2, 0) / touchXValues.length;

  void frames; // frames param kept for API consistency; currently unused in bench path
  return variance;
}
