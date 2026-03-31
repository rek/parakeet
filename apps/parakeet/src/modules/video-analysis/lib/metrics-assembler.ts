import type { VideoAnalysisResult } from '@parakeet/shared-types';

import {
  DEFAULT_STRATEGY,
  STRATEGIES,
  type AnalysisStrategy,
  type StrategyName,
} from './analysis-strategy';
import { computeForwardLean, computeHipAngle, computeKneeAngle } from './angle-calculator';
import { computeConcentricVelocity, computeVelocityLoss, estimateRirFromVelocityLoss } from './bar-velocity';
import { detectSquatDepth } from './depth-detector';
import { CM_PER_UNIT, type PoseFrame } from './pose-types';
import { computeRepTempo } from './rep-tempo';

const ANALYSIS_VERSION = 2;

/**
 * Run the full video analysis pipeline on a sequence of pose frames.
 *
 * Pass `strategy` to swap algorithms (rep detection, bar path, faults, grading).
 * Default: 'v1_mediapipe'. For A/B comparison, call twice with different strategies.
 *
 * Steps:
 * 1. Extract and smooth the bar path from wrist landmarks
 * 2. Detect rep boundaries from hip/wrist Y periodicity
 * 3. For each rep: compute shared context once, then angles, depth, faults
 * 4. Return a VideoAnalysisResult ready for storage in the analysis JSONB column
 */
export function assembleAnalysis({
  frames,
  fps,
  lift,
  strategy: strategyName = DEFAULT_STRATEGY,
}: {
  frames: PoseFrame[];
  fps: number;
  lift: 'squat' | 'bench' | 'deadlift';
  strategy?: StrategyName;
}) {
  const strategy: AnalysisStrategy = STRATEGIES[strategyName];
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analysis] ${frames.length} frames, ${fps}fps, ${lift}, strategy=${strategy.name}`);
  }

  const rawPath = strategy.barPath.extractBarPath({ frames });
  const barPath = strategy.barPath.smoothBarPath({ path: rawPath, fps });
  const repBoundsList = strategy.repDetector.detectReps({ frames, lift, fps });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analysis] ${repBoundsList.length} reps detected`);
  }

  const reps = repBoundsList.map(({ startFrame, endFrame }, index) => {
    // Clamp to valid frame indices
    const safeStart = Math.max(0, Math.min(startFrame, frames.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(endFrame, frames.length - 1));

    // --- Shared per-rep context (computed once, reused by fault detector) ---
    const repPath = strategy.barPath.sliceBarPath({ barPath, startFrame: safeStart, endFrame: safeEnd });
    const barDriftNormalized = strategy.barPath.computeBarDrift({ path: repPath });
    const bottomFrame =
      lift === 'squat'
        ? strategy.faults.findBottomFrame({ frames, startFrame: safeStart, endFrame: safeEnd })
        : safeStart;

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
      const { depthCm } = detectSquatDepth({ frame: frames[bottomFrame] });
      maxDepthCm = depthCm;
    }

    // Range of motion: vertical travel of bar path (top to bottom)
    const pathYValues = repPath.map((p) => p.y);
    const romNormalized =
      pathYValues.length > 1 ? Math.max(...pathYValues) - Math.min(...pathYValues) : 0;
    const romCm = romNormalized * CM_PER_UNIT;

    const faults = strategy.faults.detectFaults({
      frames,
      repBounds: { startFrame: safeStart, endFrame: safeEnd },
      barPath,
      lift,
      repContext: { repPath, barDrift: barDriftNormalized, bottomFrame },
    });

    // Bar velocity: mean concentric velocity from wrist Y displacement
    const meanConcentricVelocityCmS = computeConcentricVelocity({ repPath, fps }) ?? undefined;

    // Tempo: eccentric/concentric phase durations
    const tempo = computeRepTempo({ repPath, fps });

    const repAnalysis = {
      repNumber: index + 1,
      startFrame: safeStart,
      endFrame: safeEnd,
      barPath: repPath,
      maxDepthCm,
      forwardLeanDeg,
      barDriftCm,
      romCm,
      kneeAngleDeg: kneeAngleAtMid,
      hipAngleAtLockoutDeg: hipAngleAtEnd,
      meanConcentricVelocityCmS,
      concentricDurationSec: tempo?.concentricDurationSec,
      eccentricDurationSec: tempo?.eccentricDurationSec,
      tempoRatio: tempo?.tempoRatio,
      faults,
    };

    // Auto-grade every rep against IPF competition standards
    const verdict = strategy.grader.gradeRep({ rep: repAnalysis, frames, fps, lift });

    return { ...repAnalysis, verdict };
  });

  // Compute velocity loss % and estimated RiR across all reps
  const velocities = reps.map((r) => r.meanConcentricVelocityCmS ?? null);
  const velocityLosses = computeVelocityLoss({ velocities });

  const repsWithVelocity = reps.map((r, i) => ({
    ...r,
    velocityLossPct: velocityLosses[i] != null
      ? Math.round(velocityLosses[i]! * 10) / 10
      : undefined,
    estimatedRir: estimateRirFromVelocityLoss({
      velocityLossPct: velocityLosses[i],
    }) ?? undefined,
  }));

  return {
    reps: repsWithVelocity,
    fps,
    cameraAngle: 'side' as const,
    analysisVersion: ANALYSIS_VERSION,
  } satisfies VideoAnalysisResult;
}
