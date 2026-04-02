import type {
  CriterionResult,
  RepAnalysis,
  RepVerdict,
} from '@parakeet/shared-types';

import {
  computeBarVelocity,
  computeElbowAngle,
  computeHipAngle,
  computeKneeAngle,
} from './angle-calculator';
import { CM_PER_UNIT, LANDMARK, type PoseFrame } from './pose-types';

export type { CriterionResult, RepVerdict };

// --- Squat ---

function gradeSquatDepth({ rep }: { rep: RepAnalysis }) {
  // Depth is only measured from side view — undefined means front/diagonal
  // camera where depth can't be assessed. Skip the criterion entirely.
  if (rep.maxDepthCm == null) {
    return {
      name: 'depth',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 0,
      unit: 'cm',
      message: 'Depth not assessable from this camera angle',
    } satisfies CriterionResult;
  }

  const depth = rep.maxDepthCm;
  // Positive = below parallel (pass), negative = above (fail)
  let verdict: CriterionResult['verdict'];
  if (depth >= 2) verdict = 'pass';
  else if (depth >= 0) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'depth',
    verdict,
    measured: depth,
    threshold: 0,
    unit: 'cm',
    message:
      verdict === 'pass'
        ? `${depth.toFixed(1)}cm below parallel`
        : verdict === 'borderline'
          ? `Borderline depth (${depth.toFixed(1)}cm)`
          : `${Math.abs(depth).toFixed(1)}cm above parallel — would not pass`,
  } satisfies CriterionResult;
}

function gradeSquatLockout({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  // Knee angle is only meaningful from side view
  if (rep.kneeAngleDeg == null) {
    return {
      name: 'lockout',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 170,
      unit: '°',
      message: 'Lockout not assessable from this camera angle',
    } satisfies CriterionResult;
  }

  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const kneeAngle = computeKneeAngle({ frame: frames[endIdx] });

  // IPF requires knees locked. 170° is functionally locked — MediaPipe
  // landmark jitter means true lockout rarely reads exactly 180°.
  let verdict: CriterionResult['verdict'];
  if (kneeAngle >= 170) verdict = 'pass';
  else if (kneeAngle >= 165) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'lockout',
    verdict,
    measured: kneeAngle,
    threshold: 170,
    unit: '°',
    message:
      verdict === 'pass'
        ? `Knees fully locked (${kneeAngle.toFixed(0)}°)`
        : verdict === 'borderline'
          ? `Knees nearly locked (${kneeAngle.toFixed(0)}°)`
          : `Incomplete lockout (${kneeAngle.toFixed(0)}°) — would not pass`,
  } satisfies CriterionResult;
}

function gradeSquatForwardMotion({ rep }: { rep: RepAnalysis }) {
  // Check bar path deviation during the final 20% of the rep (ascent to lockout).
  // Uses perpendicular deviation from the ascending path's travel axis, which
  // is camera-angle-invariant — a straight ascent from any camera position
  // reads as zero drift.
  const path = rep.barPath;
  if (path.length < 5) {
    return {
      name: 'forward_motion',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 3,
      unit: 'cm',
      message: 'Insufficient data',
    };
  }

  const cutoff = Math.floor(path.length * 0.8);
  const topPath = path.slice(cutoff);
  if (topPath.length < 2) {
    return {
      name: 'forward_motion',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 3,
      unit: 'cm',
      message: 'Insufficient data',
    };
  }

  // Travel axis of the ascending phase
  const start = topPath[0];
  const end = topPath[topPath.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  let maxDrift = 0;
  if (len > 0.001) {
    const nx = -dy / len;
    const ny = dx / len;
    for (const p of topPath) {
      const perpDist = Math.abs((p.x - start.x) * nx + (p.y - start.y) * ny);
      if (perpDist > maxDrift) maxDrift = perpDist;
    }
  }

  const driftCm = maxDrift * CM_PER_UNIT;
  let verdict: CriterionResult['verdict'];
  if (driftCm < 3) verdict = 'pass';
  else if (driftCm < 6) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'forward_motion',
    verdict,
    measured: driftCm,
    threshold: 3,
    unit: 'cm',
    message:
      verdict === 'pass'
        ? 'Clean lockout path'
        : `${driftCm.toFixed(1)}cm path deviation at top`,
  } satisfies CriterionResult;
}

