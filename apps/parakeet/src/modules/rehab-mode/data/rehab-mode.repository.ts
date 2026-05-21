// @spec docs/features/rehab-mode/spec-data.md
import type {
  CreateRehabCapInput,
  RehabLift,
  UpdateRehabCapInput,
} from '@parakeet/shared-types';
import type { DbInsert, DbRow, DbUpdate } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';

export type RehabCapRow = DbRow<'rehab_caps'>;

/** Thrown when a second active cap is attempted for the same (user_id, lift).
 *  Surfaced to UI so a friendly error message can replace the raw PG error. */
export class ActiveRehabCapExistsError extends Error {
  constructor(public readonly lift: RehabLift) {
    super(`A rehab cap is already active for ${lift}.`);
    this.name = 'ActiveRehabCapExistsError';
  }
}

const UNIQUE_VIOLATION = '23505';

export async function listActiveRehabCaps(
  userId: string
): Promise<RehabCapRow[]> {
  const { data, error } = await typedSupabase
    .from('rehab_caps')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getActiveCapForLift(
  userId: string,
  lift: RehabLift
): Promise<RehabCapRow | null> {
  const { data, error } = await typedSupabase
    .from('rehab_caps')
    .select('*')
    .eq('user_id', userId)
    .eq('lift', lift)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRehabCap(
  id: string,
  userId: string
): Promise<RehabCapRow | null> {
  const { data, error } = await typedSupabase
    .from('rehab_caps')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRehabCapHistory(
  userId: string,
  { page = 0, pageSize = 20 }: { page?: number; pageSize?: number } = {}
): Promise<{ items: RehabCapRow[]; total: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await typedSupabase
    .from('rehab_caps')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}

export async function insertRehabCap(
  userId: string,
  input: CreateRehabCapInput
): Promise<RehabCapRow> {
  const row: DbInsert<'rehab_caps'> = {
    user_id: userId,
    lift: input.lift,
    cap_kg: input.cap_kg,
    note: input.note ?? null,
    planned_end_date: input.planned_end_date ?? null,
  };
  const { data, error } = await typedSupabase
    .from('rehab_caps')
    .insert(row)
    .select()
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new ActiveRehabCapExistsError(input.lift);
    }
    throw error;
  }
  return data;
}

export async function updateRehabCap(
  id: string,
  userId: string,
  patch: UpdateRehabCapInput
): Promise<RehabCapRow> {
  const update: DbUpdate<'rehab_caps'> = {};
  if (patch.cap_kg !== undefined) update.cap_kg = patch.cap_kg;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.planned_end_date !== undefined)
    update.planned_end_date = patch.planned_end_date;
  if (patch.ended_at !== undefined) update.ended_at = patch.ended_at;

  const { data, error } = await typedSupabase
    .from('rehab_caps')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function endRehabCap(
  id: string,
  userId: string,
  endedAt: Date = new Date()
): Promise<RehabCapRow> {
  return updateRehabCap(id, userId, { ended_at: endedAt.toISOString() });
}
