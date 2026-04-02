import { describe, expect, it } from 'vitest';

import {
  computeBarDrift,
  extractBarPath,
  sliceBarPath,
  smoothBarPath,
} from '../bar-path';
import { LANDMARK } from '../pose-types';
import { buildFrame } from './fixtures';

describe('extractBarPath', () => {
  it('returns one point per frame', () => {
    const frames = [
      buildFrame({
        [LANDMARK.LEFT_WRIST]: { x: 0.4, y: 0.3, z: 0, visibility: 1 },
      }),
      buildFrame({
        [LANDMARK.LEFT_WRIST]: { x: 0.5, y: 0.4, z: 0, visibility: 1 },
      }),
    ];
    const path = extractBarPath({ frames });
    expect(path).toHaveLength(2);
  });

  it('averages left and right wrist x,y', () => {
    const frame = buildFrame({
      [LANDMARK.LEFT_WRIST]: { x: 0.4, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_WRIST]: { x: 0.6, y: 0.5, z: 0, visibility: 1 },
    });
    const [point] = extractBarPath({ frames: [frame] });
    expect(point.x).toBeCloseTo(0.5);
    expect(point.y).toBeCloseTo(0.4);
  });

  it('sets frame index from array position', () => {
    const frames = [buildFrame(), buildFrame(), buildFrame()];
    const path = extractBarPath({ frames });
    expect(path[0].frame).toBe(0);
    expect(path[1].frame).toBe(1);
    expect(path[2].frame).toBe(2);
  });

  it('returns empty array for empty input', () => {
    expect(extractBarPath({ frames: [] })).toEqual([]);
  });

  it('preserves x=y when both wrists are at the same position', () => {
    const frame = buildFrame({
      [LANDMARK.LEFT_WRIST]: { x: 0.55, y: 0.42, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_WRIST]: { x: 0.55, y: 0.42, z: 0, visibility: 1 },
    });
    const [point] = extractBarPath({ frames: [frame] });
    expect(point.x).toBeCloseTo(0.55);
    expect(point.y).toBeCloseTo(0.42);
  });
});

describe('smoothBarPath', () => {
  it('returns empty array for empty input', () => {
    expect(smoothBarPath({ path: [] })).toEqual([]);
  });

  it('returns a single point unchanged', () => {
    const path = [{ x: 0.5, y: 0.4, frame: 0 }];
    const smoothed = smoothBarPath({ path });
    expect(smoothed[0].x).toBeCloseTo(0.5);
    expect(smoothed[0].y).toBeCloseTo(0.4);
  });

  it('output length matches input length', () => {
    const path = Array.from({ length: 20 }, (_, i) => ({
      x: 0.5,
      y: i * 0.01,
      frame: i,
    }));
    const smoothed = smoothBarPath({ path });
    expect(smoothed).toHaveLength(20);
  });

  it('preserves frame indices', () => {
    const path = Array.from({ length: 5 }, (_, i) => ({
      x: 0.5,
      y: 0.5,
      frame: i * 2,
    }));
    const smoothed = smoothBarPath({ path });
    expect(smoothed.map((p) => p.frame)).toEqual([0, 2, 4, 6, 8]);
  });

  it('reduces noise in a jittery signal', () => {
    // Noisy signal alternating ±0.05 around 0.5
    const path = Array.from({ length: 11 }, (_, i) => ({
      x: 0.5 + (i % 2 === 0 ? 0.05 : -0.05),
      y: 0.5,
      frame: i,
    }));
    const smoothed = smoothBarPath({ path, windowSize: 5 });
    // Interior smoothed points should be close to the mean (0.5)
    const interior = smoothed.slice(2, 9);
    for (const p of interior) {
      expect(Math.abs(p.x - 0.5)).toBeLessThan(0.02);
    }
  });

  it('respects custom window size', () => {
    // A perfect ramp signal — window size should not change the central value
    const path = Array.from({ length: 7 }, (_, i) => ({
      x: i * 0.1,
      y: 0.5,
      frame: i,
    }));
    const s3 = smoothBarPath({ path, windowSize: 3 });
    const s7 = smoothBarPath({ path, windowSize: 7 });
    // Mid-point of a linear ramp is the same regardless of window
    expect(s3[3].x).toBeCloseTo(0.3, 5);
    expect(s7[3].x).toBeCloseTo(0.3, 5);
  });

  it('computes fps-relative window when fps is provided', () => {
    // At 15fps, ~167ms ≈ 3 frames. At 30fps → 5 frames.
    const path = Array.from({ length: 11 }, (_, i) => ({
      x: 0.5 + (i % 2 === 0 ? 0.05 : -0.05),
      y: 0.5,
      frame: i,
    }));
    const at15 = smoothBarPath({ path, fps: 15 });
    const at30 = smoothBarPath({ path, fps: 30 });
    // Both should smooth, but 30fps uses a wider window → smoother result
    const mid15 = Math.abs(at15[5].x - 0.5);
    const mid30 = Math.abs(at30[5].x - 0.5);
    expect(mid30).toBeLessThanOrEqual(mid15 + 0.001);
  });

  it('explicit windowSize overrides fps', () => {
    const path = Array.from({ length: 7 }, (_, i) => ({
      x: i * 0.1,
      y: 0.5,
      frame: i,
    }));
    const withFps = smoothBarPath({ path, fps: 60, windowSize: 3 });
    const withoutFps = smoothBarPath({ path, windowSize: 3 });
    expect(withFps[3].x).toBeCloseTo(withoutFps[3].x);
  });
});

