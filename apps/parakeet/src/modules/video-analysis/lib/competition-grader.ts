import type { RepAnalysis, BarPathPoint } from '@parakeet/shared-types';

import { computeElbowAngle, computeHipAngle, computeKneeAngle, computeBarVelocity } from './angle-calculator';
import { LANDMARK, type PoseFrame } from './pose-types';

// Approx cm per normalized unit (170cm person filling 70% of frame height)
const CM_PER_UNIT = 243;

export interface CriterionResult {
  name: string;
  verdict: 'pass' | 'borderline' | 'fail';
  measured: number;
  threshold: number;
  unit: string;
  message: string;
}

export interface RepVerdict {
  verdict: 'white_light' | 'red_light' | 'borderline';
  criteria: CriterionResult[];
}

// --- Squat ---

function gradeSquatDepth({ rep }: { rep: RepAnalysis }) {
  const depth = rep.maxDepthCm ?? 0;
  // Negative = below parallel (pass), positive = above (fail)
  let verdict: CriterionResult['verdict'];
  if (depth <= -2) verdict = 'pass';
  else if (depth <= 0) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'depth',
    verdict,
    measured: depth,
    threshold: 0,
    unit: 'cm',
    message: verdict === 'pass'
      ? `${Math.abs(depth).toFixed(1)}cm below parallel`
      : verdict === 'borderline'
        ? `Borderline depth (${Math.abs(depth).toFixed(1)}cm)`
        : `${depth.toFixed(1)}cm above parallel — would not pass`,
  } satisfies CriterionResult;
}

function gradeSquatLockout({ frames, rep }: { frames: PoseFrame[]; rep: RepAnalysis }) {
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const kneeAngle = computeKneeAngle({ frame: frames[endIdx] });

  let verdict: CriterionResult['verdict'];
  if (kneeAngle >= 175) verdict = 'pass';
  else if (kneeAngle >= 170) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'lockout',
    verdict,
    measured: kneeAngle,
    threshold: 175,
    unit: '°',
    message: verdict === 'pass'
      ? `Knees fully locked (${kneeAngle.toFixed(0)}°)`
      : verdict === 'borderline'
        ? `Knees nearly locked (${kneeAngle.toFixed(0)}°)`
        : `Incomplete lockout (${kneeAngle.toFixed(0)}°) — would not pass`,
  } satisfies CriterionResult;
}

function gradeSquatForwardMotion({ rep }: { rep: RepAnalysis }) {
  // Check bar X drift in the final 20% of the rep
  const path = rep.barPath;
  if (path.length < 5) {
    return { name: 'forward_motion', verdict: 'pass' as const, measured: 0, threshold: 2, unit: 'cm', message: 'Insufficient data' };
  }

  const cutoff = Math.floor(path.length * 0.8);
  const topPath = path.slice(cutoff);
  const startX = topPath[0].x;
  let maxForwardDrift = 0;
  for (const p of topPath) {
    const drift = (p.x - startX) * CM_PER_UNIT;
    if (Math.abs(drift) > Math.abs(maxForwardDrift)) maxForwardDrift = drift;
  }

  const absDrift = Math.abs(maxForwardDrift);
  let verdict: CriterionResult['verdict'];
  if (absDrift < 2) verdict = 'pass';
  else if (absDrift < 4) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'forward_motion',
    verdict,
    measured: absDrift,
    threshold: 2,
    unit: 'cm',
    message: verdict === 'pass'
      ? 'Clean lockout path'
      : `${absDrift.toFixed(1)}cm forward drift at top`,
  } satisfies CriterionResult;
}

export function gradeSquatRep({ rep, frames }: { rep: RepAnalysis; frames: PoseFrame[] }) {
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
    return { name: 'pause', verdict: 'pass' as const, measured: 0, threshold: 0.3, unit: 's', message: 'Insufficient data' };
  }

  const velocities = computeBarVelocity({ barPath: path, fps });
  // Find the longest consecutive run where velocity is near zero (<5 cm/s)
  const STALL_THRESHOLD = 5;
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
  if (stallSeconds >= 0.3) verdict = 'pass';
  else if (stallSeconds >= 0.15) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'pause',
    verdict,
    measured: stallSeconds,
    threshold: 0.3,
    unit: 's',
    message: verdict === 'pass'
      ? `Clear pause (${stallSeconds.toFixed(2)}s)`
      : verdict === 'borderline'
        ? `Short pause (${stallSeconds.toFixed(2)}s) — may not be called`
        : 'No visible pause at chest',
  } satisfies CriterionResult;
}

function gradeBenchLockout({ frames, rep }: { frames: PoseFrame[]; rep: RepAnalysis }) {
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const elbowAngle = computeElbowAngle({ frame: frames[endIdx] });

  let verdict: CriterionResult['verdict'];
  if (elbowAngle >= 170) verdict = 'pass';
  else if (elbowAngle >= 165) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'lockout',
    verdict,
    measured: elbowAngle,
    threshold: 170,
    unit: '°',
    message: verdict === 'pass'
      ? `Elbows fully locked (${elbowAngle.toFixed(0)}°)`
      : verdict === 'borderline'
        ? `Elbows nearly locked (${elbowAngle.toFixed(0)}°)`
        : `Incomplete lockout (${elbowAngle.toFixed(0)}°) — would not pass`,
  } satisfies CriterionResult;
}

