import { describe, expect, it } from 'vitest';

import {
  computeAngle,
  computeForwardLean,
  computeHipAngle,
  computeKneeAngle,
} from '../angle-calculator';
import { LANDMARK } from '../pose-types';
import { buildFrame } from './fixtures';
import type { PoseLandmark } from '../pose-types';

function lm(x: number, y: number): PoseLandmark {
  return { x, y, z: 0, visibility: 1 };
}

describe('computeAngle', () => {
  it('returns 90° for a right angle', () => {
    // b at origin, a directly above, c directly right
    const a = lm(0, 0);
    const b = lm(0, 1); // vertex
    const c = lm(1, 1);
    expect(computeAngle({ a, b, c })).toBeCloseTo(90, 1);
  });

  it('returns 180° for a straight line', () => {
    const a = lm(0, 0);
    const b = lm(1, 0); // vertex on the line
    const c = lm(2, 0);
    expect(computeAngle({ a, b, c })).toBeCloseTo(180, 1);
  });

  it('returns ~60° for an equilateral-triangle configuration', () => {
    // Equilateral triangle: all angles = 60°
    const a = lm(0, 0);
    const b = lm(0.5, Math.sqrt(3) / 2); // vertex
    const c = lm(1, 0);
    expect(computeAngle({ a, b, c })).toBeCloseTo(60, 1);
  });

  it('returns ~45° for a diagonal', () => {
    const a = lm(0, 1);
    const b = lm(0, 0); // vertex at origin
    const c = lm(1, 1);
    expect(computeAngle({ a, b, c })).toBeCloseTo(45, 1);
  });

  it('is symmetric — swapping a and c yields the same angle', () => {
    const a = lm(0.3, 0.1);
    const b = lm(0.5, 0.5);
    const c = lm(0.8, 0.2);
    const ab = computeAngle({ a, b, c });
    const ba = computeAngle({ a: c, b, c: a });
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('always returns a value in [0, 180]', () => {
    const pairs = [
      [lm(0, 0), lm(0.5, 0.5), lm(1, 0)],
      [lm(0.2, 0.8), lm(0.5, 0.3), lm(0.9, 0.7)],
      [lm(0, 1), lm(0, 0), lm(0, -1)],
    ];
    for (const [a, b, c] of pairs) {
      const angle = computeAngle({ a, b, c });
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    }
  });
});

describe('computeForwardLean', () => {
  it('returns ~0° for a perfectly upright torso', () => {
    // Shoulders directly above hips (same x, hip lower y in MediaPipe)
    const frame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.7, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.7, z: 0, visibility: 1 },
    });
    expect(computeForwardLean({ frame })).toBeCloseTo(0, 1);
  });

  it('returns ~45° for a 45-degree forward lean', () => {
    // Hip is as far forward (x) as it is below (y) the shoulder
    // shoulder at (0.5, 0.2), hip at (0.7, 0.4) → dx=0.2, dy=0.2 → atan2(0.2, 0.2)=45°
    const frame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.7, y: 0.4, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.7, y: 0.4, z: 0, visibility: 1 },
    });
    expect(computeForwardLean({ frame })).toBeCloseTo(45, 1);
  });

  it('returns a value between 0 and 90 for typical lifter positions', () => {
    const frames = [
      // Upright
      buildFrame({
        [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
        [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.55, z: 0, visibility: 1 },
      }),
      // 30° lean
      buildFrame({
        [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.25, z: 0, visibility: 1 },
        [LANDMARK.LEFT_HIP]: { x: 0.67, y: 0.54, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.67, y: 0.54, z: 0, visibility: 1 },
      }),
    ];
    for (const frame of frames) {
      const lean = computeForwardLean({ frame });
      expect(lean).toBeGreaterThanOrEqual(0);
      expect(lean).toBeLessThanOrEqual(90);
    }
  });
});

describe('computeHipAngle', () => {
  it('returns ~180° for a fully extended hip (standing)', () => {
    // Shoulder directly above hip, knee directly below hip
    const frame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.5, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.5, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.5, y: 0.8, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.5, y: 0.8, z: 0, visibility: 1 },
    });
    expect(computeHipAngle({ frame })).toBeCloseTo(180, 1);
  });

  it('returns a smaller angle for a flexed hip (squat bottom)', () => {
    // Hip forward of the shoulder-knee line
    const frame = buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.4, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.4, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.7, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.7, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.5, y: 0.85, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.5, y: 0.85, z: 0, visibility: 1 },
    });
    const angle = computeHipAngle({ frame });
    expect(angle).toBeLessThan(180);
    expect(angle).toBeGreaterThan(0);
  });

  it('returns a value in [0, 180]', () => {
    const frame = buildFrame();
    const angle = computeHipAngle({ frame });
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThanOrEqual(180);
  });
});

describe('computeKneeAngle', () => {
  it('returns ~180° for a fully extended knee', () => {
    // Hip, knee, ankle all vertically aligned
    const frame = buildFrame({
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.5, y: 0.6, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.5, y: 0.6, z: 0, visibility: 1 },
      [LANDMARK.LEFT_ANKLE]: { x: 0.5, y: 0.9, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_ANKLE]: { x: 0.5, y: 0.9, z: 0, visibility: 1 },
    });
    expect(computeKneeAngle({ frame })).toBeCloseTo(180, 1);
  });

  it('returns a smaller angle for a flexed knee (squat)', () => {
    // Ankle forward of the hip-knee-ankle line creates flexion
    const frame = buildFrame({
      [LANDMARK.LEFT_HIP]: { x: 0.5, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.5, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.55, y: 0.65, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.55, y: 0.65, z: 0, visibility: 1 },
      [LANDMARK.LEFT_ANKLE]: { x: 0.5, y: 0.9, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_ANKLE]: { x: 0.5, y: 0.9, z: 0, visibility: 1 },
    });
    const angle = computeKneeAngle({ frame });
    expect(angle).toBeLessThan(180);
    expect(angle).toBeGreaterThan(0);
  });

  it('returns a value in [0, 180]', () => {
    const frame = buildFrame();
    const angle = computeKneeAngle({ frame });
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThanOrEqual(180);
  });

  it('averages left and right knee angles', () => {
    // Left knee at 90°, right knee at 180° → average should be ~135°
    const frame = buildFrame({
      // Left side: right-angle knee
      [LANDMARK.LEFT_HIP]: { x: 0.3, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.3, y: 0.6, z: 0, visibility: 1 },
      [LANDMARK.LEFT_ANKLE]: { x: 0.6, y: 0.6, z: 0, visibility: 1 },
      // Right side: straight knee
      [LANDMARK.RIGHT_HIP]: { x: 0.7, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.7, y: 0.6, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_ANKLE]: { x: 0.7, y: 0.9, z: 0, visibility: 1 },
    });
    const angle = computeKneeAngle({ frame });
    expect(angle).toBeCloseTo(135, 0);
  });
});
