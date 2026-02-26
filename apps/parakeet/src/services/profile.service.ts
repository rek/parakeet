import {
  getAuthenticatedUserId,
  getProfileById,
  updateProfileById,
  type ProfileUpdateRecord,
} from '../data/profile.repository';

export type BiologicalSex = 'female' | 'male';

export interface Profile {
  id: string;
  display_name: string | null;
  biological_sex: BiologicalSex | null;
  date_of_birth: string | null; // ISO date 'YYYY-MM-DD'
  bodyweight_kg: number | null;
  created_at: string;
}

export type UpdateProfileInput = Pick<
  ProfileUpdateRecord,
  'display_name' | 'biological_sex' | 'date_of_birth' | 'bodyweight_kg'
>;

export async function getProfile(): Promise<Profile | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const data = await getProfileById(userId);
  if (!data) return null;

  const normalizedSex: BiologicalSex | null =
    data.biological_sex === 'female' || data.biological_sex === 'male'
      ? data.biological_sex
      : null;

  return {
    ...data,
    biological_sex: normalizedSex,
  };
}

export async function updateProfile(update: UpdateProfileInput): Promise<void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error('Not authenticated');

  await updateProfileById(userId, update);
}
