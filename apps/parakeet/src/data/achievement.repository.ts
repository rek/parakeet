import type { PR } from '@parakeet/training-engine';
import type { Lift } from '@parakeet/shared-types';

import { typedSupabase } from '../network/supabase-client';

const db = typedSupabase as any;

export async function upsertPersonalRecords(userId: string, prs: PR[]): Promise<void> {
  if (prs.length === 0) return;

  await db.from('personal_records').upsert(
    prs.map((pr) => ({
      user_id: userId,
      lift: pr.lift,
      pr_type: pr.type,
      value: pr.value,
      weight_kg: pr.weightKg ?? null,
      session_id: pr.sessionId,
      achieved_at: pr.achievedAt,
    })),
    { onConflict: 'user_id,lift,pr_type,weight_kg' },
  );
}

export async function fetchPersonalRecords(userId: string, lift: Lift) {
  const { data } = await db
    .from('personal_records')
    .select('pr_type, value, weight_kg')
    .eq('user_id', userId)
    .eq('lift', lift);

  return data ?? [];
}

export async function fetchSessionsForStreak(userId: string) {
  const { data } = await db
    .from('sessions')
    .select('id, planned_date, status')
    .eq('user_id', userId)
    .not('planned_date', 'is', null)
    .order('planned_date', { ascending: true });

  return data ?? [];
}

export async function fetchDisruptionsForStreak(userId: string) {
  const { data } = await db
    .from('disruptions')
    .select('affected_date_start, affected_date_end, session_ids_affected')
    .eq('user_id', userId);

  return data ?? [];
}

export async function fetchProgramsForCycleBadges(userId: string) {
  const { data } = await db
    .from('programs')
    .select('id, version, start_date, total_weeks, status')
    .eq('user_id', userId)
    .in('status', ['completed', 'archived'])
    .order('version', { ascending: true });

  return data ?? [];
}

export async function fetchProgramSessionStatuses(programId: string, userId: string) {
  const { data } = await db
    .from('sessions')
    .select('status')
    .eq('program_id', programId)
    .eq('user_id', userId);

  return data ?? [];
}

export async function fetchProfileForWilks(userId: string) {
  const { data } = await db
    .from('profiles')
    .select('biological_sex, bodyweight_kg')
    .eq('id', userId)
    .maybeSingle();

  return data;
}

export async function fetchMaxesForWilks(userId: string) {
  const { data } = await db
    .from('lifter_maxes')
    .select('recorded_at, squat_1rm_grams, bench_1rm_grams, deadlift_1rm_grams')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true });

  return data ?? [];
}

export async function fetchProgramsForWilks(userId: string) {
  const { data } = await db
    .from('programs')
    .select('id, version, start_date')
    .eq('user_id', userId)
    .in('status', ['completed', 'archived'])
    .order('version', { ascending: true });

  return data ?? [];
}
