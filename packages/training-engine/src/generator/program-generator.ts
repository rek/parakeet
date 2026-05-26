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

// A deload session is tagged with the block it follows (e.g. week 4 deload
// inherits block 1, week 8 follows block 2). This keeps the JIT pipeline's
// `getActiveAssignments(programId, blockNumber)` lookup coherent — the lifter
// deloads the same auxiliaries they were just running. Previously this was
// `blockNumber: null`, which crashed `runJITForSession` via Zod
// (Sentry react-native#122700262).
export function generateDeloadWeek(
  weekNumber: number,
  blockNumber: number,
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
      blockNumber,
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
      // Inherit the block of the preceding training week. Clamp to 1 for the
      // degenerate case of a totalWeeks=1 program (which is itself a deload).
      const followingBlock = week > 1 ? getBlockNumber(week - 1) : 1;
      sessions.push(
        ...generateDeloadWeek(week, followingBlock, dayOffsets, startDate)
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
  lastResolvedLift?: Lift | null; // history-based: rotate past most recent completed-or-skipped lift
  intensitySignals?: IntensityTypeSignals; // when present, triggers dynamic selection
}

export function computeNextUnendingLift(input: {
  sessionCounter: number;
  trainingDaysPerWeek: number;
  lastResolvedLift?: Lift | null;
}): Lift {
  const { sessionCounter, trainingDaysPerWeek, lastResolvedLift } = input;
  const daysPerWeek = Math.max(1, trainingDaysPerWeek);
  return lastResolvedLift
    ? nextLiftAfter(lastResolvedLift)
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
  const { sessionCounter, trainingDaysPerWeek, lastResolvedLift } = input;
  const daysPerWeek = Math.max(1, trainingDaysPerWeek);

  const weekNumber = Math.floor(sessionCounter / daysPerWeek) + 1;
  const dayNumber = (sessionCounter % daysPerWeek) + 1;
  const lift = computeNextUnendingLift({ sessionCounter, trainingDaysPerWeek, lastResolvedLift });

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

