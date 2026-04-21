import type { DbRow, DbUpdate } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';

type ProfileRow = DbRow<'profiles'>;

export interface ProfileRecord
  extends Pick<
    ProfileRow,
    | 'id'
    | 'display_name'
    | 'biological_sex'
    | 'date_of_birth'
    | 'bodyweight_kg'
    | 'height_cm'
    | 'lean_mass_kg'
    | 'activity_level'
    | 'goal'
    | 'created_at'
  > {}

export type ProfileUpdateRecord = Pick<
  DbUpdate<'profiles'>,
  | 'display_name'
  | 'biological_sex'
  | 'date_of_birth'
  | 'bodyweight_kg'
  | 'height_cm'
  | 'lean_mass_kg'
  | 'activity_level'
  | 'goal'
>;

const PROFILE_SELECT =
  'id, display_name, biological_sex, date_of_birth, bodyweight_kg, height_cm, lean_mass_kg, activity_level, goal, created_at';

export async function getAuthenticatedUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  return user?.id ?? null;
}

export async function getProfileById(
  userId: string
): Promise<ProfileRecord | null> {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function updateProfileById(
  userId: string,
  update: ProfileUpdateRecord
): Promise<void> {
  const { error } = await typedSupabase
    .from('profiles')
    .update(update)
    .eq('id', userId);

  if (error) throw error;
}