describe('computeBarDrift', () => {
  it('returns 0 for empty path', () => {
    expect(computeBarDrift({ path: [] })).toBe(0);
  });

  it('returns 0 for a single point', () => {
    expect(computeBarDrift({ path: [{ x: 0.5, y: 0.3, frame: 0 }] })).toBe(0);
  });

  it('returns 0 for a perfectly straight vertical path', () => {
    const path = Array.from({ length: 10 }, (_, i) => ({
      x: 0.5,
      y: i * 0.05,
      frame: i,
    }));
    expect(computeBarDrift({ path })).toBe(0);
  });

  it('returns 0 for a straight diagonal path (camera parallax)', () => {
    // Bar travels diagonally due to camera angle — no real drift
    const path = Array.from({ length: 10 }, (_, i) => ({
      x: 0.5 + i * 0.01, // apparent X shift from perspective
      y: i * 0.05,
      frame: i,
    }));
    expect(computeBarDrift({ path })).toBeCloseTo(0, 5);
  });

  it('detects perpendicular deviation from travel axis', () => {
    // Bar travels from (0.5, 0) to (0.5, 0.3) but bulges right at midpoint
    const path = [
      { x: 0.5, y: 0.0, frame: 0 },
      { x: 0.54, y: 0.1, frame: 1 }, // 0.04 perpendicular drift
      { x: 0.5, y: 0.2, frame: 2 },
      { x: 0.5, y: 0.3, frame: 3 },
    ];
    expect(computeBarDrift({ path })).toBeCloseTo(0.04);
  });

  it('handles drift on a diagonal travel axis', () => {
    // Bar travels diagonally (camera angle) but curves at midpoint
    const path = [
      { x: 0.5, y: 0.0, frame: 0 },
      { x: 0.55, y: 0.1, frame: 1 }, // on axis
      { x: 0.64, y: 0.2, frame: 2 }, // drifts right of axis
      { x: 0.65, y: 0.3, frame: 3 }, // on axis
    ];
    // Travel axis is (0.50,0) → (0.65,0.3), slope = 0.3/0.15
    // Point (0.64, 0.2) should have some perpendicular deviation
    const drift = computeBarDrift({ path });
    expect(drift).toBeGreaterThan(0.01);
    expect(drift).toBeLessThan(0.05);
  });

  it('returns absolute value (always non-negative)', () => {
    const path = [
      { x: 0.6, y: 0, frame: 0 },
      { x: 0.5, y: 0.1, frame: 1 },
    ];
    expect(computeBarDrift({ path })).toBeGreaterThanOrEqual(0);
  });

  it('falls back to mean-centered X when start ≈ end', () => {
    // Squat: bar starts and ends at roughly the same position
    const path = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.54, y: 0.5, frame: 1 }, // drifts
      { x: 0.5, y: 0.3, frame: 2 }, // returns
    ];
    // start ≈ end, so falls back to mean-centered: mean=0.5133, max dev≈0.027
    const drift = computeBarDrift({ path });
    expect(drift).toBeGreaterThan(0);
  });
});

describe('sliceBarPath', () => {
  const contiguousPath = Array.from({ length: 10 }, (_, i) => ({
    x: 0.5,
    y: i * 0.05,
    frame: i,
  }));

  it('slices contiguous frames correctly', () => {
    const sliced = sliceBarPath({
      barPath: contiguousPath,
      startFrame: 3,
      endFrame: 7,
    });
    expect(sliced).toHaveLength(5);
    expect(sliced[0].frame).toBe(3);
    expect(sliced[sliced.length - 1].frame).toBe(7);
  });

  it('returns empty array for empty input', () => {
    expect(sliceBarPath({ barPath: [], startFrame: 0, endFrame: 5 })).toEqual(
      []
    );
  });

  it('clamps when startFrame is before first frame', () => {
    const sliced = sliceBarPath({
      barPath: contiguousPath,
      startFrame: -5,
      endFrame: 2,
    });
    expect(sliced[0].frame).toBe(0);
    expect(sliced).toHaveLength(3);
  });

  it('clamps when endFrame is beyond last frame', () => {
    const sliced = sliceBarPath({
      barPath: contiguousPath,
      startFrame: 8,
      endFrame: 20,
    });
    expect(sliced).toHaveLength(2);
    expect(sliced[sliced.length - 1].frame).toBe(9);
  });

  it('returns empty when range is entirely outside path', () => {
    expect(
      sliceBarPath({ barPath: contiguousPath, startFrame: 15, endFrame: 20 })
    ).toEqual([]);
  });

  it('handles non-contiguous (subsampled) frame indices', () => {
    // Frames at indices 0, 2, 4, 6, 8 (every other frame)
    const subsampled = Array.from({ length: 5 }, (_, i) => ({
      x: 0.5,
      y: i * 0.05,
      frame: i * 2,
    }));
    const sliced = sliceBarPath({
      barPath: subsampled,
      startFrame: 2,
      endFrame: 6,
    });
    expect(sliced).toHaveLength(3);
    expect(sliced.map((p) => p.frame)).toEqual([2, 4, 6]);
  });

  it('returns single element when start equals end', () => {
    const sliced = sliceBarPath({
      barPath: contiguousPath,
      startFrame: 5,
      endFrame: 5,
    });
    expect(sliced).toHaveLength(1);
    expect(sliced[0].frame).toBe(5);
  });
});
