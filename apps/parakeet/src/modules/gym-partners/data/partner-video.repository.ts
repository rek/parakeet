import type { Json } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

export async function insertPartnerSessionVideo({
  targetUserId,
  sessionId,
  lift,
  setNumber,
  sagittalConfidence = 0.8,
  localUri,
  durationSec,
  analysis,
}: {
  targetUserId: string;
  sessionId: string;
  lift: string;
  setNumber: number;
  sagittalConfidence?: number;
  localUri: string;
  durationSec: number;
  analysis?: Json;
}) {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await typedSupabase
    .from('session_videos')
    .insert({
      user_id: targetUserId,
      recorded_by: user.id,
      session_id: sessionId,
      lift,
      set_number: setNumber,
      sagittal_confidence: sagittalConfidence,
      local_uri: localUri,
      duration_sec: Math.round(durationSec),
      ...(analysis != null ? { analysis } : {}),
    })
    .select('id')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return { videoId: data.id };
}

export async function fetchUnseenPartnerVideoCount({
  sinceTimestamp,
}: {
  sinceTimestamp: string | null;
}) {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = typedSupabase
    .from('session_videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('recorded_by', 'is', null);

  if (sinceTimestamp) {
    query = query.gt('created_at', sinceTimestamp);
  }

  const { count, error } = await query;

  if (error) {
    captureException(error);
    throw error;
  }

  return count ?? 0;
}

export function subscribeToPartnerVideoInserts({
  onInsert,
}: {
  onInsert: () => void;
}) {
  const channel = typedSupabase
    .channel('partner-video-inserts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_videos',
      },
      (payload) => {
        const recordedBy = (payload.new as Record<string, unknown>)
          ?.recorded_by;
        if (recordedBy != null) {
          onInsert();
        }
      }
    )
    .subscribe();

  return () => {
    typedSupabase.removeChannel(channel);
  };
}
