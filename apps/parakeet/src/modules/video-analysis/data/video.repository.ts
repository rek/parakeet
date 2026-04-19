import {
  FormCoachingResultSchema,
  VideoAnalysisResultSchema,
} from '@parakeet/shared-types';
import type {
  FormCoachingResult,
  VideoAnalysisResult,
} from '@parakeet/shared-types';
import type { DbRow } from '@platform/supabase';
import { toJson, typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import {
  DebugLandmarksSchema,
  type DebugLandmarks,
} from '../lib/pose-types';
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

function parseDebugLandmarks(raw: unknown): DebugLandmarks | null {
  if (raw == null) return null;
  const result = DebugLandmarksSchema.safeParse(raw);
  if (result.success) return result.data;
  // Non-fatal — the overlay simply stays disabled for malformed rows.
  captureException(
    new Error(`Invalid debug_landmarks JSON: ${result.error.message}`)
  );
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
    sagittalConfidence: row.sagittal_confidence,
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
    videoWidthPx: row.video_width_px ?? null,
    videoHeightPx: row.video_height_px ?? null,
    debugLandmarks: parseDebugLandmarks(row.debug_landmarks),
    createdAt: row.created_at,
  };
}

const SELECT_WITH_PROFILE =
  '*, recorded_by_profile:profiles!session_videos_recorded_by_fkey(display_name)' as const;

export async function insertSessionVideo({
  sessionId,
  lift,
  setNumber,
  sagittalConfidence = 0.8,
  localUri,
  durationSec,
  setWeightGrams,
  setReps,
  setRpe,
  videoWidthPx,
  videoHeightPx,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  sagittalConfidence?: number;
  localUri: string;
  durationSec: number;
  setWeightGrams?: number | null;
  setReps?: number | null;
  setRpe?: number | null;
  videoWidthPx?: number | null;
  videoHeightPx?: number | null;
}) {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // `remote_uri` is intentionally not written. Videos stay on-device as
  // of backlog #17; legacy rows retain their value for eventual cleanup.
  const { data, error } = await typedSupabase
    .from('session_videos')
    .insert({
      user_id: user.id,
      session_id: sessionId,
      lift,
      set_number: setNumber,
      sagittal_confidence: sagittalConfidence,
      local_uri: localUri,
      duration_sec: Math.round(durationSec),
      set_weight_grams: setWeightGrams ?? null,
      set_reps: setReps ?? null,
      set_rpe: setRpe ?? null,
      video_width_px: videoWidthPx ?? null,
      video_height_px: videoHeightPx ?? null,
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
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await typedSupabase
    .from('session_videos')
    .select(SELECT_WITH_PROFILE)
    .eq('user_id', user.id)
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
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await typedSupabase
    .from('session_videos')
    .select(SELECT_WITH_PROFILE)
    .eq('user_id', user.id)
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
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = typedSupabase
    .from('session_videos')
    .select(SELECT_WITH_PROFILE)
    .eq('user_id', user.id)
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
 * Persist raw PoseFrame[] landmarks to `session_videos.debug_landmarks`.
 *
 * Used by the playback skeleton overlay (backlog #19 Phase 2) — the column
 * is nullable so rows created before this shipped simply hide the overlay.
 * Non-fatal on write failure: losing the skeleton is preferable to blocking
 * the primary save path, so the caller should not `await` for correctness.
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
  }
}

export async function deleteSessionVideo({ id }: { id: string }) {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the row first to get file URIs for cleanup
  const { data: row, error: fetchError } = await typedSupabase
    .from('session_videos')
    .select('local_uri, remote_uri')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    captureException(fetchError);
    throw fetchError;
  }

  // Delete DB row
  const { error } = await typedSupabase
    .from('session_videos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    captureException(error);
    throw error;
  }

  // Best-effort local file cleanup
  if (row?.local_uri) {
    try {
      const { File } = await import('expo-file-system');
      const { normalizeVideoUri } = await import('../lib/normalize-video-uri');
      const file = new File(normalizeVideoUri(row.local_uri));
      if (file.exists) {
        file.delete();
      }
    } catch (err) {
      captureException(err);
    }
  }

  // Best-effort remote storage cleanup
  if (row?.remote_uri) {
    try {
      const storagePath = `${user.id}/${id}.mp4`;
      const { error: storageError } = await typedSupabase.storage
        .from('session-videos')
        .remove([storagePath]);
      if (storageError) {
        captureException(storageError);
      }
    } catch (err) {
      captureException(err);
    }
  }
}
