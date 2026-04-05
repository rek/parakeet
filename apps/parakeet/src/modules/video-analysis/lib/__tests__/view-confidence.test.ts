import { describe, expect, it } from 'vitest';

import { LANDMARK } from '../pose-types';
import {
  computeSagittalConfidence,
  deriveCameraAngle,
  detectCameraAngle,
} from '../view-confidence';
import { buildFrame } from './fixtures';

describe('computeSagittalConfidence', () => {
  it('returns 0.8 default for empty frames', () => {
    expect(computeSagittalConfidence({ frames: [] })).toBe(0.8);
  });

  it('returns ~1.0 for pure side view (shoulders overlapping in X)', () => {
    const sideFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 1 },
    });
    const result = computeSagittalConfidence({ frames: [sideFrame] });
    expect(result).toBeCloseTo(1.0, 1);
  });

  it('returns ~0.0 for pure front view (shoulders maximally separated)', () => {
    // MAX_SEPARATION = 0.3, so shoulders at 0.35 and 0.65 → separation = 0.3
    const frontFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.35, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.65, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.35, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.65, y: 0.55, z: 0, visibility: 1 },
    });
    const result = computeSagittalConfidence({ frames: [frontFrame] });
    expect(result).toBeCloseTo(0.0, 1);
  });

  it('returns ~0.5 for 45° angle (moderate shoulder separation)', () => {
    // 50% of MAX_SEPARATION = 0.15 → confidence = 1 - 0.15/0.3 = 0.5
    const angledFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.425, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.575, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.425, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.575, y: 0.55, z: 0, visibility: 1 },
    });
    const result = computeSagittalConfidence({ frames: [angledFrame] });
    expect(result).toBeCloseTo(0.5, 1);
  });

  it('falls back to 30% hip weight when shoulders are not visible', () => {
    const hipOnlyFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 0.1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 0.1 },
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 1 },
    });
    // Only hips visible, both at same X → separation = 0 → confidence = 1.0
    const result = computeSagittalConfidence({ frames: [hipOnlyFrame] });
    expect(result).toBeCloseTo(1.0, 1);
  });

  it('returns 0.8 when no landmarks are visible', () => {
    const invisibleFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 0.1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 0.1 },
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 0.1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 0.1 },
    });
    expect(computeSagittalConfidence({ frames: [invisibleFrame] })).toBe(0.8);
  });

  it('samples up to 10 frames from a longer sequence', () => {
    // 20 frames but only first 10 are sampled. First 10 = side view, rest = front.
    // Result should reflect only the side-view frames.
    const sideFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
    });
    const frontFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.35, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.65, y: 0.25, z: 0, visibility: 1 },
    });
    const frames = [
      ...Array.from({ length: 10 }, () => sideFrame),
      ...Array.from({ length: 10 }, () => frontFrame),
    ];
    const result = computeSagittalConfidence({ frames });
    // Only first 10 frames sampled (all side view) → high confidence
    expect(result).toBeGreaterThan(0.8);
  });

  it('clamps result to [0, 1] for extreme separation', () => {
    // Separation beyond MAX_SEPARATION → clamped to 0
    const wideFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.1, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.9, y: 0.25, z: 0, visibility: 1 },
    });
    const result = computeSagittalConfidence({ frames: [wideFrame] });
    expect(result).toBe(0);
  });
});

describe('deriveCameraAngle', () => {
  it('returns "side" when confidence >= 0.5', () => {
    expect(deriveCameraAngle(0.5)).toBe('side');
    expect(deriveCameraAngle(0.8)).toBe('side');
    expect(deriveCameraAngle(1.0)).toBe('side');
  });

  it('returns "front" when confidence < 0.5', () => {
    expect(deriveCameraAngle(0.49)).toBe('front');
    expect(deriveCameraAngle(0.0)).toBe('front');
  });
});

describe('detectCameraAngle (deprecated)', () => {
  it('delegates to computeSagittalConfidence + deriveCameraAngle', () => {
    const sideFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
    });
    expect(detectCameraAngle({ frames: [sideFrame] })).toBe('side');

    const frontFrame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.35, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.65, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.35, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.65, y: 0.55, z: 0, visibility: 1 },
    });
    expect(detectCameraAngle({ frames: [frontFrame] })).toBe('front');
  });
});
