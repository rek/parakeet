import type { Lift } from '@parakeet/shared-types';
import { LiftSchema } from '@parakeet/shared-types';
import {
  getDefaultThresholds,
  isMakeupWindowExpired,
  suggestProgramAdjustments,
} from '@parakeet/training-engine';
import type {
  CompletedSetLog,
  SessionLogSummary,
  SessionRef,
} from '@parakeet/training-engine';
import {
  fetchCompletedSessions,
  fetchCurrentWeekLogs,
  fetchLastCompletedAtForLift,
  fetchOverdueScheduledSessions,
  fetchProfileSex,
  fetchProgramSessionsForMakeup,
  fetchProgramSessionStatuses,
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
import type {
  CompletedSessionListItem,
  CompleteSessionInput,
  SessionCompletionContext,
} from '../types/domain';

export type {
  CompleteSessionInput,
  CompletedSessionListItem,
  SessionCompletionContext,
} from '../types/domain';

// Today's session: nearest upcoming session not yet completed/skipped
export async function findTodaySession(userId: string) {
  return fetchTodaySession(userId);
}

// Full session detail
export async function getSession(sessionId: string) {
  return fetchSessionById(sessionId);
}

export async function getSessionCompletionContext(
  sessionId: string
): Promise<SessionCompletionContext> {
  const data = await fetchSessionCompletionContext(sessionId);
  return {
    primaryLift: data?.primary_lift
      ? LiftSchema.parse(data.primary_lift)
      : null,
    programId: data?.program_id ?? null,
  };
}

// All sessions for a given week of a program
export async function getSessionsForWeek(
  programId: string,
  weekNumber: number
) {
  return fetchSessionsForWeek(programId, weekNumber);
}

// Paginated list of completed sessions (History tab)
export async function getCompletedSessions(
  userId: string,
  page: number,
  pageSize = 20
): Promise<CompletedSessionListItem[]> {
  return fetchCompletedSessions(userId, page, pageSize);
}

export async function getProgramCompletionCounts(
  programId: string,
  userId: string
): Promise<{
  total: number;
  completed: number;
  skipped: number;
}> {
  const statuses = await fetchProgramSessionStatuses(programId, userId);
  const total = statuses.length;
  const completed = statuses.filter((s) => s.status === 'completed').length;
  const skipped = statuses.filter((s) => s.status === 'skipped').length;
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
export async function skipSession(
  sessionId: string,
  reason?: string
): Promise<void> {
  await updateSessionToSkipped(sessionId, reason);
}

// Complete a session: log sets, update status, run performance adjuster
export async function completeSession(
  sessionId: string,
  userId: string,
  input: CompleteSessionInput
): Promise<void> {
  const { actualSets, auxiliarySets, sessionRpe, startedAt, completedAt } =
    input;
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
      (!Number.isFinite(set.rpe_actual) ||
        set.rpe_actual < 6 ||
        set.rpe_actual > 10)
    ) {
      throw new Error('Invalid RPE value');
    }
    return { ...set, is_completed: set.is_completed === true };
  });
  const normalizedAuxiliarySets = auxiliarySets?.map((set) => {
    if (!Number.isInteger(set.set_number) || set.set_number <= 0) {
      throw new Error('Invalid auxiliary set number');
    }
    if (!Number.isFinite(set.weight_grams) || set.weight_grams < 0) {
      throw new Error('Invalid auxiliary set weight');
    }
    if (!Number.isInteger(set.reps_completed) || set.reps_completed < 0) {
      throw new Error('Invalid auxiliary reps completed');
    }
    if (
      set.rpe_actual !== undefined &&
      (!Number.isFinite(set.rpe_actual) ||
        set.rpe_actual < 6 ||
        set.rpe_actual > 10)
    ) {
      throw new Error('Invalid auxiliary RPE value');
    }
    return { ...set, is_completed: set.is_completed === true };
  });

  const session = await getSession(sessionId);
  const plannedCountRaw =
    (Array.isArray(session?.planned_sets)
      ? session.planned_sets.length
      : null) ?? normalizedSets.length;
  const plannedCount =
    plannedCountRaw > 0 ? plannedCountRaw : normalizedSets.length;
  const completedCount = normalizedSets.filter((s) => s.is_completed).length;
  const completionPct = (completedCount / plannedCount) * 100;
  const performanceVsPlan = classifyPerformance(
    completedCount,
    plannedCount,
    completionPct
  );

  const setsForLog = normalizedSets.map(
    ({ is_completed: _isCompleted, ...set }) => set
  );
  const auxiliarySetsForLog = normalizedAuxiliarySets?.map(
    ({ is_completed: _isCompleted, ...set }) => set
  );

  const sessionLogId = await insertSessionLog({
    sessionId,
    userId,
    actualSets: setsForLog,
    auxiliarySets: auxiliarySetsForLog,
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
      LiftSchema.parse(session.primary_lift),
      6
    );
    const biologicalSex = await fetchProfileSex(userId);
    const suggestions = suggestProgramAdjustments(
      recentLogs,
      getDefaultThresholds(biologicalSex)
    );

    if (suggestions.length > 0) {
      await insertPerformanceMetric({
        session_log_id: sessionLogId,
        user_id: userId,
        lift: session.primary_lift,
        intensity_type: session.intensity_type,
        recorded_at: new Date().toISOString(),
        week_number: session.week_number ?? null,
        block_number: session.block_number ?? null,
      });
    }
  }

  // Check if program has reached ≥80% completion → trigger async cycle review
  if (session?.program_id) {
    const statuses = await fetchProgramSessionStatuses(
      session.program_id,
      userId
    );
    const total = statuses.length;
    const completed = statuses.filter((s) => s.status === 'completed').length;
    if (total > 0 && completed / total >= 0.8) {
      const { onCycleComplete } = await import('../lib/programs');
      onCycleComplete(session.program_id, userId);
    }
  }
}

