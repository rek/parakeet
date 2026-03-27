import type { ActualSet, IntensityType, Lift } from '@parakeet/shared-types';
import { IntensityTypeSchema, LiftSchema } from '@parakeet/shared-types';
import type { DbInsert, DbRow } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';
import type {
  CompletedSessionListItem,
  ProgramSessionView,
  SessionStatus,
} from '@shared/types/domain';
import { localDateString } from '@shared/utils/localDateString';

import { parseActualSetsJson } from './session-codecs';

type SessionRow = DbRow<'sessions'>;

interface SessionJoinLift {
  primary_lift: string;
}

interface SessionJoinLiftIntensity extends SessionJoinLift {
  intensity_type: string;
}

function parseLift(value: string | null): Lift {
  return LiftSchema.parse(value);
}

function parseLiftNullable(value: string | null): Lift | null {
  const result = LiftSchema.safeParse(value);
  return result.success ? result.data : null;
}

function parseIntensity(value: string | null): IntensityType {
  const result = IntensityTypeSchema.safeParse(value);
  return result.success ? result.data : 'heavy';
}

function parseSessionStatus(value: string): SessionStatus {
  if (
    value === 'planned' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'skipped' ||
    value === 'missed'
  ) {
    return value;
  }
  throw new Error(`Unexpected session status: ${value}`);
}

function normalizeJoinedSession<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toProgramSessionView(row: {
  id: string;
  week_number: number;
  day_number: number;
  primary_lift: string | null;
  intensity_type: string | null;
  block_number: number | null;
  is_deload: boolean;
  planned_date: string | null;
  status: string;
  jit_generated_at: string | null;
  completed_at?: string | null;
}): ProgramSessionView {
  if (row.planned_date === null) {
    throw new Error(`Session ${row.id} has null planned_date`);
  }
  return {
    id: row.id,
    week_number: row.week_number,
    day_number: row.day_number,
    primary_lift: parseLift(row.primary_lift),
    intensity_type: parseIntensity(row.intensity_type),
    block_number: row.block_number,
    is_deload: row.is_deload,
    planned_date: row.planned_date,
    status: parseSessionStatus(row.status),
    jit_generated_at: row.jit_generated_at,
    completed_at: row.completed_at ?? null,
  };
}

export async function fetchTodaySession(
  userId: string
): Promise<SessionRow | null> {
  const { data: inProgressData, error: inProgressError } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .not('planned_date', 'is', null)
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (inProgressError) throw inProgressError;
  if (inProgressData) return inProgressData;

  const today = localDateString();
  const { data: completedTodayData, error: completedTodayError } =
    await typedSupabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .eq('planned_date', today)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  if (completedTodayError) throw completedTodayError;
  if (completedTodayData) return completedTodayData;

  const { data: plannedData, error: plannedError } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .not('planned_date', 'is', null)
    .gte('planned_date', today)
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (plannedError) throw plannedError;
  return plannedData;
}

export async function fetchTodaySessions(
  userId: string
): Promise<SessionRow[]> {
  const today = localDateString();
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .or(`planned_date.eq.${today},status.eq.in_progress`)
    .order('planned_date', { ascending: true });
  if (error) throw error;
  // Deduplicate: in_progress session may match both conditions
  const seen = new Set<string>();
  return (data ?? []).filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function fetchSessionById(
  sessionId: string
): Promise<SessionRow | null> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSessionCompletionContext(sessionId: string): Promise<
  | (Pick<SessionRow, 'primary_lift' | 'program_id'> & {
      program_mode: string | null;
    })
  | null
> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('primary_lift, program_id, programs(program_mode)')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const programMode = Array.isArray(data.programs)
    ? (data.programs[0]?.program_mode ?? null)
    : ((data.programs as { program_mode: string } | null)?.program_mode ??
      null);
  return {
    primary_lift: data.primary_lift,
    program_id: data.program_id,
    program_mode: programMode,
  };
}

export async function fetchSessionsForWeek(
  programId: string,
  weekNumber: number
): Promise<ProgramSessionView[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      'id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_date, status, jit_generated_at, completed_at'
    )
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .order('planned_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toProgramSessionView);
}

