import type { Lift } from '@parakeet/shared-types';
import { LiftSchema } from '@parakeet/shared-types';
import {
  DEFAULT_TRAINING_DAYS,
  getDefaultThresholds,
  isMakeupWindowExpired,
  localDateString,
  nextTrainingDate,
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
  fetchInProgressSession,
  fetchSessionLogBySessionId,
  fetchTodaySessions,
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
  fetchPlannedSessionForProgram,
  fetchEndOfWeekContext,
  fetchHasNextWeekSessions,
  insertAdHocSession,
  insertPerformanceMetric,
  insertSessionLog,
  getLatestSorenessRatings,
  insertSorenessCheckin,
  markSessionAsMissed,
  updateSessionToCompleted,
  updateSessionToInProgress,
  updateSessionToPlanned,
  updateSessionToSkipped,
  deleteSession,
} from '../data/session.repository';
import { fetchActiveProgramMode, appendNextUnendingSession, type UnendingProgramRef } from '@modules/program';
import { captureException } from '@platform/utils/captureException';
import type {
  CompletedSessionListItem,
  CompleteSessionInput,
  SessionCompletionContext,
} from '@shared/types/domain';

export type {
  CompleteSessionInput,
  CompletedSessionListItem,
  SessionCompletionContext,
} from '@shared/types/domain';

// Today's session: active in-progress session first, else nearest planned session.
// For unending programs, generates the next session lazily if none exists.
export async function findTodaySession(userId: string) {
  const session = await fetchTodaySession(userId);
  // For unending programs, a completed session is not "today's session" —
  // the next one should be generated immediately so the user can train again.
  const program = await fetchActiveProgramMode(userId);
  if (program?.program_mode === 'unending') {
    if (!session || session.status === 'completed') {
      // Guard: if a planned session already exists, return it without generating another.
      // This prevents duplicate generation on each pull-to-refresh.
      const existingPlanned = await fetchPlannedSessionForProgram(program.id, userId);
      if (existingPlanned) return existingPlanned;
      return generateNextUnendingSession(program, userId);
    }
  }

  if (session) return session;
  return null;
}

// All sessions relevant to today: planned_date = today + any in_progress
// For unending programs, triggers lazy session generation first.
export async function findTodaySessions(userId: string) {
  try {
    const program = await fetchActiveProgramMode(userId);
    if (program?.program_mode === 'unending') {
      await findTodaySession(userId);
    }
  } catch (err) {
    // Don't let program-mode lookup failures break the session list.
    // The direct fetchTodaySessions query still works without program context.
    captureException(err);
  }
  return fetchTodaySessions(userId);
}

// Full session detail
export async function getSession(sessionId: string) {
  return fetchSessionById(sessionId);
}

// Full session log (actual sets, aux sets, RPE, etc.)
export async function getSessionLog(sessionId: string) {
  return fetchSessionLogBySessionId(sessionId);
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
    programMode: data?.program_mode ?? null,
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

export async function getLatestSorenessCheckin(
  userId: string,
): Promise<Record<string, number> | null> {
  return getLatestSorenessRatings(userId);
}

export async function getInProgressSession(
  userId: string
): Promise<{ id: string } | null> {
  return fetchInProgressSession(userId);
}

// Create a standalone ad-hoc session (no program context) and return its ID.
// Free-form: omit lift/intensityType, optionally provide activityName.
// Lift-specific: provide lift + intensityType for a traditional ad-hoc session.
export async function createAdHocSession(
  userId: string,
  options?: {
    lift?: 'squat' | 'bench' | 'deadlift';
    intensityType?: 'heavy' | 'explosive' | 'rep';
    activityName?: string;
  },
): Promise<string> {
  return insertAdHocSession({
    userId,
    lift: options?.lift,
    intensityType: options?.intensityType,
    activityName: options?.activityName,
  });
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

// Abandon an in-progress session, resetting it back to planned
export async function abandonSession(sessionId: string): Promise<void> {
  const session = await fetchSessionById(sessionId);
  // Ad-hoc sessions have no program — delete them entirely on abandon
  if (session && !session.program_id) {
    await deleteSession(sessionId);
    return;
  }
  await updateSessionToPlanned(sessionId);
}

// Complete a session: log sets, update status, run performance adjuster
export async function completeSession(
  sessionId: string,
  userId: string,
  input: CompleteSessionInput
): Promise<void> {
  const { actualSets, auxiliarySets, sessionRpe, startedAt, completedAt } =
    input;
  if (actualSets.length === 0 && (!auxiliarySets || auxiliarySets.length === 0)) {
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
        set.rpe_actual < 1 ||
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
        set.rpe_actual < 1 ||
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

  const setsForLog = normalizedSets
    .filter((s) => s.is_completed)
    .map(({ is_completed: _isCompleted, ...set }) => set);
  const auxiliarySetsForLog = normalizedAuxiliarySets
    ?.filter((s) => s.is_completed)
    .map(({ is_completed: _isCompleted, ...set }) => set);

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
        intensity_type: session.intensity_type!,
        recorded_at: new Date().toISOString(),
        week_number: session.week_number ?? null,
        block_number: session.block_number ?? null,
      });
    }
  }

  // Check if program has reached ≥80% completion → trigger async cycle review.
  // Unending programs have no fixed session count; cycle review is triggered manually via End Program.
  if (session?.program_id) {
    const programMeta = await fetchActiveProgramMode(userId);
    if (programMeta?.program_mode !== 'unending') {
      const statuses = await fetchProgramSessionStatuses(
        session.program_id,
        userId
      );
      const total = statuses.length;
      const completed = statuses.filter((s) => s.status === 'completed').length;
      if (total > 0 && completed / total >= 0.8) {
        const { onCycleComplete } = await import('@modules/program/application/program.service');
        onCycleComplete(session.program_id, userId);
      }
    }
  }
}

