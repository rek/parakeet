// @spec docs/features/programs/spec-lifter-maxes.md
import type { DbInsert } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';

export async function getCurrentAuthUser() {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  return user;
}

export async function insertLifterMaxes(row: DbInsert<'lifter_maxes'>) {
  const { data, error } = await typedSupabase
    .from('lifter_maxes')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchLatestLifterMaxes(userId: string) {
  const { data, error } = await typedSupabase
    .from('lifter_maxes')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