export async function fetchCompletedSessions(
  userId: string,
  page: number,
  pageSize: number
): Promise<CompletedSessionListItem[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      'id, primary_lift, intensity_type, activity_name, planned_date, completed_at, status, week_number, block_number, session_logs(cycle_phase, session_rpe)'
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return (data ?? []).map((row) => {
    const logs = Array.isArray(row.session_logs) ? row.session_logs : [];
    const log = logs[0] as
      | { cycle_phase?: string | null; session_rpe?: number | null }
      | undefined;
    return {
      id: row.id,
      primary_lift: parseLiftNullable(row.primary_lift),
      intensity_type: row.primary_lift
        ? parseIntensity(row.intensity_type)
        : null,
      activity_name: row.activity_name ?? null,
      planned_date: row.planned_date,
      completed_at: row.completed_at ?? null,
      status: parseSessionStatus(row.status),
      week_number: row.week_number,
      block_number: row.block_number,
      cycle_phase: log?.cycle_phase ?? null,
      rpe: log?.session_rpe ?? null,
    };
  });
}

export async function fetchProgramSessionStatuses(
  programId: string,
  userId: string
): Promise<Array<{ status: SessionStatus }>> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('status')
    .eq('program_id', programId)
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    status: parseSessionStatus(row.status),
  }));
}

export async function insertSorenessCheckin(input: {
  sessionId: string;
  userId: string;
  ratings: Record<string, number>;
  skipped: boolean;
}): Promise<void> {
  const { error } = await typedSupabase.from('soreness_checkins').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    ratings: input.ratings,
    skipped: input.skipped,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Returns the ratings from the most recent soreness check-in for a user,
// regardless of whether it was tied to a session. Used to pre-populate
// the soreness screen after an unprogrammed event injection.
export async function getLatestSorenessRatings(
  userId: string
): Promise<Record<string, number> | null> {
  const { data, error } = await typedSupabase
    .from('soreness_checkins')
    .select('ratings, skipped')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.skipped) return null;
  return data.ratings as Record<string, number>;
}

export async function insertAdHocSession(input: {
  userId: string;
  lift?: Lift;
  intensityType?: 'heavy' | 'explosive' | 'rep';
  activityName?: string;
}): Promise<string> {
  const today = localDateString();
  const { data, error } = await typedSupabase
    .from('sessions')
    .insert({
      user_id: input.userId,
      primary_lift: input.lift ?? null,
      intensity_type: input.intensityType ?? null,
      activity_name: input.activityName ?? null,
      program_id: null,
      block_number: null,
      week_number: 0,
      day_number: 0,
      is_deload: false,
      planned_date: today,
      status: 'planned',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSessionToInProgress(
  sessionId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'in_progress' })
    .eq('id', sessionId)
    .eq('status', 'planned');
  if (error) throw error;
}

export async function updateSessionToSkipped(
  sessionId: string,
  _reason?: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'skipped' })
    .eq('id', sessionId)
    .in('status', ['planned', 'in_progress']);
  if (error) throw error;
}

export async function insertSessionLog(input: {
  sessionId: string;
  userId: string;
  actualSets: ActualSet[];
  auxiliarySets?: ActualSet[];
  sessionRpe: number | undefined;
  completionPct: number;
  performanceVsPlan: 'over' | 'at' | 'under' | 'incomplete';
  startedAt?: Date;
  completedAt?: Date;
}): Promise<string> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      actual_sets: input.actualSets,
      auxiliary_sets: input.auxiliarySets ?? null,
      session_rpe: input.sessionRpe ?? null,
      completion_pct: input.completionPct,
      performance_vs_plan: input.performanceVsPlan,
      started_at: input.startedAt?.toISOString() ?? null,
      completed_at: (input.completedAt ?? new Date()).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSessionToCompleted(
  sessionId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function fetchProfileSex(
  userId: string
): Promise<'female' | 'male' | undefined> {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('biological_sex')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const sex = data?.biological_sex;
  return sex === 'female' || sex === 'male' ? sex : undefined;
}

export type PerformanceMetricsInsert = DbInsert<'performance_metrics'>;

export async function insertPerformanceMetric(
  input: PerformanceMetricsInsert
): Promise<void> {
  const { error } = await typedSupabase
    .from('performance_metrics')
    .insert(input);
  if (error) throw error;
}

export interface RecentLogForLift {
  session_id: string;
  completion_pct: number | null;
  actual_rpe: number | null;
  lift: Lift;
  intensity_type: IntensityType;
}

export async function fetchRecentLogsForLift(
  userId: string,
  lift: Lift,
  limit: number
): Promise<RecentLogForLift[]> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'id, completion_pct, session_rpe, sessions!inner(primary_lift, intensity_type)'
    )
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => {
    const session = normalizeJoinedSession(
      row.sessions as
        | SessionJoinLiftIntensity
        | SessionJoinLiftIntensity[]
        | null
    );
    return {
      session_id: row.id,
      completion_pct: row.completion_pct ?? null,
      actual_rpe: row.session_rpe ?? null,
      lift: parseLift(session?.primary_lift ?? lift),
      intensity_type: parseIntensity(session?.intensity_type ?? 'heavy'),
    };
  });
}

