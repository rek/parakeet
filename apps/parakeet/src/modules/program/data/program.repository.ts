import { safeParseWithParser } from '@parakeet/db';
import type { FormulaOverrides } from '@parakeet/shared-types';
import { FormulaOverridesSchema } from '@parakeet/shared-types';
import type { FormulaConfig } from '@parakeet/training-engine';
import { getDefaultFormulaConfig, mergeFormulaConfig } from '@parakeet/training-engine';
import type { DbInsert, DbRow } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import type { ProgramListItem, ProgramSessionView } from '@shared/types/domain';
import { localDateString } from '@shared/utils/localDateString';

const EMPTY_OVERRIDES: FormulaOverrides = {} as FormulaOverrides;

/**
 * Fetches the active formula config for a user.
 * Kept here (not in @modules/formula) to break the formula ↔ program require cycle:
 * formula/hooks imports programQueries, so program cannot import @modules/formula.
 * Same React Query cache key as formulaQueries.config() so they share the cache.
 */
export async function fetchActiveFormulaConfig(
  userId: string
): Promise<FormulaConfig> {
  const { data } = await typedSupabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  const base = getDefaultFormulaConfig();
  if (!data) return base;
  const overrides = safeParseWithParser(
    data.overrides,
    (v) => FormulaOverridesSchema.parse(v),
    EMPTY_OVERRIDES,
    captureException
  );
  return mergeFormulaConfig(base, overrides);
}

function parseProgramStatus(status: string): ProgramListItem['status'] {
  if (status === 'active' || status === 'completed' || status === 'archived')
    return status;
  throw new Error(`Unexpected program status: ${status}`);
}

export async function listArchivedProgramBlocks(userId: string) {
  const { data, error } = await typedSupabase
    .from('programs')
    .select('total_weeks, status')
    .eq('user_id', userId)
    .eq('status', 'archived');

  if (error) throw error;
  return data ?? [];
}

export async function archiveActivePrograms(userId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
}

export async function fetchLatestProgramVersion(
  userId: string
): Promise<number> {
  const { data, error } = await typedSupabase
    .from('programs')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.version ?? 0;
}

type ProgramInsert = Omit<DbInsert<'programs'>, 'id'>;
export async function insertProgramRow(input: ProgramInsert) {
  const { data, error } = await typedSupabase
    .from('programs')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as Program;
}

type Program = DbRow<'programs'>;
type ProgramWithProgramSessions = Program & {
  sessions: ProgramSessionView[] | null;
};

export async function insertSessionRows(
  rows: DbInsert<'sessions'>[]
): Promise<void> {
  const { error } = await typedSupabase.from('sessions').insert(rows);
  if (error) throw error;
}

export async function insertAuxiliaryAssignmentRows(
  rows: DbInsert<'auxiliary_assignments'>[]
): Promise<void> {
  const { error } = await typedSupabase
    .from('auxiliary_assignments')
    .insert(rows);
  if (error) throw error;
}

export async function fetchActiveProgramWithSessions(userId: string) {
  const { data, error } = await typedSupabase
    .from('programs')
    .select(
      `
      *,
      sessions(id, week_number, day_number, primary_lift, intensity_type,
               block_number, is_deload, planned_date, status, jit_generated_at, completed_at)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data as ProgramWithProgramSessions | null;
}

export async function fetchProgramWithSessions(programId: string) {
  const { data, error } = await typedSupabase
    .from('programs')
    .select('*, sessions(*)')
    .eq('id', programId)
    .maybeSingle();

  if (error) throw error;
  return data as ProgramWithProgramSessions | null;
}

export async function fetchProgramsList(
  userId: string
): Promise<ProgramListItem[]> {
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

export async function updateProgramStatusIfActive(
  programId: string,
  status: 'completed' | 'archived'
): Promise<void> {
  const { error } = await typedSupabase
    .from('programs')
    .update({ status })
    .eq('id', programId)
    .eq('status', 'active');
  if (error) throw error;
}

export async function updateUnendingSessionCounter(
  programId: string,
  newCount: number
): Promise<void> {
  const { error } = await typedSupabase
    .from('programs')
    .update({ unending_session_counter: newCount })
    .eq('id', programId);
  if (error) throw error;
}

export async function updateProgramTrainingDays(
  programId: string,
  trainingDays: number[],
  newStartDate?: Date
): Promise<void> {
  const payload: Partial<DbInsert<'programs'>> = {
    training_days: trainingDays,
  };
  if (newStartDate) {
    payload.start_date = localDateString(newStartDate);
  }
  const { error } = await typedSupabase
    .from('programs')
    .update(payload)
    .eq('id', programId);
  if (error) throw error;
}

export interface FuturePlannedSession {
  id: string;
  week_number: number;
  day_number: number;
}

export async function fetchPlannedSessionsForProgram(
  programId: string
): Promise<FuturePlannedSession[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, week_number, day_number')
    .eq('program_id', programId)
    .eq('status', 'planned')
    .order('week_number', { ascending: true })
    .order('day_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function bulkUpdateSessionDates(
  updates: Array<{ id: string; planned_date: string }>
): Promise<void> {
  await Promise.all(
    updates.map(async ({ id, planned_date }) => {
      const { error } = await typedSupabase
        .from('sessions')
        .update({ planned_date })
        .eq('id', id);
      if (error) throw error;
    })
  );
}

export async function fetchActiveProgramMode(userId: string): Promise<{
  id: string;
  program_mode: string;
  training_days_per_week: number;
  unending_session_counter: number;
  training_days: number[] | null;
} | null> {
  const { data, error } = await typedSupabase
    .from('programs')
    .select(
      'id, program_mode, training_days_per_week, unending_session_counter, training_days'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

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
