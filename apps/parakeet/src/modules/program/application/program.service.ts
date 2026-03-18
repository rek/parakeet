import {
  calculateSessionDate,
  computeBlockOffset,
  computeDayOffsets,
  DEFAULT_TRAINING_DAYS,
  generateAuxiliaryAssignments,
  generateProgram,
  localDateString,
  nextTrainingDate,
} from '@parakeet/training-engine';
import type { ProgramListItem } from '@shared/types/domain';

import { getAuthenticatedUserId } from '../data/profile.repository';
import { computeMinimalDayShift } from '../utils/computeMinimalDayShift';
import {
  archiveActivePrograms,
  bulkUpdateSessionDates,
  cancelPlannedSessionsForProgram,
  fetchActiveProgramMode,
  fetchActiveProgramWithSessions,
  fetchPlannedSessionsForProgram,
  fetchLatestProgramVersion,
  fetchProgramsList,
  fetchProgramWithSessions,
  insertAuxiliaryAssignmentRows,
  insertProgramRow,
  insertSessionRows,
  listArchivedProgramBlocks,
  updateProgramStatusIfActive,
  updateProgramTrainingDays,
  updateUnendingSessionCounter,
} from '../data/program.repository';
import { getAuxiliaryPools } from '../lib/auxiliary-config';
import { getCurrentMaxes } from '../lib/lifter-maxes';
import { captureException } from '../utils/captureException';
import { appendNextUnendingSession } from './unending-session';

export type { ProgramListItem } from '@shared/types/domain';

export interface CreateProgramInput {
  totalWeeks?: 10 | 12 | 14; // not required for unending programs
  trainingDaysPerWeek: 3 | 4;
  startDate: Date;
  trainingDays?: number[]; // weekday indices 0=Sun..6=Sat
  programMode?: 'scheduled' | 'unending';
}

export type RegenerateProgramInput = Omit<CreateProgramInput, 'programMode'>;

async function getBlockOffset(userId: string): Promise<number> {
  const data = await listArchivedProgramBlocks(userId);
  const history = data.map((p) => ({
    // For unending programs total_weeks is null; treat as 0 blocks contributed
    completedBlocks: Math.floor((p.total_weeks ?? 0) / 4),
  }));
  return computeBlockOffset(history);
}