export interface CurrentWeekLogRow {
  actual_sets: ActualSet[];
  auxiliary_sets: ActualSet[];
  primary_lift: Lift | null;
}

export async function fetchCurrentWeekLogs(
  userId: string,
  startIso: string,
  endIso: string
): Promise<CurrentWeekLogRow[]> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('actual_sets, auxiliary_sets, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .gte('completed_at', startIso)
    .lt('completed_at', endIso);

  if (error) throw error;
  return (data ?? []).map((row) => {
    const session = normalizeJoinedSession(
      row.sessions as SessionJoinLift | SessionJoinLift[] | null
    );
    return {
      actual_sets: parseActualSetsJson(row.actual_sets),
      auxiliary_sets: parseActualSetsJson(row.auxiliary_sets),
      primary_lift: session?.primary_lift
        ? parseLift(session.primary_lift)
        : null,
    };
  });
}

export interface OverdueScheduledSessionRow {
  id: string;
  planned_date: string;
  primary_lift: Lift;
  week_number: number;
  program_id: string;
}

export async function fetchOverdueScheduledSessions(
  userId: string,
  today: string
): Promise<OverdueScheduledSessionRow[]> {
  // Exclude unending programs — their sessions are always planned for today and can't go overdue
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      'id, planned_date, primary_lift, week_number, program_id, programs!inner(program_mode)'
    )
    .eq('user_id', userId)
    .eq('status', 'planned')
    .lt('planned_date', today)
    .eq('programs.program_mode', 'scheduled');

  if (error) throw error;
  return (data ?? []).map((row) => {
    if (row.planned_date === null) {
      throw new Error(`Session ${row.id} has null planned_date`);
    }
    return {
      id: row.id,
      planned_date: row.planned_date,
      primary_lift: parseLift(row.primary_lift),
      week_number: row.week_number,
      // Inner join on programs guarantees program_id is non-null here
      program_id: row.program_id!,
    };
  });
}

export interface ProgramSessionForMakeup {
  id: string;
  planned_date: string;
  primary_lift: Lift;
  week_number: number;
}

export async function fetchProgramSessionsForMakeup(
  programId: string,
  userId: string
): Promise<ProgramSessionForMakeup[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, planned_date, primary_lift, week_number')
    .eq('program_id', programId)
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => {
    if (row.planned_date === null) {
      throw new Error(`Session ${row.id} has null planned_date`);
    }
    return {
      id: row.id,
      planned_date: row.planned_date,
      primary_lift: parseLift(row.primary_lift),
      week_number: row.week_number,
    };
  });
}

export async function updateSessionToPlanned(sessionId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'planned' })
    .eq('id', sessionId)
    .eq('status', 'in_progress');
  if (error) throw error;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

export async function markSessionAsMissed(sessionId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'missed' })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function fetchLastCompletedAtForLift(
  userId: string,
  lift: Lift
): Promise<{ completed_at: string | null } | null> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('completed_at, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? { completed_at: data.completed_at } : null;
}

export interface SessionLogDetail {
  actual_sets: ActualSet[];
  auxiliary_sets: ActualSet[];
  session_rpe: number | null;
  completion_pct: number | null;
  performance_vs_plan: string | null;
  started_at: string | null;
  completed_at: string | null;
  session_notes: string | null;
}