export function gradeSquatRep({
  rep,
  frames,
}: {
  rep: RepAnalysis;
  frames: PoseFrame[];
}) {
  const criteria = [
    gradeSquatDepth({ rep }),
    gradeSquatLockout({ frames, rep }),
    gradeSquatForwardMotion({ rep }),
  ];
  return buildVerdict({ criteria });
}

// --- Bench ---

function gradeBenchPause({ rep, fps }: { rep: RepAnalysis; fps: number }) {
  const path = rep.barPath;
  if (path.length < 3) {
    return {
      name: 'pause',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 0.2,
      unit: 's',
      message: 'Insufficient data',
    };
  }

  const velocities = computeBarVelocity({ barPath: path, fps });
  // At low fps (4fps), velocity between frames is noisy. Use a higher stall
  // threshold and count even single frames as a pause — a 250ms pause is
  // exactly 1 frame at 4fps.
  const STALL_THRESHOLD = fps <= 8 ? 15 : 5; // cm/s — more tolerant at low fps
  let maxStallFrames = 0;
  let currentStall = 0;
  for (const v of velocities) {
    if (Math.abs(v) < STALL_THRESHOLD) {
      currentStall++;
      if (currentStall > maxStallFrames) maxStallFrames = currentStall;
    } else {
      currentStall = 0;
    }
  }
  const stallSeconds = maxStallFrames / fps;

  let verdict: CriterionResult['verdict'];
  if (stallSeconds >= 0.2) verdict = 'pass';
  else if (stallSeconds >= 0.1) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'pause',
    verdict,
    measured: stallSeconds,
    threshold: 0.2,
    unit: 's',
    message:
      verdict === 'pass'
        ? `Clear pause (${stallSeconds.toFixed(2)}s)`
        : verdict === 'borderline'
          ? `Short pause (${stallSeconds.toFixed(2)}s) — may not be called`
          : 'No visible pause at chest',
  } satisfies CriterionResult;
}

function gradeBenchLockout({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  // Find the lockout frame: lowest wrist Y (bar at highest point)
  const startIdx = Math.max(rep.startFrame, 0);
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  let lockoutIdx = endIdx;
  let lowestWristY = Infinity;
  for (let i = startIdx; i <= endIdx; i++) {
    const wristY =
      (frames[i][LANDMARK.LEFT_WRIST].y + frames[i][LANDMARK.RIGHT_WRIST].y) /
      2;
    if (wristY < lowestWristY) {
      lowestWristY = wristY;
      lockoutIdx = i;
    }
  }

  const elbowAngle = computeElbowAngle({ frame: frames[lockoutIdx] });

  // MediaPipe elbow landmark reads ~10° below anatomical angle.
  let verdict: CriterionResult['verdict'];
  if (elbowAngle >= 155) verdict = 'pass';
  else if (elbowAngle >= 145) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'lockout',
    verdict,
    measured: elbowAngle,
    threshold: 155,
    unit: '°',
    message:
      verdict === 'pass'
        ? `Elbows fully locked (${elbowAngle.toFixed(0)}°)`
        : verdict === 'borderline'
          ? `Elbows nearly locked (${elbowAngle.toFixed(0)}°)`
          : `Incomplete lockout (${elbowAngle.toFixed(0)}°) — would not pass`,
  } satisfies CriterionResult;
}

function gradeBenchEvenPress({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  // Even press is only meaningful from front view — from the side, perspective
  // makes one wrist appear higher than the other even when the bar is level.
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const ls = frames[endIdx][LANDMARK.LEFT_SHOULDER];
  const rs = frames[endIdx][LANDMARK.RIGHT_SHOULDER];
  if (Math.abs(ls.x - rs.x) < 0.15) {
    return {
      name: 'even_press',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 2,
      unit: 'cm',
      message: 'Even press not assessable from this camera angle',
    } satisfies CriterionResult;
  }

  const frame = frames[endIdx];
  const lw = frame[LANDMARK.LEFT_WRIST];
  const rw = frame[LANDMARK.RIGHT_WRIST];
  const delta = Math.abs(lw.y - rw.y) * CM_PER_UNIT;

  let verdict: CriterionResult['verdict'];
  if (delta < 2) verdict = 'pass';
  else if (delta < 4) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'even_press',
    verdict,
    measured: delta,
    threshold: 2,
    unit: 'cm',
    message:
      verdict === 'pass'
        ? 'Even press'
        : `${delta.toFixed(1)}cm wrist height difference at lockout`,
  } satisfies CriterionResult;
}

