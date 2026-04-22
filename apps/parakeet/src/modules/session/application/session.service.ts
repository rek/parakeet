// @spec docs/features/session/spec-lifecycle.md
import {
  appendNextUnendingSession,
  fetchActiveProgramMode,
  type UnendingProgramRef,
} from '@modules/program';
import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import { LiftSchema } from '@parakeet/shared-types';
import {
  computeNextUnendingLift,
  DEFAULT_TRAINING_DAYS,
  getDefaultThresholds,
  getPrimaryMusclesForSession,
  getWorstSoreness,
  isMakeupWindowExpired,
  localDateString,
  nextTrainingDate,
  suggestProgramAdjustments,
} from '@parakeet/training-engine';
import type {
  CompletedSetLog,
  IntensityTypeSignals,
  SessionLogSummary,
  SessionRef,
  SorenessLevel,
} from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';
import * as Sentry from '@sentry/react-native';
import { DEFAULT_RPE_TARGET } from '@shared/constants/training';
import type {
  CompletedSessionListItem,
  CompleteSessionInput,
  SessionCompletionContext,
} from '@shared/types/domain';

import { flushUnsyncedSets } from './set-persistence.service';
import {
  countSetLogsForSession,
  deleteSession,
  deleteSetLogsForSession,
  reviveSkippedSessionToInProgress,
  fetchCompletedSessions,
  fetchCurrentWeekLogs,
  fetchEndOfWeekContext,
  fetchHasCompletedSessionToday,
  fetchHasNextWeekSessions,
  fetchInProgressSession,
  fetchLastCompletedAtForLift,
  fetchLastCompletedLiftForProgram,
  fetchOverdueScheduledSessions,
  fetchPlannedSessionForProgram,
  fetchProfileSex,
  fetchProgramSessionsForMakeup,
  fetchProgramSessionStatuses,
  fetchRecentAuxExerciseNames,
  fetchRecentLogsForLift,
  fetchSessionById,
  fetchSessionCompletionContext,
  fetchSessionLogBySessionId,
  fetchSessionsForWeek,
  fetchSetLogs,
  fetchTodaySession,
  fetchTodaySessions,
  getLatestSorenessRatings,
  insertAdHocSession,
  insertPerformanceMetric,
  insertSessionLog,
  insertSorenessCheckin,
  markSessionAsMissed,
  sessionLogExists,
  updateSessionToCompleted,
  updateSessionToInProgress,
  updateSessionToPlanned,
  updateSessionToSkipped,
} from '../data/session.repository';
import { classifyPerformance } from '../utils/classify-performance';
import { validateSet } from '../utils/validateSet';

export type {
  CompleteSessionInput,
  CompletedSessionListItem,
  SessionCompletionContext,
} from '@shared/types/domain';

// Mutex: prevents concurrent unending session generation from racing.
// Multiple React Query refetches can overlap; without this, each passes the
// "no planned session" guard before any insert lands, creating duplicates.
let generatingSession: Promise<unknown> | null = null;

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
      const existingPlanned = await fetchPlannedSessionForProgram(
        program.id,
        userId
      );
      if (existingPlanned) return existingPlanned;

      // Serialize concurrent generation attempts so only the first insert wins.
      if (generatingSession) {
        await generatingSession;
        return fetchPlannedSessionForProgram(program.id, userId);
      }
      generatingSession = generateNextUnendingSession(program, userId);
      try {
        await generatingSession;
      } finally {
        generatingSession = null;
      }
      return fetchPlannedSessionForProgram(program.id, userId);
    }
  }

  if (session) return session;
  return null;
}

// All sessions relevant to today: planned_date = today + any in_progress
// For unending programs, triggers lazy session generation first.
export async function findTodaySessions(userId: string) {
  let unendingSession: Awaited<ReturnType<typeof findTodaySession>> = null;
  let activeProgramId: string | null = null;
  try {
    const program = await fetchActiveProgramMode(userId);
    if (program) {
      activeProgramId = program.id;
    }
    if (program?.program_mode === 'unending') {
      unendingSession = await findTodaySession(userId);
    }
  } catch (err) {
    // Don't let program-mode lookup failures break the session list.
    // The direct fetchTodaySessions query still works without program context.
    captureException(err);
  }
  const sessions = await fetchTodaySessions(userId, activeProgramId);
  // For unending programs, if no sessions matched today's date,
  // include the nearest planned session so the user always sees their next workout.
  if (sessions.length === 0 && unendingSession?.status === 'planned') {
    return [unendingSession];
  }
  return sessions;
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
  userId: string
): Promise<Record<string, number> | null> {
  return getLatestSorenessRatings(userId);
}

export async function getInProgressSession(
  userId: string
): Promise<{ id: string } | null> {
  return fetchInProgressSession(userId);
}

