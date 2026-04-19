import { describe, expect, it } from 'vitest';

import { computeElbowFlareSeries } from '../elbow-flare-series';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

/**
 * Build a symmetric bench frame with a given flare angle θ (measured from
 * the downward hip direction). Shoulder at (0.5, 0.3), hip at (0.5, 0.6),
 * arm length 0.2. Elbow at (0.5 ± sin(θ)·0.2, 0.3 + cos(θ)·0.2).
 */
function makeFrameWithFlare(deg: number): PoseFrame {
  const rad = (deg * Math.PI) / 180;
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.5, 0.3);
  frame[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.5, 0.3);
  frame[LANDMARK.LEFT_HIP] = makeLandmark(0.5, 0.6);
  frame[LANDMARK.RIGHT_HIP] = makeLandmark(0.5, 0.6);
  frame[LANDMARK.LEFT_ELBOW] = makeLandmark(
    0.5 + Math.sin(rad) * 0.2,
    0.3 + Math.cos(rad) * 0.2
  );
  frame[LANDMARK.RIGHT_ELBOW] = makeLandmark(
    0.5 + Math.sin(rad) * 0.2,
    0.3 + Math.cos(rad) * 0.2
  );
  return frame;
}

describe('computeElbowFlareSeries', () => {
  it('reports min/max/mean across a rep', () => {
    const frames: PoseFrame[] = [
      makeFrameWithFlare(40),
      makeFrameWithFlare(60),
      makeFrameWithFlare(80),
      makeFrameWithFlare(60),
    ];
    const result = computeElbowFlareSeries({
      frames,
      startFrame: 0,
      endFrame: 3,
    });
    expect(result.minDeg).toBeCloseTo(40, 0);
    expect(result.maxDeg).toBeCloseTo(80, 0);
    expect(result.meanDeg).toBeCloseTo(60, 0);
    expect(result.framesUsed).toBe(4);
  });

  it('captures peak flare that a single-frame midpoint would miss', () => {
    // Midpoint of [30, 30, 95, 30, 30] is index 2 — the spike.
    // But if the real rep looked like [30, 95, 30, 30, 30], midpoint
    // misses the spike while series still catches it in `maxDeg`.
    const frames: PoseFrame[] = [
      makeFrameWithFlare(30),
      makeFrameWithFlare(95),
      makeFrameWithFlare(30),
      makeFrameWithFlare(30),
      makeFrameWithFlare(30),
    ];
    const result = computeElbowFlareSeries({
      frames,
      startFrame: 0,
      endFrame: 4,
    });
    expect(result.maxDeg).toBeCloseTo(95, 0);
  });

  it('skips frames with both sides missing', () => {
    const frames: PoseFrame[] = [
      makeFrameWithFlare(40),
      makeFrameWithFlare(60),
    ];
    frames[1][LANDMARK.LEFT_ELBOW].visibility = 0;
    frames[1][LANDMARK.RIGHT_ELBOW].visibility = 0;
    const result = computeElbowFlareSeries({
      frames,
      startFrame: 0,
      endFrame: 1,
    });
    expect(result.framesUsed).toBe(1);
    expect(result.maxDeg).toBeCloseTo(40, 0);
  });

  it('uses whichever side is visible when only one is available', () => {
    const frames: PoseFrame[] = [makeFrameWithFlare(70)];
    frames[0][LANDMARK.LEFT_ELBOW].visibility = 0;
    const result = computeElbowFlareSeries({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result.framesUsed).toBe(1);
    expect(result.maxDeg).toBeCloseTo(70, 0);
  });

  it('returns zeros when no frames are usable', () => {
    const frames: PoseFrame[] = [makeFrameWithFlare(60)];
    frames[0][LANDMARK.LEFT_ELBOW].visibility = 0;
    frames[0][LANDMARK.RIGHT_ELBOW].visibility = 0;
    const result = computeElbowFlareSeries({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result).toEqual({ minDeg: 0, maxDeg: 0, meanDeg: 0, framesUsed: 0 });
  });
});
