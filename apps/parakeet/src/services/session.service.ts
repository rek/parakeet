import {
  suggestProgramAdjustments,
  getDefaultThresholds,
  isMakeupWindowExpired,
} from '@parakeet/training-engine';
import type {
  SessionLogSummary,
  CompletedSetLog,
  SessionRef,
} from '@parakeet/training-engine';
import type { Lift } from '@parakeet/shared-types';

import {
  fetchCompletedSessions,
  fetchCurrentWeekLogs,
  fetchLastCompletedAtForLift,
  fetchOverdueScheduledSessions,
  fetchProfileSex,
  fetchProgramSessionStatuses,
  fetchProgramSessionsForMakeup,
  fetchRecentLogsForLift,
  fetchSessionById,
  fetchSessionCompletionContext,
  fetchSessionsForWeek,
  fetchTodaySession,
  insertPerformanceMetric,
  insertSessionLog,
  insertSorenessCheckin,
  markSessionAsMissed,
  updateSessionToCompleted,
  updateSessionToInProgress,
  updateSessionToSkipped,
} from '../data/session.repository';

export interface CompleteSessionInput {
  actualSets: {
    set_number: number;
    weight_grams: number;
    reps_completed: number;
    rpe_actual?: number;
    actual_rest_seconds?: number;
    notes?: string;
  }[];
  auxiliarySets?: {
    exercise: string;
    set_number: number;
    weight_grams: number;
    reps_completed: number;
    rpe_actual?: number;
    actual_rest_seconds?: number;
  }[];
  sessionRpe?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SessionCompletionContext {
  primaryLift: Lift | null;
  programId: string | null;
}

export interface CompletedSessionListItem {
  id: string;
  primary_lift: string;
  intensity_type: string;
  planned_date: string | null;
  status: string;
  week_number: number;
  block_number: number;
  cycle_phase: string | null;
  rpe: number | null;
}

// Today's session: nearest upcoming session not yet completed/skipped
export async function findTodaySession(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  return fetchTodaySession(userId, today);
}

// Full session detail
export async function getSession(sessionId: string) {
  return fetchSessionById(sessionId);
}

export async function getSessionCompletionContext(
  sessionId: string,
): Promise<SessionCompletionContext> {
  const data = await fetchSessionCompletionContext(sessionId);
  return {
    primaryLift: (data?.primary_lift as Lift | null) ?? null,
    programId: data?.program_id ?? null,
  };
}

// All sessions for a given week of a program
export async function getSessionsForWeek(programId: string, weekNumber: number) {
  return fetchSessionsForWeek(programId, weekNumber);
}

// Paginated list of completed sessions (History tab)
export async function getCompletedSessions(
  userId: string,
  page: number,
  pageSize = 20,
): Promise<CompletedSessionListItem[]> {
  const rows = await fetchCompletedSessions(userId, page, pageSize);
  return rows as CompletedSessionListItem[];
}

export async function getProgramCompletionCounts(programId: string, userId: string): Promise<{
  total: number;
  completed: number;
  skipped: number;
}> {
  const statuses = await fetchProgramSessionStatuses(programId, userId);
  const total = statuses.length;
  const completed = statuses.filter((s: { status: string }) => s.status === 'completed').length;
  const skipped = statuses.filter((s: { status: string }) => s.status === 'skipped').length;
  return { total, completed, skipped };
}

export async function recordSorenessCheckin(input: {
  sessionId: string;
  userId: string;
  ratings: Record<string, number>;
  skipped: boolean;
}): Promise<void> {
  await insertSorenessCheckin(input);
}

// Transition session to in_progress
export async function startSession(sessionId: string): Promise<void> {
  await updateSessionToInProgress(sessionId);
}

// Skip a session (planned or in_progress → skipped)
export async function skipSession(sessionId: string, reason?: string): Promise<void> {
  await updateSessionToSkipped(sessionId, reason);
}

// Complete a session: log sets, update status, run performance adjuster
export async function completeSession(
  sessionId: string,
  userId: string,
  input: CompleteSessionInput,
): Promise<void> {
  const { actualSets, auxiliarySets, sessionRpe, startedAt, completedAt } = input;
  if (actualSets.length === 0) {
    throw new Error('At least one set is required');
  }

  const normalizedSets = actualSets.map((set) => {
    if (!Number.isInteger(set.set_number) || set.set_number <= 0) {
      throw new Error('Invalid set number');
    }
    if (!Number.isFinite(set.weight_grams) || set.weight_grams < 0) {
      throw new Error('Invalid set weight');
    }
    if (!Number.isInteger(set.reps_completed) || set.reps_completed < 0) {
      throw new Error('Invalid reps completed');
    }
    if (
      set.rpe_actual !== undefined &&
      (!Number.isFinite(set.rpe_actual) || set.rpe_actual < 6 || set.rpe_actual > 10)
    ) {
      throw new Error('Invalid RPE value');
    }
    return set;
  });

  const session = await getSession(sessionId);
  const plannedCountRaw =
    (session?.planned_sets as unknown[] | null)?.length ?? normalizedSets.length;
  const plannedCount = plannedCountRaw > 0 ? plannedCountRaw : normalizedSets.length;
  const completionPct =
    (normalizedSets.filter((s) => s.reps_completed > 0).length / plannedCount) * 100;
  const performanceVsPlan = classifyPerformance(normalizedSets, completionPct);

  await insertSessionLog({
    sessionId,
    userId,
    actualSets: normalizedSets,
    auxiliarySets,
    sessionRpe,
    completionPct,
    performanceVsPlan,
    startedAt,
    completedAt,
  });

  await updateSessionToCompleted(sessionId);

  if (session?.primary_lift) {
    const recentLogs = await getRecentLogsForLift(
      userId,
      session.primary_lift as Lift,
      6,
    );
    const biologicalSex = await fetchProfileSex(userId);
    const suggestions = suggestProgramAdjustments(recentLogs, getDefaultThresholds(biologicalSex));

    if (suggestions.length > 0) {
      await insertPerformanceMetric({
        sessionId,
        userId,
        suggestions,
      });
    }
  }

  // Check if program has reached ≥80% completion → trigger async cycle review
  if (session?.program_id) {
    const statuses = await fetchProgramSessionStatuses(session.program_id, userId);
    const total = statuses.length;
    const completed = statuses.filter((s: { status: string }) => s.status === 'completed').length;
    if (total > 0 && completed / total >= 0.8) {
      const { onCycleComplete } = await import('../lib/programs');
      onCycleComplete(session.program_id, userId);
    }
  }
}

// Session logs for the current calendar week (Sun–Sat)
export async function getCurrentWeekLogs(userId: string): Promise<CompletedSetLog[]> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const rows = await fetchCurrentWeekLogs(
    userId,
    startOfWeek.toISOString(),
    endOfWeek.toISOString(),
  );

