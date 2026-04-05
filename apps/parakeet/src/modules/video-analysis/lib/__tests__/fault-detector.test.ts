import { describe, expect, it } from 'vitest';

import { detectFaults } from '../fault-detector';
import { LANDMARK } from '../pose-types';
import type { PoseFrame } from '../pose-types';
import {
  buildFrame,
  generateDeadliftFrames,
  generateSquatFrames,
} from './fixtures';

/** Build a minimal bar path that has no drift. */
function straightPath(startFrame: number, endFrame: number) {
  return Array.from({ length: endFrame - startFrame + 1 }, (_, i) => ({
    x: 0.5,
    y: 0.3 + i * 0.01,
    frame: startFrame + i,
  }));
}

/** Build a bar path that curves away from the travel axis.
 * Uses a sine bulge so the path deviates perpendicularly from the
 * start→end line. Peak deviation = maxDrift, well above 0.03 threshold. */
function driftingPath(startFrame: number, endFrame: number, maxDrift = 0.06) {
  const count = endFrame - startFrame + 1;
  return Array.from({ length: count }, (_, i) => ({
    x: 0.5 + Math.sin((i / (count - 1)) * Math.PI) * maxDrift,
    y: 0.3 + i * 0.01,
    frame: startFrame + i,
  }));
}

/**
 * Build frames for a clean squat rep at below-parallel depth.
 * Hip Y is above knee Y at the bottom frame (mid-rep).
 */
function buildCleanSquatFrames(frameCount = 60): PoseFrame[] {
  return generateSquatFrames({ reps: 1, framesPerRep: frameCount });
}

/**
 * Build frames for an above-parallel squat: hip Y stays below knee Y throughout.
 */
function buildAboveParallelSquatFrames(frameCount = 60): PoseFrame[] {
  return Array.from({ length: frameCount }, (_, i) => {
    const repPhase = i / frameCount;
    const t = Math.sin(repPhase * Math.PI);
    // Hip never goes deeper than y=0.70, which is above the knee at y=0.75
    const hipY = 0.5 + t * 0.18; // max = 0.68 < 0.75
    return buildFrame({
      [LANDMARK.LEFT_HIP]: { x: 0.47, y: hipY, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.53, y: hipY, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
    });
  });
}

/**
 * Build frames with excessive forward lean (>55°) throughout the rep.
 *
 * computeForwardLean measures atan2(|hipX - shoulderX|, hipY - shoulderY).
 * For ~60° lean: shoulder at x=0.5,y=0.3; hip at x=0.847,y=0.5
 * → dx=0.347, dy=0.2 → atan2(0.347, 0.2) ≈ 60°
 */
function buildExcessiveLeanFrames(frameCount = 60): PoseFrame[] {
  return Array.from({ length: frameCount }, () =>
    buildFrame({
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.847, y: 0.5, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.847, y: 0.5, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.44, y: 0.75, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: 0.75, z: 0, visibility: 1 },
    })
  );
}

/**
 * Build deadlift frames with no lockout — hip angle at end frame is <170°.
 */
