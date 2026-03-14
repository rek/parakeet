import { Lift } from '@parakeet/shared-types';

import { AuxiliaryPool } from '../types';
import { LIFTS } from './exercise-catalog';

export { DEFAULT_AUXILIARY_POOLS } from './exercise-catalog';

export interface ProgramRecord {
  completedBlocks: number;
}

export interface AuxiliaryAssignmentRecord {
  programId: string;
  blockNumber: number;
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
  blockNumber: number,
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
 * Generates AuxiliaryAssignmentRecords (3 lifts × N blocks) for a new program.
 * The last week is always a deload, so totalBlocks = ceil((totalWeeks - 1) / 3).
 * Pass startOffset from computeBlockOffset to continue pool rotation across programs.
 */
export function generateAuxiliaryAssignments(
  programId: string,
  totalWeeks: number,
  pool: AuxiliaryPool,
  startOffset = 0
): AuxiliaryAssignmentRecord[] {
  const assignments: AuxiliaryAssignmentRecord[] = [];
  const lifts = LIFTS;
  const totalBlocks = Math.ceil((totalWeeks - 1) / 3);

  for (let blockNumber = 1; blockNumber <= totalBlocks; blockNumber++) {
    for (const lift of lifts) {
      const liftPool = pool[lift];
      if (!liftPool || liftPool.length < 2) continue;

      const [ex1, ex2] = getAuxiliariesForBlock(lift, blockNumber, liftPool, startOffset);
      assignments.push({
        programId,
        blockNumber,
        lift,
        exercise1: ex1,
        exercise2: ex2,
      });
    }
  }

  return assignments;
}