export function gradeBenchRep({
  rep,
  frames,
  fps,
}: {
  rep: RepAnalysis;
  frames: PoseFrame[];
  fps: number;
}) {
  const criteria = [
    gradeBenchPause({ rep, fps }),
    gradeBenchLockout({ frames, rep }),
    gradeBenchEvenPress({ frames, rep }),
  ];
  return buildVerdict({ criteria });
}

// --- Deadlift ---

/**
 * Find the lockout frame — where the bar (wrist Y) is at its highest point
 * (lowest Y value) during the rep. This corresponds to the top of the pull
 * regardless of how upright the lifter stands. Using hip Y fails for lifters
 * who stay bent over at lockout — the bar still reaches its peak.
 */
function findLockoutFrame({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  const startIdx = Math.max(rep.startFrame, 0);
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  let bestIdx = endIdx;
  let lowestWristY = Infinity;
  for (let i = startIdx; i <= endIdx; i++) {
    const lw = frames[i][LANDMARK.LEFT_WRIST];
    const rw = frames[i][LANDMARK.RIGHT_WRIST];
    const wristY = (lw.y + rw.y) / 2;
    if (wristY < lowestWristY) {
      lowestWristY = wristY;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function gradeDeadliftHipLockout({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  const lockoutIdx = findLockoutFrame({ frames, rep });
  const hipAngle = computeHipAngle({ frame: frames[lockoutIdx] });

  // MediaPipe hip landmark is at the ASIS (surface), not the hip joint center.
  // This causes a systematic 10-15° underread vs anatomical angles. A 160°
  // reading from MediaPipe corresponds to ~175° true hip extension.
  let verdict: CriterionResult['verdict'];
  if (hipAngle >= 160) verdict = 'pass';
  else if (hipAngle >= 155) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'hip_lockout',
    verdict,
    measured: hipAngle,
    threshold: 160,
    unit: '°',
    message:
      verdict === 'pass'
        ? `Hips fully through (${hipAngle.toFixed(0)}°)`
        : verdict === 'borderline'
          ? `Hips nearly locked (${hipAngle.toFixed(0)}°)`
          : `Incomplete hip lockout (${hipAngle.toFixed(0)}°) — would not pass`,
  } satisfies CriterionResult;
}

function gradeDeadliftKneeLockout({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  const lockoutIdx = findLockoutFrame({ frames, rep });
  const kneeAngle = computeKneeAngle({ frame: frames[lockoutIdx] });

  let verdict: CriterionResult['verdict'];
  if (kneeAngle >= 160) verdict = 'pass';
  else if (kneeAngle >= 155) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'knee_lockout',
    verdict,
    measured: kneeAngle,
    threshold: 160,
    unit: '°',
    message:
      verdict === 'pass'
        ? `Knees fully locked (${kneeAngle.toFixed(0)}°)`
        : `Knee angle ${kneeAngle.toFixed(0)}° at lockout`,
  } satisfies CriterionResult;
}

function gradeDeadliftDownwardMotion({ rep }: { rep: RepAnalysis }) {
  const path = rep.barPath;
  if (path.length < 5) {
    return {
      name: 'downward_motion',
      verdict: 'pass' as const,
      measured: 0,
      threshold: 3,
      unit: 'cm',
      message: 'Insufficient data',
    };
  }

  // Find the concentric phase: from bottom (max Y) to the lockout point
  // (min Y after bottom). Don't include the descent/lowering phase.
  let bottomIdx = 0;
  let maxY = -Infinity;
  for (let i = 0; i < path.length; i++) {
    if (path[i].y > maxY) {
      maxY = path[i].y;
      bottomIdx = i;
    }
  }

  // Find the lockout point (lowest Y after bottom = highest bar position)
  let lockoutIdx = bottomIdx;
  let minYAfterBottom = Infinity;
  for (let i = bottomIdx; i < path.length; i++) {
    if (path[i].y < minYAfterBottom) {
      minYAfterBottom = path[i].y;
      lockoutIdx = i;
    }
  }

  // Check for downward motion (increasing Y) during concentric phase only
  const concentric = path.slice(bottomIdx, lockoutIdx + 1);
  let maxDip = 0;
  for (let i = 1; i < concentric.length; i++) {
    const dip = (concentric[i].y - concentric[i - 1].y) * CM_PER_UNIT;
    if (dip > maxDip) maxDip = dip;
  }

  // At 4fps, frame-to-frame landmark jitter of 1-2cm is normal.
  // Threshold of 3cm filters noise while catching genuine hitching.
  let verdict: CriterionResult['verdict'];
  if (maxDip <= 3) verdict = 'pass';
  else if (maxDip <= 5) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'downward_motion',
    verdict,
    measured: maxDip,
    threshold: 1,
    unit: 'cm',
    message:
      verdict === 'pass'
        ? 'Smooth pull — no downward motion'
        : `${maxDip.toFixed(1)}cm downward motion during pull`,
  } satisfies CriterionResult;
}

function gradeDeadliftShoulders({
  frames,
  rep,
}: {
  frames: PoseFrame[];
  rep: RepAnalysis;
}) {
  const lockoutIdx = findLockoutFrame({ frames, rep });
  const frame = frames[lockoutIdx];
  const shoulderX =
    (frame[LANDMARK.LEFT_SHOULDER].x + frame[LANDMARK.RIGHT_SHOULDER].x) / 2;
  const hipX = (frame[LANDMARK.LEFT_HIP].x + frame[LANDMARK.RIGHT_HIP].x) / 2;
  const deltaCm = (shoulderX - hipX) * CM_PER_UNIT;
  // Negative = shoulders behind hips (good), positive = forward.
  // Camera angle and landmark noise create ~5cm apparent forward lean
  // even when shoulders are anatomically behind the hips.

  let verdict: CriterionResult['verdict'];
  if (deltaCm <= 5) verdict = 'pass';
  else if (deltaCm <= 8) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'shoulders_back',
    verdict,
    measured: deltaCm,
    threshold: 5,
    unit: 'cm',
    message:
      verdict === 'pass'
        ? 'Shoulders behind hips at lockout'
        : `Shoulders ${deltaCm.toFixed(1)}cm forward of hips`,
  } satisfies CriterionResult;
}

export function gradeDeadliftRep({
  rep,
  frames,
}: {
  rep: RepAnalysis;
  frames: PoseFrame[];
}) {
  const criteria = [
    gradeDeadliftHipLockout({ frames, rep }),
    gradeDeadliftKneeLockout({ frames, rep }),
    gradeDeadliftDownwardMotion({ rep }),
    gradeDeadliftShoulders({ frames, rep }),
  ];
  return buildVerdict({ criteria });
}

// --- Dispatcher ---

/**
 * Grade a single rep against IPF competition standards.
 *
 * Returns a verdict (white_light / red_light / borderline) determined
 * by the worst individual criterion. If any criterion fails, the rep
 * is a red light. If none fail but any are borderline, the rep is borderline.
 */
export function gradeRep({
  rep,
  frames,
  fps,
  lift,
}: {
  rep: RepAnalysis;
  frames: PoseFrame[];
  fps: number;
  lift: 'squat' | 'bench' | 'deadlift';
}) {
  if (lift === 'squat') return gradeSquatRep({ rep, frames });
  if (lift === 'bench') return gradeBenchRep({ rep, frames, fps });
  return gradeDeadliftRep({ rep, frames });
}

// --- Helpers ---

function buildVerdict({ criteria }: { criteria: CriterionResult[] }) {
  const hasFail = criteria.some((c) => c.verdict === 'fail');
  const hasBorderline = criteria.some((c) => c.verdict === 'borderline');

  let verdict: RepVerdict['verdict'];
  if (hasFail) verdict = 'red_light';
  else if (hasBorderline) verdict = 'borderline';
  else verdict = 'white_light';

  return { verdict, criteria } satisfies RepVerdict;
}
