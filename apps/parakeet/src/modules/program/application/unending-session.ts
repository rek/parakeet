// @spec docs/features/programs/spec-unending.md
import type { Lift } from '@parakeet/shared-types';
import { nextUnendingSession, type IntensityTypeSignals } from '@parakeet/training-engine';

import {
  insertSessionRows,
  updateUnendingSessionCounter,
} from '../data/program.repository';

export interface UnendingProgramRef {
  id: string;
  training_days_per_week: number;
  unending_session_counter: number;
  training_days: number[] | null;
}

// Builds and inserts the next session row for an unending program and advances the counter.
// lastCompletedLift drives history-based rotation (squat→bench→deadlift→squat).
export async function appendNextUnendingSession(
  program: UnendingProgramRef,
  userId: string,
  plannedDate: string,
  lastCompletedLift?: Lift | null,
  intensitySignals?: IntensityTypeSignals
): Promise<void> {
  const next = nextUnendingSession({
    sessionCounter: program.unending_session_counter,
    trainingDaysPerWeek: program.training_days_per_week,
    lastCompletedLift,
    intensitySignals,
  });

  await insertSessionRows([
    {
      user_id: userId,
      program_id: program.id,
      week_number: next.weekNumber,
      day_number: next.dayNumber,
      primary_lift: next.primaryLift,
      intensity_type: next.intensityType,
      block_number: next.blockNumber,
      is_deload: next.isDeload,
      planned_date: plannedDate,
      status: 'planned',
      planned_sets: null,
      jit_generated_at: null,
    },
  ]);

  await updateUnendingSessionCounter(
    program.id,
    program.unending_session_counter + 1
  );
}
