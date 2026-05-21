// @spec docs/features/programs/spec-generator.md
import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import {
  DEFAULT_AUXILIARY_POOLS,
  DEFAULT_CARDIO_POOL,
  DEFAULT_CORE_POOL,
  type ExerciseType,
} from '@parakeet/training-engine';

import {
  deleteAuxiliaryExercises,
  fetchActiveAssignments,
  fetchAllBlockAssignments,
  fetchAuxiliaryExercises,
  insertAuxiliaryExercises,
  resolveAuxExerciseSlug,
  upsertBlockAssignment,
} from '../data/auxiliary-config.repository';
import { getPrimaryMuscles } from '../utils/auxiliary-muscles';

/** Pool categories the user can configure. 'core' and 'cardio' are not
 *  powerlifting lifts, but are stored in the same auxiliary_exercises table
 *  for symmetry with the lift pools (DB CHECK allows 'core' since 20260515,
 *  'cardio' since 20260516). */
export type AuxiliaryPoolCategory = Lift | 'core' | 'cardio';

function defaultPoolFor(category: AuxiliaryPoolCategory): string[] {
  if (category === 'core') return DEFAULT_CORE_POOL;
  if (category === 'cardio') return DEFAULT_CARDIO_POOL;
  return DEFAULT_AUXILIARY_POOLS[category];
}

export async function getAuxiliaryPool(
  userId: string,
  category: AuxiliaryPoolCategory
): Promise<string[]> {
  const data = await fetchAuxiliaryExercises(userId, category);
  if (data.length === 0) return defaultPoolFor(category);
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
  const [sq, be, dl, co, ca] = await Promise.all([
    fetchAuxiliaryExercises(userId, 'squat'),
    fetchAuxiliaryExercises(userId, 'bench'),
    fetchAuxiliaryExercises(userId, 'deadlift'),
    fetchAuxiliaryExercises(userId, 'core'),
    fetchAuxiliaryExercises(userId, 'cardio'),
  ]);
  const result: Record<string, string[]> = {};
  for (const row of [...sq, ...be, ...dl, ...co, ...ca]) {
    if (row.primary_muscles.length > 0) {
      result[row.exercise_name] = row.primary_muscles;
    }
  }
  return result;
}

/**
 * Returns a map of user-customized exercise types (only for rows where the
 * user picked a type via the AddExerciseModal type-picker step). Used to
 * seed the engine's `customExerciseTypeMap` before JIT runs, so e.g. a
 * user-added "Running" is treated as `timed` instead of falling back to
 * the default `weighted`.
 */
export async function getAllAuxTypeMap(
  userId: string
): Promise<Record<string, ExerciseType>> {
  const [sq, be, dl, co, ca] = await Promise.all([
    fetchAuxiliaryExercises(userId, 'squat'),
    fetchAuxiliaryExercises(userId, 'bench'),
    fetchAuxiliaryExercises(userId, 'deadlift'),
    fetchAuxiliaryExercises(userId, 'core'),
    fetchAuxiliaryExercises(userId, 'cardio'),
  ]);
  const result: Record<string, ExerciseType> = {};
  for (const row of [...sq, ...be, ...dl, ...co, ...ca]) {
    if (
      row.exercise_type === 'weighted' ||
      row.exercise_type === 'bodyweight' ||
      row.exercise_type === 'timed'
    ) {
      result[row.exercise_name] = row.exercise_type;
    }
  }
  return result;
}

export async function getAuxiliaryPools(
  userId: string
): Promise<Record<AuxiliaryPoolCategory, string[]>> {
  return {
    squat: await getAuxiliaryPool(userId, 'squat'),
    bench: await getAuxiliaryPool(userId, 'bench'),
    deadlift: await getAuxiliaryPool(userId, 'deadlift'),
    core: await getAuxiliaryPool(userId, 'core'),
    cardio: await getAuxiliaryPool(userId, 'cardio'),
  };
}

export async function reorderAuxiliaryPool(
  userId: string,
  category: AuxiliaryPoolCategory,
  orderedExercises: string[],
  customMuscles?: Record<string, MuscleGroup[]>,
  customTypes?: Record<string, ExerciseType>
): Promise<void> {
  await deleteAuxiliaryExercises(userId, category);

  const rows = orderedExercises.map((name, i) => ({
    user_id: userId,
    lift: category,
    exercise_name: name,
    exercise_slug: resolveAuxExerciseSlug(name),
    pool_position: i,
    primary_muscles: customMuscles?.[name] ?? getPrimaryMuscles(name),
    exercise_type: customTypes?.[name] ?? null,
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
    exercise_1_slug: resolveAuxExerciseSlug(exercise1),
    exercise_1_locked: exercise1Locked,
    exercise_2: exercise2,
    exercise_2_slug: resolveAuxExerciseSlug(exercise2),
    exercise_2_locked: exercise2Locked,
  });
}
