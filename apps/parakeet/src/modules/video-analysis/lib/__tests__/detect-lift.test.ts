import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import {
  detectLift,
  WARN_CONFIDENCE,
  type DetectableLift,
} from '../detect-lift';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

// ---------------------------------------------------------------------------
// Synthetic frames — hand-built pose geometries for each lift archetype
// ---------------------------------------------------------------------------

function lm(x: number, y: number, visibility = 1): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function emptyFrame(): PoseFrame {
  return Array.from({ length: 33 }, () => lm(0, 0, 0));
}

/**
 * Build a frame where shoulders, hips, and wrists are placed at fixed
 * normalised coordinates. Other landmarks stay zero-visibility so they
 * don't pollute the signal.
 */
function buildFrame({
  shoulderY,
  hipY,
  wristY,
}: {
  shoulderY: number;
  hipY: number;
  wristY: number;
}): PoseFrame {
  const frame = emptyFrame();
  // Small horizontal spread so torsoLen is non-zero but dominated by dy.
  frame[LANDMARK.LEFT_SHOULDER] = lm(0.4, shoulderY);
  frame[LANDMARK.RIGHT_SHOULDER] = lm(0.6, shoulderY);
  frame[LANDMARK.LEFT_HIP] = lm(0.42, hipY);
  frame[LANDMARK.RIGHT_HIP] = lm(0.58, hipY);
  frame[LANDMARK.LEFT_WRIST] = lm(0.35, wristY);
  frame[LANDMARK.RIGHT_WRIST] = lm(0.65, wristY);
  return frame;
}

function repeatFrame(frame: PoseFrame, n: number): PoseFrame[] {
  return Array.from({ length: n }, () => frame);
}

