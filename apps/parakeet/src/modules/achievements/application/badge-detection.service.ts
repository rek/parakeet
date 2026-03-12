import type {
  BadgeCheckContext,
  BadgeId,
  EarnedBadge,
} from '@parakeet/training-engine';
import {
  BADGE_CATALOG,
  checkPerformanceBadges,
  checkSituationalBadges,
  checkRpeEffortBadges,
  checkVolumeRepBadges,
  checkSessionMilestoneBadges,
  checkWildRareBadges,
  checkLiftIdentityBadges,
  checkRestPacingBadges,
} from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';

import { fetchUserBadgeIds, insertBadges } from '../data/badge.repository';

import type { ActualSet } from '../hooks/useAchievementDetection';

// ── Types ────────────────────────────────────────────────────────────────────

interface BadgeDetectionInput {
  sessionId: string;
  userId: string;
  actualSets: ActualSet[];
  earnedPRs: Array<{
    type: string;
    lift: string;
    value: number;
    weightKg?: number;
  }>;
  streakWeeks: number;
  cycleBadgeEarned: boolean;
  primaryLift: string | null;
  programId: string | null;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function detectBadges(
  input: BadgeDetectionInput
): Promise<EarnedBadge[]> {
  const {
    sessionId,
    userId,
    actualSets,
    earnedPRs,
    streakWeeks,
    cycleBadgeEarned,
    primaryLift,
    programId,
  } = input;

  // 1. Fetch already-earned badges + supporting data in parallel
  const [alreadyEarned, sessionLog, profile, sessionCount, previousSession] =
    await Promise.all([
      fetchUserBadgeIds(userId),
      fetchSessionLog(sessionId),
      fetchProfile(userId),
      fetchCompletedSessionCount(userId),
      fetchPreviousSession(userId, sessionId),
    ]);

  // 2. Build context for pure checkers
  const ctx: BadgeCheckContext = {
    sessionId,
    actualSets: actualSets.map((s) => ({
      set_number: 0, // not used by checkers
      weight_grams: s.weight_grams,
      reps_completed: s.reps_completed,
      rpe_actual: s.rpe_actual,
      actual_rest_seconds: undefined, // TODO: wire from session log JSONB
      is_completed: s.is_completed,
    })),
    plannedSets: (
      (Array.isArray(sessionLog?.planned_sets)
        ? sessionLog.planned_sets
        : []) as Array<Record<string, unknown>>
    ).map(
      (s: Record<string, unknown>) => ({
        set_number: (s.set_number as number) ?? 0,
        weight_grams: (s.weight_grams as number) ?? 0,
        reps: (s.reps as number) ?? 0,
        rpe_target: s.rpe_target as number | undefined,
      })
    ),
    startedAt: sessionLog?.started_at ?? null,
    completedAt: sessionLog?.completed_at ?? null,
    durationSeconds: sessionLog?.duration_seconds ?? null,
    primaryLift,
    isDeload: sessionLog?.is_deload ?? false,
    programId,

    earnedPRs,
    totalCompletedSessions: sessionCount,
    completedCycles: cycleBadgeEarned ? 1 : 0, // simplified — just checks this session
    allLiftE1RMs: await fetchAllLiftE1RMs(userId),
    bodyweightKg: profile?.bodyweight_kg ?? null,
    streakWeeks,

    sleepQuality: null, // TODO: Slice 6 — fetch from soreness_checkins
    energyLevel: null,

    hasActiveMajorDisruption: false, // TODO: Slice 6
    daysSinceLastDisruption: null,
    lastDisruptionDurationDays: null,

    completedAtHour: sessionLog?.completed_at
      ? new Date(sessionLog.completed_at).getHours()
      : null,

    previousSessionWasDeload: previousSession?.is_deload ?? false,
    previousE1Rm: {}, // TODO: Slice 5 — fetch previous best e1RMs
  };

  // 3. Run all checkers
  const candidates: BadgeId[] = [
    ...checkPerformanceBadges(ctx),
    ...checkSituationalBadges(ctx),
    ...checkRpeEffortBadges(ctx),
    ...checkVolumeRepBadges(ctx),
    ...checkSessionMilestoneBadges(ctx),
    ...checkWildRareBadges(ctx),
    ...checkLiftIdentityBadges(ctx),
    ...checkRestPacingBadges(ctx),
  ];

  // 4. Filter already earned
  const newBadgeIds = candidates.filter((id) => !alreadyEarned.has(id));
  if (newBadgeIds.length === 0) return [];

  // 5. Persist
  await insertBadges(
    userId,
    newBadgeIds.map((id) => ({ badgeId: id, sessionId }))
  );

  // 6. Return for UI
  return newBadgeIds.map((id) => {
    const def = BADGE_CATALOG[id];
    return {
      id,
      name: def.name,
      emoji: def.emoji,
      flavor: def.flavor,
    };
  });
}

// ── Data fetchers (badge-specific) ───────────────────────────────────────────

async function fetchSessionLog(sessionId: string) {
  // session_logs for timing data, join sessions for is_deload + planned_sets
  const [logResult, sessionResult] = await Promise.all([
    typedSupabase
      .from('session_logs')
      .select(
        'started_at, completed_at, duration_seconds, actual_sets, completion_pct'
      )
      .eq('session_id', sessionId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    typedSupabase
      .from('sessions')
      .select('is_deload, planned_sets')
      .eq('id', sessionId)
      .maybeSingle(),
  ]);

  if (logResult.error) throw logResult.error;
  if (sessionResult.error) throw sessionResult.error;

  if (!logResult.data) return null;

  return {
    ...logResult.data,
    is_deload: sessionResult.data?.is_deload ?? false,
    planned_sets: sessionResult.data?.planned_sets ?? [],
  };
}

async function fetchProfile(userId: string) {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('bodyweight_kg')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchCompletedSessionCount(userId: string): Promise<number> {
  const { count, error } = await typedSupabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error) throw error;
  return count ?? 0;
}

async function fetchPreviousSession(userId: string, currentSessionId: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, is_deload')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .neq('id', currentSessionId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchAllLiftE1RMs(
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await typedSupabase
    .from('personal_records')
    .select('lift, value')
    .eq('user_id', userId)
    .eq('pr_type', 'estimated_1rm');

  if (error) throw error;

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const lift = row.lift as string;
    const value = row.value as number;
    if ((result[lift] ?? 0) < value) result[lift] = value;
  }
  return result;
}
