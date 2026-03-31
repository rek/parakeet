import type { VideoAnalysisResult } from '@parakeet/shared-types';

import {
  DEFAULT_STRATEGY,
  STRATEGIES,
  type AnalysisStrategy,
  type StrategyName,
} from './analysis-strategy';
import { computeForwardLean, computeHipAngle, computeKneeAngle } from './angle-calculator';
import { computeBarToShinDistance } from './bar-shin-distance';
import { computeConcentricVelocity, computeVelocityLoss, estimateRirFromVelocityLoss } from './bar-velocity';
import { detectButtWink } from './butt-wink-detector';
import { detectCameraAngle } from './detect-camera-angle';
import { computeElbowFlare } from './elbow-flare';
import { computeFatigueSignatures } from './fatigue-signatures';
import { analyzeHipHingeTiming } from './hip-hinge-timing';
import { computeHipShift } from './hip-shift';
import { computeLockoutStability } from './lockout-stability';
import { assessPauseQuality } from './pause-quality';
import { detectSquatDepth } from './depth-detector';
import { CM_PER_UNIT, type PoseFrame } from './pose-types';
import { computeRepTempo } from './rep-tempo';
import { computeStanceWidth } from './stance-width';

const ANALYSIS_VERSION = 3;

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
  const cameraAngle = detectCameraAngle({ frames });
  // Side-view metrics (depth, forward lean) are meaningless from the front
  // because hip/knee Y overlap and shoulder-hip X alignment is perpendicular.
  const isSideView = cameraAngle === 'side';

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analysis] ${frames.length} frames, ${fps}fps, ${lift}, ${cameraAngle}, strategy=${strategy.name}`);
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

    // Forward lean and knee angle are only meaningful from the side.
    // From the front, shoulder-hip X separation is near-zero → lean saturates
    // at 90°, and knee angle reads near-180° (overlapping landmarks).
    const forwardLeanDeg = isSideView
      ? computeForwardLean({ frame: frames[midFrame] })
      : undefined;
    const kneeAngleAtMid = isSideView
      ? computeKneeAngle({ frame: frames[midFrame] })
      : undefined;

    // Hip angle at end frame for lockout assessment — reasonable from both views
    const hipAngleAtEnd = computeHipAngle({ frame: frames[safeEnd] });

    // Squat-specific: depth at bottom frame — only meaningful from side view
    // (from front, hip and knee Y overlap regardless of actual depth)
    let maxDepthCm: number | undefined;
    if (lift === 'squat' && isSideView) {
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
      cameraAngle,
    });

    // Bar velocity: mean concentric velocity from wrist Y displacement
    const meanConcentricVelocityCmS = computeConcentricVelocity({ repPath, fps }) ?? undefined;

    // Tempo: eccentric/concentric phase durations
    const tempo = computeRepTempo({ repPath, fps });

    // --- Lift-specific metrics ---

    // Squat: butt wink (side only), stance width, hip shift
    let buttWinkDeg: number | undefined;
    let stanceWidthCm: number | undefined;
    let hipShiftCm: number | undefined;
    let hipShiftDirection: 'left' | 'right' | 'none' | undefined;
    if (lift === 'squat') {
      // Butt wink is only detectable from side view (hip angle tracking)
      if (isSideView) {
        const wink = detectButtWink({ frames, bottomFrame, fps });
        if (wink.detected && wink.magnitudeDeg != null) {
          buttWinkDeg = wink.magnitudeDeg;
          faults.push({
            type: 'butt_wink',
            severity: 'warning',
            message: `Butt wink of ${wink.magnitudeDeg.toFixed(1)}° at bottom`,
            value: wink.magnitudeDeg,
            threshold: 10,
          });
        }
      }
      stanceWidthCm = computeStanceWidth({ frame: frames[safeStart] });
      const shift = computeHipShift({ frames, startFrame: safeStart, endFrame: safeEnd });
      hipShiftCm = shift.maxShiftCm;
      hipShiftDirection = shift.direction;
    }

    // Bench: elbow flare, pause quality
    let elbowFlareDeg: number | undefined;
    let pauseDurationSec: number | undefined;
    let isSinking: boolean | undefined;
    if (lift === 'bench') {
      elbowFlareDeg = computeElbowFlare({ frame: frames[midFrame] });
      if (elbowFlareDeg > 80 || elbowFlareDeg < 30) {
        faults.push({
          type: 'elbow_flare',
          severity: 'warning',
          message: elbowFlareDeg > 80
            ? `Excessive elbow flare: ${elbowFlareDeg.toFixed(1)}°`
            : `Elbows overtucked: ${elbowFlareDeg.toFixed(1)}°`,
          value: elbowFlareDeg,
          threshold: elbowFlareDeg > 80 ? 80 : 30,
        });
      }
      const pause = assessPauseQuality({ repPath, fps });
      pauseDurationSec = pause.pauseDurationSec;
      isSinking = pause.isSinking;
    }

    // Deadlift: hip hinge timing, bar-to-shin distance
    let hipHingeCrossoverPct: number | undefined;
    let barToShinDistanceCm: number | undefined;
    if (lift === 'deadlift') {
      const hinge = analyzeHipHingeTiming({ frames, startFrame: safeStart, endFrame: safeEnd, fps });
      hipHingeCrossoverPct = hinge.crossoverPct;
      if (hinge.isEarlyHipShoot) {
        faults.push({
          type: 'early_hip_shoot',
          severity: 'warning',
          message: `Hips shot up at ${hinge.crossoverPct.toFixed(0)}% of pull`,
          value: hinge.crossoverPct,
          threshold: 30,
        });
      }
      barToShinDistanceCm = computeBarToShinDistance({ frames, startFrame: safeStart, endFrame: safeEnd });
      if (barToShinDistanceCm > 5) {
        faults.push({
          type: 'bar_away_from_shins',
          severity: 'warning',
          message: `Bar ${barToShinDistanceCm.toFixed(1)}cm away from shins`,
          value: barToShinDistanceCm,
          threshold: 5,
        });
      }
    }

    // All lifts: lockout stability
    const lockoutStabilityCv = computeLockoutStability({ frames, startFrame: safeStart, endFrame: safeEnd });
    if (lockoutStabilityCv > 5) {
      faults.push({
        type: 'unstable_lockout',
        severity: 'warning',
        message: `Unstable lockout (CV ${lockoutStabilityCv.toFixed(1)}%)`,
        value: lockoutStabilityCv,
        threshold: 5,
      });
    }

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
      buttWinkDeg,
      stanceWidthCm,
      hipShiftCm,
      hipShiftDirection,
      elbowFlareDeg,
      pauseDurationSec,
      isSinking,
      hipHingeCrossoverPct,
      barToShinDistanceCm,
      lockoutStabilityCv,
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

  // Cross-rep fatigue analysis (needs ≥2 reps with metrics)
  const fatigueSignatures = computeFatigueSignatures({ reps: repsWithVelocity }) ?? undefined;

  return {
    reps: repsWithVelocity,
    fps,
    cameraAngle,
    analysisVersion: ANALYSIS_VERSION,
    fatigueSignatures,
  } satisfies VideoAnalysisResult;
}
