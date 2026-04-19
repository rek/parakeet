import { describe, expect, it } from 'vitest';

import { computeChestTouchGap } from '../bench-chest-touch';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

/**
 * Build a bench-like frame. Shoulder at y=0.30, hip at y=0.70
 * (torso length 0.40). Wrist Y configurable — caller passes the
 * bar height they want at that instant. Left/right wrists co-located
 * at the same Y so the midpoint equals wristY.
 */
function makeFrame({
  wristY,
  visibility = 1,
  hipVisibility,
}: {
  wristY: number;
  visibility?: number;
  hipVisibility?: number;
}): PoseFrame {
  const hv = hipVisibility ?? visibility;
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.45, 0.3, visibility);
  frame[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.55, 0.3, visibility);
  frame[LANDMARK.LEFT_WRIST] = makeLandmark(0.4, wristY, visibility);
  frame[LANDMARK.RIGHT_WRIST] = makeLandmark(0.6, wristY, visibility);
  frame[LANDMARK.LEFT_HIP] = makeLandmark(0.47, 0.7, hv);
  frame[LANDMARK.RIGHT_HIP] = makeLandmark(0.53, 0.7, hv);
  return frame;
}

describe('computeChestTouchGap (front view)', () => {
  it('returns gap ≤ 0 when wrists pass shoulder line at the bottom', () => {
    // Descent: wristY rises from 0.1 (locked out, above shoulder) down to
    // 0.32 (just past shoulder line at 0.30). Front view → ref is shoulderY.
    const wristYs = [0.1, 0.15, 0.22, 0.28, 0.32, 0.28, 0.2, 0.1];
    const frames = wristYs.map((y) => makeFrame({ wristY: y }));
    const result = computeChestTouchGap({
      frames,
      startFrame: 0,
      endFrame: frames.length - 1,
      sagittalConfidence: 0.2,
    });
    // deepest frame: wristY=0.32, shoulderY=0.30, torso=0.40
    // gap = (0.30 − 0.32) / 0.40 = −0.05
    expect(result.gap).toBeCloseTo(-0.05, 3);
    expect(result.framesUsed).toBe(frames.length);
  });

  it('returns gap > 0.10 when bar stops well above shoulder line', () => {
    // Bar never gets below y=0.20 — still 0.10 above shoulderY=0.30.
    const wristYs = [0.1, 0.15, 0.18, 0.20, 0.18, 0.15, 0.1];
    const frames = wristYs.map((y) => makeFrame({ wristY: y }));
    const result = computeChestTouchGap({
      frames,
      startFrame: 0,
      endFrame: frames.length - 1,
      sagittalConfidence: 0.2,
    });
    // deepest wristY=0.20, gap = (0.30 − 0.20) / 0.40 = 0.25
    expect(result.gap).toBeCloseTo(0.25, 3);
    expect(result.framesUsed).toBe(frames.length);
  });

  it('flags shallow partials (0.03 < gap ≤ 0.10)', () => {
    // Bar stops at y=0.28 — 0.02 above shoulders.
    // gap = (0.30 − 0.28) / 0.40 = 0.05 → shallow range.
    const wristYs = [0.1, 0.2, 0.25, 0.28, 0.25, 0.2, 0.1];
    const frames = wristYs.map((y) => makeFrame({ wristY: y }));
    const result = computeChestTouchGap({
      frames,
      startFrame: 0,
      endFrame: frames.length - 1,
      sagittalConfidence: 0.2,
    });
    expect(result.gap).toBeGreaterThan(0.03);
    expect(result.gap).toBeLessThanOrEqual(0.1);
  });
});

describe('computeChestTouchGap (side view)', () => {
  it('uses shoulder+0.2*(hip-shoulder) as chest reference', () => {
    // Shoulder Y=0.30, Hip Y=0.70 → chest ref = 0.30 + 0.2*(0.40) = 0.38.
    // Bar stops at y=0.34 → still 0.04 above chest approx.
    // gap = (0.38 − 0.34) / 0.40 = 0.10.
    const wristYs = [0.1, 0.2, 0.3, 0.34, 0.3, 0.2, 0.1];
    const frames = wristYs.map((y) => makeFrame({ wristY: y }));
    const result = computeChestTouchGap({
      frames,
      startFrame: 0,
      endFrame: frames.length - 1,
      sagittalConfidence: 0.9,
    });
    expect(result.gap).toBeCloseTo(0.1, 3);
  });

  it('reports touch when the bar reaches the approximate chest line', () => {
    // Bar reaches y=0.40 → past chest ref 0.38.
    // gap = (0.38 − 0.40) / 0.40 = −0.05.
    const wristYs = [0.1, 0.25, 0.35, 0.4, 0.35, 0.25, 0.1];
    const frames = wristYs.map((y) => makeFrame({ wristY: y }));
    const result = computeChestTouchGap({
      frames,
      startFrame: 0,
      endFrame: frames.length - 1,
      sagittalConfidence: 0.9,
    });
    expect(result.gap).toBeLessThan(0);
  });
});

describe('computeChestTouchGap (edge cases)', () => {
  it('skips frames missing required landmarks', () => {
    const visible = makeFrame({ wristY: 0.32 });
    const bad = makeFrame({ wristY: 0.32, visibility: 0.1 });
    const result = computeChestTouchGap({
      frames: [bad, visible, bad],
      startFrame: 0,
      endFrame: 2,
      sagittalConfidence: 0.2,
    });
    expect(result.framesUsed).toBe(1);
    expect(result.gap).toBeCloseTo(-0.05, 3);
  });

  it('skips frames where hips are invisible even on front view', () => {
    // Front view still needs hips for torso-length normalization.
    const f = makeFrame({ wristY: 0.32, hipVisibility: 0.1 });
    const result = computeChestTouchGap({
      frames: [f],
      startFrame: 0,
      endFrame: 0,
      sagittalConfidence: 0.2,
    });
    expect(result).toEqual({ gap: 0, framesUsed: 0 });
  });

  it('clamps out-of-range frame indices', () => {
    const frames = [makeFrame({ wristY: 0.32 })];
    const result = computeChestTouchGap({
      frames,
      startFrame: -3,
      endFrame: 50,
      sagittalConfidence: 0.2,
    });
    expect(result.framesUsed).toBe(1);
  });

  it('returns zeros when no frames have valid landmarks', () => {
    const bad = makeFrame({ wristY: 0.32, visibility: 0 });
    const result = computeChestTouchGap({
      frames: [bad],
      startFrame: 0,
      endFrame: 0,
      sagittalConfidence: 0.2,
    });
    expect(result).toEqual({ gap: 0, framesUsed: 0 });
  });
});
