import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { analyzeVideoFrames } from '../analyze-video';
import {
  isSupportedLift,
  reanalyzeSessionVideo,
  SUPPORTED_LIFTS,
} from '../reanalyze';
import type { PoseFrame } from '../../lib/pose-types';
import type { SessionVideo } from '../../model/types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'sb_publishable_REDACTED';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  'sb_secret_REDACTED';

const FIXTURE_PATH = resolve(
  __dirname,
  '../../../../../../../test-videos/landmarks/dl-2-reps-side.landmarks.json'
);

const localSupabaseReachable = await (async () => {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return r.ok;
  } catch {
    return false;
  }
})();

// Integration tests require a running local Supabase stack + fixture file.
// Skip cleanly in CI and in workspaces where `supabase start` isn't in play.
const runIntegration = localSupabaseReachable && existsSync(FIXTURE_PATH);
const describeIntegration = runIntegration ? describe : describe.skip;

describe('reanalyze.pure', () => {
  it('SUPPORTED_LIFTS is the squat/bench/deadlift triple', () => {
    expect([...SUPPORTED_LIFTS]).toEqual(['squat', 'bench', 'deadlift']);
  });

  it('isSupportedLift is a type guard over that set', () => {
    expect(isSupportedLift('squat')).toBe(true);
    expect(isSupportedLift('ohp')).toBe(false);
    expect(isSupportedLift('')).toBe(false);
  });

  it('rejects unsupported lifts without calling any dep', async () => {
    const calls: string[] = [];
    await expect(
      reanalyzeSessionVideo({
        result: makeResult({ id: 'r1', analysis: null }),
        lift: 'ohp',
        deps: {
          fileExists: () => {
            calls.push('fileExists');
            return true;
          },
          getVideoDurationSec: async () => 10,
          extractFrames: async () => ({ frames: [], fps: 4 }),
          analyze: () => {
            throw new Error('unreachable');
          },
          update: async () => {
            throw new Error('unreachable');
          },
        },
      })
    ).rejects.toThrow(/lift "ohp"/);
    expect(calls).toEqual([]);
  });

  it('rejects when the local file is missing', async () => {
    await expect(
      reanalyzeSessionVideo({
        result: makeResult({ id: 'r1', localUri: 'file:///gone.mp4' }),
        lift: 'squat',
        deps: {
          fileExists: () => false,
          getVideoDurationSec: async () => 10,
          extractFrames: async () => ({ frames: [], fps: 4 }),
          analyze: () => ({}) as never,
          update: async () => ({}) as never,
        },
      })
    ).rejects.toThrow(/Local video file missing/);
  });

  it('rejects when extraction returns 0 frames', async () => {
    await expect(
      reanalyzeSessionVideo({
        result: makeResult({ id: 'r1' }),
        lift: 'squat',
        deps: {
          fileExists: () => true,
          getVideoDurationSec: async () => 10,
          extractFrames: async () => ({ frames: [], fps: 4 }),
          analyze: () => {
            throw new Error('unreachable');
          },
          update: async () => {
            throw new Error('unreachable');
          },
        },
      })
    ).rejects.toThrow(/0 frames/);
  });

  it('emits breadcrumbs at each pipeline step on happy path', async () => {
    const breadcrumbs: string[] = [];
    const updated = makeResult({ id: 'r1', analysis: analysisWithReps(2) });

    const result = await reanalyzeSessionVideo({
      result: makeResult({ id: 'r1' }),
      lift: 'deadlift',
      deps: {
        fileExists: () => true,
        getVideoDurationSec: async () => 13,
        extractFrames: async () => ({
          frames: Array.from(
            { length: 30 },
            () => Array.from({ length: 33 }, () => makeLandmark())
          ) as PoseFrame[],
          fps: 4,
        }),
        analyze: () => analysisWithReps(2),
        update: async () => updated,
        onBreadcrumb: (step) => breadcrumbs.push(step),
      },
    });

    expect(result).toBe(updated);
    expect(breadcrumbs).toContain('extract-start');
    expect(breadcrumbs).toContain('extract-done');
    expect(breadcrumbs).toContain('analyze-done');
    expect(breadcrumbs).toContain('db-update-ok');
  });
});

