import { DEFAULT_AUXILIARY_POOLS } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

export async function getAuxiliaryPool(userId: string, lift: Lift): Promise<string[]> {
  const { data } = await supabase
    .from('auxiliary_exercises')
    .select('exercise_name')
    .eq('user_id', userId)
    .eq('lift', lift)
    .order('pool_position')

  if (!data || data.length === 0) return DEFAULT_AUXILIARY_POOLS[lift]
  return data.map((r) => r.exercise_name)
}

export async function getAuxiliaryPools(userId: string): Promise<Record<Lift, string[]>> {
  return {
    squat:    await getAuxiliaryPool(userId, 'squat'),
    bench:    await getAuxiliaryPool(userId, 'bench'),
    deadlift: await getAuxiliaryPool(userId, 'deadlift'),
  }
}

export async function reorderAuxiliaryPool(
  userId: string,
  lift: Lift,
  orderedExercises: string[],
): Promise<void> {
  await supabase.from('auxiliary_exercises').delete().eq('user_id', userId).eq('lift', lift)

  const rows = orderedExercises.map((name, i) => ({
    user_id: userId,
    lift,
    exercise_name: name,
    pool_position: i,
  }))
  await supabase.from('auxiliary_exercises').insert(rows)
}

export async function getActiveAssignments(
  userId: string,
  programId: string,
  blockNumber: 1 | 2 | 3,
): Promise<Partial<Record<Lift, [string, string]>>> {
  const { data } = await supabase
    .from('auxiliary_assignments')
    .select('lift, exercise_1, exercise_2')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('block_number', blockNumber)

  return Object.fromEntries(
    (data ?? []).map((r) => [r.lift, [r.exercise_1, r.exercise_2]]),
  ) as Partial<Record<Lift, [string, string]>>
}

export async function lockAssignment(
  userId: string,
  programId: string,
  lift: Lift,
  blockNumber: 1 | 2 | 3,
  exercise1: string,
  exercise2: string,
): Promise<void> {
  await supabase.from('auxiliary_assignments').upsert(
    {
      user_id: userId,
      program_id: programId,
      lift,
      block_number: blockNumber,
      exercise_1: exercise1,
      exercise_2: exercise2,
      is_locked: true,
    },
    { onConflict: 'user_id,program_id,lift,block_number' },
  )
}
