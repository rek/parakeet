// @spec docs/features/flock/spec-data-foundation.md
import { typedSupabase } from '@platform/supabase';
import { weightGramsToKg } from '@shared/utils/weight';

import type {
  FlockCard,
  FlockHighlightInput,
  HeadlineKind,
} from '../model/flock.types';

/** All sharers' cards except the current user, newest highlight first. */
export async function fetchFlockHighlights(
  currentUserId: string
): Promise<FlockCard[]> {
  const { data, error } = await typedSupabase
    .from('flock_highlights')
    .select('*')
    .neq('user_id', currentUserId)
    .order('published_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    headline: row.headline,
    headlineKind: row.headline_kind as HeadlineKind,
    prLift: row.latest_pr_lift,
    prWeightKg:
      row.latest_pr_weight_g !== null
        ? weightGramsToKg(row.latest_pr_weight_g)
        : null,
    prReps: row.latest_pr_reps,
    wilks: row.wilks,
    wilksDelta: row.wilks_delta,
    streakWeeks: row.streak_weeks,
    publishedAt: row.published_at,
  }));
}

/** Publish (upsert) the current user's single highlight row. Owner-only via RLS. */
export async function upsertFlockHighlight(
  userId: string,
  input: FlockHighlightInput,
  publishedAt: string
): Promise<void> {
  const { error } = await typedSupabase.from('flock_highlights').upsert({
    user_id: userId,
    display_name: input.displayName,
    headline: input.headline,
    headline_kind: input.headlineKind,
    latest_pr_lift: input.latestPrLift,
    latest_pr_weight_g: input.latestPrWeightG,
    latest_pr_reps: input.latestPrReps,
    wilks: input.wilks,
    wilks_delta: input.wilksDelta,
    streak_weeks: input.streakWeeks,
    published_at: publishedAt,
  });

  if (error) throw error;
}

/** Remove the current user's card (used when sharing is turned off). */
export async function deleteFlockHighlight(userId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('flock_highlights')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

/** The Wilks value on the user's last published row, for delta computation. */
export async function getPublishedWilks(
  userId: string
): Promise<number | null> {
  const { data, error } = await typedSupabase
    .from('flock_highlights')
    .select('wilks')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.wilks ?? null;
}

/** Whether the user has opted into sharing. Defaults to false when no row. */
export async function getFlockSharing(userId: string): Promise<boolean> {
  const { data, error } = await typedSupabase
    .from('flock_config')
    .select('sharing_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.sharing_enabled ?? false;
}

export async function setFlockSharing(
  userId: string,
  enabled: boolean,
  updatedAt: string
): Promise<void> {
  const { error } = await typedSupabase.from('flock_config').upsert({
    user_id: userId,
    sharing_enabled: enabled,
    updated_at: updatedAt,
  });

  if (error) throw error;
}
