import { nextUnendingSession } from '@parakeet/training-engine';
import { insertSessionRows, updateUnendingSessionCounter } from '../data/program.repository';

export interface UnendingProgramRef {
  id: string;
  training_days_per_week: number;
  unending_session_counter: number;
  training_days: number[] | null;
}

// Builds and inserts the next session row for an unending program.
// Pass skipCounterIncrement: true when called at program creation — the program row
// is already inserted with unending_session_counter: 0, so it must not be bumped again.
export async function appendNextUnendingSession(
  program: UnendingProgramRef,
  userId: string,
  plannedDate: string,
  options?: { skipCounterIncrement?: boolean },
): Promise<void> {
  const next = nextUnendingSession({
    sessionCounter: program.unending_session_counter,
    trainingDaysPerWeek: program.training_days_per_week,
  });

  await insertSessionRows([{
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
  }]);

  if (!options?.skipCounterIncrement) {
    await updateUnendingSessionCounter(program.id, program.unending_session_counter + 1);
  }
}
