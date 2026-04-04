import { IntensityTypeSchema, LiftSchema } from '@parakeet/shared-types';
import type { IntensityType, Lift } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';
import type { CompletedSessionListItem, ProgramListItem, SessionStatus } from '@shared/types/domain';

// SYNC: These functions mirror repository logic in @modules/session and @modules/program.
// Kept here to avoid circular dependencies: history -> session -> history and
// history -> program -> history. Any schema changes to sessions/programs tables
// must be reflected here as well.

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

function parseProgramStatus(status: string): ProgramListItem['status'] {
  if (status === 'active' || status === 'completed' || status === 'archived')
    return status;
  throw new Error(`Unexpected program status: ${status}`);
}

export async function getCompletedSessions(
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

export async function listPrograms(userId: string): Promise<ProgramListItem[]> {
  const { data, error } = await typedSupabase
    .from('programs')
    .select(
      'id, version, status, program_mode, total_weeks, unending_session_counter, training_days_per_week, start_date, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version ?? null,
    status: parseProgramStatus(row.status),
    program_mode: (row.program_mode === 'unending'
      ? 'unending'
      : 'scheduled') as 'scheduled' | 'unending',
    total_weeks: row.total_weeks ?? null,
    unending_session_counter: row.unending_session_counter ?? 0,
    training_days_per_week: row.training_days_per_week,
    start_date: row.start_date,
    created_at: row.created_at,
  }));
}
