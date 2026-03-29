import type { VideoAnalysisResult, FormCoachingResult } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import type { SessionVideo } from '../model/types';

// session_videos table is not yet in the generated types — this cast will be
// removed once migration mobile-046 step 1.2 lands and types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = typedSupabase as any;

interface SessionVideoRow {
  id: string;
  session_id: string;
  lift: string;
  camera_angle: string;
  local_uri: string;
  remote_uri: string | null;
  duration_sec: number;
  analysis: unknown;
  coaching_response: unknown;
  created_at: string;
}

function toSessionVideo(row: SessionVideoRow): SessionVideo {
  return {
    id: row.id,
    sessionId: row.session_id,
    lift: row.lift,
    cameraAngle: (row.camera_angle === 'front' ? 'front' : 'side') as 'side' | 'front',
    localUri: row.local_uri,
    remoteUri: row.remote_uri,
    durationSec: row.duration_sec,
    analysis: (row.analysis as VideoAnalysisResult) ?? null,
    coachingResponse: (row.coaching_response as FormCoachingResult) ?? null,
    createdAt: row.created_at,
  };
}

export async function insertSessionVideo({
  sessionId,
  lift,
  cameraAngle = 'side',
  localUri,
  remoteUri,
  durationSec,
}: {
  sessionId: string;
  lift: string;
  cameraAngle?: 'side' | 'front';
  localUri: string;
  remoteUri?: string | null;
  durationSec: number;
}) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row: Record<string, unknown> = {
    user_id: user.id,
    session_id: sessionId,
    lift,
    local_uri: localUri,
    remote_uri: remoteUri ?? null,
    duration_sec: durationSec,
    analysis: null,
  };
  // camera_angle column added in migration 20260329000002 — only include
  // if explicitly set to avoid PGRST204 on databases without the migration.
  if (cameraAngle !== 'side') {
    row.camera_angle = cameraAngle;
  }

  const { data, error } = await db
    .from('session_videos')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return toSessionVideo(data as SessionVideoRow);
}

export async function getVideoForSessionLift({
  sessionId,
  lift,
}: {
  sessionId: string;
  lift: string;
}) {
  const { data, error } = await db
    .from('session_videos')
    .select('*')
    .eq('session_id', sessionId)
    .eq('lift', lift)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    captureException(error);
    throw error;
  }

  return data ? toSessionVideo(data as SessionVideoRow) : null;
}

export async function getVideosForLift({ lift }: { lift: string }) {
  const { data, error } = await db
    .from('session_videos')
    .select('*')
    .eq('lift', lift)
    .order('created_at', { ascending: false });

  if (error) {
    captureException(error);
    throw error;
  }

  return (data as SessionVideoRow[]).map(toSessionVideo);
}

export async function updateSessionVideoAnalysis({
  id,
  analysis,
}: {
  id: string;
  analysis: VideoAnalysisResult;
}) {
  const { data, error } = await db
    .from('session_videos')
    .update({ analysis })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return toSessionVideo(data as SessionVideoRow);
}

export async function updateSessionVideoCoaching({
  id,
  coachingResponse,
}: {
  id: string;
  coachingResponse: FormCoachingResult;
}) {
  const { data, error } = await db
    .from('session_videos')
    .update({ coaching_response: coachingResponse })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return toSessionVideo(data as SessionVideoRow);
}

export async function deleteSessionVideo({ id }: { id: string }) {
  const { error } = await db.from('session_videos').delete().eq('id', id);

  if (error) {
    captureException(error);
    throw error;
  }
}
