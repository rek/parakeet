import { typedSupabase } from '../network/supabase-client';

const db = typedSupabase as any;

export async function listArchivedProgramBlocks(userId: string) {
  const { data } = await db
    .from('programs')
    .select('total_weeks, status')
    .eq('user_id', userId)
    .eq('status', 'archived');

  return data ?? [];
}

export async function archiveActivePrograms(userId: string): Promise<void> {
  await db
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active');
}

export async function fetchLatestProgramVersion(userId: string): Promise<number> {
  const { data } = await db
    .from('programs')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { version?: number } | null)?.version ?? 0) as number;
}

export async function insertProgramRow(input: Record<string, unknown>) {
  const { data } = await db
    .from('programs')
    .insert(input)
    .select()
    .single();

  return data;
}

export async function insertSessionRows(rows: Record<string, unknown>[]): Promise<void> {
  await db.from('sessions').insert(rows);
}

export async function insertAuxiliaryAssignmentRows(rows: Record<string, unknown>[]): Promise<void> {
  await db.from('auxiliary_assignments').insert(rows);
}

export async function fetchActiveProgramWithSessions(userId: string) {
  const { data } = await db
    .from('programs')
    .select(`
      *,
      sessions(id, week_number, day_number, primary_lift, intensity_type,
               block_number, is_deload, planned_date, status, jit_generated_at)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return data;
}

export async function fetchProgramWithSessions(programId: string) {
  const { data } = await db
    .from('programs')
    .select('*, sessions(*)')
    .eq('id', programId)
    .maybeSingle();

  return data;
}

export async function fetchProgramsList(userId: string) {
  const { data } = await db
    .from('programs')
    .select('id, version, status, total_weeks, training_days_per_week, start_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function updateProgramStatusIfActive(
  programId: string,
  status: 'completed' | 'archived',
): Promise<void> {
  await db
    .from('programs')
    .update({ status })
    .eq('id', programId)
    .eq('status', 'active');
}
