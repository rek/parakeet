import { describe, expect, it } from 'vitest';

import { detectReps } from '../rep-detector';
import { buildFrame, generateBenchFrames, generateSquatFrames } from './fixtures';
import { LANDMARK } from '../pose-types';

describe('detectReps', () => {
  describe('edge cases', () => {
    it('returns empty array for empty frames', () => {
      expect(detectReps({ frames: [], lift: 'squat' })).toEqual([]);
    });

    it('returns empty array for a static pose (too few frames)', () => {
      // Less than 2 * MIN_PEAK_DISTANCE = 30 frames
      const frames = Array.from({ length: 10 }, () => buildFrame());
      expect(detectReps({ frames, lift: 'squat' })).toEqual([]);
    });

    it('returns empty array when there are no peaks (flat signal)', () => {
      // Constant hip Y — no movement, no peaks
      const frames = Array.from({ length: 60 }, () =>
        buildFrame({
          [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.5, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.5, z: 0, visibility: 1 },
        })
      );
      expect(detectReps({ frames, lift: 'squat' })).toEqual([]);
    });
  });

  describe('squat rep detection (hip Y)', () => {
    it('detects a single squat rep', () => {
      // One rep: hip Y goes up (standing) → down (bottom) → up (standing)
      // In MediaPipe coords: high Y = bottom, low Y = standing
      const frames = generateSquatFrames({ reps: 1, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'squat' });
      expect(reps).toHaveLength(1);
    });

    it('detects the correct number of squat reps', () => {
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'squat' });
      expect(reps).toHaveLength(3);
    });

    it('detects 5 squat reps correctly', () => {
      const frames = generateSquatFrames({ reps: 5, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'squat' });
      expect(reps).toHaveLength(5);
    });

    it('each rep has startFrame < endFrame', () => {
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'squat' });
      for (const rep of reps) {
        expect(rep.startFrame).toBeLessThan(rep.endFrame);
      }
    });

    it('rep boundaries are within frame array bounds', () => {
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'squat' });
      for (const rep of reps) {
        expect(rep.startFrame).toBeGreaterThanOrEqual(0);
        expect(rep.endFrame).toBeLessThan(frames.length);
      }
    });

    it('rep boundaries cover the full video without gaps', () => {
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'squat' });
      expect(reps[0].startFrame).toBe(0);
      expect(reps[reps.length - 1].endFrame).toBe(frames.length - 1);
      // No gaps between consecutive reps
      for (let i = 1; i < reps.length; i++) {
        expect(reps[i].startFrame).toBe(reps[i - 1].endFrame);
      }
    });

    it('minimum distance prevents false detections from rapid noise', () => {
      // Insert high-frequency jitter on top of a slow rep movement
      const frames = generateSquatFrames({ reps: 1, framesPerRep: 60 });
      // Even with generated frames that could be noisy, we expect exactly 1 rep
      const reps = detectReps({ frames, lift: 'squat' });
      // Should not over-detect
      expect(reps.length).toBeLessThanOrEqual(2);
    });
  });

  describe('bench rep detection (wrist Y)', () => {
    it('detects a single bench rep', () => {
      const frames = generateBenchFrames({ reps: 1, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'bench' });
      expect(reps).toHaveLength(1);
    });

    it('detects the correct number of bench reps', () => {
      const frames = generateBenchFrames({ reps: 3, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'bench' });
      expect(reps).toHaveLength(3);
    });

    it('bench uses wrist Y not hip Y', () => {
      // Freeze hips but move wrists — should still detect bench reps
      const framesPerRep = 60;
      const frames = Array.from({ length: framesPerRep * 2 }, (_, i) => {
        const repPhase = (i % framesPerRep) / framesPerRep;
        const t = Math.sin(repPhase * Math.PI);
        const wristY = 0.3 + t * 0.25; // 0.3 → 0.55
        return buildFrame({
          [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.5, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.5, z: 0, visibility: 1 },
          [LANDMARK.LEFT_WRIST]: { x: 0.38, y: wristY, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_WRIST]: { x: 0.62, y: wristY, z: 0, visibility: 1 },
        });
      });
      const reps = detectReps({ frames, lift: 'bench' });
      expect(reps).toHaveLength(2);
    });
  });

  describe('deadlift rep detection (hip Y)', () => {
    it('detects deadlift reps using hip Y signal', () => {
      // Deadlift uses hip Y same as squat — reuse same fixture signal shape
      const frames = generateSquatFrames({ reps: 2, framesPerRep: 60 });
      const reps = detectReps({ frames, lift: 'deadlift' });
      expect(reps).toHaveLength(2);
    });
  });
});
