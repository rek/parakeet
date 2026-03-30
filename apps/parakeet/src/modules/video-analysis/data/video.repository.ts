import type { VideoAnalysisResult, FormCoachingResult } from '@parakeet/shared-types';
import type { DbRow } from '@platform/supabase';
import { fromJson, toJson, typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import type { SessionVideo } from '../model/types';

type SessionVideoRow = DbRow<'session_videos'>;

function toSessionVideo(row: SessionVideoRow): SessionVideo {
  return {
    id: row.id,
    sessionId: row.session_id,
    lift: row.lift,
    setNumber: row.set_number,
    cameraAngle: (row.camera_angle === 'front' ? 'front' : 'side') as 'side' | 'front',
    localUri: row.local_uri,
    remoteUri: row.remote_uri,
    durationSec: row.duration_sec,
    analysis: fromJson<VideoAnalysisResult | null>(row.analysis),
    coachingResponse: fromJson<FormCoachingResult | null>(row.coaching_response),
    createdAt: row.created_at,
  };
}

export async function insertSessionVideo({
  sessionId,
  lift,
  setNumber,
  cameraAngle = 'side',
  localUri,
  remoteUri,
  durationSec,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  cameraAngle?: 'side' | 'front';
  localUri: string;
  remoteUri?: string | null;
  durationSec: number;
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
    .select('*')
    .eq('session_id', sessionId)
    .eq('lift', lift)
    .eq('set_number', setNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    captureException(error);
    throw error;
  }

  return data ? toSessionVideo(data) : null;
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
    .select('*')
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

  return (data ?? []).map(toSessionVideo);
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

export async function deleteSessionVideo({ id }: { id: string }) {
  const { error } = await typedSupabase.from('session_videos').delete().eq('id', id);

  if (error) {
    captureException(error);
    throw error;
  }
}
