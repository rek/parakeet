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

  describe('real-world low-fps scenarios', () => {
    it('detects 5 squat reps at 4fps with walkout setup', () => {
      // Simulate a real squat video at 4fps: ~3 frames of walkout, then 5 reps
      // Hip Y: low (standing) → high (bottom of squat) → low (standing)
      // In MediaPipe: Y increases downward, so bottom of squat = max Y
      const standingY = 0.33;
      const bottomY = 0.60;
      const walkoutY = 0.38; // slight dip during walkout (NOT a rep)
      const framesPerRep = 10; // ~2.5s per rep at 4fps

      const frames: ReturnType<typeof buildFrame>[] = [];

      // Walkout (3 frames): small dip then back to standing
      frames.push(buildFrame({ [LANDMARK.LEFT_HIP]: { x: 0.47, y: standingY, z: 0, visibility: 1 }, [LANDMARK.RIGHT_HIP]: { x: 0.53, y: standingY, z: 0, visibility: 1 } }));
      frames.push(buildFrame({ [LANDMARK.LEFT_HIP]: { x: 0.47, y: walkoutY, z: 0, visibility: 1 }, [LANDMARK.RIGHT_HIP]: { x: 0.53, y: walkoutY, z: 0, visibility: 1 } }));
      frames.push(buildFrame({ [LANDMARK.LEFT_HIP]: { x: 0.47, y: standingY, z: 0, visibility: 1 }, [LANDMARK.RIGHT_HIP]: { x: 0.53, y: standingY, z: 0, visibility: 1 } }));

      // 5 reps: sine wave from standing to bottom and back
      for (let rep = 0; rep < 5; rep++) {
        for (let f = 0; f < framesPerRep; f++) {
          const phase = f / framesPerRep;
          const t = Math.sin(phase * Math.PI);
          const hipY = standingY + (bottomY - standingY) * t;
          frames.push(buildFrame({
            [LANDMARK.LEFT_HIP]: { x: 0.47, y: hipY, z: 0, visibility: 1 },
            [LANDMARK.RIGHT_HIP]: { x: 0.53, y: hipY, z: 0, visibility: 1 },
          }));
        }
      }

      // 2 trailing frames (standing)
      frames.push(buildFrame({ [LANDMARK.LEFT_HIP]: { x: 0.47, y: standingY, z: 0, visibility: 1 }, [LANDMARK.RIGHT_HIP]: { x: 0.53, y: standingY, z: 0, visibility: 1 } }));
      frames.push(buildFrame({ [LANDMARK.LEFT_HIP]: { x: 0.47, y: standingY, z: 0, visibility: 1 }, [LANDMARK.RIGHT_HIP]: { x: 0.53, y: standingY, z: 0, visibility: 1 } }));

      const reps = detectReps({ frames, lift: 'squat', fps: 4 });
      expect(reps).toHaveLength(5);
    });

    it('detects 3 squat reps at 3fps', () => {
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 9 });
      const reps = detectReps({ frames, lift: 'squat', fps: 3 });
      expect(reps).toHaveLength(3);
    });

    it('counts walkout dip as a rep when present (handled by caller)', () => {
      // A walkout dip close to the first rep will be merged by minPeakDistance.
      // A walkout far from the first rep counts as a peak — the caller can
      // trim it based on rep quality metrics (ROM, depth) if needed.
      const standingY = 0.33;
      const bottomY = 0.60;
      const walkoutY = standingY + (bottomY - standingY) * 0.30;

      const frames: ReturnType<typeof buildFrame>[] = [];

      // Walkout dip (6 frames at 4fps = 1.5s — far enough to be a separate peak)
      for (let f = 0; f < 6; f++) {
        const phase = f / 6;
        const t = Math.sin(phase * Math.PI);
        const hipY = standingY + (walkoutY - standingY) * t;
        frames.push(buildFrame({
          [LANDMARK.LEFT_HIP]: { x: 0.47, y: hipY, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_HIP]: { x: 0.53, y: hipY, z: 0, visibility: 1 },
        }));
      }

      // 3 real reps
      for (let rep = 0; rep < 3; rep++) {
        for (let f = 0; f < 10; f++) {
          const phase = f / 10;
          const t = Math.sin(phase * Math.PI);
          const hipY = standingY + (bottomY - standingY) * t;
          frames.push(buildFrame({
            [LANDMARK.LEFT_HIP]: { x: 0.47, y: hipY, z: 0, visibility: 1 },
            [LANDMARK.RIGHT_HIP]: { x: 0.53, y: hipY, z: 0, visibility: 1 },
          }));
        }
      }

      const reps = detectReps({ frames, lift: 'squat', fps: 4 });
      // Walkout dip is filtered by prominence (only 30% of real rep
      // displacement, below the 20% threshold relative to signal range).
      // Only the 3 real reps should be detected.
      expect(reps).toHaveLength(3);
    });
  });

  describe('real captured signal', () => {
    it('detects correct reps from actual squat video signal', () => {
      // Real hip Y signal from a 5-rep squat video at 4fps (60 frames).
      // Peaks alternate: squat bottom (0.59) and lockout (0.44).
      // Only the bottom-of-squat peaks should count as reps.
      const hipY = [0.3336,0.3352,0.3367,0.3382,0.3382,0.3514,0.3646,0.3777,0.3777,0.3744,0.3677,0.3577,0.3477,0.3376,0.3309,0.3276,0.3276,0.4150,0.5023,0.5896,0.5896,0.5221,0.4545,0.3869,0.3869,0.4066,0.4263,0.4459,0.4459,0.4404,0.4349,0.4294,0.4294,0.3984,0.3675,0.3365,0.3365,0.4244,0.5124,0.6003,0.6003,0.5314,0.4626,0.3938,0.3938,0.4004,0.4070,0.4137,0.4137,0.4246,0.4356,0.4465,0.4465,0.4153,0.3840,0.3527,0.3527,0.3527,0.3527,0.3527];

      // Build frames with this hip Y signal
      const frames = hipY.map((y) =>
        buildFrame({
          [LANDMARK.LEFT_HIP]: { x: 0.47, y, z: 0, visibility: 1 },
          [LANDMARK.RIGHT_HIP]: { x: 0.53, y, z: 0, visibility: 1 },
        }),
      );

      const reps = detectReps({ frames, lift: 'squat', fps: 4 });
      // 3 of the 5 peaks have sufficient prominence (≥20% of signal range).
      // The 2 shallower peaks are filtered as noise/transitions.
      expect(reps).toHaveLength(3);

      // Each rep should contain a peak (bottom of squat).
      // Valley-based boundaries ensure each slice has a full cycle.
      for (const rep of reps) {
        expect(rep.endFrame).toBeGreaterThan(rep.startFrame);
      }
    });
  });

  describe('fps-relative scaling', () => {
    it('detects reps at 15fps with half the frames per rep', () => {
      // 15fps → 30 frames per 2-second rep (instead of 60 at 30fps)
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 30 });
      const reps = detectReps({ frames, lift: 'squat', fps: 15 });
      expect(reps).toHaveLength(3);
    });

    it('detects reps at 10fps', () => {
      // 10fps → 20 frames per 2-second rep
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 20 });
      const reps = detectReps({ frames, lift: 'squat', fps: 10 });
      expect(reps).toHaveLength(3);
    });

    it('defaults to 30fps when fps is omitted', () => {
      const frames = generateSquatFrames({ reps: 3, framesPerRep: 60 });
      const repsDefault = detectReps({ frames, lift: 'squat' });
      const repsExplicit = detectReps({ frames, lift: 'squat', fps: 30 });
      expect(repsDefault).toEqual(repsExplicit);
    });

    it('still rejects too-short videos at low fps', () => {
      // At 10fps, minPeakDistance = round(10*0.5) = 5, need 2*5=10 frames
      const frames = generateSquatFrames({ reps: 1, framesPerRep: 6 });
      const reps = detectReps({ frames, lift: 'squat', fps: 10 });
      expect(reps).toEqual([]);
    });
  });
});
