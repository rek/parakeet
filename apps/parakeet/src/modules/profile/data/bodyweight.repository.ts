import { typedSupabase } from '@platform/supabase';

export interface BodyweightEntry {
  id: string;
  recorded_date: string;
  weight_kg: number;
}

export async function fetchBodyweightHistory(userId: string) {
  const { data, error } = await typedSupabase
    .from('bodyweight_entries')
    .select('id, recorded_date, weight_kg')
    .eq('user_id', userId)
    .order('recorded_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BodyweightEntry[];
}

export async function upsertBodyweightEntry({
  userId,
  recordedDate,
  weightKg,
}: {
  userId: string;
  recordedDate: string;
  weightKg: number;
}) {
  const { error } = await typedSupabase
    .from('bodyweight_entries')
    .upsert(
      { user_id: userId, recorded_date: recordedDate, weight_kg: weightKg },
      { onConflict: 'user_id,recorded_date' }
    );
  if (error) throw error;

  // Sync cache: set profiles.bodyweight_kg to the most recent entry
  await syncBodyweightCache(userId);
}

export async function deleteBodyweightEntry({
  userId,
  entryId,
}: {
  userId: string;
  entryId: string;
}) {
  const { error } = await typedSupabase
    .from('bodyweight_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) throw error;

  // Sync cache: set profiles.bodyweight_kg to the most recent remaining entry
  await syncBodyweightCache(userId);
}

async function syncBodyweightCache(userId: string) {
  const { data, error: selectError } = await typedSupabase
    .from('bodyweight_entries')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('recorded_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;

  const { error } = await typedSupabase
    .from('profiles')
    .update({ bodyweight_kg: data?.weight_kg ?? null })
    .eq('id', userId);
  if (error) throw error;
}
