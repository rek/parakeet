// @spec docs/features/social/spec-session-visibility.md
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import type { PartnerActiveSession } from '../model/types';

export async function fetchPartnerActiveSession({
  partnerId,
}: {
  partnerId: string;
}) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, status, primary_lift, planned_sets')
    .eq('user_id', partnerId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    captureException(error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    status: data.status,
    primaryLift: data.primary_lift,
    plannedSets: Array.isArray(data.planned_sets) ? data.planned_sets : [],
  } satisfies PartnerActiveSession;
}

export function subscribeToPartnerSessions({
  partnerIds,
  onUpdate,
}: {
  partnerIds: string[];
  onUpdate: (partnerId: string) => void;
}) {
  if (partnerIds.length === 0) return () => {};

  const channel = typedSupabase
    .channel('partner-sessions')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `user_id=in.(${partnerIds.join(',')})`,
      },
      (payload) => {
        const userId = (payload.new as Record<string, unknown>)?.user_id;
        if (typeof userId === 'string') onUpdate(userId);
      }
    )
    .subscribe();

  return () => {
    typedSupabase.removeChannel(channel);
  };
}
