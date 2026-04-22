import { IntensityType, Lift } from '@parakeet/shared-types';

import { LIFTS } from '../auxiliary/exercise-catalog';
import {
  calculateSessionDate,
  computeDayOffsets,
  DEFAULT_TRAINING_DAYS,
  getBlockNumber,
  getIntensityTypeForWeek,
  getWeekInBlock,
  isDeloadWeek,
  selectIntensityTypeForUnending,
  type IntensityTypeSignals,
} from '../cube/scheduler';
import {
  AuxiliaryAssignment,
  AuxiliaryPool,
  GeneratedProgramStructure,
  GenerateProgramInput,
  SessionScaffold,
} from '../types';

export function generateWeekSessions(
  weekNumber: number,
  blockNumber: number,
  _weekInBlock: number,
  dayOffsets: number[],
  startDate: Date
): SessionScaffold[] {
  return Array.from({ length: dayOffsets.length }, (_, dayIndex) => {
    const lift = LIFTS[dayIndex % LIFTS.length];
    return {
      weekNumber,
      dayNumber: dayIndex + 1,
      primaryLift: lift,
      intensityType: getIntensityTypeForWeek(weekNumber, lift),
      blockNumber,
      isDeload: false,
      plannedDate: calculateSessionDate(
        startDate,
        weekNumber,
        dayIndex,
        dayOffsets
      ),
      plannedSets: null,
      jitGeneratedAt: null,
    };
  });
}

export function generateDeloadWeek(
  weekNumber: number,
  _totalWeeks: number,
  dayOffsets: number[],
  startDate: Date
): SessionScaffold[] {
  return Array.from({ length: dayOffsets.length }, (_, dayIndex) => {
    const lift = LIFTS[dayIndex % LIFTS.length];
    return {
      weekNumber,
      dayNumber: dayIndex + 1,
      primaryLift: lift,
      intensityType: 'deload' as IntensityType,
      blockNumber: null,
      isDeload: true,
      plannedDate: calculateSessionDate(
        startDate,
        weekNumber,
        dayIndex,
        dayOffsets
      ),
      plannedSets: null,
      jitGeneratedAt: null,
    };
  });
}

export function generateProgram(
  input: GenerateProgramInput
): GeneratedProgramStructure {
  const { totalWeeks, trainingDaysPerWeek, startDate } = input;
  const selectedDays =
    input.trainingDays ?? DEFAULT_TRAINING_DAYS[trainingDaysPerWeek];
  const dayOffsets = computeDayOffsets(selectedDays);
  const sessions: SessionScaffold[] = [];

  for (let week = 1; week <= totalWeeks; week++) {
    if (isDeloadWeek(week, totalWeeks)) {
      sessions.push(
        ...generateDeloadWeek(week, totalWeeks, dayOffsets, startDate)
      );
    } else {
      const blockNumber = getBlockNumber(week);
      const weekInBlock = getWeekInBlock(week);
      sessions.push(
        ...generateWeekSessions(
          week,
          blockNumber,
          weekInBlock,
          dayOffsets,
          startDate
        )
      );
    }
  }

  return { sessions };
}

export interface NextUnendingSessionInput {
  sessionCounter: number; // program.unending_session_counter (0-based)
  trainingDaysPerWeek: number;
  lastCompletedLift?: Lift | null; // history-based: rotate past this lift
  intensitySignals?: IntensityTypeSignals; // when present, triggers dynamic selection
}

export function computeNextUnendingLift(input: {
  sessionCounter: number;
  trainingDaysPerWeek: number;
  lastCompletedLift?: Lift | null;
}): Lift {
  const { sessionCounter, trainingDaysPerWeek, lastCompletedLift } = input;
  const daysPerWeek = Math.max(1, trainingDaysPerWeek);
  return lastCompletedLift
    ? nextLiftAfter(lastCompletedLift)
    : LIFTS[(sessionCounter % daysPerWeek) % LIFTS.length];
}

export interface NextUnendingSessionResult {
  weekNumber: number; // synthetic, monotonically increasing
  dayNumber: number; // 1..trainingDaysPerWeek
  primaryLift: Lift;
  intensityType: IntensityType;
  blockNumber: number;
  isDeload: boolean;
}

// Computes the metadata for the next session in an unending program.
// All values are derived arithmetically from the session counter — no DB access needed.
// Advance one position in the squat→bench→deadlift rotation.
function nextLiftAfter(lastLift: Lift): Lift {
  const idx = LIFTS.indexOf(lastLift);
  return LIFTS[(idx + 1) % LIFTS.length];
}

export function nextUnendingSession(
  input: NextUnendingSessionInput
): NextUnendingSessionResult {
  const { sessionCounter, trainingDaysPerWeek, lastCompletedLift } = input;
  const daysPerWeek = Math.max(1, trainingDaysPerWeek);

  const weekNumber = Math.floor(sessionCounter / daysPerWeek) + 1;
  const dayNumber = (sessionCounter % daysPerWeek) + 1;
  const lift = computeNextUnendingLift({ sessionCounter, trainingDaysPerWeek, lastCompletedLift });

  // Blocks cycle 1→2→3→1… every 3 training weeks (same as scheduled)
  const blockNumber = (Math.floor((weekNumber - 1) / 3) % 3) + 1;

  // Deload every 4th week equivalent (week 4, 8, 12, …)
  const isDeload = weekNumber % 4 === 0;

  const intensityType: IntensityType = input.intensitySignals
    ? selectIntensityTypeForUnending(lift, weekNumber, input.intensitySignals)
    : isDeload
      ? 'deload'
      : getIntensityTypeForWeek(weekNumber, lift);

  return {
    weekNumber,
    dayNumber,
    primaryLift: lift,
    intensityType,
    blockNumber,
    isDeload,
  };
}

export function generateAuxiliaryAssignments(
  totalWeeks: number,
  auxiliaryPool: AuxiliaryPool
): AuxiliaryAssignment[] {
  const assignments: AuxiliaryAssignment[] = [];
  const lifts: Lift[] = ['squat', 'bench', 'deadlift'];
  const totalBlocks = Math.ceil((totalWeeks - 1) / 3);

  for (let blockNumber = 1; blockNumber <= totalBlocks; blockNumber++) {
    for (const lift of lifts) {
      const pool = auxiliaryPool[lift];
      if (!pool || pool.length < 2) continue;

      const poolSize = pool.length;
      const blockIndex = blockNumber - 1;
      const pos1 = (blockIndex * 2) % poolSize;
      const pos2 = (blockIndex * 2 + 1) % poolSize;

      assignments.push({
        blockNumber,
        lift,
        exercise1: pool[pos1],
        exercise2: pool[pos2],
      });
    }
  }

  return assignments;
}