// Session logs for the rolling 7-day window ending now
export async function getCurrentWeekLogs(
  userId: string
): Promise<CompletedSetLog[]> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);

  const rows = await fetchCurrentWeekLogs(
    userId,
    start.toISOString(),
    now.toISOString()
  );

  return rows.flatMap((row) => {
    const entries: CompletedSetLog[] = [
      {
        lift: row.primary_lift,
        completedSets: row.actual_sets.length,
        setRpes: row.actual_sets.map((s) => s.rpe_actual ?? undefined),
      },
    ];
    // Group aux sets by exercise name, preserving per-set RPEs
    const auxByExercise = new Map<string, (number | undefined)[]>();
    for (const s of row.auxiliary_sets) {
      const name = (s as { exercise?: string }).exercise;
      if (!name) continue;
      if (!auxByExercise.has(name)) auxByExercise.set(name, []);
      auxByExercise.get(name)!.push(s.rpe_actual ?? undefined);
    }
    for (const [exercise, rpes] of auxByExercise) {
      entries.push({ lift: row.primary_lift, completedSets: rpes.length, exercise, setRpes: rpes });
    }
    return entries;
  });
}

// Mark overdue scheduled sessions as missed when their makeup window has expired.
// Called on app foreground — fire-and-forget safe.
export async function markMissedSessions(userId: string): Promise<void> {
  const now = new Date();
  const today = localDateString(now);

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

// Generates and inserts the next session for an unending program,
// then increments the program's session counter. Returns the new session row.
async function generateNextUnendingSession(program: UnendingProgramRef, userId: string) {
  const trainingDays = program.training_days ?? DEFAULT_TRAINING_DAYS[program.training_days_per_week] ?? [1, 3, 5];
  const plannedDate = nextTrainingDate(trainingDays);
  await appendNextUnendingSession(program, userId, plannedDate);
  // Fetch by program_id+planned status so we get the newly created session,
  // not the completed session that fetchTodaySession would return first.
  return fetchPlannedSessionForProgram(program.id, userId);
}

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

export interface EndOfWeekResult {
  shouldPrompt: boolean;
  programId: string | null;
  weekNumber: number;
}

/** After completing a session, determine if we should prompt the end-of-week body review.
 *  - Scheduled: prompt when this was the last session of the week (no sessions with higher week_number)
 *    OR no more sessions exist in the program.
 *  - Unending: prompt every 3rd completed session (counter % 3 === 0).
 *  - Ad-hoc: never prompt.
 */
export async function checkEndOfWeek(sessionId: string): Promise<EndOfWeekResult> {
  const ctx = await fetchEndOfWeekContext(sessionId);
  if (!ctx || !ctx.programId || ctx.programMode === null) {
    return { shouldPrompt: false, programId: null, weekNumber: 0 };
  }

  if (ctx.programMode === 'unending') {
    const counter = ctx.unendingSessionCounter ?? 0;
    return {
      shouldPrompt: counter > 0 && counter % 3 === 0,
      programId: ctx.programId,
      weekNumber: ctx.weekNumber,
    };
  }

  if (ctx.programMode === 'scheduled') {
    const hasNext = await fetchHasNextWeekSessions(ctx.programId, ctx.weekNumber);
    return {
      shouldPrompt: !hasNext,
      programId: ctx.programId,
      weekNumber: ctx.weekNumber,
    };
  }

  return { shouldPrompt: false, programId: null, weekNumber: 0 };
}
