import type { ProgramSessionView } from '@shared/types/domain';

export type ProgramSession = ProgramSessionView;

export function groupByWeek(
  sessions: ProgramSession[]
): [number, ProgramSession[]][] {
  const map = new Map<number, ProgramSession[]>();
  for (const s of sessions) {
    if (!map.has(s.week_number)) map.set(s.week_number, []);
    map.get(s.week_number)!.push(s);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function currentBlockNumber(
  startDate: string,
  totalWeeks: number
): number {
  const weeksPassed = Math.floor(
    (Date.now() - new Date(startDate).getTime()) / MS_PER_WEEK
  );
  const totalBlocks = Math.ceil((totalWeeks - 1) / 3);
  const block = Math.min(totalBlocks, Math.floor(weeksPassed / 3) + 1);
  return Math.max(1, block);
}

export function unendingBlockNumber(
  sessionCounter: number,
  daysPerWeek: number
): number {
  const weekNumber = Math.floor(sessionCounter / daysPerWeek) + 1;
  return ((Math.floor((weekNumber - 1) / 3) % 3) + 1);
}

/** Get the current block number for any program mode. */
export function getCurrentBlock(program: {
  program_mode?: string | null;
  unending_session_counter?: number | null;
  training_days_per_week?: number | null;
  start_date?: string | null;
  total_weeks?: number | null;
}): number {
  if (program.program_mode === 'unending') {
    return unendingBlockNumber(
      program.unending_session_counter ?? 0,
      program.training_days_per_week ?? 3
    );
  }
  return currentBlockNumber(program.start_date!, program.total_weeks ?? 9);
}

export function determineCurrentWeek(sessions: ProgramSession[]): number {
  const activeSession = sessions.find(
    (s) => s.status === 'planned' || s.status === 'in_progress'
  );
  return activeSession?.week_number ?? 1;
}
