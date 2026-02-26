import type { DbRow, DbUpdate } from '../network/database';
import { typedSupabase } from '../network/supabase-client';

type ProfileRow = DbRow<'profiles'>;

export interface ProfileRecord
  extends Pick<
    ProfileRow,
    'id' | 'display_name' | 'biological_sex' | 'date_of_birth' | 'bodyweight_kg' | 'created_at'
  > {}

export type ProfileUpdateRecord = Pick<
  DbUpdate<'profiles'>,
  'display_name' | 'biological_sex' | 'date_of_birth' | 'bodyweight_kg'
>;

export async function getAuthenticatedUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  return user?.id ?? null;
}

export async function getProfileById(userId: string): Promise<ProfileRecord | null> {
  const { data } = await typedSupabase
    .from('profiles')
    .select('id, display_name, biological_sex, date_of_birth, bodyweight_kg, created_at')
    .eq('id', userId)
    .maybeSingle();

  return data ?? null;
}

export async function updateProfileById(
  userId: string,
  update: ProfileUpdateRecord,
): Promise<void> {
  const { error } = await typedSupabase
    .from('profiles')
    .update(update)
    .eq('id', userId);

  if (error) throw error;
}
