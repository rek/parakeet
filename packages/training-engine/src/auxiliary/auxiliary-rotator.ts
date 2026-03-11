import { Lift } from '@parakeet/shared-types';

import { AuxiliaryPool } from '../types';

export { DEFAULT_AUXILIARY_POOLS } from './exercise-catalog';

export interface ProgramRecord {
  completedBlocks: number;
}

export interface AuxiliaryAssignmentRecord {
  programId: string;
  blockNumber: 1 | 2 | 3;
  lift: Lift;
  exercise1: string;
  exercise2: string;
}

/**
 * Returns the 2 exercises for a given block using sequential pool rotation.
 * startOffset advances the rotation across programs (from computeBlockOffset).
 */
export function getAuxiliariesForBlock(
  _lift: Lift,
  blockNumber: 1 | 2 | 3,
  pool: string[],
  startOffset = 0
): [string, string] {
  const poolSize = pool.length;
  const blockIndex = blockNumber - 1;
  const pos1 = (startOffset + blockIndex * 2) % poolSize;
  const pos2 = (startOffset + blockIndex * 2 + 1) % poolSize;
  return [pool[pos1], pool[pos2]];
}

/**
 * Total pool advancement from completed programs.
 * Each block consumed 2 pool positions, so offset = totalBlocks * 2.
 */
export function computeBlockOffset(programHistory: ProgramRecord[]): number {
  const totalBlocks = programHistory.reduce(
    (sum, p) => sum + p.completedBlocks,
    0
  );
  return totalBlocks * 2;
}

/**
 * Generates 9 AuxiliaryAssignmentRecords (3 lifts × 3 blocks) for a new program.
 * Pass startOffset from computeBlockOffset to continue pool rotation across programs.
 */
export function generateAuxiliaryAssignments(
  programId: string,
  _totalWeeks: number,
  pool: AuxiliaryPool,
  startOffset = 0
): AuxiliaryAssignmentRecord[] {
  const assignments: AuxiliaryAssignmentRecord[] = [];
  const lifts: Lift[] = ['squat', 'bench', 'deadlift'];

  for (let blockNumber = 1; blockNumber <= 3; blockNumber++) {
    for (const lift of lifts) {
      const liftPool = pool[lift];
      if (!liftPool || liftPool.length < 2) continue;

      const [ex1, ex2] = getAuxiliariesForBlock(
        lift,
        blockNumber as 1 | 2 | 3,
        liftPool,
        startOffset
      );
      assignments.push({
        programId,
        blockNumber: blockNumber as 1 | 2 | 3,
        lift,
        exercise1: ex1,
        exercise2: ex2,
      });
    }
  }

  return assignments;
}
