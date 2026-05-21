// @spec docs/features/programs/spec-generator.md
import type { Lift } from '@parakeet/shared-types';
import { getCatalogEntry, slugify } from '@parakeet/training-engine';
import type { DbInsert } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';

type PoolCategory = Lift | 'core' | 'cardio';

export async function fetchAuxiliaryExercises(
  userId: string,
  category: PoolCategory
): Promise<
  {
    exercise_name: string;
    exercise_slug: string;
    primary_muscles: string[];
    exercise_type: string | null;
  }[]
> {
  const { data, error } = await typedSupabase
    .from('auxiliary_exercises')
    .select('exercise_name, exercise_slug, primary_muscles, exercise_type')
    .eq('user_id', userId)
    .eq('lift', category)
    .order('pool_position');

  if (error) throw error;
  return data ?? [];
}

/** Stable slug for a pool entry: catalog hit → catalog slug; otherwise slugify. */
export function resolveAuxExerciseSlug(exerciseName: string): string {
  return getCatalogEntry(exerciseName)?.slug ?? slugify(exerciseName);
}

export async function deleteAuxiliaryExercises(
  userId: string,
  category: PoolCategory
): Promise<void> {
  const { error } = await typedSupabase
    .from('auxiliary_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('lift', category);
  if (error) throw error;
}

export async function insertAuxiliaryExercises(
  rows: DbInsert<'auxiliary_exercises'>[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await typedSupabase
    .from('auxiliary_exercises')
    .insert(rows);
  if (error) throw error;
}

export async function fetchActiveAssignments(
  userId: string,
  programId: string,
  blockNumber: number
): Promise<
  {
    lift: string;
    exercise_1: string;
    exercise_1_locked: boolean;
    exercise_2: string;
    exercise_2_locked: boolean;
  }[]
> {
  const { data, error } = await typedSupabase
    .from('auxiliary_assignments')
    .select(
      'lift, exercise_1, exercise_1_locked, exercise_2, exercise_2_locked'
    )
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('block_number', blockNumber);

  if (error) throw error;
  return data ?? [];
}

export async function fetchAllBlockAssignments(
  userId: string,
  programId: string
): Promise<
  {
    block_number: number;
    lift: string;
    exercise_1: string;
    exercise_1_locked: boolean;
    exercise_2: string;
    exercise_2_locked: boolean;
  }[]
> {
  const { data, error } = await typedSupabase
    .from('auxiliary_assignments')
    .select(
      'block_number, lift, exercise_1, exercise_1_locked, exercise_2, exercise_2_locked'
    )
    .eq('user_id', userId)
    .eq('program_id', programId);

  if (error) throw error;
  return data ?? [];
}

export async function upsertBlockAssignment(
  row: DbInsert<'auxiliary_assignments'>
): Promise<void> {
  const { error } = await typedSupabase
    .from('auxiliary_assignments')
    .upsert(row, { onConflict: 'user_id,program_id,lift,block_number' });
  if (error) throw error;
}
