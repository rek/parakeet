import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { analyzeVideoFrames } from '../../application/analyze-video';
import { computeSagittalConfidence } from '../view-confidence';
import type { PoseFrame } from '../pose-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(process.cwd(), '../..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandmarkFile {
  videoId: string;
  fps: number;
  totalFrames: number;
  validFrames: number;
  frames: Array<Array<{ x: number; y: number; z: number; visibility: number }>>;
}

interface RepCountRange {
  min: number;
  max: number;
  notes?: string;
}

interface SagittalConfidenceRange {
  min: number;
  max: number;
}

interface ManifestVideo {
  id: string;
  file: string;
  lift: 'squat' | 'bench' | 'deadlift';
  calibrated: boolean;
  expected: {
    sagittal_confidence: SagittalConfidenceRange;
    rep_count: RepCountRange;
    faults_to_test: string[];
    metrics_present: string[];
    fatigue_signatures: boolean;
    notes?: string;
  };
  actual: null | Record<string, unknown>;
}

interface Manifest {
  videos: ManifestVideo[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadManifest(): Manifest {
  const path = resolve(PROJECT_ROOT, 'test-videos/manifest.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as Manifest;
}

function loadLandmarks(
  videoId: string
): { frames: PoseFrame[]; fps: number } | null {
  const path = resolve(
    PROJECT_ROOT,
    `test-videos/landmarks/${videoId}.landmarks.json`
  );
  if (!existsSync(path)) return null;

  const data = JSON.parse(readFileSync(path, 'utf-8')) as LandmarkFile;
  return { frames: data.frames as PoseFrame[], fps: data.fps };
}

// ---------------------------------------------------------------------------
// Per-video analysis cache — avoids re-running the pipeline for each `it` block
// ---------------------------------------------------------------------------

const analysisCache = new Map<string, ReturnType<typeof analyzeVideoFrames>>();

function getCachedAnalysis(
  videoId: string,
  frames: PoseFrame[],
  fps: number,
  lift: 'squat' | 'bench' | 'deadlift'
) {
  if (!analysisCache.has(videoId)) {
    analysisCache.set(videoId, analyzeVideoFrames({ frames, fps, lift }));
  }
  return analysisCache.get(videoId)!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const manifest = loadManifest();

describe.each(manifest.videos)('video: $id', (video) => {
  const fixture = loadLandmarks(video.id);

  if (!fixture) {
    it.skip(`skipping — landmark fixture missing for ${video.id}`, () => {});
    return;
  }

  const { frames, fps } = fixture;

  it('produces a valid analysis result', () => {
    const result = getCachedAnalysis(video.id, frames, fps, video.lift);

    const { min, max } = video.expected.rep_count;
    expect(result.reps.length).toBeGreaterThanOrEqual(min);
    expect(result.reps.length).toBeLessThanOrEqual(max);
    expect(result.analysisVersion).toBe(4);
  });

  it('sagittal confidence is within expected range', () => {
    const confidence = computeSagittalConfidence({ frames });
    const { min, max } = video.expected.sagittal_confidence;
    expect(confidence).toBeGreaterThanOrEqual(min);
    expect(confidence).toBeLessThanOrEqual(max);
  });

  it('has expected metrics on every rep', () => {
    const result = getCachedAnalysis(video.id, frames, fps, video.lift);

    for (const rep of result.reps) {
      // Shared metrics — present for all lifts
      expect(rep.repNumber).toBeGreaterThan(0);
      expect(rep.startFrame).toBeLessThanOrEqual(rep.endFrame);
      expect(Array.isArray(rep.faults)).toBe(true);

      if (video.lift === 'squat') {
        // Depth is always computed (perspective-corrected at oblique angles)
        expect(rep.maxDepthCm).toBeDefined();
        expect(rep.stanceWidthCm).toBeDefined();
        expect(rep.hipShiftCm).toBeDefined();
        expect(rep.hipShiftDirection).toBeDefined();
      }

      if (video.lift === 'deadlift') {
        expect(rep.hipHingeCrossoverPct).toBeDefined();
        expect(rep.barToShinDistanceCm).toBeDefined();
      }

      if (video.lift === 'bench') {
        expect(rep.elbowFlareDeg).toBeDefined();
        expect(rep.pauseDurationSec).toBeDefined();
        expect(typeof rep.isSinking).toBe('boolean');
      }
    }
  });

  it('produces well-formed faults', () => {
    const result = getCachedAnalysis(video.id, frames, fps, video.lift);
    const validSeverities = ['info', 'warning', 'critical'] as const;

    for (const rep of result.reps) {
      for (const fault of rep.faults) {
        expect(typeof fault.type).toBe('string');
        expect(fault.type.length).toBeGreaterThan(0);
        expect(validSeverities).toContain(fault.severity);
        expect(typeof fault.message).toBe('string');
        expect(fault.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('computes fatigue signatures when 2+ reps', () => {
    if (!video.expected.fatigue_signatures) return;

    const result = getCachedAnalysis(video.id, frames, fps, video.lift);
    if (result.reps.length < 2) return;

    expect(result.fatigueSignatures).toBeDefined();

    const sig = result.fatigueSignatures!;
    // Each field is a number or null — never undefined
    expect('forwardLeanDriftDeg' in sig).toBe(true);
    expect('barDriftIncreaseCm' in sig).toBe(true);
    expect('romCompressionCm' in sig).toBe(true);
    expect('descentSpeedChange' in sig).toBe(true);
    expect('lockoutDegradationDeg' in sig).toBe(true);
    expect('velocityLossTrend' in sig).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Lift-specific assertions
  // -------------------------------------------------------------------------

  if (video.lift === 'squat') {
    describe('squat-specific', () => {
      it('maxDepthCm is defined on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          expect(rep.maxDepthCm).toBeDefined();
        }
      });

      it('forwardLeanDeg is between 0 and 90 on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.forwardLeanDeg == null) continue;
          expect(rep.forwardLeanDeg).toBeGreaterThanOrEqual(0);
          expect(rep.forwardLeanDeg).toBeLessThanOrEqual(90);
        }
      });

      it('kneeAngleDeg is between 0 and 180 on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.kneeAngleDeg == null) continue;
          expect(rep.kneeAngleDeg).toBeGreaterThanOrEqual(0);
          expect(rep.kneeAngleDeg).toBeLessThanOrEqual(180);
        }
      });

      it('stanceWidthCm is positive on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.stanceWidthCm == null) continue;
          expect(rep.stanceWidthCm).toBeGreaterThan(0);
        }
      });
    });
  }

  if (video.lift === 'deadlift') {
    describe('deadlift-specific', () => {
      it('hipAngleAtLockoutDeg is defined on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          expect(rep.hipAngleAtLockoutDeg).toBeDefined();
        }
      });

      it('hipHingeCrossoverPct is between 0 and 100 on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.hipHingeCrossoverPct == null) continue;
          expect(rep.hipHingeCrossoverPct).toBeGreaterThanOrEqual(0);
          expect(rep.hipHingeCrossoverPct).toBeLessThanOrEqual(100);
        }
      });

      it('barToShinDistanceCm is a finite number on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.barToShinDistanceCm == null) continue;
          // Signed distance: negative = bar is behind knees, positive = bar is forward.
          // The fault threshold (>5cm) applies to the positive direction only.
          expect(Number.isFinite(rep.barToShinDistanceCm)).toBe(true);
        }
      });
    });
  }

  if (video.lift === 'bench') {
    describe('bench-specific', () => {
      it('elbowFlareDeg is between 0 and 180 on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.elbowFlareDeg == null) continue;
          // From front view, elbow angle can exceed 90° because the
          // shoulder-elbow-wrist landmarks are in a different plane.
          expect(rep.elbowFlareDeg).toBeGreaterThanOrEqual(0);
          expect(rep.elbowFlareDeg).toBeLessThanOrEqual(180);
        }
      });

      it('pauseDurationSec is non-negative on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.pauseDurationSec == null) continue;
          expect(rep.pauseDurationSec).toBeGreaterThanOrEqual(0);
        }
      });

      it('isSinking is a boolean on every rep', () => {
        const result = getCachedAnalysis(video.id, frames, fps, video.lift);
        for (const rep of result.reps) {
          if (rep.isSinking == null) continue;
          expect(typeof rep.isSinking).toBe('boolean');
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Regression suite — runs only for calibrated videos
// ---------------------------------------------------------------------------

describe('regression', () => {
  const calibrated = manifest.videos.filter((v) => v.calibrated);

  if (calibrated.length === 0) {
    it.todo(
      'no calibrated videos yet — set calibrated: true + actual fields in manifest to enable'
    );
    return;
  }

  describe.each(calibrated)('$id', (video) => {
    const fixture = loadLandmarks(video.id);

    if (!fixture) {
      it.skip(`skipping regression — landmark fixture missing for ${video.id}`, () => {});
      return;
    }

    const { frames, fps } = fixture;

    it('matches calibrated rep count exactly', () => {
      const actual = video.actual as { rep_count: number } | null;
      if (!actual?.rep_count) return;

      const result = getCachedAnalysis(video.id, frames, fps, video.lift);
      expect(result.reps.length).toBe(actual.rep_count);
    });

    it('matches calibrated sagittal confidence', () => {
      const actual = video.actual as {
        sagittal_confidence: number;
      } | null;
      if (actual?.sagittal_confidence == null) return;

      const confidence = computeSagittalConfidence({ frames });
      expect(confidence).toBeCloseTo(actual.sagittal_confidence, 1);
    });

    it('matches calibrated analysis version', () => {
      const actual = video.actual as { analysis_version: number } | null;
      if (!actual?.analysis_version) return;

      const result = getCachedAnalysis(video.id, frames, fps, video.lift);
      expect(result.analysisVersion).toBe(actual.analysis_version);
    });
  });
});
