import {
  getAuthenticatedUserId,
  getProfileById,
  updateProfileById,
  type ProfileUpdateRecord,
} from '../data/profile.repository';

export type BiologicalSex = 'female' | 'male';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
export type Goal = 'cut' | 'maintain' | 'bulk';

export interface Profile {
  id: string;
  display_name: string | null;
  biological_sex: BiologicalSex | null;
  date_of_birth: string | null; // ISO date 'YYYY-MM-DD'
  bodyweight_kg: number | null;
  height_cm: number | null;
  lean_mass_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  created_at: string;
}

export type UpdateProfileInput = Pick<
  ProfileUpdateRecord,
  | 'display_name'
  | 'biological_sex'
  | 'date_of_birth'
  | 'bodyweight_kg'
  | 'height_cm'
  | 'lean_mass_kg'
  | 'activity_level'
  | 'goal'
>;

const ACTIVITY_LEVELS: ReadonlySet<ActivityLevel> = new Set([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
const GOALS: ReadonlySet<Goal> = new Set(['cut', 'maintain', 'bulk']);

function isActivityLevel(v: unknown): v is ActivityLevel {
  return typeof v === 'string' && ACTIVITY_LEVELS.has(v as ActivityLevel);
}
function isGoal(v: unknown): v is Goal {
  return typeof v === 'string' && GOALS.has(v as Goal);
}

export async function getProfile(): Promise<Profile | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const data = await getProfileById(userId);
  if (!data) return null;

  const normalizedSex: BiologicalSex | null =
    data.biological_sex === 'female' || data.biological_sex === 'male'
      ? data.biological_sex
      : null;
  const activity_level = isActivityLevel(data.activity_level)
    ? data.activity_level
    : null;
  const goal = isGoal(data.goal) ? data.goal : null;

  return {
    ...data,
    biological_sex: normalizedSex,
    activity_level,
    goal,
  };
}

export async function updateProfile(update: UpdateProfileInput): Promise<void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error('Not authenticated');

  await updateProfileById(userId, update);
}
