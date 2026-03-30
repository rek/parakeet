import type {
  BadgeCheckContext,
  ConsistencyData,
  ProgramLoyaltyData,
} from '@parakeet/training-engine';
import {
  checkConsistencyBadges,
  checkCouplesBadges,
  checkLiftIdentityBadges,
  checkPerformanceBadges,
  checkProgramLoyaltyBadges,
  checkRestPacingBadges,
  checkRpeEffortBadges,
  checkSessionMilestoneBadges,
  checkSituationalBadges,
  checkVolumeRepBadges,
  checkWildRareBadges,
  detectStreakBreakAndRebuild,
} from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';

import {
  fetchDisruptionsForStreak,
  fetchSessionsForStreak,
} from '../data/achievement.repository';
import { fetchUserBadgeIds, insertBadges } from '../data/badge.repository';
import type { ActualSet } from '../hooks/useAchievementDetection';
import {
  BADGE_CATALOG,
  type BadgeId,
  type EarnedBadge,
} from '../lib/engine-adapter';
import { buildWeekStatuses } from '../utils/week-status-builder';

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
  /** Pre-upsert e1RM values per lift (for "Technically a PR"). */
  previousE1Rm?: Record<string, number>;
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

  // 1. Fetch all supporting data in parallel
  const [
    alreadyEarned,
    sessionLog,
    profile,
    sessionCount,
    previousSession,
    sorenessData,
    disruptionData,
    allLiftE1RMs,
    prCounts,
    consistencyData,
    programLoyaltyData,
    uniqueAuxCount,
    consecutiveFullRest,
    streakBreakRebuild,
    partnerCompletedToday,
  ] = await Promise.all([
    fetchUserBadgeIds(userId),
    fetchSessionLog(sessionId),
    fetchProfile(userId),
    fetchCompletedSessionCount(userId),
    fetchPreviousSession(userId, sessionId),
    fetchSorenessData(sessionId),
    fetchDisruptionContext(userId),
    fetchAllLiftE1RMs(userId),
    fetchPrTypeCounts(userId),
    fetchConsistencyData(userId, sessionId, streakWeeks),
    fetchProgramLoyaltyData(userId, programId),
    fetchUniqueAuxExercisesInCycle(userId, programId),
    fetchConsecutiveFullRestSessions(userId, sessionId),
    fetchStreakBreakAndRebuild(userId),
    fetchPartnerCompletedToday(userId),
  ]);

  // 2. Build actual sets with rest seconds from JSONB
  const logActualSets = parseActualSetsFromLog(sessionLog?.actual_sets);

  // 3. Build context for pure checkers
  const ctx: BadgeCheckContext = {
    sessionId,
    actualSets: actualSets.map((s, i) => ({
      set_number: i + 1,
      weight_grams: s.weight_grams,
      reps_completed: s.reps_completed,
      rpe_actual: s.rpe_actual,
      actual_rest_seconds: logActualSets[i]?.actual_rest_seconds,
      is_completed: s.is_completed,
    })),
    plannedSets: (
      (Array.isArray(sessionLog?.planned_sets)
        ? sessionLog.planned_sets
        : []) as Array<Record<string, unknown>>
    ).map((s: Record<string, unknown>) => ({
      set_number: (s.set_number as number) ?? 0,
      weight_grams: (s.weight_grams as number) ?? 0,
      reps: (s.reps as number) ?? 0,
      rpe_target: s.rpe_target as number | undefined,
    })),
    startedAt: sessionLog?.started_at ?? null,
    completedAt: sessionLog?.completed_at ?? null,
    durationSeconds: sessionLog?.duration_seconds ?? null,
    primaryLift,
    isDeload: sessionLog?.is_deload ?? false,
    programId,

    earnedPRs,
    totalCompletedSessions: sessionCount,
    completedCycles: cycleBadgeEarned ? 1 : 0,
    allLiftE1RMs,
    bodyweightKg: profile?.bodyweight_kg ?? null,
    streakWeeks,

    sleepQuality: sorenessData.sleepQuality,
    energyLevel: sorenessData.energyLevel,

    hasActiveMajorDisruption: disruptionData.hasActiveMajor,
    daysSinceLastDisruption: disruptionData.daysSinceLast,
    lastDisruptionDurationDays: disruptionData.lastDurationDays,

    completedAtHour: sessionLog?.completed_at
      ? new Date(sessionLog.completed_at).getHours()
      : null,

    previousSessionWasDeload: previousSession?.is_deload ?? false,
    previousE1Rm: input.previousE1Rm ?? {},

    volumePrCount: prCounts.volumePrCount,
    oneRmPrCount: prCounts.oneRmPrCount,
    uniqueAuxExercisesInCycle: uniqueAuxCount,
    consecutiveFullRestSessions: consecutiveFullRest,
    hadStreakBreakAndRebuild: streakBreakRebuild,
    partnerCompletedToday,
  };

  // 4. Run all checkers
  const candidates: BadgeId[] = [
    ...checkPerformanceBadges(ctx),
    ...checkSituationalBadges(ctx),
    ...checkRpeEffortBadges(ctx),
    ...checkVolumeRepBadges(ctx),
    ...checkSessionMilestoneBadges(ctx),
    ...checkWildRareBadges(ctx),
    ...checkLiftIdentityBadges(ctx),
    ...checkRestPacingBadges(ctx),
    ...checkConsistencyBadges(consistencyData),
    ...checkProgramLoyaltyBadges(programLoyaltyData),
    ...checkCouplesBadges(ctx),
  ];

  // 5. Filter already earned
  const newBadgeIds = candidates.filter((id) => !alreadyEarned.has(id));
  if (newBadgeIds.length === 0) return [];

  // 6. Persist
  await insertBadges(
    userId,
    newBadgeIds.map((id) => ({ badgeId: id, sessionId }))
  );

  // 7. Return for UI
  return newBadgeIds.map((id) => {
    const def = BADGE_CATALOG[id];
    return { id, name: def.name, emoji: def.emoji, flavor: def.flavor };
  });
}