// Session logs for the current calendar week (Sun–Sat)
export async function getCurrentWeekLogs(
  userId: string
): Promise<CompletedSetLog[]> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const rows = await fetchCurrentWeekLogs(
    userId,
    startOfWeek.toISOString(),
    endOfWeek.toISOString()
  );

  return rows.map((row) => {
    const sets = row.actual_sets;
    const completedSets = sets.filter(
      (s) => (s.reps_completed ?? 0) > 0
    ).length;
    return {
      lift: row.primary_lift,
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
    const pid = s.program_id;
    if (!byProgram.has(pid)) byProgram.set(pid, []);
    byProgram.get(pid)!.push(s);
  }

  for (const [programId, overdueInProgram] of byProgram) {
    // Fetch all sessions for this program to determine makeup windows
    const allSessions = await fetchProgramSessionsForMakeup(programId, userId);

    const allSessionRefs: SessionRef[] = allSessions.map((s) => ({
      id: s.id,
      scheduledDate: s.planned_date,
      lift: s.primary_lift,
      weekNumber: s.week_number,
    }));

    for (const session of overdueInProgram) {
      const missedSession: SessionRef = {
        id: session.id,
        scheduledDate: session.planned_date,
        lift: session.primary_lift,
        weekNumber: session.week_number,
      };

      const expired = isMakeupWindowExpired({
        missedSession,
        allSessionsThisCycle: allSessionRefs,
        today: now,
      });

      if (expired) {
        await markSessionAsMissed(session.id);
      }
    }
  }
}

// Returns the number of days since the most recent completed session for a given lift.
// Returns null when no completed session exists (first-time lifter or no history).
export async function getDaysSinceLastSession(
  userId: string,
  lift: Lift
): Promise<number | null> {
  const data = await fetchLastCompletedAtForLift(userId, lift);
  if (!data?.completed_at) return null;

  const completedAt = new Date(data.completed_at);
  const now = new Date();
  const diffMs = now.getTime() - completedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// --- Private helpers ---

type PerformanceVsPlan = 'over' | 'at' | 'under' | 'incomplete';

function classifyPerformance(
  completedCount: number,
  plannedCount: number,
  completionPct: number
): PerformanceVsPlan {
  if (completionPct < 50) return 'incomplete';
  if (completionPct < 90) return 'under';
  // With explicit completion flags and planned denominator, completion > 110%
  // means confirmed completed sets exceeded planned set count.
  if (plannedCount > 0 && completedCount / plannedCount > 1.1) return 'over';
  return 'at';
}

async function getRecentLogsForLift(
  userId: string,
  lift: Lift,
  limit: number
): Promise<SessionLogSummary[]> {
  const rows = await fetchRecentLogsForLift(userId, lift, limit);

  return rows.map((row) => {
    return {
      session_id: row.session_id,
      lift: row.lift ?? lift,
      intensity_type: row.intensity_type,
      actual_rpe: row.actual_rpe ?? null,
      target_rpe: 8.5,
      completion_pct: row.completion_pct ?? null,
    };
  });
}
