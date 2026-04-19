import type { VideoAnalysisResult } from '@parakeet/shared-types';

import {
  DEFAULT_STRATEGY,
  STRATEGIES,
  type AnalysisStrategy,
  type StrategyName,
} from './analysis-strategy';
import {
  computeForwardLean,
  computeHipAngle,
  computeKneeAngle,
} from './angle-calculator';
import { computeBarToShinDistance } from './bar-shin-distance';
import {
  computeConcentricVelocity,
  computeVelocityLoss,
  estimateRirFromVelocityLoss,
} from './bar-velocity';
import { computeBarTiltSeries } from './bar-tilt';
import { detectButtWink } from './butt-wink-detector';
import { detectSquatDepth } from './depth-detector';
import { computeElbowFlareSeries } from './elbow-flare-series';
import { computeElbowPathSymmetry } from './elbow-path-symmetry';
import { computeFatigueSignatures } from './fatigue-signatures';
import { analyzeHipHingeTiming } from './hip-hinge-timing';
import { computeHipShift } from './hip-shift';
import { computeLockoutStability } from './lockout-stability';
import { assessPauseQuality } from './pause-quality';
import { CM_PER_UNIT, type PoseFrame } from './pose-types';
import { computePressAsymmetry } from './press-asymmetry';
import { computeRepTempo } from './rep-tempo';
import { computeStanceWidth } from './stance-width';
import { deriveCameraAngle, MIN_SAGITTAL_CONFIDENCE } from './view-confidence';

/**
 * v4 → v5: front-on bench is now a first-class path. Rep detection
 * switches to `(meanWristY − meanShoulderY)` below `MIN_SAGITTAL_CONFIDENCE`,
 * elbow flare is a per-frame series instead of a single midpoint sample,
 * and three new front-specific metrics are emitted: `barTiltMaxDeg`,
 * `pressAsymmetryRatio`, `elbowPathSymmetryRatio`.
 */
const ANALYSIS_VERSION = 5;

/**
 * Bar-tilt fault fires when the worst tilt across a rep exceeds this
 * many degrees. Tuned to ignore the small drift a level lifter shows
 * mid-press while still catching visibly uneven lockouts.
 */
const BAR_TILT_FAULT_DEG = 8;

/**
 * Press-asymmetry fault fires when the peak wrist Y delta across a rep
 * exceeds this fraction of torso length. 0.08 ≈ a wrist noticeably
 * lagging by roughly a fist-height for a typical lifter.
 */
const PRESS_ASYMMETRY_FAULT_RATIO = 0.08;

/**
 * Elbow-path-symmetry fault bounds. A perfectly symmetric press reads
 * 1.0; values outside [0.8, 1.25] indicate a single-sided flare that
 * single-frame flare sampling would average away.
 */
const ELBOW_PATH_SYMMETRY_MIN = 0.8;
const ELBOW_PATH_SYMMETRY_MAX = 1.25;

/** Elbow-flare fault thresholds — unchanged from v4; now driven by max over the rep. */
const ELBOW_FLARE_MAX_FAULT_DEG = 80;
const ELBOW_FLARE_MIN_FAULT_DEG = 30;

/**
 * Compensate for foreshortening when metrics are measured from oblique angles.
 * At pure side (confidence=1.0), no correction. At 45° (confidence~0.5),
 * values are foreshortened by ~30% — divide by sqrt(confidence) to compensate.
 * Below 0.8 confidence, foreshortening becomes significant.
 */
function perspectiveCorrection(
  value: number,
  sagittalConfidence: number
): number {
  if (sagittalConfidence >= 0.8) return value;
  // Avoid division by zero or extreme amplification at very low confidence.
  // Below 0.1, the measurement is too unreliable to correct meaningfully.
  const clamped = Math.max(0.1, sagittalConfidence);
  return value / Math.sqrt(clamped);
}