const STALE_SESSION_HOURS = 48;

// Resolve a stale in-progress session on app foreground.
// Branches on set_logs presence so sessions containing real logged work are
// never silently dropped: they auto-finalise into a completed session_logs row
// with session_rpe=null (user can't retroactively provide one).
// See docs/features/session/spec-auto-finalize.md.
export async function abandonStaleInProgressSessions(
  userId: string
): Promise<void> {
  const session = await fetchInProgressSession(userId);
  if (!session?.planned_date) return;

  const plannedDate = new Date(session.planned_date);
  const hoursSince = (Date.now() - plannedDate.getTime()) / (1000 * 60 * 60);
  if (hoursSince <= STALE_SESSION_HOURS) return;

  const setCount = await countSetLogsForSession(session.id);
  if (setCount === 0) {
    // Nothing was logged; safe to skip.
    await updateSessionToSkipped(session.id);
    return;
  }

  // Real work exists — synthesise a session_logs summary so history, adjuster,
  // and downstream analytics see a completed session rather than a lost one.
  await autoFinaliseSession(session.id, userId);
}

async function autoFinaliseSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const logs = await fetchSetLogs(sessionId);
  if (logs.length === 0) return;

  const alreadyLogged = await sessionLogExists(sessionId);
  if (alreadyLogged) return;

  Sentry.addBreadcrumb({
    category: 'session.durability',
    message: 'auto-finalise stale in_progress session',
    level: 'info',
    data: {
      sessionId,
      setCount: logs.length,
    },
  });

  const sessionMeta = await fetchSessionById(sessionId);
  const plannedCount = Array.isArray(sessionMeta?.planned_sets)
    ? sessionMeta.planned_sets.length
    : 0;

  const primary = logs.filter((l) => l.kind === 'primary');
  const completedCount = primary.length;
  const denom = plannedCount > 0 ? plannedCount : completedCount;
  const completionPct = denom > 0 ? (completedCount / denom) * 100 : 0;
  const performanceVsPlan = classifyPerformance(
    completedCount,
    denom,
    completionPct
  );

  const lastLoggedAt = logs.reduce<string | null>((acc, l) => {
    if (!acc) return l.logged_at;
    return l.logged_at > acc ? l.logged_at : acc;
  }, null);
  const completedAt = lastLoggedAt ? new Date(lastLoggedAt) : new Date();

  await insertSessionLog({
    sessionId,
    userId,
    sessionRpe: undefined,
    completionPct,
    performanceVsPlan,
    completedAt,
    autoFinalised: true,
  });

  await updateSessionToCompleted(sessionId, completedAt);

  // Deliberately no performance adjuster, no achievement detection — End was
  // never tapped, signal is unreliable, don't award surprise PRs on auto-save.
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
  }
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

// Public read path for per-set data across sessions. Thin wrapper over the
// repository so the session module's barrel stays free of repo exports (see
// docs/guide/ai-learnings.md). Consumers outside this module use this.
export {
  fetchSessionSetsBySessionIds as getSessionSetsBySessionIds,
} from '../data/session.repository';

// Skip a session (planned or in_progress → skipped)
export async function skipSession(
  sessionId: string,
  reason?: string
): Promise<void> {
  await updateSessionToSkipped(sessionId, reason);
}

// Recover sets from a locally-held session whose server-side record has
// already been skipped or missed. Flushes unsynced set rows into set_logs,
// flips the session back to in_progress, then auto-finalises so it shows up
// as a normal completed session in history.
//
// Called by useSessionRecovery when the user confirms "Save" on the recovery
// alert. Safe to call multiple times; idempotent via set_logs upserts and a
// no-op when the server-side session is no longer in skipped/missed.
export async function recoverSkippedSessionFromLocal(
  sessionId: string,
  userId: string
): Promise<void> {
  await flushUnsyncedSets(userId);

  const revived = await reviveSkippedSessionToInProgress(sessionId);
  if (!revived) return;

  await autoFinaliseSession(sessionId, userId);
}

