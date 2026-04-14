import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import { DEFAULT_AUXILIARY_POOLS } from '@parakeet/training-engine';

import {
  deleteAuxiliaryExercises,
  fetchActiveAssignments,
  fetchAllBlockAssignments,
  fetchAuxiliaryExercises,
  insertAuxiliaryExercises,
  upsertBlockAssignment,
} from '../data/auxiliary-config.repository';
import { getPrimaryMuscles } from '../utils/auxiliary-muscles';

export async function getAuxiliaryPool(
  userId: string,
  lift: Lift
): Promise<string[]> {
  const data = await fetchAuxiliaryExercises(userId, lift);
  if (data.length === 0) return DEFAULT_AUXILIARY_POOLS[lift];
  return data.map((r) => r.exercise_name);
}

/**
 * Returns a map of all auxiliary exercise names to their stored primary muscles.
 * Used to seed the engine's custom exercise registry before JIT runs, and to
 * preserve existing muscle data on pool re-save.
 */
export async function getAllAuxMuscleMap(
  userId: string
): Promise<Record<string, string[]>> {
  const [sq, be, dl] = await Promise.all([
    fetchAuxiliaryExercises(userId, 'squat'),
    fetchAuxiliaryExercises(userId, 'bench'),
    fetchAuxiliaryExercises(userId, 'deadlift'),
  ]);
  const result: Record<string, string[]> = {};
  for (const row of [...sq, ...be, ...dl]) {
    if (row.primary_muscles.length > 0) {
      result[row.exercise_name] = row.primary_muscles;
    }
  }
  return result;
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
  orderedExercises: string[],
  customMuscles?: Record<string, MuscleGroup[]>
): Promise<void> {
  await deleteAuxiliaryExercises(userId, lift);

  const rows = orderedExercises.map((name, i) => ({
    user_id: userId,
    lift,
    exercise_name: name,
    pool_position: i,
    primary_muscles: customMuscles?.[name] ?? getPrimaryMuscles(name),
  }));
  await insertAuxiliaryExercises(rows);
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
  const data = await fetchActiveAssignments(userId, programId, blockNumber);
  return Object.fromEntries(
    data.map((r) => [
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
  const data = await fetchAllBlockAssignments(userId, programId);

  const result: Record<number, Partial<Record<Lift, SlotAssignment>>> = {};
  for (const row of data) {
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
  await upsertBlockAssignment({
    user_id: userId,
    program_id: programId,
    lift,
    block_number: blockNumber,
    exercise_1: exercise1,
    exercise_1_locked: exercise1Locked,
    exercise_2: exercise2,
    exercise_2_locked: exercise2Locked,
  });
}
