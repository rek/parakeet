import { typedSupabase } from '../network/supabase-client';

// TODO: remove cast once all query return types are verified against service layer
const db = typedSupabase as any;

export async function listArchivedProgramBlocks(userId: string) {
  const { data, error } = await db
    .from('programs')
    .select('total_weeks, status')
    .eq('user_id', userId)
    .eq('status', 'archived');

  if (error) throw error;
  return data ?? [];
}

export async function archiveActivePrograms(userId: string): Promise<void> {
  const { error } = await db
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
}

export async function fetchLatestProgramVersion(userId: string): Promise<number> {
  const { data, error } = await db
    .from('programs')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return ((data as { version?: number } | null)?.version ?? 0) as number;
}

export async function insertProgramRow(input: Record<string, unknown>) {
  const { data, error } = await db
    .from('programs')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function insertSessionRows(rows: Record<string, unknown>[]): Promise<void> {
  const { error } = await db.from('sessions').insert(rows);
  if (error) throw error;
}

export async function insertAuxiliaryAssignmentRows(rows: Record<string, unknown>[]): Promise<void> {
  const { error } = await db.from('auxiliary_assignments').insert(rows);
  if (error) throw error;
}

export async function fetchActiveProgramWithSessions(userId: string) {
  const { data, error } = await db
    .from('programs')
    .select(`
      *,
      sessions(id, week_number, day_number, primary_lift, intensity_type,
               block_number, is_deload, planned_date, status, jit_generated_at, completed_at)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchProgramWithSessions(programId: string) {
  const { data, error } = await db
    .from('programs')
    .select('*, sessions(*)')
    .eq('id', programId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchProgramsList(userId: string) {
  const { data, error } = await db
    .from('programs')
    .select('id, version, status, total_weeks, training_days_per_week, start_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateProgramStatusIfActive(
  programId: string,
  status: 'completed' | 'archived',
): Promise<void> {
  const { error } = await db
    .from('programs')
    .update({ status })
    .eq('id', programId)
    .eq('status', 'active');
  if (error) throw error;
}