export async function fetchSessionLogBySessionId(
  sessionId: string
): Promise<SessionLogDetail | null> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'actual_sets, auxiliary_sets, session_rpe, completion_pct, performance_vs_plan, started_at, completed_at, session_notes'
    )
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    actual_sets: parseActualSetsJson(data.actual_sets),
    auxiliary_sets: data.auxiliary_sets
      ? parseActualSetsJson(data.auxiliary_sets)
      : [],
    session_rpe: data.session_rpe ?? null,
    completion_pct: data.completion_pct ?? null,
    performance_vs_plan: data.performance_vs_plan ?? null,
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
    session_notes: data.session_notes ?? null,
  };
}

export async function fetchInProgressSession(
  userId: string
): Promise<{ id: string; planned_date: string | null } | null> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, planned_date')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Cancel all planned sessions for a program when it is archived/ended.
// Prevents leftover planned sessions from surfacing on the Today screen.
export async function cancelPlannedSessionsForProgram(
  programId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'skipped' })
    .eq('program_id', programId)
    .eq('status', 'planned');
  if (error) throw error;
}

// Fetch the earliest planned session for a given program. Used by unending mode
// to detect whether a next session was already generated before creating another.
// Matches both 'planned' and 'in_progress' to close a TOCTOU race: if the user
// starts a session (planned → in_progress) between fetchTodaySession and this
// guard, the guard would otherwise miss it and generate a duplicate.
export async function fetchPlannedSessionForProgram(
  programId: string,
  userId: string
): Promise<SessionRow | null> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Fetch the primary lift of the most recently completed session in a program.
// Used by unending mode to determine which lift comes next in the rotation.
export async function fetchLastCompletedLiftForProgram(
  programId: string,
  userId: string
): Promise<Lift | null> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('primary_lift')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.primary_lift) return null;
  return LiftSchema.parse(data.primary_lift);
}

// True if any session in this program was completed during today (local time).
// Used to avoid scheduling the next session on the same day (GH#136).
export async function fetchHasCompletedSessionToday(
  programId: string,
  userId: string
): Promise<boolean> {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { count, error } = await typedSupabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', startOfDay.toISOString())
    .lt('completed_at', endOfDay.toISOString());
  if (error) throw error;
  return (count ?? 0) > 0;
}

export interface EndOfWeekContext {
  programId: string | null;
  programMode: 'scheduled' | 'unending' | null;
  weekNumber: number;
  /** For unending programs — the counter value after completing this session */
  unendingSessionCounter: number | null;
}

export async function fetchEndOfWeekContext(
  sessionId: string
): Promise<EndOfWeekContext | null> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      'program_id, week_number, programs(program_mode, unending_session_counter)'
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const programs = Array.isArray(data.programs)
    ? data.programs[0]
    : data.programs;
  const programMode =
    (programs?.program_mode as 'scheduled' | 'unending' | null) ?? null;
  const counter = programs?.unending_session_counter ?? null;

  return {
    programId: data.program_id,
    programMode,
    weekNumber: data.week_number,
    unendingSessionCounter: typeof counter === 'number' ? counter : null,
  };
}

/** Unique aux exercise names from recent sessions, most-recent-first.
 *  Relies on RLS for user scoping — no userId parameter needed. */
export async function fetchRecentAuxExerciseNames() {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('auxiliary_sets')
    .not('auxiliary_sets', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(30);

  if (error) throw error;

  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of data ?? []) {
    const sets = row.auxiliary_sets as unknown[];
    if (!Array.isArray(sets)) continue;
    for (const s of sets) {
      const exercise = (s as { exercise?: string }).exercise;
      if (exercise && !seen.has(exercise)) {
        seen.add(exercise);
        names.push(exercise);
      }
    }
  }
  return names;
}

/** Returns true when no sessions with a higher week_number exist in the same program.
 *  Used to detect end-of-week for scheduled programs. */
export async function fetchHasNextWeekSessions(
  programId: string,
  currentWeekNumber: number
): Promise<boolean> {
  const { count, error } = await typedSupabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .gt('week_number', currentWeekNumber);

  if (error) throw error;
  return (count ?? 0) > 0;
}