describeIntegration(
  'reanalyze.integration (local Supabase)',
  () => {
    let admin: SupabaseClient;
    let user: SupabaseClient;
    let userId: string;
    let sessionId: string;
    let videoId: string;

    beforeAll(async () => {
      admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const email = `reanalyze-integration-${Date.now()}@example.com`;
      const password = 'testpass123';
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (createErr || !created.user) throw createErr;
      userId = created.user.id;

      await admin
        .from('profiles')
        .insert({ id: userId, display_name: 'Integration Test' });

      sessionId = randomUUID();
      await admin.from('sessions').insert({
        id: sessionId,
        user_id: userId,
        planned_date: new Date().toISOString().slice(0, 10),
        status: 'completed',
        week_number: 0,
        day_number: 0,
      });

      videoId = randomUUID();
      const stuckAnalysis = {
        fps: 4,
        reps: [],
        cameraAngle: 'side',
        analysisVersion: 4,
        sagittalConfidence: 0.8,
      };
      await admin.from('session_videos').insert({
        id: videoId,
        user_id: userId,
        session_id: sessionId,
        lift: 'deadlift',
        set_number: 2,
        sagittal_confidence: 0.8,
        local_uri: 'file:///fake.mp4',
        duration_sec: 13,
        analysis: stuckAnalysis,
      });

      user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error: signInErr } = await user.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) throw signInErr;
    });

    afterAll(async () => {
      if (!admin) return;
      await admin.from('session_videos').delete().eq('id', videoId);
      await admin.from('sessions').delete().eq('id', sessionId);
      await admin.auth.admin.deleteUser(userId);
    });

    it('updates the DB row in place with refreshed analysis', async () => {
      const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as {
        frames: PoseFrame[];
        fps: number;
      };

      const result = makeResult({
        id: videoId,
        sessionId,
        lift: 'deadlift',
        setNumber: 2,
        localUri: 'file:///fake.mp4',
        durationSec: 13,
        analysis: {
          fps: 4,
          reps: [],
          cameraAngle: 'side',
          analysisVersion: 4,
          sagittalConfidence: 0.8,
        } as never,
      });

      const steps: Array<[string, Record<string, unknown> | undefined]> = [];

      const updated = await reanalyzeSessionVideo({
        result,
        lift: 'deadlift',
        deps: {
          fileExists: () => true,
          getVideoDurationSec: async () => fixture.frames.length / fixture.fps,
          extractFrames: async () => fixture,
          analyze: ({ frames, fps, lift }) =>
            analyzeVideoFrames({ frames, fps, lift }),
          update: async ({ id, analysis }) => {
            const { data, error } = await user
              .from('session_videos')
              .update({ analysis })
              .eq('id', id)
              .select('*')
              .single();
            if (error) throw error;
            return rowToSessionVideo(data);
          },
          onBreadcrumb: (step, data) => steps.push([step, data]),
        },
      });

      expect(updated.analysis?.reps.length).toBeGreaterThan(0);
      expect(updated.analysis?.fatigueSignatures).toBeDefined();
      expect(updated.id).toBe(videoId);

      // Verify the row in DB actually changed (round-trip through PostgREST)
      const { data: final, error: finalErr } = await user
        .from('session_videos')
        .select('analysis')
        .eq('id', videoId)
        .single();
      expect(finalErr).toBeNull();
      const finalAnalysis = final?.analysis as {
        reps: unknown[];
        fatigueSignatures?: unknown;
      };
      expect(finalAnalysis.reps.length).toBeGreaterThan(0);

      expect(steps.map(([s]) => s)).toEqual(
        expect.arrayContaining([
          'extract-start',
          'extract-done',
          'analyze-done',
          'db-update-ok',
        ])
      );
    }, 30_000);
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<SessionVideo>): SessionVideo {
  return {
    id: 'r1',
    sessionId: 's1',
    lift: 'deadlift',
    setNumber: 1,
    sagittalConfidence: 0.8,
    localUri: 'file:///video.mp4',
    remoteUri: null,
    durationSec: 10,
    analysis: null,
    coachingResponse: null,
    setWeightGrams: null,
    setReps: null,
    setRpe: null,
    recordedBy: null,
    recordedByName: null,
    videoWidthPx: null,
    videoHeightPx: null,
    debugLandmarks: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeLandmark() {
  return { x: 0.5, y: 0.5, z: 0, visibility: 1 };
}

function analysisWithReps(n: number) {
  return {
    fps: 4,
    reps: Array.from({ length: n }, (_, i) => ({
      repNumber: i + 1,
      startFrame: i * 10,
      endFrame: i * 10 + 9,
      barPath: [],
      forwardLeanDeg: 0,
      barDriftCm: 0,
      romCm: 0,
      kneeAngleDeg: 0,
      hipAngleAtLockoutDeg: 0,
      lockoutStabilityCv: 0,
      faults: [],
    })),
    cameraAngle: 'side' as const,
    sagittalConfidence: 0.8,
    analysisVersion: 4,
  } as never;
}

function rowToSessionVideo(row: Record<string, unknown>): SessionVideo {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    lift: row.lift as string,
    setNumber: row.set_number as number,
    sagittalConfidence: row.sagittal_confidence as number,
    localUri: row.local_uri as string,
    remoteUri: (row.remote_uri as string) ?? null,
    durationSec: row.duration_sec as number,
    analysis: row.analysis as SessionVideo['analysis'],
    coachingResponse: null,
    setWeightGrams: (row.set_weight_grams as number) ?? null,
    setReps: (row.set_reps as number) ?? null,
    setRpe: (row.set_rpe as number) ?? null,
    recordedBy: (row.recorded_by as string) ?? null,
    recordedByName: null,
    videoWidthPx: (row.video_width_px as number) ?? null,
    videoHeightPx: (row.video_height_px as number) ?? null,
    debugLandmarks: null,
    createdAt: row.created_at as string,
  };
}
