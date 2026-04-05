#!/usr/bin/env npx tsx
/**
 * Run all test videos through the analysis pipeline and generate calibration
 * artifacts: snapshot files and manifest actual values.
 *
 * Usage:
 *   npx tsx scripts/calibrate-videos.ts [options]
 *
 * Options:
 *   --video <id>        Run for a single video only (default: all)
 *   --update-manifest   Write actual values back to manifest.json
 *   --mark-calibrated   Set calibrated: true for videos within expected ranges
 *   --dry-run           Print what would be written without writing
 *   --force             Overwrite existing snapshots
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Relative import from script location to app module — no path aliases available
import { analyzeVideoFrames } from '../apps/parakeet/src/modules/video-analysis/application/analyze-video';
import { computeSagittalConfidence } from '../apps/parakeet/src/modules/video-analysis/lib/view-confidence';
import type { PoseFrame } from '../apps/parakeet/src/modules/video-analysis/lib/pose-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(PROJECT_ROOT, 'test-videos/manifest.json');
const LANDMARKS_DIR = resolve(PROJECT_ROOT, 'test-videos/landmarks');
const SNAPSHOTS_DIR = resolve(PROJECT_ROOT, 'test-videos/snapshots');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandmarkFile {
  videoId: string;
  fps: number;
  totalFrames: number;
  validFrames: number;
  frames: PoseFrame[];
}

interface SagittalConfidenceRange {
  min: number;
  max: number;
}

interface RepCountRange {
  min: number;
  max: number;
  notes?: string;
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
  actual: Record<string, unknown> | null;
}

interface Manifest {
  description: string;
  thresholds: Record<string, number>;
  videos: ManifestVideo[];
}

interface SnapshotFile {
  videoId: string;
  lift: string;
  analysisVersion: number;
  snapshotVersion: number;
  createdAt: string;
  sagittalConfidence: number;
  result: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const videoFilter = args.includes('--video')
  ? args[args.indexOf('--video') + 1]
  : null;
const updateManifest = args.includes('--update-manifest');
const markCalibrated = args.includes('--mark-calibrated');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest;
}

function loadLandmarks(
  videoId: string
): { frames: PoseFrame[]; fps: number } | null {
  const path = resolve(LANDMARKS_DIR, `${videoId}.landmarks.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf-8')) as LandmarkFile;
  return { frames: data.frames, fps: data.fps };
}

function computeMetricSummary(
  reps: Array<Record<string, unknown>>
): Record<string, { mean: number; min: number; max: number }> {
  const numericFields = [
    'forwardLeanDeg',
    'maxDepthCm',
    'barDriftCm',
    'romCm',
    'kneeAngleDeg',
    'hipAngleAtLockoutDeg',
    'meanConcentricVelocityCmS',
    'buttWinkDeg',
    'stanceWidthCm',
    'hipShiftCm',
    'elbowFlareDeg',
    'pauseDurationSec',
    'hipHingeCrossoverPct',
    'barToShinDistanceCm',
    'lockoutStabilityCv',
  ];

  const summary: Record<string, { mean: number; min: number; max: number }> =
    {};

  for (const field of numericFields) {
    const values = reps
      .map((r) => r[field])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) continue;

    summary[field] = {
      mean: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100,
      min: Math.round(Math.min(...values) * 100) / 100,
      max: Math.round(Math.max(...values) * 100) / 100,
    };
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const manifest = loadManifest();
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const videos = videoFilter
    ? manifest.videos.filter((v) => v.id === videoFilter)
    : manifest.videos;

  if (videos.length === 0) {
    console.error(
      videoFilter
        ? `No video found with id "${videoFilter}"`
        : 'No videos in manifest'
    );
    process.exit(1);
  }

  console.log(
    `Calibrating ${videos.length} video(s)${dryRun ? ' (dry run)' : ''}...\n`
  );

  let updated = 0;
  let skipped = 0;
  let calibratedCount = 0;

  for (const video of videos) {
    const fixture = loadLandmarks(video.id);
    if (!fixture) {
      console.log(`  SKIP ${video.id} — no landmark fixture`);
      skipped++;
      continue;
    }

    const { frames, fps } = fixture;

    // Run analysis
    const sagittalConfidence = computeSagittalConfidence({ frames });
    const result = analyzeVideoFrames({ frames, fps, lift: video.lift });

    // Build actual summary
    const reps = result.reps as Array<Record<string, unknown>>;
    const faultTypes = [
      ...new Set(
        reps.flatMap((r) =>
          ((r.faults as Array<{ type: string }>) ?? []).map((f) => f.type)
        )
      ),
    ].sort();

    const actual = {
      rep_count: result.reps.length,
      sagittal_confidence:
        Math.round(sagittalConfidence * 1000) / 1000,
      analysis_version: result.analysisVersion,
      metric_summary: computeMetricSummary(reps),
      fault_types: faultTypes,
      calibrated_at: new Date().toISOString(),
    };

    // Check if within expected ranges
    const repInRange =
      actual.rep_count >= video.expected.rep_count.min &&
      actual.rep_count <= video.expected.rep_count.max;
    const confidenceInRange =
      actual.sagittal_confidence >=
        video.expected.sagittal_confidence.min &&
      actual.sagittal_confidence <=
        video.expected.sagittal_confidence.max;
    const withinRange = repInRange && confidenceInRange;

    const statusIcon = withinRange ? '✓' : '✗';
    console.log(
      `  ${statusIcon} ${video.id}: ${actual.rep_count} reps, ` +
        `confidence=${actual.sagittal_confidence}, ` +
        `v${actual.analysis_version}, ` +
        `faults=[${faultTypes.join(', ')}]` +
        (!repInRange
          ? ` (rep count outside ${video.expected.rep_count.min}-${video.expected.rep_count.max})`
          : '') +
        (!confidenceInRange
          ? ` (confidence outside ${video.expected.sagittal_confidence.min}-${video.expected.sagittal_confidence.max})`
          : '')
    );

    // Write snapshot
    const snapshotPath = resolve(
      SNAPSHOTS_DIR,
      `${video.id}.snapshot.json`
    );
    if (!existsSync(snapshotPath) || force) {
      const snapshot: SnapshotFile = {
        videoId: video.id,
        lift: video.lift,
        analysisVersion: result.analysisVersion,
        snapshotVersion: 1,
        createdAt: new Date().toISOString(),
        sagittalConfidence,
        result: result as unknown as Record<string, unknown>,
      };

      if (dryRun) {
        console.log(`    → would write ${snapshotPath}`);
      } else {
        writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        console.log(`    → snapshot written`);
      }
    } else {
      console.log(`    → snapshot exists (use --force to overwrite)`);
    }

    // Update manifest actual field
    if (updateManifest) {
      video.actual = actual;
      if (markCalibrated && withinRange) {
        video.calibrated = true;
        calibratedCount++;
      }
      updated++;
    }
  }

  // Write manifest
  if (updateManifest && !dryRun) {
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(
      `\nManifest updated: ${updated} video(s)` +
        (markCalibrated ? `, ${calibratedCount} newly calibrated` : '')
    );
  } else if (updateManifest && dryRun) {
    console.log(`\nDry run: would update ${updated} video(s) in manifest`);
  }

  console.log(
    `\nDone. ${updated} updated, ${skipped} skipped.`
  );
}

main();