function gradeBenchEvenPress({ frames, rep }: { frames: PoseFrame[]; rep: RepAnalysis }) {
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
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
    message: verdict === 'pass'
      ? 'Even press'
      : `${delta.toFixed(1)}cm wrist height difference at lockout`,
  } satisfies CriterionResult;
}

export function gradeBenchRep({ rep, frames, fps }: { rep: RepAnalysis; frames: PoseFrame[]; fps: number }) {
  const criteria = [
    gradeBenchPause({ rep, fps }),
    gradeBenchLockout({ frames, rep }),
    gradeBenchEvenPress({ frames, rep }),
  ];
  return buildVerdict({ criteria });
}

// --- Deadlift ---

function gradeDeadliftHipLockout({ frames, rep }: { frames: PoseFrame[]; rep: RepAnalysis }) {
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const hipAngle = computeHipAngle({ frame: frames[endIdx] });

  let verdict: CriterionResult['verdict'];
  if (hipAngle >= 175) verdict = 'pass';
  else if (hipAngle >= 170) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'hip_lockout',
    verdict,
    measured: hipAngle,
    threshold: 175,
    unit: '°',
    message: verdict === 'pass'
      ? `Hips fully through (${hipAngle.toFixed(0)}°)`
      : verdict === 'borderline'
        ? `Hips nearly locked (${hipAngle.toFixed(0)}°)`
        : `Incomplete hip lockout (${hipAngle.toFixed(0)}°) — would not pass`,
  } satisfies CriterionResult;
}

function gradeDeadliftKneeLockout({ frames, rep }: { frames: PoseFrame[]; rep: RepAnalysis }) {
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const kneeAngle = computeKneeAngle({ frame: frames[endIdx] });

  let verdict: CriterionResult['verdict'];
  if (kneeAngle >= 175) verdict = 'pass';
  else if (kneeAngle >= 170) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'knee_lockout',
    verdict,
    measured: kneeAngle,
    threshold: 175,
    unit: '°',
    message: verdict === 'pass'
      ? `Knees fully locked (${kneeAngle.toFixed(0)}°)`
      : `Knee angle ${kneeAngle.toFixed(0)}° at lockout`,
  } satisfies CriterionResult;
}

function gradeDeadliftDownwardMotion({ rep }: { rep: RepAnalysis }) {
  const path = rep.barPath;
  if (path.length < 5) {
    return { name: 'downward_motion', verdict: 'pass' as const, measured: 0, threshold: 1, unit: 'cm', message: 'Insufficient data' };
  }

  // Find the concentric phase: from bottom (max Y) to end
  let bottomIdx = 0;
  let maxY = -Infinity;
  for (let i = 0; i < path.length; i++) {
    if (path[i].y > maxY) {
      maxY = path[i].y;
      bottomIdx = i;
    }
  }

  // Check for downward motion (increasing Y) during concentric phase
  const concentric = path.slice(bottomIdx);
  let maxDip = 0;
  for (let i = 1; i < concentric.length; i++) {
    const dip = (concentric[i].y - concentric[i - 1].y) * CM_PER_UNIT;
    if (dip > maxDip) maxDip = dip;
  }

  let verdict: CriterionResult['verdict'];
  if (maxDip <= 0) verdict = 'pass';
  else if (maxDip <= 1) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'downward_motion',
    verdict,
    measured: maxDip,
    threshold: 1,
    unit: 'cm',
    message: verdict === 'pass'
      ? 'Smooth pull — no downward motion'
      : `${maxDip.toFixed(1)}cm downward motion during pull`,
  } satisfies CriterionResult;
}

function gradeDeadliftShoulders({ frames, rep }: { frames: PoseFrame[]; rep: RepAnalysis }) {
  const endIdx = Math.min(rep.endFrame, frames.length - 1);
  const frame = frames[endIdx];
  const shoulderX = (frame[LANDMARK.LEFT_SHOULDER].x + frame[LANDMARK.RIGHT_SHOULDER].x) / 2;
  const hipX = (frame[LANDMARK.LEFT_HIP].x + frame[LANDMARK.RIGHT_HIP].x) / 2;
  const deltaCm = (shoulderX - hipX) * CM_PER_UNIT;
  // Negative = shoulders behind hips (good), positive = forward

  let verdict: CriterionResult['verdict'];
  if (deltaCm <= 0) verdict = 'pass';
  else if (deltaCm <= 1) verdict = 'borderline';
  else verdict = 'fail';

  return {
    name: 'shoulders_back',
    verdict,
    measured: deltaCm,
    threshold: 0,
    unit: 'cm',
    message: verdict === 'pass'
      ? 'Shoulders behind hips at lockout'
      : `Shoulders ${deltaCm.toFixed(1)}cm forward of hips`,
  } satisfies CriterionResult;
}

export function gradeDeadliftRep({ rep, frames }: { rep: RepAnalysis; frames: PoseFrame[] }) {
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
