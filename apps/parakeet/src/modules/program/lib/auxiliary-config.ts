import type { Lift } from '@parakeet/shared-types';
import { DEFAULT_AUXILIARY_POOLS } from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';

import { getPrimaryMuscles } from '../utils/auxiliary-muscles';

export async function getAuxiliaryPool(
  userId: string,
  lift: Lift
): Promise<string[]> {
  const { data, error } = await typedSupabase
    .from('auxiliary_exercises')
    .select('exercise_name')
    .eq('user_id', userId)
    .eq('lift', lift)
    .order('pool_position');

  if (error) throw error;
  if (!data || data.length === 0) return DEFAULT_AUXILIARY_POOLS[lift];
  return data.map((r) => r.exercise_name);
}

export async function getAuxiliaryPools(
  userId: string
): Promise<Record<Lift, string[]>> {
  return {
    squat: await getAuxiliaryPool(userId, 'squat'),
    bench: await getAuxiliaryPool(userId, 'bench'),
    deadlift: await getAuxiliaryPool(userId, 'deadlift'),
  };
}

export async function reorderAuxiliaryPool(
  userId: string,
  lift: Lift,
  orderedExercises: string[]
): Promise<void> {
  await typedSupabase
    .from('auxiliary_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('lift', lift);

  const rows = orderedExercises.map((name, i) => ({
    user_id: userId,
    lift,
    exercise_name: name,
    pool_position: i,
    primary_muscles: getPrimaryMuscles(name),
  }));
  await typedSupabase.from('auxiliary_exercises').insert(rows);
}

export type SlotAssignment = {
  exercise_1: string;
  exercise_1_locked: boolean;
  exercise_2: string;
  exercise_2_locked: boolean;
};

export async function getActiveAssignments(
  userId: string,
  programId: string,
  blockNumber: number
): Promise<Partial<Record<Lift, SlotAssignment>>> {
  const { data, error } = await typedSupabase
    .from('auxiliary_assignments')
    .select(
      'lift, exercise_1, exercise_1_locked, exercise_2, exercise_2_locked'
    )
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('block_number', blockNumber);

  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [
      r.lift,
      {
        exercise_1: r.exercise_1,
        exercise_1_locked: r.exercise_1_locked,
        exercise_2: r.exercise_2,
        exercise_2_locked: r.exercise_2_locked,
      },
    ])
  ) as Partial<Record<Lift, SlotAssignment>>;
}

export async function getAllBlockAssignments(
  userId: string,
  programId: string
): Promise<Record<number, Partial<Record<Lift, SlotAssignment>>>> {
  const { data, error } = await typedSupabase
    .from('auxiliary_assignments')
    .select(
      'block_number, lift, exercise_1, exercise_1_locked, exercise_2, exercise_2_locked'
    )
    .eq('user_id', userId)
    .eq('program_id', programId);

  if (error) throw error;

  const result: Record<number, Partial<Record<Lift, SlotAssignment>>> = {};
  for (const row of data ?? []) {
    const bn = row.block_number as number;
    if (!result[bn]) result[bn] = {};
    result[bn]![row.lift as Lift] = {
      exercise_1: row.exercise_1,
      exercise_1_locked: row.exercise_1_locked,
      exercise_2: row.exercise_2,
      exercise_2_locked: row.exercise_2_locked,
    };
  }
  return result;
}

export async function saveBlockAssignment(
  userId: string,
  programId: string,
  lift: Lift,
  blockNumber: number,
  exercise1: string,
  exercise1Locked: boolean,
  exercise2: string,
  exercise2Locked: boolean
): Promise<void> {
  const { error } = await typedSupabase.from('auxiliary_assignments').upsert(
    {
      user_id: userId,
      program_id: programId,
      lift,
      block_number: blockNumber,
      exercise_1: exercise1,
      exercise_1_locked: exercise1Locked,
      exercise_2: exercise2,
      exercise_2_locked: exercise2Locked,
    },
    { onConflict: 'user_id,program_id,lift,block_number' }
  );
  if (error) throw error;
}
