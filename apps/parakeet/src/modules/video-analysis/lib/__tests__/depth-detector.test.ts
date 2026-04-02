import { describe, expect, it } from 'vitest';

import { detectSquatDepth } from '../depth-detector';
import { LANDMARK } from '../pose-types';
import { buildFrame } from './fixtures';

const CM_PER_UNIT = 243;

describe('detectSquatDepth', () => {
  describe('below parallel', () => {
    it('returns belowParallel=true when hip Y > knee Y', () => {
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { belowParallel } = detectSquatDepth({ frame });
      expect(belowParallel).toBe(true);
    });

    it('returns positive depthCm when below parallel', () => {
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { depthCm } = detectSquatDepth({ frame });
      expect(depthCm).toBeGreaterThan(0);
    });

    it('computes correct depthCm from normalized difference', () => {
      // Hip at 0.80, knee at 0.75 → Δ=0.05 → 0.05 * 243 ≈ 12.15cm
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { depthCm } = detectSquatDepth({ frame });
      expect(depthCm).toBeCloseTo(0.05 * CM_PER_UNIT, 1);
    });
  });

  describe('above parallel', () => {
    it('returns belowParallel=false when hip Y < knee Y', () => {
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.6, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.6, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { belowParallel } = detectSquatDepth({ frame });
      expect(belowParallel).toBe(false);
    });

    it('returns negative depthCm when above parallel', () => {
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.6, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.6, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { depthCm } = detectSquatDepth({ frame });
      expect(depthCm).toBeLessThan(0);
    });

    it('computes correct negative depthCm', () => {
      // Hip at 0.60, knee at 0.75 → Δ = -0.15 → -0.15 * 243 ≈ -36.45cm
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.6, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.6, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { depthCm } = detectSquatDepth({ frame });
      expect(depthCm).toBeCloseTo(-0.15 * CM_PER_UNIT, 1);
    });
  });

  describe('at parallel', () => {
    it('returns belowParallel=false when hip Y = knee Y (exactly at parallel)', () => {
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { belowParallel, depthCm } = detectSquatDepth({ frame });
      expect(belowParallel).toBe(false);
      expect(depthCm).toBeCloseTo(0, 5);
    });

    it('returns approximately zero depthCm near parallel', () => {
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.751, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.751, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
      });
      const { depthCm } = detectSquatDepth({ frame });
      expect(Math.abs(depthCm)).toBeLessThan(1);
    });
  });

  describe('averaging', () => {
    it('averages left and right hip Y', () => {
      // Left hip at 0.80, right hip at 0.70 → average 0.75
      // Left knee at 0.74, right knee at 0.76 → average 0.75
      // exactly at parallel → depthCm ≈ 0
      const frame = buildFrame({
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.8, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.7, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.74, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.76, z: 0, visibility: 1 },
      });
      const { depthCm } = detectSquatDepth({ frame });
      expect(Math.abs(depthCm)).toBeLessThan(0.1);
    });
  });
});
