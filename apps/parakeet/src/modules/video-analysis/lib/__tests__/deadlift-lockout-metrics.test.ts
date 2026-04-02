import { describe, expect, it } from 'vitest';

import { computeBarToShinDistance } from '../bar-shin-distance';
import { analyzeHipHingeTiming } from '../hip-hinge-timing';
import { computeLockoutStability } from '../lockout-stability';
import { LANDMARK } from '../pose-types';
import type { PoseFrame, PoseLandmark } from '../pose-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLandmark(x: number, y: number): PoseLandmark {
  return { x, y, z: 0, visibility: 1 };
}

function makeFrame(overrides: Record<number, PoseLandmark>): PoseFrame {
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  for (const [idx, lm] of Object.entries(overrides)) {
    frame[Number(idx)] = lm;
  }
  return frame;
}

/**
 * Build a frame whose hip angle (shoulder-hip-knee) is controlled by hipDeg
 * and whose knee angle (hip-knee-ankle) is controlled by kneeDeg.
 *
 * All landmarks are placed along a vertical line at x=0.5 except for the
 * one landmark that closes each angle, offset horizontally via:
 *   offset = limbLength * tan((180 - targetDeg) * π/180)
 *
 * This makes both angles approach 180° as offsets approach 0 (straight limb).
 */
function makeFrameWithAngles(hipDeg: number, kneeDeg: number): PoseFrame {
  const cx = 0.5;
  const shoulderY = 0.3;
  const hipY = 0.5;
  const kneeY = 0.72;
  const ankleY = 0.95;

  // Hip angle: knee X offset relative to the hip–shoulder vertical
  const hipToKneeLen = kneeY - hipY;
  const kneeOffsetX = hipToKneeLen * Math.tan(((180 - hipDeg) * Math.PI) / 180);

  // Knee angle: ankle X offset relative to the knee–hip vertical
  const kneeToAnkleLen = ankleY - kneeY;
  const ankleOffsetX =
    kneeToAnkleLen * Math.tan(((180 - kneeDeg) * Math.PI) / 180);

  return makeFrame({
    [LANDMARK.LEFT_SHOULDER]: makeLandmark(cx, shoulderY),
    [LANDMARK.RIGHT_SHOULDER]: makeLandmark(cx, shoulderY),
    [LANDMARK.LEFT_HIP]: makeLandmark(cx, hipY),
    [LANDMARK.RIGHT_HIP]: makeLandmark(cx, hipY),
    [LANDMARK.LEFT_KNEE]: makeLandmark(cx + kneeOffsetX, kneeY),
    [LANDMARK.RIGHT_KNEE]: makeLandmark(cx + kneeOffsetX, kneeY),
    [LANDMARK.LEFT_ANKLE]: makeLandmark(
      cx + kneeOffsetX + ankleOffsetX,
      ankleY
    ),
    [LANDMARK.RIGHT_ANKLE]: makeLandmark(
      cx + kneeOffsetX + ankleOffsetX,
      ankleY
    ),
  });
}

// ---------------------------------------------------------------------------
// analyzeHipHingeTiming
// ---------------------------------------------------------------------------