// ── Data fetchers ───────────────────────────────────────────────────────────

async function fetchSessionLog(sessionId: string) {
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

function parseActualSetsFromLog(
  actualSets: unknown
): Array<{ actual_rest_seconds?: number }> {
  if (!Array.isArray(actualSets)) return [];
  return actualSets.map((s: Record<string, unknown>) => ({
    actual_rest_seconds:
      typeof s.actual_rest_seconds === 'number'
        ? s.actual_rest_seconds
        : undefined,
  }));
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

// ── Soreness / Readiness ────────────────────────────────────────────────────

async function fetchSorenessData(
  sessionId: string
): Promise<{ sleepQuality: number | null; energyLevel: number | null }> {
  const { data, error } = await typedSupabase
    .from('soreness_checkins')
    .select('ratings')
    .eq('session_id', sessionId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.ratings) return { sleepQuality: null, energyLevel: null };

  const ratings = data.ratings as Record<string, unknown>;
  const sleep =
    typeof ratings.sleep_quality === 'number' ? ratings.sleep_quality : null;
  const energy =
    typeof ratings.energy_level === 'number' ? ratings.energy_level : null;
  return { sleepQuality: sleep, energyLevel: energy };
}

// ── Disruption Context ──────────────────────────────────────────────────────

async function fetchDisruptionContext(userId: string): Promise<{
  hasActiveMajor: boolean;
  daysSinceLast: number | null;
  lastDurationDays: number | null;
}> {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select('severity, status, affected_date_start, affected_date_end')
    .eq('user_id', userId)
    .order('reported_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) {
    return {
      hasActiveMajor: false,
      daysSinceLast: null,
      lastDurationDays: null,
    };
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const hasActiveMajor = data.some(
    (d) =>
      d.severity === 'major' &&
      d.status === 'active' &&
      (d.affected_date_start as string) <= todayStr &&
      ((d.affected_date_end as string | null) ?? '9999-12-31') >= todayStr
  );

  // Find most recently resolved disruption
  const resolved = data.find((d) => d.status === 'resolved');
  let daysSinceLast: number | null = null;
  let lastDurationDays: number | null = null;

  if (resolved) {
    const endDate = (resolved.affected_date_end ??
      resolved.affected_date_start) as string;
    daysSinceLast = Math.floor(
      (now.getTime() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const start = new Date(resolved.affected_date_start as string);
    const end = new Date(endDate);
    lastDurationDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  return { hasActiveMajor, daysSinceLast, lastDurationDays };
}

// ── PR Type Counts ──────────────────────────────────────────────────────────

async function fetchPrTypeCounts(
  userId: string
): Promise<{ volumePrCount: number; oneRmPrCount: number }> {
  const { data, error } = await typedSupabase
    .from('personal_records')
    .select('pr_type')
    .eq('user_id', userId);

  if (error) throw error;

  let volumePrCount = 0;
  let oneRmPrCount = 0;
  for (const row of data ?? []) {
    if (row.pr_type === 'estimated_1rm') oneRmPrCount++;
    else volumePrCount++; // volume + rep_at_weight
  }
  return { volumePrCount, oneRmPrCount };
}

// ── Consistency Data ────────────────────────────────────────────────────────

async function fetchConsistencyData(
  userId: string,
  currentSessionId: string,
  streakWeeks: number
): Promise<ConsistencyData> {
  // Fetch completed sessions with timing + lift data
  const { data: sessions, error } = await typedSupabase
    .from('sessions')
    .select('id, primary_lift, status, planned_date, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) throw error;
  const rows = sessions ?? [];

  // Dawn Patrol / Night Owl — count by completed_at hour
  let sessionsBeforeSixAm = 0;
  let sessionsAfterNinePm = 0;
  let distinctSundays = new Set<string>();

  for (const s of rows) {
    if (s.completed_at) {
      const d = new Date(s.completed_at as string);
      const hour = d.getHours();
      if (hour < 6) sessionsBeforeSixAm++;
      if (hour >= 21) sessionsAfterNinePm++;
      // Sunday check
      if (d.getDay() === 0) {
        distinctSundays.add(d.toISOString().split('T')[0]);
      }
    }
  }

  // Leg Day Loyalist — consecutive completed squat/deadlift sessions
  let consecutiveLegDaySessions = 0;
  for (const s of rows) {
    const lift = s.primary_lift as string | null;
    if (lift === 'squat' || lift === 'deadlift') {
      consecutiveLegDaySessions++;
    } else {
      break; // only count from most recent backwards
    }
  }

  // Perfect Week — all planned sessions this week completed, no extras
  const isPerfectWeek = await checkPerfectWeek(userId);

  // Iron Monk — consecutive sessions where all planned sets were met
  const consecutivePerfectSessions = await fetchConsecutivePerfectSessions(
    userId,
    currentSessionId
  );

  return {
    sessionsBeforeSixAm,
    sessionsAfterNinePm,
    distinctSundaySessions: distinctSundays.size,
    streakWeeks,
    consecutiveLegDaySessions,
    isPerfectWeek,
    consecutivePerfectSessions,
  };
}

async function checkPerfectWeek(userId: string): Promise<boolean> {
  // Get current week boundaries (Monday to Sunday)
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  const { data, error } = await typedSupabase
    .from('sessions')
    .select('status, planned_date')
    .eq('user_id', userId)
    .not('planned_date', 'is', null)
    .gte('planned_date', mondayStr)
    .lte('planned_date', sundayStr);

  if (error) throw error;
  if (!data || data.length === 0) return false;

  // All sessions must be completed — none missed, skipped, or in_progress
  return data.every((s) => s.status === 'completed');
}

async function fetchConsecutivePerfectSessions(
  userId: string,
  _currentSessionId: string
): Promise<number> {
  // Get recent session_logs with actual_sets and planned_sets (via sessions join)
  const { data: recentLogs, error } = await typedSupabase
    .from('session_logs')
    .select('session_id, actual_sets')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!recentLogs || recentLogs.length === 0) return 0;

  // For each session_log, check if every completed set met planned reps
  let consecutive = 0;
  for (const log of recentLogs) {
    const actual = log.actual_sets as Array<Record<string, unknown>> | null;
    if (!Array.isArray(actual) || actual.length === 0) break;

    // Check that every set is completed with reps >= some minimum
    const allMet = actual.every((s) => {
      if (!s.is_completed) return false;
      return (s.reps_completed as number) > 0;
    });

    if (allMet) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

// ── Program Loyalty Data ────────────────────────────────────────────────────

async function fetchProgramLoyaltyData(
  userId: string,
  currentProgramId: string | null
): Promise<ProgramLoyaltyData> {
  // Fetch all programs ordered by version
  const { data: programs, error } = await typedSupabase
    .from('programs')
    .select('id, version, formula_config_id, start_date, status')
    .eq('user_id', userId)
    .order('version', { ascending: false });

  if (error) throw error;
  if (!programs || programs.length === 0) {
    return {
      consecutiveSameFormulaCycles: 0,
      formulaChangesThisCycle: 0,
      consecutiveCyclesWithoutDeload: 0,
    };
  }

  // Consecutive same formula — walk from most recent backwards.
  // Guard: formula_config_id is currently always null (resolved at JIT runtime),
  // so skip this check when null to avoid false positives.
  let consecutiveSameFormula = 0;
  const currentFormula = programs[0].formula_config_id;
  if (currentFormula != null) {
    consecutiveSameFormula = 1;
    for (let i = 1; i < programs.length; i++) {
      if (programs[i].formula_config_id === currentFormula) {
        consecutiveSameFormula++;
      } else {
        break;
      }
    }
  }

  // Formula changes this cycle — count formula_configs created after active program start
  let formulaChangesThisCycle = 0;
  if (currentProgramId) {
    const active = programs.find((p) => p.id === currentProgramId);
    if (active?.start_date) {
      const { count, error: fcError } = await typedSupabase
        .from('formula_configs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', active.start_date as string);

      if (!fcError && count != null) {
        formulaChangesThisCycle = Math.max(0, count - 1); // subtract the initial config
      }
    }
  }

  // Consecutive cycles without deload — single batch query, then walk
  const completedPrograms = programs.filter(
    (p) => p.status === 'completed' || p.status === 'archived'
  );
  let consecutiveCyclesWithoutDeload = 0;
  if (completedPrograms.length > 0) {
    const programIds = completedPrograms.map((p) => p.id as string);
    const { data: deloadSessions, error: deloadErr } = await typedSupabase
      .from('sessions')
      .select('program_id')
      .in('program_id', programIds)
      .eq('is_deload', true)
      .eq('status', 'completed');

    if (!deloadErr) {
      const programsWithDeload = new Set(
        (deloadSessions ?? []).map((s) => s.program_id as string)
      );
      for (const prog of completedPrograms) {
        if (!programsWithDeload.has(prog.id as string)) {
          consecutiveCyclesWithoutDeload++;
        } else {
          break;
        }
      }
    }
  }

  return {
    consecutiveSameFormulaCycles: consecutiveSameFormula,
    formulaChangesThisCycle,
    consecutiveCyclesWithoutDeload,
  };
}

// ── Unique Aux Exercises in Cycle ───────────────────────────────────────────

async function fetchUniqueAuxExercisesInCycle(
  userId: string,
  programId: string | null
): Promise<number> {
  if (!programId) return 0;

  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('auxiliary_sets')
    .eq('user_id', userId)
    .in(
      'session_id',
      // Subquery: session IDs for this program
      (
        await typedSupabase
          .from('sessions')
          .select('id')
          .eq('program_id', programId)
          .eq('status', 'completed')
      ).data?.map((s) => s.id as string) ?? []
    );

  if (error) throw error;

  const exerciseNames = new Set<string>();
  for (const log of data ?? []) {
    const auxSets = log.auxiliary_sets as Array<Record<string, unknown>> | null;
    if (!Array.isArray(auxSets)) continue;
    for (const s of auxSets) {
      if (typeof s.exercise === 'string' && s.exercise) {
        exerciseNames.add(s.exercise);
      }
    }
  }

  return exerciseNames.size;
}

// ── Consecutive Full Rest Sessions ──────────────────────────────────────────

const MIN_FULL_REST_SECONDS = 90; // threshold for "waited for full timer"

async function fetchConsecutiveFullRestSessions(
  userId: string,
  _currentSessionId: string
): Promise<number> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('session_id, actual_sets')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let consecutive = 0;
  for (const log of data) {
    const sets = log.actual_sets as Array<Record<string, unknown>> | null;
    if (!Array.isArray(sets) || sets.length === 0) break;

    const completedSets = sets.filter((s) => s.is_completed === true);
    if (completedSets.length === 0) break;

    // Every completed set must have actual_rest_seconds >= threshold
    const allFullRest = completedSets.every(
      (s) =>
        typeof s.actual_rest_seconds === 'number' &&
        s.actual_rest_seconds >= MIN_FULL_REST_SECONDS
    );

    if (allFullRest) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

// ── Partner Completed Today (Power Couple) ─────────────────────────────────

async function fetchPartnerCompletedToday(userId: string): Promise<boolean> {
  // Get accepted partner IDs
  const { data: partners, error: partnerError } = await typedSupabase
    .from('gym_partners')
    .select('requester_id, responder_id')
    .or(`requester_id.eq.${userId},responder_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (partnerError || !partners || partners.length === 0) return false;

  const partnerIds = partners.map((p) =>
    p.requester_id === userId ? p.responder_id : p.requester_id,
  );

  // Check if any partner completed a session today
  const todayStr = new Date().toISOString().split('T')[0];
  const { count, error: sessionError } = await typedSupabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .in('user_id', partnerIds)
    .eq('status', 'completed')
    .gte('completed_at', `${todayStr}T00:00:00`)
    .lt('completed_at', `${todayStr}T23:59:59.999`);

  if (sessionError) return false;
  return (count ?? 0) > 0;
}

// ── Streak Break & Rebuild ──────────────────────────────────────────────────

async function fetchStreakBreakAndRebuild(userId: string): Promise<boolean> {
  const todayStr = new Date().toISOString().split('T')[0];

  const [sessions, disruptions] = await Promise.all([
    fetchSessionsForStreak(userId),
    fetchDisruptionsForStreak(userId),
  ]);

  const weekStatuses = buildWeekStatuses(sessions, disruptions, todayStr);
  return detectStreakBreakAndRebuild(weekStatuses);
}