// Abandon an in-progress session, resetting it back to planned
export async function abandonSession(sessionId: string): Promise<void> {
  const session = await fetchSessionById(sessionId);
  // Ad-hoc sessions have no program — delete them entirely on abandon.
  // ON DELETE CASCADE on set_logs handles cleanup.
  if (session && !session.program_id) {
    await deleteSession(sessionId);
    return;
  }
  // Program sessions reset to planned. set_logs from the abandoned attempt
  // must be purged or they resurrect as ghost sets next time the user opens
  // this session (slot keys collapse for equal set numbers; higher numbers
  // linger). See spec-set-persistence.md.
  await deleteSetLogsForSession(sessionId);
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
  if (
    actualSets.length === 0 &&
    (!auxiliarySets || auxiliarySets.length === 0)
  ) {
    throw new Error('At least one set is required');
  }

  const normalizedSets = actualSets.map((set) => validateSet(set, 'set'));
  // Validate aux set shape too even though we no longer materialise the array —
  // catches regressions where callers drift from the ActualSet contract.
  auxiliarySets?.forEach((set) => validateSet(set, 'auxiliary set'));

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

  // Per-set data is written directly to set_logs by useSetPersistence; this
  // summary row only stores aggregate stats. The is_completed-filtered
  // projection is no longer needed.

  const sessionLogId = await insertSessionLog({
    sessionId,
    userId,
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

  // Fire-and-forget: decision replay scoring
  import('./decision-replay.service')
    .then(({ scoreDecisionReplayAsync }) =>
      scoreDecisionReplayAsync(sessionId, userId)
    )
    .catch(captureException);

  // Fire-and-forget: modifier calibration update from trace + actual RPE
  import('@modules/jit')
    .then(({ updateModifierCalibrations }) =>
      updateModifierCalibrations({ sessionId, userId })
    )
    .catch(captureException);

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
        const { onCycleComplete } = await import('@modules/program');
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
      entries.push({
        lift: row.primary_lift,
        completedSets: rpes.length,
        exercise,
        setRpes: rpes,
      });
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
async function generateNextUnendingSession(
  program: UnendingProgramRef,
  userId: string
) {
  const trainingDays = program.training_days ??
    DEFAULT_TRAINING_DAYS[program.training_days_per_week] ?? [1, 3, 5];

  // If a session was already completed today, schedule for the next training
  // day after today — prevents double-scheduling on the same day (GH#136).
  const completedToday = await fetchHasCompletedSessionToday(
    program.id,
    userId
  );
  let referenceDate: Date | undefined;
  if (completedToday) {
    referenceDate = new Date();
    referenceDate.setDate(referenceDate.getDate() + 1);
  }
  const plannedDate = nextTrainingDate(trainingDays, referenceDate);
  const lastCompletedLift = await fetchLastCompletedLiftForProgram(
    program.id,
    userId
  );

  const nextLift = computeNextUnendingLift({
    sessionCounter: program.unending_session_counter,
    trainingDaysPerWeek: program.training_days_per_week,
    lastCompletedLift,
  });

  const [sorenessRatings, lastCompletedAt, recentLogs] = await Promise.all([
    getLatestSorenessRatings(userId),
    fetchLastCompletedAtForLift(userId, nextLift),
    getRecentLogsForLift(userId, nextLift, 3),
  ]);

  const primaryMuscleSoreness: number | null = sorenessRatings
    ? getWorstSoreness(
        getPrimaryMusclesForSession(nextLift),
        sorenessRatings as Partial<Record<MuscleGroup, SorenessLevel>>
      )
    : null;

  const daysSinceLastSession: number | null = lastCompletedAt?.completed_at
    ? Math.floor(
        (Date.now() - new Date(lastCompletedAt.completed_at).getTime()) /
          86_400_000
      )
    : null;

  const intensitySignals: IntensityTypeSignals = {
    primaryMuscleSoreness,
    daysSinceLastSession,
    recentRpe: recentLogs
      .map((l) => l.actual_rpe)
      .filter((r): r is number => r !== null),
    lastIntensityType: recentLogs[0]?.intensity_type ?? null,
  };

  try {
    await appendNextUnendingSession(
      program,
      userId,
      plannedDate,
      lastCompletedLift,
      intensitySignals
    );
  } catch (err: unknown) {
    // Unique constraint violation (23505) means another call already inserted —
    // safe to ignore and return the existing planned session.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === '23505'
    ) {
      return fetchPlannedSessionForProgram(program.id, userId);
    }
    throw err;
  }
  // Fetch by program_id+planned status so we get the newly created session,
  // not the completed session that fetchTodaySession would return first.
  return fetchPlannedSessionForProgram(program.id, userId);
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
      target_rpe: DEFAULT_RPE_TARGET,
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
export async function checkEndOfWeek(
  sessionId: string
): Promise<EndOfWeekResult> {
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
    const hasNext = await fetchHasNextWeekSessions(
      ctx.programId,
      ctx.weekNumber
    );
    return {
      shouldPrompt: !hasNext,
      programId: ctx.programId,
      weekNumber: ctx.weekNumber,
    };
  }

  return { shouldPrompt: false, programId: null, weekNumber: 0 };
}

export async function getProfileSex(
  userId: string
): Promise<'female' | 'male' | undefined> {
  return fetchProfileSex(userId);
}

export async function getRecentAuxExerciseNames(): Promise<string[]> {
  return fetchRecentAuxExerciseNames();
}