async function getRequiredUserId(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

async function buildProgram(
  input: CreateProgramInput,
  withFormulaConfigId: boolean
) {
  const userId = await getRequiredUserId();
  const isUnending = input.programMode === 'unending';

  const maxes = await getCurrentMaxes(userId);
  const auxiliaryPool = await getAuxiliaryPools(userId);
  const blockOffset = await getBlockOffset(userId);

  await archiveActivePrograms(userId);

  const nextVersion = (await fetchLatestProgramVersion(userId)) + 1;
  const today = localDateString(input.startDate);

  const program = await insertProgramRow({
    user_id: userId,
    status: 'active',
    version: nextVersion,
    total_weeks: isUnending ? null : (input.totalWeeks ?? 10),
    training_days_per_week: input.trainingDaysPerWeek,
    training_days: input.trainingDays ?? null,
    start_date: today,
    lifter_maxes_id: maxes?.id ?? null,
    program_mode: isUnending ? 'unending' : 'scheduled',
    unending_session_counter: 0,
    ...(withFormulaConfigId ? { formula_config_id: null } : {}),
  });

  // Auxiliary assignments are generated for all 3 blocks upfront for both modes.
  // For unending programs the blocks cycle indefinitely; the same 3-block assignments reuse.
  const auxiliaryAssignments = generateAuxiliaryAssignments(
    program.id,
    input.totalWeeks ?? 9, // 9-week placeholder ensures 3 blocks generated
    auxiliaryPool,
    blockOffset
  );

  await insertAuxiliaryAssignmentRows(
    auxiliaryAssignments.map((a) => ({
      user_id: userId,
      program_id: a.programId,
      block_number: a.blockNumber,
      lift: a.lift,
      exercise_1: a.exercise1,
      exercise_2: a.exercise2,
    }))
  );

  if (isUnending) {
    // Create just the first session — subsequent sessions are generated lazily
    const trainingDays = input.trainingDays ??
      DEFAULT_TRAINING_DAYS[input.trainingDaysPerWeek] ?? [1, 3, 5];
    const firstDate = nextTrainingDate(trainingDays);
    await appendNextUnendingSession(
      {
        id: program.id,
        training_days_per_week: input.trainingDaysPerWeek,
        unending_session_counter: 0,
        training_days: input.trainingDays ?? null,
      },
      userId,
      firstDate,
    );
  } else {
    const scaffold = generateProgram({
      totalWeeks: input.totalWeeks ?? 10,
      trainingDaysPerWeek: input.trainingDaysPerWeek,
      startDate: input.startDate,
      trainingDays: input.trainingDays,
    });

    const sessionRows = scaffold.sessions.map((s) => ({
      user_id: userId,
      program_id: program.id,
      week_number: s.weekNumber,
      day_number: s.dayNumber,
      primary_lift: s.primaryLift,
      intensity_type: s.intensityType,
      block_number: s.blockNumber,
      is_deload: s.isDeload,
      planned_date: localDateString(s.plannedDate),
      status: 'planned',
      planned_sets: null,
      jit_generated_at: null,
    }));

    await insertSessionRows(sessionRows);
  }

  return program;
}

export async function createProgram(input: CreateProgramInput) {
  return buildProgram(input, true);
}

export async function regenerateProgram(input: RegenerateProgramInput) {
  return buildProgram(input, false);
}

export async function getActiveProgram(userId: string) {
  return fetchActiveProgramWithSessions(userId);
}

export async function getProgram(programId: string) {
  return fetchProgramWithSessions(programId);
}

export async function listPrograms(userId: string): Promise<ProgramListItem[]> {
  return fetchProgramsList(userId);
}

export async function updateProgramStatus(
  programId: string,
  status: 'completed' | 'archived',
  options?: { triggerCycleReview?: boolean; userId?: string }
): Promise<void> {
  await cancelPlannedSessionsForProgram(programId);
  await updateProgramStatusIfActive(programId, status);
  if (options?.triggerCycleReview && options.userId) {
    onCycleComplete(programId, options.userId);
  }
}

export async function updateTrainingDays(
  programId: string,
  newDays: number[],
  program: {
    program_mode: string;
    start_date: string;
    training_days: number[] | null;
  }
) {
  // Shift start_date so it falls on the new first training day's weekday.
  // Use the actual weekday of start_date (not the old training_days) so that
  // prior misalignment from bugs or multiple changes doesn't compound.
  const newFirst = [...newDays].sort((a, b) => a - b)[0];
  const originalStart = new Date(program.start_date + 'T00:00:00');
  const startDow = originalStart.getDay();
  const dayShift = computeMinimalDayShift({ oldFirst: startDow, newFirst });
  const newStartDate = new Date(originalStart);
  newStartDate.setDate(newStartDate.getDate() + dayShift);

  await updateProgramTrainingDays(programId, newDays, newStartDate);

  if (program.program_mode === 'scheduled') {
    const futureSessions = await fetchPlannedSessionsForProgram(programId);
    const dayOffsets = computeDayOffsets(newDays);

    const updates = futureSessions.map((session) => ({
      id: session.id,
      planned_date: localDateString(
        calculateSessionDate(
          newStartDate,
          session.week_number,
          session.day_number - 1, // day_number is 1-based, dayIndex is 0-based
          dayOffsets
        )
      ),
    }));

    await bulkUpdateSessionDates(updates);
    return { updatedSessionCount: updates.length };
  }

  // Cancel the stale planned session so findTodaySession regenerates
  // it with the correct date based on the new training days.
  await cancelPlannedSessionsForProgram(programId);
  return { updatedSessionCount: 0 };
}

export async function countFuturePlannedSessions(programId: string) {
  const sessions = await fetchPlannedSessionsForProgram(programId);
  return sessions.length;
}

export {
  fetchActiveProgramMode,
  updateUnendingSessionCounter,
} from '../data/program.repository';

// Triggered after each session completion when program reaches ≥80% done.
// Fire-and-forget: errors are logged but do not block the caller.
export function onCycleComplete(programId: string, userId: string): void {
  import('@modules/cycle-review/lib/cycle-review')
    .then(
      ({ compileCycleReport, getPreviousCycleSummaries, storeCycleReview }) =>
        import('@parakeet/training-engine').then(({ generateCycleReview }) =>
          compileCycleReport(programId, userId).then((report) =>
            getPreviousCycleSummaries(userId, programId, 3).then((summaries) =>
              generateCycleReview(report, summaries).then((review) =>
                storeCycleReview(programId, userId, report, review)
              )
            )
          )
        )
    )
    .catch((err) => captureException(err));
}
