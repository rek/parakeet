import {
  computeBlockOffset,
  generateAuxiliaryAssignments,
  generateProgram,
} from '@parakeet/training-engine';

import {
  archiveActivePrograms,
  fetchActiveProgramWithSessions,
  fetchLatestProgramVersion,
  fetchProgramWithSessions,
  fetchProgramsList,
  insertAuxiliaryAssignmentRows,
  insertProgramRow,
  insertSessionRows,
  listArchivedProgramBlocks,
  updateProgramStatusIfActive,
} from '../data/program.repository';
import { getAuthenticatedUserId } from '../data/profile.repository';
import { getAuxiliaryPools } from '../lib/auxiliary-config';
import { getCurrentMaxes } from '../lib/lifter-maxes';

export interface CreateProgramInput {
  totalWeeks: 10 | 12 | 14;
  trainingDaysPerWeek: 3 | 4;
  startDate: Date;
}

export type RegenerateProgramInput = CreateProgramInput;

export interface ProgramListItem {
  id: string;
  version: number | null;
  status: string;
  total_weeks: number;
  training_days_per_week: number;
  start_date: string;
  created_at: string;
}

async function getBlockOffset(userId: string): Promise<number> {
  const data = await listArchivedProgramBlocks(userId);
  const history = data.map((p: { total_weeks: number }) => ({
    completedBlocks: Math.floor(p.total_weeks / 4),
  }));
  return computeBlockOffset(history);
}

async function getRequiredUserId(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

async function buildProgram(input: CreateProgramInput, withFormulaConfigId: boolean) {
  const userId = await getRequiredUserId();

  const maxes = await getCurrentMaxes(userId);
  const scaffold = generateProgram({
    totalWeeks: input.totalWeeks,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    startDate: input.startDate,
  });

  const auxiliaryPool = await getAuxiliaryPools(userId);
  const blockOffset = await getBlockOffset(userId);

  await archiveActivePrograms(userId);

  const nextVersion = (await fetchLatestProgramVersion(userId)) + 1;

  const program = await insertProgramRow({
    user_id: userId,
    status: 'active',
    version: nextVersion,
    total_weeks: input.totalWeeks,
    training_days_per_week: input.trainingDaysPerWeek,
    start_date: input.startDate.toISOString().split('T')[0],
    lifter_maxes_id: maxes?.id ?? null,
    ...(withFormulaConfigId ? { formula_config_id: null } : {}),
  });

  const auxiliaryAssignments = generateAuxiliaryAssignments(
    program!.id,
    input.totalWeeks,
    auxiliaryPool,
    blockOffset,
  );

  const sessionRows = scaffold.sessions.map((s) => ({
    user_id: userId,
    program_id: program!.id,
    week_number: s.weekNumber,
    day_number: s.dayNumber,
    primary_lift: s.primaryLift,
    intensity_type: s.intensityType,
    block_number: s.blockNumber,
    is_deload: s.isDeload,
    planned_date: s.plannedDate.toISOString().split('T')[0],
    status: 'planned',
    planned_sets: null,
    jit_generated_at: null,
  }));

  await insertSessionRows(sessionRows);
  await insertAuxiliaryAssignmentRows(
    auxiliaryAssignments.map((a) => ({ ...a, user_id: userId })),
  );

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

export async function listPrograms(userId: string) {
  const rows = await fetchProgramsList(userId);
  return rows as ProgramListItem[];
}

export async function updateProgramStatus(
  programId: string,
  status: 'completed' | 'archived',
): Promise<void> {
  await updateProgramStatusIfActive(programId, status);
}

// Triggered after each session completion when program reaches ≥80% done.
// Fire-and-forget: errors are logged but do not block the caller.
export function onCycleComplete(programId: string, userId: string): void {
  import('../lib/cycle-review')
    .then(({ compileCycleReport, getPreviousCycleSummaries, storeCycleReview }) =>
      import('@parakeet/training-engine')
        .then(({ generateCycleReview }) =>
          compileCycleReport(programId, userId)
            .then((report) =>
              getPreviousCycleSummaries(userId, programId, 3).then((summaries) =>
                generateCycleReview(report, summaries).then((review) =>
                  storeCycleReview(programId, userId, report, review),
                ),
              ),
            ),
        ),
    )
    .catch((err) => console.error('[onCycleComplete] cycle review failed:', err));
}
