import type { Json } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';

import type { BadgeId } from '../lib/engine-adapter';

/** Fetch the set of badge IDs already earned by a user. */
export async function fetchUserBadgeIds(userId: string): Promise<Set<BadgeId>> {
  const { data, error } = await typedSupabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);

  if (error) throw error;
  return new Set((data ?? []).map((r) => r.badge_id as BadgeId));
}

/** Fetch all earned badges with full metadata (for achievements screen). */
export async function fetchUserBadges(userId: string) {
  const { data, error } = await typedSupabase
    .from('user_badges')
    .select('badge_id, earned_at, session_id, metadata')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Insert newly earned badges. Ignores duplicates via UNIQUE constraint. */
export async function insertBadges(
  userId: string,
  badges: Array<{
    badgeId: BadgeId;
    sessionId: string | null;
    metadata?: Json;
  }>
): Promise<void> {
  if (badges.length === 0) return;

  const { error } = await typedSupabase.from('user_badges').upsert(
    badges.map((b) => ({
      user_id: userId,
      badge_id: b.badgeId,
      session_id: b.sessionId,
      metadata: b.metadata ?? null,
    })),
    { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
  );
  if (error) throw error;
}
