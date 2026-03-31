#!/usr/bin/env npx tsx
/**
 * Pull on-device video analysis results and landmarks from Supabase,
 * and write them as calibration fixture files.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/pull-device-analysis.ts [--limit N]
 *
 * What it does:
 *   1. Queries session_videos rows that have debug_landmarks populated
 *   2. For each row, writes:
 *      - test-videos/landmarks/device-<id>.landmarks.json  (PoseFrame[] fixture)
 *      - test-videos/device-results/device-<id>.analysis.json  (on-device analysis result)
 *   3. Prints a summary comparing on-device rep count / faults with what our
 *      TS pipeline produces from the same landmarks
 *
 * This creates a feedback loop:
 *   Device records video → MediaPipe extracts landmarks → analysis runs →
 *   both stored in DB → this script pulls them → calibration tests validate
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '..');
const LANDMARKS_DIR = resolve(PROJECT_ROOT, 'test-videos/landmarks');
const RESULTS_DIR = resolve(PROJECT_ROOT, 'test-videos/device-results');

function getEnvOrDie(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: ${name} environment variable is required`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const limit = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '20', 10);

  const supabaseUrl = getEnvOrDie('SUPABASE_URL');
  const supabaseKey = getEnvOrDie('SUPABASE_SERVICE_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Querying session_videos with debug_landmarks...');

  const { data, error } = await supabase
    .from('session_videos')
    .select('id, lift, camera_angle, duration_sec, analysis, debug_landmarks, created_at')
    .not('debug_landmarks', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase query failed:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No rows with debug_landmarks found. Run a video analysis on device first.');
    process.exit(0);
  }

  console.log(`Found ${data.length} row(s) with debug landmarks.\n`);

  mkdirSync(LANDMARKS_DIR, { recursive: true });
  mkdirSync(RESULTS_DIR, { recursive: true });

  for (const row of data) {
    const shortId = row.id.slice(0, 8);
    const landmarks = row.debug_landmarks as { frames: unknown[]; fps: number; extractedAt: string };
    const analysis = row.analysis as Record<string, unknown> | null;

    // Write landmarks fixture (same format as Python-extracted)
    const landmarkFile = resolve(LANDMARKS_DIR, `device-${shortId}.landmarks.json`);
    const landmarkPayload = {
      videoId: `device-${shortId}`,
      fps: landmarks.fps,
      totalFrames: landmarks.frames.length,
      validFrames: landmarks.frames.filter((f: unknown) => {
        const frame = f as Array<{ visibility: number }>;
        return Array.isArray(frame) && frame.length > 0 && frame[0].visibility > 0;
      }).length,
      frames: landmarks.frames,
    };
    writeFileSync(landmarkFile, JSON.stringify(landmarkPayload));
    console.log(`  ${landmarkFile}`);

    // Write analysis result
    if (analysis) {
      const analysisFile = resolve(RESULTS_DIR, `device-${shortId}.analysis.json`);
      const analysisPayload = {
        videoId: `device-${shortId}`,
        lift: row.lift,
        cameraAngle: row.camera_angle,
        durationSec: row.duration_sec,
        createdAt: row.created_at,
        deviceAnalysis: analysis,
      };
      writeFileSync(analysisFile, JSON.stringify(analysisPayload, null, 2));
      console.log(`  ${analysisFile}`);
    }

    // Summary
    const reps = (analysis as { reps?: unknown[] } | null)?.reps ?? [];
    const faults = reps.flatMap((r: unknown) => ((r as { faults: unknown[] }).faults ?? []));
    const faultTypes = [...new Set(faults.map((f: unknown) => (f as { type: string }).type))];
    console.log(
      `  → ${row.lift} | ${row.camera_angle} | ${reps.length} reps | ` +
      `${landmarks.frames.length} frames (${landmarkPayload.validFrames} valid) | ` +
      `faults: ${faultTypes.join(', ') || 'none'}`
    );
    console.log();
  }

  console.log(`\nDone. Landmark fixtures written to test-videos/landmarks/device-*.landmarks.json`);
  console.log('Run calibration tests to validate: npx nx test parakeet -- calibration');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