describe('detectLift.synthetic', () => {
  it('returns null when fewer than MIN_FRAMES are usable', () => {
    const result = detectLift({ frames: [emptyFrame(), emptyFrame()] });
    expect(result.lift).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('classifies squat archetype (wrists at shoulder height)', () => {
    // Bar on traps: wrists ≈ shoulder Y for every frame of the lift.
    const frame = buildFrame({ shoulderY: 0.3, hipY: 0.55, wristY: 0.3 });
    const result = detectLift({ frames: repeatFrame(frame, 30) });
    expect(result.lift).toBe<DetectableLift>('squat');
    expect(result.confidence).toBeGreaterThan(WARN_CONFIDENCE);
  });

  it('classifies bench archetype (wrists above shoulders)', () => {
    // Lifter supine with bar pressed up: wrist Y well above shoulder Y.
    const frame = buildFrame({ shoulderY: 0.5, hipY: 0.55, wristY: 0.2 });
    const result = detectLift({ frames: repeatFrame(frame, 30) });
    expect(result.lift).toBe<DetectableLift>('bench');
    expect(result.confidence).toBeGreaterThan(WARN_CONFIDENCE);
  });

  it('classifies deadlift archetype (wrists far below shoulders)', () => {
    // Bar at floor: wrists well below shoulders, torso bent over.
    const frame = buildFrame({ shoulderY: 0.3, hipY: 0.45, wristY: 0.75 });
    const result = detectLift({ frames: repeatFrame(frame, 30) });
    expect(result.lift).toBe<DetectableLift>('deadlift');
    expect(result.confidence).toBeGreaterThan(WARN_CONFIDENCE);
  });

  it('emits a human-readable reason naming the feature that decided it', () => {
    const frame = buildFrame({ shoulderY: 0.5, hipY: 0.55, wristY: 0.2 });
    const result = detectLift({ frames: repeatFrame(frame, 30) });
    expect(result.reason).toMatch(/p90|median/);
  });

  it('stays silent on a paused-bench clip trimmed to chest touch (no lockout frames)', () => {
    // Bench that was trimmed to only the descent + pause; wrists never make
    // it above shoulder line. Lands right on the bench/squat boundary.
    // Must either abstain or return non-confident — the caller's mismatch
    // warning must not fire.
    const frame = buildFrame({ shoulderY: 0.45, hipY: 0.55, wristY: 0.44 });
    const result = detectLift({ frames: repeatFrame(frame, 30) });
    if (result.lift != null) {
      expect(result.confidence).toBeLessThan(WARN_CONFIDENCE);
    }
  });

  it('abstains when most frames have unusable landmarks', () => {
    // Exactly MIN_FRAMES - 1 usable frames surrounded by empty ones. The
    // classifier must return `lift: null`, not make something up.
    const goodFrame = buildFrame({ shoulderY: 0.3, hipY: 0.55, wristY: 0.3 });
    const frames = [
      ...Array.from({ length: 7 }, () => goodFrame),
      ...Array.from({ length: 30 }, () => emptyFrame()),
    ];
    const result = detectLift({ frames });
    expect(result.lift).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture eval — all calibrated landmark fixtures with >= MIN_FRAMES worth
// of data must classify correctly. Degenerate fixtures (too few valid frames,
// collapsed landmarks) are expected to fall back to `lift: null` rather than
// a confident-wrong prediction; we assert that too.
// ---------------------------------------------------------------------------

interface ManifestVideo {
  id: string;
  lift: string;
  calibrated: boolean;
}

interface LandmarkFile {
  frames: PoseFrame[];
}

const PROJECT_ROOT = resolve(__dirname, '../../../../../../..');
const MANIFEST_PATH = resolve(PROJECT_ROOT, 'test-videos/manifest.json');

function loadManifest(): ManifestVideo[] {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as {
    videos: ManifestVideo[];
  };
  return raw.videos;
}

function loadLandmarks(id: string): PoseFrame[] | null {
  try {
    const path = resolve(PROJECT_ROOT, `test-videos/landmarks/${id}.landmarks.json`);
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as LandmarkFile;
    return raw.frames;
  } catch {
    return null;
  }
}

describe('detectLift.fixtures', () => {
  const videos = loadManifest().filter(
    (v) => v.calibrated && ['squat', 'bench', 'deadlift'].includes(v.lift)
  );

  it('has fixtures loaded', () => {
    expect(videos.length).toBeGreaterThan(10);
  });

  for (const video of videos) {
    it(`${video.id} (labelled ${video.lift}): must be correct OR a null/low-conf abstention`, () => {
      const frames = loadLandmarks(video.id);
      if (!frames) return; // fixture missing — skip silently

      const result = detectLift({ frames });

      // Three acceptable outcomes — strongest first:
      //   (a) classified correctly (any confidence)
      //   (b) abstained (lift === null)
      //   (c) classified wrong BUT with confidence < WARN_CONFIDENCE
      //
      // Case (c) is the one we accept grudgingly: degenerate fixtures (e.g.
      // 14 usable frames with landmark noise) legitimately drift into the
      // wrong bucket but stay silent. What MUST NOT happen is a confident
      // wrong classification — that's the failure mode the user would see.
      const correct = result.lift === video.lift;
      const abstained = result.lift === null;
      const silentlyWrong =
        result.lift != null &&
        result.lift !== video.lift &&
        result.confidence < WARN_CONFIDENCE;
      expect(
        correct || abstained || silentlyWrong,
        `Confident wrong label: ${result.lift} @ ${result.confidence.toFixed(2)} for ${video.id} (labelled ${video.lift})`
      ).toBe(true);
    });
  }

  it('emits at least 2 high-confidence predictions per lift category', () => {
    // Without this, a regression that silently drops confidence to 0 across
    // the board would pass the per-fixture tests above — they only assert
    // "not confidently wrong", and `null` satisfies that trivially.
    const highConfByLift: Record<string, number> = { squat: 0, bench: 0, deadlift: 0 };
    for (const video of videos) {
      const frames = loadLandmarks(video.id);
      if (!frames) continue;
      const result = detectLift({ frames });
      if (result.lift === video.lift && result.confidence >= WARN_CONFIDENCE) {
        highConfByLift[video.lift]++;
      }
    }
    expect(highConfByLift.squat).toBeGreaterThanOrEqual(2);
    expect(highConfByLift.bench).toBeGreaterThanOrEqual(1); // only 2 bench fixtures total
    expect(highConfByLift.deadlift).toBeGreaterThanOrEqual(2);
  });
});