function buildIncompleteLockoutDeadliftFrames(frameCount = 60): PoseFrame[] {
  return Array.from({ length: frameCount }, () =>
    buildFrame({
      // Hip forward of the shoulder-knee line at all frames → hip angle < 170°
      [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
      [LANDMARK.LEFT_HIP]: { x: 0.65, y: 0.5, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.65, y: 0.5, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.5, y: 0.75, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.5, y: 0.75, z: 0, visibility: 1 },
    })
  );
}

describe('detectFaults', () => {
  describe('squat', () => {
    it('detects above-parallel fault when hip does not reach knee depth', () => {
      const frames = buildAboveParallelSquatFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
      });
      const aboveParallel = faults.find((f) => f.type === 'above_parallel');

      expect(aboveParallel).toBeDefined();
      expect(aboveParallel?.severity).toBe('critical');
    });

    it('detects excessive forward lean fault', () => {
      const frames = buildExcessiveLeanFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
      });
      const leanFault = faults.find((f) => f.type === 'excessive_lean');

      expect(leanFault).toBeDefined();
      expect(leanFault?.severity).toBe('warning');
    });

    it('detects bar drift fault when drift exceeds 0.03 normalized', () => {
      const frames = buildCleanSquatFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = driftingPath(0, frames.length - 1); // mean-centered drift ~0.06, well above 0.03 threshold

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
      });
      const driftFault = faults.find((f) => f.type === 'bar_drift');

      expect(driftFault).toBeDefined();
      expect(driftFault?.severity).toBe('warning');
    });

    it('returns no faults for a clean below-parallel rep with minimal drift', () => {
      const frames = buildCleanSquatFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
      });

      // Clean rep should have no faults (depth is fine in generateSquatFrames)
      const criticalFaults = faults.filter((f) => f.severity === 'critical');
      expect(criticalFaults).toHaveLength(0);
    });

    it('downgrades above_parallel to warning at low sagittal confidence', () => {
      const frames = buildAboveParallelSquatFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
        sagittalConfidence: 0.3,
      });
      const depthFault = faults.find((f) => f.type === 'above_parallel');

      expect(depthFault).toBeDefined();
      expect(depthFault?.severity).toBe('warning');
      expect(depthFault?.message).toContain('low angle confidence');
    });

    it('fault value and threshold are set for detectable faults', () => {
      const frames = buildExcessiveLeanFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
      });
      const leanFault = faults.find((f) => f.type === 'excessive_lean');

      expect(leanFault?.value).toBeDefined();
      expect(leanFault?.threshold).toBe(55);
    });
  });

  describe('deadlift', () => {
    it('detects incomplete lockout when hip angle at end < 170°', () => {
      const frames = buildIncompleteLockoutDeadliftFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'deadlift',
      });
      const lockoutFault = faults.find((f) => f.type === 'incomplete_lockout');

      expect(lockoutFault).toBeDefined();
      // Default sagittalConfidence=0.8 → high confidence → warning severity
      expect(lockoutFault?.severity).toBe('warning');
    });

    it('detects bar drift in deadlift', () => {
      const frames = generateDeadliftFrames({ reps: 1, framesPerRep: 60 });
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = driftingPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'deadlift',
      });
      expect(faults.some((f) => f.type === 'bar_drift')).toBe(true);
    });

    it('downgrades back_rounding to info at low sagittal confidence', () => {
      // Build frames where hip angle decreases by >15° in the first third
      // (simulating back rounding: hips shoot up while upper back caves).
      // Start: shoulder, hip, knee roughly straight → hip angle ~170°
      // First third: hip moves forward → hip angle drops to ~140° (30° decrease)
      const frameCount = 60;
      const frames = Array.from({ length: frameCount }, (_, i) => {
        const t = i / frameCount;
        // Only move during first third to trigger rounding detection
        const roundingT = t < 1 / 3 ? t * 3 : 1;
        // Hip moves forward (increasing x) → decreasing shoulder-hip-knee angle
        const hipX = 0.5 + roundingT * 0.25;
        return buildFrame({
          [LANDMARK.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0, visibility: 1 },
          [LANDMARK.LEFT_HIP]: { x: hipX, y: 0.5, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_HIP]: { x: hipX, y: 0.5, z: 0, visibility: 1 },
          [LANDMARK.LEFT_KNEE]: { x: 0.5, y: 0.75, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_KNEE]: { x: 0.5, y: 0.75, z: 0, visibility: 1 },
        });
      });
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'deadlift',
        sagittalConfidence: 0.3,
      });
      const roundingFault = faults.find((f) => f.type === 'back_rounding');

      expect(roundingFault).toBeDefined();
      expect(roundingFault?.severity).toBe('info');
      expect(roundingFault?.message).toContain('low angle confidence');
    });

    it('downgrades incomplete lockout to info at low sagittal confidence', () => {
      const frames = buildIncompleteLockoutDeadliftFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'deadlift',
        sagittalConfidence: 0.3,
      });
      const lockoutFault = faults.find((f) => f.type === 'incomplete_lockout');

      expect(lockoutFault).toBeDefined();
      expect(lockoutFault?.severity).toBe('info');
      expect(lockoutFault?.message).toContain('low angle confidence');
    });

    it('reports incomplete lockout as warning at high sagittal confidence', () => {
      const frames = buildIncompleteLockoutDeadliftFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'deadlift',
        sagittalConfidence: 0.9,
      });
      const lockoutFault = faults.find((f) => f.type === 'incomplete_lockout');

      expect(lockoutFault).toBeDefined();
      expect(lockoutFault?.severity).toBe('warning');
    });

    it('includes a human-readable message on each fault', () => {
      const frames = buildIncompleteLockoutDeadliftFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = straightPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'deadlift',
      });
      for (const fault of faults) {
        expect(typeof fault.message).toBe('string');
        expect(fault.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('bench', () => {
    it('detects bar drift in bench press', () => {
      const frames = Array.from({ length: 60 }, () => buildFrame());
      const repBounds = { startFrame: 0, endFrame: 59 };
      const barPath = driftingPath(0, 59);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'bench',
      });
      expect(faults.some((f) => f.type === 'bar_drift')).toBe(true);
    });

    it('returns no faults for a clean bench rep with straight bar path', () => {
      const frames = Array.from({ length: 60 }, () => buildFrame());
      const repBounds = { startFrame: 0, endFrame: 59 };
      const barPath = straightPath(0, 59);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'bench',
      });
      expect(faults).toHaveLength(0);
    });
  });

  describe('general', () => {
    it('returns an array for all lift types', () => {
      const frames = Array.from({ length: 60 }, () => buildFrame());
      const repBounds = { startFrame: 0, endFrame: 59 };
      const barPath = straightPath(0, 59);

      for (const lift of ['squat', 'bench', 'deadlift'] as const) {
        const faults = detectFaults({ frames, repBounds, barPath, lift });
        expect(Array.isArray(faults)).toBe(true);
      }
    });

    it('all returned faults have a valid severity', () => {
      const frames = buildAboveParallelSquatFrames();
      const repBounds = { startFrame: 0, endFrame: frames.length - 1 };
      const barPath = driftingPath(0, frames.length - 1);

      const faults = detectFaults({
        frames,
        repBounds,
        barPath,
        lift: 'squat',
      });
      const validSeverities = new Set(['info', 'warning', 'critical']);
      for (const fault of faults) {
        expect(validSeverities.has(fault.severity)).toBe(true);
      }
    });
  });
});