  return rows.map((row: any) => {
    const sessRaw = row.sessions as unknown;
    const sess = (Array.isArray(sessRaw) ? sessRaw[0] : sessRaw) as
      | { primary_lift: string }
      | null;
    const sets = Array.isArray(row.actual_sets)
      ? (row.actual_sets as { reps_completed?: number }[])
      : [];
    const completedSets = sets.filter((s) => (s.reps_completed ?? 0) > 0).length;
    return {
      lift: (sess?.primary_lift ?? 'squat') as Lift,
      completedSets: completedSets || sets.length,
    };
  });
}

// Mark overdue scheduled sessions as missed when their makeup window has expired.
// Called on app foreground — fire-and-forget safe.
export async function markMissedSessions(userId: string): Promise<void> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Fetch all scheduled sessions whose date is in the past
  const scheduled = await fetchOverdueScheduledSessions(userId, today);
  if (scheduled.length === 0) return;

  // Group by program_id so we fetch all cycle sessions once per program
  const byProgram = new Map<string, typeof scheduled>();
  for (const s of scheduled) {
    const pid = s.program_id as string;
    if (!byProgram.has(pid)) byProgram.set(pid, []);
    byProgram.get(pid)!.push(s);
  }

  for (const [programId, overdueInProgram] of byProgram) {
    // Fetch all sessions for this program to determine makeup windows
    const allSessions = await fetchProgramSessionsForMakeup(programId, userId);

    const allSessionRefs: SessionRef[] = allSessions.map((s: any) => ({
      id: s.id as string,
      scheduledDate: s.scheduled_date as string,
      lift: s.primary_lift as Lift,
      weekNumber: s.week_number as number,
    }));

    for (const session of overdueInProgram) {
      const missedSession: SessionRef = {
        id: session.id as string,
        scheduledDate: session.scheduled_date as string,
        lift: session.primary_lift as Lift,
        weekNumber: session.week_number as number,
      };

      const expired = isMakeupWindowExpired({
        missedSession,
        allSessionsThisCycle: allSessionRefs,
        today: now,
      });

      if (expired) {
        await markSessionAsMissed(session.id, now.toISOString());
      }
    }
  }
}

// Returns the number of days since the most recent completed session for a given lift.
// Returns null when no completed session exists (first-time lifter or no history).
export async function getDaysSinceLastSession(
  userId: string,
  lift: Lift,
): Promise<number | null> {
  const data = await fetchLastCompletedAtForLift(userId, lift);
  if (!data?.completed_at) return null;

  const completedAt = new Date(data.completed_at as string);
  const now = new Date();
  const diffMs = now.getTime() - completedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// --- Private helpers ---

type PerformanceVsPlan = 'over' | 'at' | 'under' | 'incomplete';

function classifyPerformance(
  actualSets: CompleteSessionInput['actualSets'],
  completionPct: number,
): PerformanceVsPlan {
  void actualSets;
  if (completionPct < 50) return 'incomplete';
  if (completionPct < 90) return 'under';
  // "over" means avg actual > planned by >10% — without knowing planned reps per set,
  // we use completion_pct > 110 as a proxy (set count exceeded plan)
  if (completionPct > 110) return 'over';
  return 'at';
}

async function getRecentLogsForLift(
  userId: string,
  lift: Lift,
  limit: number,
): Promise<SessionLogSummary[]> {
  const rows = await fetchRecentLogsForLift(userId, lift, limit);

  return rows.map((row: any) => {
    const sessRaw = row.sessions as unknown;
    const sess = (Array.isArray(sessRaw) ? sessRaw[0] : sessRaw) as
      | { primary_lift: string; intensity_type: string }
      | null;
    return {
      session_id: row.id,
      lift: (sess?.primary_lift ?? lift) as Lift,
      intensity_type: (sess?.intensity_type ?? 'heavy') as SessionLogSummary['intensity_type'],
      actual_rpe: row.session_rpe ?? null,
      target_rpe: 8.5,
      completion_pct: row.completion_pct ?? null,
    };
  });
}
