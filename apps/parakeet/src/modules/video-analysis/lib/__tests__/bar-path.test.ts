import { describe, expect, it } from 'vitest';

import { computeBarDrift, extractBarPath, smoothBarPath } from '../bar-path';
import { LANDMARK } from '../pose-types';
import { buildFrame } from './fixtures';

describe('extractBarPath', () => {
  it('returns one point per frame', () => {
    const frames = [
      buildFrame({ [LANDMARK.LEFT_WRIST]: { x: 0.4, y: 0.3, z: 0, visibility: 1 } }),
      buildFrame({ [LANDMARK.LEFT_WRIST]: { x: 0.5, y: 0.4, z: 0, visibility: 1 } }),
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
    const path = Array.from({ length: 20 }, (_, i) => ({ x: 0.5, y: i * 0.01, frame: i }));
    const smoothed = smoothBarPath({ path });
    expect(smoothed).toHaveLength(20);
  });

  it('preserves frame indices', () => {
    const path = Array.from({ length: 5 }, (_, i) => ({ x: 0.5, y: 0.5, frame: i * 2 }));
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
    const path = Array.from({ length: 7 }, (_, i) => ({ x: i * 0.1, y: 0.5, frame: i }));
    const s3 = smoothBarPath({ path, windowSize: 3 });
    const s7 = smoothBarPath({ path, windowSize: 7 });
    // Mid-point of a linear ramp is the same regardless of window
    expect(s3[3].x).toBeCloseTo(0.3, 5);
    expect(s7[3].x).toBeCloseTo(0.3, 5);
  });
});

describe('computeBarDrift', () => {
  it('returns 0 for empty path', () => {
    expect(computeBarDrift({ path: [] })).toBe(0);
  });

  it('returns 0 for a perfectly straight path', () => {
    const path = Array.from({ length: 10 }, (_, i) => ({ x: 0.5, y: i * 0.05, frame: i }));
    expect(computeBarDrift({ path })).toBe(0);
  });

  it('returns maximum absolute deviation from start x', () => {
    const path = [
      { x: 0.5, y: 0.0, frame: 0 },
      { x: 0.52, y: 0.1, frame: 1 },
      { x: 0.54, y: 0.2, frame: 2 }, // max drift = 0.04
      { x: 0.51, y: 0.3, frame: 3 },
    ];
    expect(computeBarDrift({ path })).toBeCloseTo(0.04);
  });

  it('handles drift in the negative direction', () => {
    const path = [
      { x: 0.5, y: 0.0, frame: 0 },
      { x: 0.46, y: 0.1, frame: 1 }, // drift = 0.04
    ];
    expect(computeBarDrift({ path })).toBeCloseTo(0.04);
  });

  it('returns absolute value (always non-negative)', () => {
    const path = [
      { x: 0.6, y: 0, frame: 0 },
      { x: 0.5, y: 0.1, frame: 1 },
    ];
    expect(computeBarDrift({ path })).toBeGreaterThanOrEqual(0);
  });

  it('uses the first point as the reference for drift measurement', () => {
    const path = [
      { x: 0.3, y: 0, frame: 0 }, // start at 0.3
      { x: 0.35, y: 0.1, frame: 1 }, // drift 0.05 from start
      { x: 0.5, y: 0.2, frame: 2 }, // drift 0.2 from start
    ];
    expect(computeBarDrift({ path })).toBeCloseTo(0.2);
  });
});