/**
 * Stage 3 of the analysis pipeline: deep per-rep metrics.
 *
 * Pass `strategy` to swap algorithms (rep detection, bar path, faults, grading).
 * Default: 'v1_mediapipe'. For A/B comparison, call twice with different strategies.
 *
 * All metrics are always computed regardless of camera angle. The caller
 * passes `sagittalConfidence` (stage 2 output — see `analyze-frames.ts`) so
 * this function is pure given a known confidence, and so callers that want
 * to override confidence (fixtures, calibration runs) can do so without
 * recomputing from frames.
 *
 * Steps:
 * 1. Extract and smooth the bar path from wrist landmarks
 * 2. Detect rep boundaries from joint angle periodicity (viewpoint-invariant)
 * 3. For each rep: compute shared context once, then all angles, depth, faults
 * 4. Return a VideoAnalysisResult ready for storage in the analysis JSONB column
 */
export function assembleAnalysis({
  frames,
  fps,
  lift,
  sagittalConfidence,
  strategy: strategyName = DEFAULT_STRATEGY,
}: {
  frames: PoseFrame[];
  fps: number;
  lift: 'squat' | 'bench' | 'deadlift';
  sagittalConfidence: number;
  strategy?: StrategyName;
}) {
  const strategy: AnalysisStrategy = STRATEGIES[strategyName];
  const cameraAngle = deriveCameraAngle(sagittalConfidence);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      `[analysis] ${frames.length} frames, ${fps}fps, ${lift}, confidence=${sagittalConfidence.toFixed(2)}, strategy=${strategy.name}`
    );
  }

  const rawPath = strategy.barPath.extractBarPath({ frames });
  const barPath = strategy.barPath.smoothBarPath({ path: rawPath, fps });
  const repBoundsList = strategy.repDetector.detectReps({
    frames,
    lift,
    fps,
    sagittalConfidence,
  });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analysis] ${repBoundsList.length} reps detected`);
  }

  const reps = repBoundsList.map(({ startFrame, endFrame }, index) => {
    // Clamp to valid frame indices
    const safeStart = Math.max(0, Math.min(startFrame, frames.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(endFrame, frames.length - 1));

    // --- Shared per-rep context (computed once, reused by fault detector) ---
    const repPath = strategy.barPath.sliceBarPath({
      barPath,
      startFrame: safeStart,
      endFrame: safeEnd,
    });
    const barDriftNormalized = strategy.barPath.computeBarDrift({
      path: repPath,
    });
    const bottomFrame =
      lift === 'squat'
        ? strategy.faults.findBottomFrame({
            frames,
            startFrame: safeStart,
            endFrame: safeEnd,
          })
        : safeStart;

    const barDriftCm = barDriftNormalized * CM_PER_UNIT;

    // Midpoint frame for representative angle measurements
    const midFrame = Math.round((safeStart + safeEnd) / 2);

    // Always compute all metrics — perspective-corrected at oblique angles.
    const rawForwardLean = computeForwardLean({ frame: frames[midFrame] });
    // Cap at 90° — computeForwardLean uses atan2 which naturally caps at 90°,
    // but perspective correction (dividing) can push it slightly past.
    const forwardLeanDeg = Math.min(
      90,
      perspectiveCorrection(rawForwardLean, sagittalConfidence)
    );
    const kneeAngleAtMid = computeKneeAngle({ frame: frames[midFrame] });

    // Hip angle at end frame for lockout assessment — reasonable from all views
    const hipAngleAtEnd = computeHipAngle({ frame: frames[safeEnd] });

    // Squat depth — always computed, perspective-corrected at oblique angles
    let maxDepthCm: number | undefined;
    if (lift === 'squat') {
      const { depthCm } = detectSquatDepth({ frame: frames[bottomFrame] });
      maxDepthCm = perspectiveCorrection(depthCm, sagittalConfidence);
    }

    // Range of motion: vertical travel of bar path (top to bottom)
    const pathYValues = repPath.map((p) => p.y);
    const romNormalized =
      pathYValues.length > 1
        ? Math.max(...pathYValues) - Math.min(...pathYValues)
        : 0;
    const romCm = romNormalized * CM_PER_UNIT;

    const faults = strategy.faults.detectFaults({
      frames,
      repBounds: { startFrame: safeStart, endFrame: safeEnd },
      barPath,
      lift,
      repContext: { repPath, barDrift: barDriftNormalized, bottomFrame },
      sagittalConfidence,
    });

    // Bar velocity: mean concentric velocity from wrist Y displacement
    const meanConcentricVelocityCmS =
      computeConcentricVelocity({ repPath, fps }) ?? undefined;

    // Tempo: eccentric/concentric phase durations
    const tempo = computeRepTempo({ repPath, fps });

    // --- Lift-specific metrics ---

    // Squat: butt wink, stance width, hip shift — always computed
    let buttWinkDeg: number | undefined;
    let stanceWidthCm: number | undefined;
    let hipShiftCm: number | undefined;
    let hipShiftDirection: 'left' | 'right' | 'none' | undefined;
    if (lift === 'squat') {
      const wink = detectButtWink({ frames, bottomFrame, fps });
      if (wink.detected && wink.magnitudeDeg != null) {
        buttWinkDeg = wink.magnitudeDeg;
        faults.push({
          type: 'butt_wink',
          severity:
            sagittalConfidence < MIN_SAGITTAL_CONFIDENCE ? 'info' : 'warning',
          message: `Butt wink of ${wink.magnitudeDeg.toFixed(1)}° at bottom`,
          value: wink.magnitudeDeg,
          threshold: 10,
        });
      }
      stanceWidthCm = computeStanceWidth({ frame: frames[safeStart] });
      const shift = computeHipShift({
        frames,
        startFrame: safeStart,
        endFrame: safeEnd,
      });
      hipShiftCm = shift.maxShiftCm;
      hipShiftDirection = shift.direction;
    }

    // Bench: elbow flare series, pause quality, + front-on-only metrics.
    let elbowFlareDeg: number | undefined;
    let elbowFlareMinDeg: number | undefined;
    let elbowFlareMaxDeg: number | undefined;
    let elbowFlareMeanDeg: number | undefined;
    let pauseDurationSec: number | undefined;
    let isSinking: boolean | undefined;
    let barTiltMaxDeg: number | undefined;
    let barTiltMeanDeg: number | undefined;
    let pressAsymmetryRatio: number | undefined;
    let elbowPathSymmetryRatio: number | undefined;
    if (lift === 'bench') {
      // Flare: sample per-frame across the rep and key faults off the max —
      // v4 sampled once at midFrame, which missed peaks and overreported
      // mean flare. `elbowFlareDeg` is preserved as the series mean for
      // downstream consumers that haven't migrated to the min/max/mean
      // fields yet (LLM prompts, coaching context, old UI chips).
      const flare = computeElbowFlareSeries({
        frames,
        startFrame: safeStart,
        endFrame: safeEnd,
      });
      if (flare.framesUsed > 0) {
        elbowFlareMinDeg = flare.minDeg;
        elbowFlareMaxDeg = flare.maxDeg;
        elbowFlareMeanDeg = flare.meanDeg;
        elbowFlareDeg = flare.meanDeg;
        if (
          flare.maxDeg > ELBOW_FLARE_MAX_FAULT_DEG ||
          flare.maxDeg < ELBOW_FLARE_MIN_FAULT_DEG
        ) {
          faults.push({
            type: 'elbow_flare',
            severity: 'warning',
            message:
              flare.maxDeg > ELBOW_FLARE_MAX_FAULT_DEG
                ? `Excessive elbow flare peak: ${flare.maxDeg.toFixed(1)}°`
                : `Elbows overtucked: ${flare.maxDeg.toFixed(1)}°`,
            value: flare.maxDeg,
            threshold:
              flare.maxDeg > ELBOW_FLARE_MAX_FAULT_DEG
                ? ELBOW_FLARE_MAX_FAULT_DEG
                : ELBOW_FLARE_MIN_FAULT_DEG,
          });
        }
      }

      const pause = assessPauseQuality({ repPath, fps });
      pauseDurationSec = pause.pauseDurationSec;
      isSinking = pause.isSinking;

      // Front-on-only metrics. Side-view (`sagittalConfidence >= 0.5`)
      // projects the L/R wrists to essentially the same image point, so
      // these readings would be dominated by noise — worse than absent.
      if (sagittalConfidence < MIN_SAGITTAL_CONFIDENCE) {
        const tilt = computeBarTiltSeries({
          frames,
          startFrame: safeStart,
          endFrame: safeEnd,
        });
        if (tilt.framesUsed > 0) {
          barTiltMaxDeg = tilt.maxDeg;
          barTiltMeanDeg = tilt.meanDeg;
          if (tilt.maxDeg > BAR_TILT_FAULT_DEG) {
            faults.push({
              type: 'uneven_lockout',
              severity: 'warning',
              message: `Bar tilts ${tilt.maxDeg.toFixed(1)}° at worst — uneven lockout`,
              value: tilt.maxDeg,
              threshold: BAR_TILT_FAULT_DEG,
            });
          }
        }

        const asymmetry = computePressAsymmetry({
          frames,
          startFrame: safeStart,
          endFrame: safeEnd,
        });
        if (asymmetry.framesUsed > 0) {
          pressAsymmetryRatio = asymmetry.ratio;
          if (asymmetry.ratio > PRESS_ASYMMETRY_FAULT_RATIO) {
            faults.push({
              type: 'press_asymmetry',
              severity: 'warning',
              message: `Uneven press — one wrist trailed by ${(asymmetry.ratio * 100).toFixed(0)}% of torso`,
              value: asymmetry.ratio,
              threshold: PRESS_ASYMMETRY_FAULT_RATIO,
            });
          }
        }

        const elbowSym = computeElbowPathSymmetry({
          frames,
          startFrame: safeStart,
          endFrame: safeEnd,
        });
        if (elbowSym.framesUsed > 0) {
          elbowPathSymmetryRatio = elbowSym.ratio;
          if (
            elbowSym.ratio < ELBOW_PATH_SYMMETRY_MIN ||
            elbowSym.ratio > ELBOW_PATH_SYMMETRY_MAX
          ) {
            faults.push({
              type: 'elbow_asymmetry',
              severity: 'warning',
              message: `Elbows flare unevenly (L/R ratio ${elbowSym.ratio.toFixed(2)})`,
              value: elbowSym.ratio,
              threshold:
                elbowSym.ratio < ELBOW_PATH_SYMMETRY_MIN
                  ? ELBOW_PATH_SYMMETRY_MIN
                  : ELBOW_PATH_SYMMETRY_MAX,
            });
          }
        }
      }
    }

    // Deadlift: hip hinge timing, bar-to-shin distance
    let hipHingeCrossoverPct: number | undefined;
    let barToShinDistanceCm: number | undefined;
    if (lift === 'deadlift') {
      const hinge = analyzeHipHingeTiming({
        frames,
        startFrame: safeStart,
        endFrame: safeEnd,
        fps,
      });
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
      barToShinDistanceCm = computeBarToShinDistance({
        frames,
        startFrame: safeStart,
        endFrame: safeEnd,
      });
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
    const lockoutStabilityCv = computeLockoutStability({
      frames,
      startFrame: safeStart,
      endFrame: safeEnd,
    });
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
      elbowFlareMinDeg,
      elbowFlareMaxDeg,
      elbowFlareMeanDeg,
      pauseDurationSec,
      isSinking,
      barTiltMaxDeg,
      barTiltMeanDeg,
      pressAsymmetryRatio,
      elbowPathSymmetryRatio,
      hipHingeCrossoverPct,
      barToShinDistanceCm,
      lockoutStabilityCv,
      faults,
    };

    // Auto-grade every rep against IPF competition standards
    const verdict = strategy.grader.gradeRep({
      rep: repAnalysis,
      frames,
      fps,
      lift,
    });

    return { ...repAnalysis, verdict };
  });

  // Compute velocity loss % and estimated RiR across all reps
  const velocities = reps.map((r) => r.meanConcentricVelocityCmS ?? null);
  const velocityLosses = computeVelocityLoss({ velocities });

  const repsWithVelocity = reps.map((r, i) => ({
    ...r,
    velocityLossPct:
      velocityLosses[i] != null
        ? Math.round(velocityLosses[i]! * 10) / 10
        : undefined,
    estimatedRir:
      estimateRirFromVelocityLoss({
        velocityLossPct: velocityLosses[i],
      }) ?? undefined,
  }));

  // Cross-rep fatigue analysis (needs ≥2 reps with metrics)
  const fatigueSignatures =
    computeFatigueSignatures({ reps: repsWithVelocity }) ?? undefined;

  return {
    reps: repsWithVelocity,
    fps,
    cameraAngle,
    sagittalConfidence,
    analysisVersion: ANALYSIS_VERSION,
    fatigueSignatures,
  } satisfies VideoAnalysisResult;
}
