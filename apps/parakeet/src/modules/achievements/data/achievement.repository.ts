// @spec docs/features/achievements/spec-screen.md
import { getSessionSetsBySessionIds } from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import type { ConsistencyData, ProgramLoyaltyData } from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';

import type { PR } from '../lib/engine-adapter';

export async function upsertPersonalRecords(
  userId: string,
  prs: PR[]
): Promise<void> {
  if (prs.length === 0) return;

  const { error } = await typedSupabase.from('personal_records').upsert(
    prs.map((pr) => ({
      user_id: userId,
      lift: pr.lift,
      pr_type: pr.type,
      value: pr.value,
      weight_kg: pr.weightKg ?? null,
      session_id: pr.sessionId,
      achieved_at: pr.achievedAt,
    })),
    { onConflict: 'user_id,lift,pr_type,weight_kg' }
  );
  if (error) throw error;
}

export async function fetchPersonalRecords(userId: string, lift: Lift) {
  const { data, error } = await typedSupabase
    .from('personal_records')
    .select('pr_type, value, weight_kg, session_id, achieved_at')
    .eq('user_id', userId)
    .eq('lift', lift);

  if (error) throw error;
  return data ?? [];
}

export async function fetchSessionsForStreak(userId: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, planned_date, status')
    .eq('user_id', userId)
    .neq('intensity_type', 'import')
    .not('planned_date', 'is', null)
    .order('planned_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchDisruptionsForStreak(userId: string) {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select('affected_date_start, affected_date_end, session_ids_affected')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function fetchProgramsForCycleBadges(userId: string) {
  const { data, error } = await typedSupabase
    .from('programs')
    .select('id, version, start_date, total_weeks, status')
    .eq('user_id', userId)
    .in('status', ['completed', 'archived'])
    .order('version', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchBodyweightEntriesForWilks(userId: string) {
  const { data, error } = await typedSupabase
    .from('bodyweight_entries')
    .select('recorded_date, weight_kg')
    .eq('user_id', userId)
    .order('recorded_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfileForWilks(userId: string) {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('biological_sex, bodyweight_kg')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchMaxesForWilks(userId: string) {
  const { data, error } = await typedSupabase
    .from('lifter_maxes')
    .select('recorded_at, squat_1rm_grams, bench_1rm_grams, deadlift_1rm_grams')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchProgramsForWilks(userId: string) {
  const { data, error } = await typedSupabase
    .from('programs')
    .select('id, version, start_date')
    .eq('user_id', userId)
    .in('status', ['completed', 'archived'])
    .order('version', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── Badge Detection Fetchers ─────────────────────────────────────────────────

export async function fetchBadgeSessionLog(sessionId: string) {
  const [logResult, sessionResult, setsMap] = await Promise.all([
    typedSupabase
      .from('session_logs')
      .select('started_at, completed_at, duration_seconds, completion_pct')
      .eq('session_id', sessionId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    typedSupabase
      .from('sessions')
      .select('is_deload, planned_sets')
      .eq('id', sessionId)
      .maybeSingle(),
    getSessionSetsBySessionIds([sessionId]),
  ]);

  if (logResult.error) throw logResult.error;
  if (sessionResult.error) throw sessionResult.error;
  if (!logResult.data) return null;

  const buckets = setsMap.get(sessionId);
  return {
    ...logResult.data,
    is_deload: sessionResult.data?.is_deload ?? false,
    planned_sets: sessionResult.data?.planned_sets ?? [],
    set_log_sets: (buckets?.primary ?? []).map((s) => ({
      actual_rest_seconds: s.actual_rest_seconds,
    })),
  };
}

export async function fetchBadgeProfile(userId: string) {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('bodyweight_kg')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCompletedSessionCount(userId: string): Promise<number> {
  const { count, error } = await typedSupabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');
  if (error) throw error;
  return count ?? 0;
}

export async function fetchPreviousSession(
  userId: string,
  currentSessionId: string
) {
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

export async function fetchAllLiftE1RMs(
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

export async function fetchSorenessData(
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

export async function fetchDisruptionContext(userId: string): Promise<{
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
    return { hasActiveMajor: false, daysSinceLast: null, lastDurationDays: null };
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

export async function fetchPrTypeCounts(
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
    else volumePrCount++;
  }
  return { volumePrCount, oneRmPrCount };
}

export async function fetchConsistencyData(
  userId: string,
  currentSessionId: string,
  streakWeeks: number
): Promise<ConsistencyData> {
  const { data: sessions, error } = await typedSupabase
    .from('sessions')
    .select('id, primary_lift, status, planned_date, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });
  if (error) throw error;

  const rows = sessions ?? [];
  let sessionsBeforeSixAm = 0;
  let sessionsAfterNinePm = 0;
  const distinctSundays = new Set<string>();

  for (const s of rows) {
    if (s.completed_at) {
      const d = new Date(s.completed_at as string);
      const hour = d.getHours();
      if (hour < 6) sessionsBeforeSixAm++;
      if (hour >= 21) sessionsAfterNinePm++;
      if (d.getDay() === 0) {
        distinctSundays.add(d.toISOString().split('T')[0]);
      }
    }
  }

  let consecutiveLegDaySessions = 0;
  for (const s of rows) {
    const lift = s.primary_lift as string | null;
    if (lift === 'squat' || lift === 'deadlift') {
      consecutiveLegDaySessions++;
    } else {
      break;
    }
  }

  const isPerfectWeek = await checkPerfectWeekSessions(userId);
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

async function checkPerfectWeekSessions(userId: string): Promise<boolean> {
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
  return data.every((s) => s.status === 'completed');
}

async function fetchConsecutivePerfectSessions(
  userId: string,
  _currentSessionId: string
): Promise<number> {
  const { data: recentLogs, error } = await typedSupabase
    .from('session_logs')
    .select('session_id')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!recentLogs || recentLogs.length === 0) return 0;

  const sessionIds = recentLogs
    .map((r) => r.session_id)
    .filter((id): id is string => !!id);
  const setsMap = await getSessionSetsBySessionIds(sessionIds);

  let consecutive = 0;
  for (const log of recentLogs) {
    if (!log.session_id) break;
    const primary = setsMap.get(log.session_id)?.primary ?? [];
    if (primary.length === 0) break;
    const allMet = primary.every((s) => s.reps_completed > 0);
    if (!allMet) break;
    consecutive++;
  }
  return consecutive;
}

export async function fetchProgramLoyaltyData(
  userId: string,
  currentProgramId: string | null
): Promise<ProgramLoyaltyData> {
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
        formulaChangesThisCycle = Math.max(0, count - 1);
      }
    }
  }

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

export async function fetchUniqueAuxExercisesInCycle(
  userId: string,
  programId: string | null
): Promise<number> {
  if (!programId) return 0;

  const { data: sessionIdRows } = await typedSupabase
    .from('sessions')
    .select('id')
    .eq('program_id', programId)
    .eq('status', 'completed');

  const sessionIds = (sessionIdRows ?? []).map((s) => s.id as string);
  if (sessionIds.length === 0) return 0;

  const { data, error } = await typedSupabase
    .from('set_logs')
    .select('exercise')
    .eq('user_id', userId)
    .eq('kind', 'auxiliary')
    .not('exercise', 'is', null)
    .in('session_id', sessionIds);
  if (error) throw error;

  const exerciseNames = new Set<string>();
  for (const row of data ?? []) {
    if (row.exercise) exerciseNames.add(row.exercise);
  }
  return exerciseNames.size;
}

export const MIN_FULL_REST_SECONDS = 90;

export async function fetchConsecutiveFullRestSessions(
  userId: string,
  _currentSessionId: string
): Promise<number> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('session_id')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const sessionIds = data
    .map((r) => r.session_id)
    .filter((id): id is string => !!id);
  const setsMap = await getSessionSetsBySessionIds(sessionIds);

  let consecutive = 0;
  for (const log of data) {
    if (!log.session_id) break;
    const primary = setsMap.get(log.session_id)?.primary ?? [];
    if (primary.length === 0) break;
    const allFullRest = primary.every(
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

export async function fetchPartnerCompletedToday(userId: string): Promise<boolean> {
  const { data: partners, error: partnerError } = await typedSupabase
    .from('gym_partners')
    .select('requester_id, responder_id')
    .or(`requester_id.eq.${userId},responder_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (partnerError || !partners || partners.length === 0) return false;

  const partnerIds = partners.map((p) =>
    p.requester_id === userId ? p.responder_id : p.requester_id
  );

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