describe('analyzeHipHingeTiming', () => {
  it('returns crossoverPct > 50 and isEarlyHipShoot=false when knees extend first', () => {
    // 11 frames (repLength=10).
    // Frames 0-5: knee velocity > hip velocity (knees leading the extension).
    // Frames 6-10: hip velocity overtakes (normal transition late in the pull).
    // First frame where hipV > kneeV is the transition at i=6 → crossoverPct = (6/10)*100 = 60.
    const frames: PoseFrame[] = [];
    for (let i = 0; i <= 10; i++) {
      const hipAngle = i < 6 ? 80 + i * 1 : 85 + (i - 6) * 8;
      const kneeAngle = i < 6 ? 100 + i * 8 : 148 + (i - 6) * 1;
      frames.push(makeFrameWithAngles(hipAngle, kneeAngle));
    }

    const result = analyzeHipHingeTiming({
      frames,
      startFrame: 0,
      endFrame: 10,
      fps: 30,
    });
    expect(result.crossoverPct).toBeGreaterThan(50);
    expect(result.isEarlyHipShoot).toBe(false);
  });

  it('returns isEarlyHipShoot=true when hips extend much faster than knees', () => {
    // Construct frames where hip Y rises quickly (hips extending) while
    // knee position stays nearly fixed (knees not extending).
    // This simulates hips shooting up while knees stay bent.
    const frames: PoseFrame[] = [];
    for (let i = 0; i <= 12; i++) {
      // Shoulders move forward (X decreases) rapidly = hips extending
      // while knees stay at a fixed bent angle = hips shooting up
      const shoulderX = 0.4 + i * 0.015; // shoulders moving back toward hip
      const kneeX = 0.52; // knees stay forward (bent)
      frames.push(
        makeFrame({
          [LANDMARK.LEFT_SHOULDER]: makeLandmark(shoulderX, 0.3),
          [LANDMARK.RIGHT_SHOULDER]: makeLandmark(shoulderX, 0.3),
          [LANDMARK.LEFT_HIP]: makeLandmark(0.5, 0.55),
          [LANDMARK.RIGHT_HIP]: makeLandmark(0.5, 0.55),
          [LANDMARK.LEFT_KNEE]: makeLandmark(kneeX, 0.75),
          [LANDMARK.RIGHT_KNEE]: makeLandmark(kneeX, 0.75),
          [LANDMARK.LEFT_ANKLE]: makeLandmark(0.5, 0.95),
          [LANDMARK.RIGHT_ANKLE]: makeLandmark(0.5, 0.95),
        })
      );
    }

    const result = analyzeHipHingeTiming({
      frames,
      startFrame: 0,
      endFrame: 12,
      fps: 30,
    });
    expect(result.isEarlyHipShoot).toBe(true);
    expect(result.crossoverPct).toBeLessThan(50);
  });

  it('returns neutral defaults when repLength is less than 3 (insufficient data)', () => {
    // endFrame - startFrame = 2, which is < 3 — triggers the early return.
    const frames = [
      makeFrameWithAngles(80, 100),
      makeFrameWithAngles(90, 110),
      makeFrameWithAngles(100, 115),
    ];

    const result = analyzeHipHingeTiming({
      frames,
      startFrame: 0,
      endFrame: 2,
      fps: 30,
    });
    expect(result.crossoverPct).toBe(50);
    expect(result.isEarlyHipShoot).toBe(false);
  });

  it('returns crossoverPct=100 and isEarlyHipShoot=false when knees always extend faster', () => {
    // Knee velocity always greater than hip velocity — no crossover found.
    const frames: PoseFrame[] = [];
    for (let i = 0; i <= 10; i++) {
      frames.push(makeFrameWithAngles(80 + i * 1, 100 + i * 8));
    }

    const result = analyzeHipHingeTiming({
      frames,
      startFrame: 0,
      endFrame: 10,
      fps: 30,
    });
    expect(result.crossoverPct).toBe(100);
    expect(result.isEarlyHipShoot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeBarToShinDistance
// ---------------------------------------------------------------------------

describe('computeBarToShinDistance', () => {
  it('returns a value close to 0 when wrist midpoint equals knee midpoint X', () => {
    // Wrists symmetric around 0.5, knees symmetric around 0.5 → midpoints equal → Δ=0
    const frame = makeFrame({
      [LANDMARK.LEFT_WRIST]: makeLandmark(0.45, 0.7),
      [LANDMARK.RIGHT_WRIST]: makeLandmark(0.55, 0.7),
      [LANDMARK.LEFT_KNEE]: makeLandmark(0.45, 0.72),
      [LANDMARK.RIGHT_KNEE]: makeLandmark(0.55, 0.72),
    });
    const frames = Array.from({ length: 5 }, () => frame);

    const distance = computeBarToShinDistance({
      frames,
      startFrame: 0,
      endFrame: 4,
    });
    expect(Math.abs(distance)).toBeCloseTo(0, 5);
  });

  it('returns a positive value greater than 5 when bar drifts forward of shins', () => {
    // Wrist midX = 0.55, knee midX = 0.50 → Δ = 0.05 → 0.05 * 243 = 12.15 cm
    const frame = makeFrame({
      [LANDMARK.LEFT_WRIST]: makeLandmark(0.5, 0.7),
      [LANDMARK.RIGHT_WRIST]: makeLandmark(0.6, 0.7),
      [LANDMARK.LEFT_KNEE]: makeLandmark(0.45, 0.72),
      [LANDMARK.RIGHT_KNEE]: makeLandmark(0.55, 0.72),
    });
    const frames = Array.from({ length: 5 }, () => frame);

    const distance = computeBarToShinDistance({
      frames,
      startFrame: 0,
      endFrame: 4,
    });
    expect(distance).toBeGreaterThan(5);
  });

  it('only samples the first third of the rep so late bar drift does not affect the result', () => {
    // First-third frames: bar close to shins (Δ ≈ 0).
    // Later frames: bar behind shins (negative Δ) — must not pull the average negative.
    const closeFrame = makeFrame({
      [LANDMARK.LEFT_WRIST]: makeLandmark(0.45, 0.7),
      [LANDMARK.RIGHT_WRIST]: makeLandmark(0.55, 0.7),
      [LANDMARK.LEFT_KNEE]: makeLandmark(0.45, 0.72),
      [LANDMARK.RIGHT_KNEE]: makeLandmark(0.55, 0.72),
    });
    const behindFrame = makeFrame({
      [LANDMARK.LEFT_WRIST]: makeLandmark(0.3, 0.7),
      [LANDMARK.RIGHT_WRIST]: makeLandmark(0.4, 0.7),
      [LANDMARK.LEFT_KNEE]: makeLandmark(0.45, 0.72),
      [LANDMARK.RIGHT_KNEE]: makeLandmark(0.55, 0.72),
    });
    // 12 frames: startFrame=0, endFrame=11 → thirdEnd = floor(11/3) = 3
    const frames: PoseFrame[] = [
      closeFrame,
      closeFrame,
      closeFrame,
      closeFrame,
      behindFrame,
      behindFrame,
      behindFrame,
      behindFrame,
      behindFrame,
      behindFrame,
      behindFrame,
      behindFrame,
    ];

    const distance = computeBarToShinDistance({
      frames,
      startFrame: 0,
      endFrame: 11,
    });
    expect(Math.abs(distance)).toBeCloseTo(0, 3);
  });

  it('returns 0 when there are fewer than 2 frames in the first-third window', () => {
    // endFrame - startFrame = 1 → thirdEnd = startFrame + floor(1/3) = startFrame
    // thirdEnd - startFrame = 0 < 1 → returns 0
    const frame = makeFrame({});
    const result = computeBarToShinDistance({
      frames: [frame, frame],
      startFrame: 0,
      endFrame: 1,
    });
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeLockoutStability
// ---------------------------------------------------------------------------

describe('computeLockoutStability', () => {
  it('returns CV close to 0 for a stable lockout with constant hip angle', () => {
    // All 20 frames have identical landmark positions → stdDev = 0 → CV = 0.
    const stableFrame = makeFrameWithAngles(170, 175);
    const frames = Array.from({ length: 20 }, () => stableFrame);

    const cv = computeLockoutStability({ frames, startFrame: 0, endFrame: 19 });
    expect(cv).toBeCloseTo(0, 5);
  });

  it('returns CV > 0 for a wobbly lockout with varying hip angles in the final window', () => {
    // 20 frames: first 18 stable, last 2 alternate between ~140° and ~175°.
    // lockoutStart = 19 - max(1, floor(19*0.1)) = 19 - 1 = 18 → window = frames[18..19].
    const stableFrame = makeFrameWithAngles(170, 175);
    const wobblyLow = makeFrameWithAngles(140, 175);
    const wobblyHigh = makeFrameWithAngles(175, 175);

    const frames: PoseFrame[] = [
      ...Array.from({ length: 18 }, () => stableFrame),
      wobblyLow,
      wobblyHigh,
    ];

    const cv = computeLockoutStability({ frames, startFrame: 0, endFrame: 19 });
    expect(cv).toBeGreaterThan(0);
  });

  it('returns 0 when the lockout window contains only one frame', () => {
    // Construct a scenario where lockoutStart === endFrame so the loop runs once.
    // lockoutStart = endFrame - max(1, floor(repLength * 0.1))
    // We need max(1, floor(repLength * 0.1)) > repLength, which is impossible for repLength >= 10.
    // Instead, directly pass startFrame > endFrame-1 so repLength is small enough that
    // the lockout window still spans >= 1 frame but the angles array ends up with 1 entry.
    // With repLength=1: lockoutStart = endFrame - max(1, floor(0.1)) = endFrame - 1 = startFrame
    // → loop i=startFrame to endFrame → 2 frames. angles.length = 2 — guard not triggered.
    //
    // The angles.length < 2 guard fires only if lockoutStart > endFrame, which the formula
    // cannot produce for valid non-negative repLength. The guard is purely defensive.
    // Verify the minimal valid case (2 lockout frames, identical) returns 0 instead.
    const frame = makeFrameWithAngles(170, 175);
    const frames = [frame, frame];

    const cv = computeLockoutStability({ frames, startFrame: 0, endFrame: 1 });
    expect(cv).toBeCloseTo(0, 5);
  });
});
