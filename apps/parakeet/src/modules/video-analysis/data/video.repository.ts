import {
  VideoAnalysisResultSchema,
  FormCoachingResultSchema,
} from '@parakeet/shared-types';
import type { VideoAnalysisResult, FormCoachingResult } from '@parakeet/shared-types';
import type { DbRow } from '@platform/supabase';
import { toJson, typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import type { SessionVideo } from '../model/types';

type SessionVideoRow = DbRow<'session_videos'>;

function parseAnalysis(raw: unknown): VideoAnalysisResult | null {
  if (raw == null) return null;
  const result = VideoAnalysisResultSchema.safeParse(raw);
  if (result.success) return result.data;
  captureException(new Error(`Invalid analysis JSON: ${result.error.message}`));
  return null;
}

function parseCoaching(raw: unknown): FormCoachingResult | null {
  if (raw == null) return null;
  const result = FormCoachingResultSchema.safeParse(raw);
  if (result.success) return result.data;
  captureException(new Error(`Invalid coaching JSON: ${result.error.message}`));
  return null;
}

type VideoRowWithProfile = SessionVideoRow & {
  recorded_by_profile?: { display_name: string | null } | null;
};

function toSessionVideo(row: VideoRowWithProfile): SessionVideo {
  return {
    id: row.id,
    sessionId: row.session_id,
    lift: row.lift,
    setNumber: row.set_number,
    cameraAngle: (row.camera_angle === 'front' ? 'front' : 'side') as 'side' | 'front',
    localUri: row.local_uri,
    remoteUri: row.remote_uri,
    durationSec: row.duration_sec,
    analysis: parseAnalysis(row.analysis),
    coachingResponse: parseCoaching(row.coaching_response),
    setWeightGrams: row.set_weight_grams ?? null,
    setReps: row.set_reps ?? null,
    setRpe: row.set_rpe != null ? Number(row.set_rpe) : null,
    recordedBy: row.recorded_by ?? null,
    recordedByName: row.recorded_by
      ? (row.recorded_by_profile?.display_name ?? 'Partner')
      : null,
    createdAt: row.created_at,
  };
}

const SELECT_WITH_PROFILE =
  '*, recorded_by_profile:profiles!session_videos_recorded_by_fkey(display_name)' as const;

export async function insertSessionVideo({
  sessionId,
  lift,
  setNumber,
  cameraAngle = 'side',
  localUri,
  remoteUri,
  durationSec,
  setWeightGrams,
  setReps,
  setRpe,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  cameraAngle?: 'side' | 'front';
  localUri: string;
  remoteUri?: string | null;
  durationSec: number;
  setWeightGrams?: number | null;
  setReps?: number | null;
  setRpe?: number | null;
}) {
  const { data: { user } } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await typedSupabase
    .from('session_videos')
    .insert({
      user_id: user.id,
      session_id: sessionId,
      lift,
      set_number: setNumber,
      camera_angle: cameraAngle,
      local_uri: localUri,
      remote_uri: remoteUri ?? null,
      duration_sec: durationSec,
      set_weight_grams: setWeightGrams ?? null,
      set_reps: setReps ?? null,
      set_rpe: setRpe ?? null,
    })
    .select('*')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return toSessionVideo(data);
}

export async function getVideoForSessionLift({
  sessionId,
  lift,
  setNumber,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
}) {
  const { data, error } = await typedSupabase
    .from('session_videos')
    .select(SELECT_WITH_PROFILE)
    .eq('session_id', sessionId)
    .eq('lift', lift)
    .eq('set_number', setNumber)
    .order('created_at', { ascending: false });

  if (error) {
    captureException(error);
    throw error;
  }

  return (data ?? []).map((row) => toSessionVideo(row as VideoRowWithProfile));
}

export async function getVideosForSessionLift({
  sessionId,
  lift,
}: {
  sessionId: string;
  lift: string;
}) {
  const { data, error } = await typedSupabase
    .from('session_videos')
    .select(SELECT_WITH_PROFILE)
    .eq('session_id', sessionId)
    .eq('lift', lift)
    .order('set_number', { ascending: true });

  if (error) {
    captureException(error);
    throw error;
  }

  return (data ?? []).map((row) => toSessionVideo(row as VideoRowWithProfile));
}

export async function getVideosForLift({
  lift,
  setNumber,
}: {
  lift: string;
  setNumber?: number;
}) {
  let query = typedSupabase
    .from('session_videos')
    .select(SELECT_WITH_PROFILE)
    .eq('lift', lift)
    .order('created_at', { ascending: false });

  if (setNumber != null) {
    query = query.eq('set_number', setNumber);
  }

  const { data, error } = await query;

  if (error) {
    captureException(error);
    throw error;
  }

  return (data ?? []).map((row) => toSessionVideo(row as VideoRowWithProfile));
}

export async function updateSessionVideoAnalysis({
  id,
  analysis,
}: {
  id: string;
  analysis: VideoAnalysisResult;
}) {
  const { data, error } = await typedSupabase
    .from('session_videos')
    .update({ analysis: toJson(analysis) })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return toSessionVideo(data);
}

export async function updateSessionVideoCoaching({
  id,
  coachingResponse,
}: {
  id: string;
  coachingResponse: FormCoachingResult;
}) {
  const { data, error } = await typedSupabase
    .from('session_videos')
    .update({ coaching_response: toJson(coachingResponse) })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return toSessionVideo(data);
}

/**
 * Store raw PoseFrame[] landmarks for calibration debugging.
 * Only called in __DEV__ — the column is nullable and ignored in production.
 */
export async function updateSessionVideoDebugLandmarks({
  id,
  frames,
  fps,
}: {
  id: string;
  frames: unknown[];
  fps: number;
}) {
  const payload = { frames, fps, extractedAt: new Date().toISOString() };
  const { error } = await typedSupabase
    .from('session_videos')
    .update({ debug_landmarks: toJson(payload) })
    .eq('id', id);

  if (error) {
    captureException(error);
    // Non-fatal — debug data loss is acceptable
  }
}

export async function deleteSessionVideo({ id }: { id: string }) {
  const { error } = await typedSupabase.from('session_videos').delete().eq('id', id);

  if (error) {
    captureException(error);
    throw error;
  }
}
