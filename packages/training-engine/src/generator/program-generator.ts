import { IntensityType, Lift } from '@parakeet/shared-types'
import {
  calculateSessionDate,
  computeDayOffsets,
  DEFAULT_TRAINING_DAYS,
  getBlockNumber,
  getIntensityTypeForWeek,
  isDeloadWeek,
  getWeekInBlock,
} from '../cube/scheduler'
import {
  AuxiliaryAssignment,
  AuxiliaryPool,
  GenerateProgramInput,
  GeneratedProgramStructure,
  SessionScaffold,
} from '../types'

const LIFT_ORDER: Lift[] = ['squat', 'bench', 'deadlift']

export function generateWeekSessions(
  weekNumber: number,
  blockNumber: 1 | 2 | 3,
  _weekInBlock: number,
  dayOffsets: number[],
  startDate: Date,
): SessionScaffold[] {
  return Array.from({ length: dayOffsets.length }, (_, dayIndex) => {
    const lift = LIFT_ORDER[dayIndex % LIFT_ORDER.length]
    return {
      weekNumber,
      dayNumber: dayIndex + 1,
      primaryLift: lift,
      intensityType: getIntensityTypeForWeek(weekNumber, lift),
      blockNumber,
      isDeload: false,
      plannedDate: calculateSessionDate(startDate, weekNumber, dayIndex, dayOffsets),
      plannedSets: null,
      jitGeneratedAt: null,
    }
  })
}

export function generateDeloadWeek(
  weekNumber: number,
  _totalWeeks: number,
  dayOffsets: number[],
  startDate: Date,
): SessionScaffold[] {
  return Array.from({ length: dayOffsets.length }, (_, dayIndex) => {
    const lift = LIFT_ORDER[dayIndex % LIFT_ORDER.length]
    return {
      weekNumber,
      dayNumber: dayIndex + 1,
      primaryLift: lift,
      intensityType: 'deload' as IntensityType,
      blockNumber: null,
      isDeload: true,
      plannedDate: calculateSessionDate(startDate, weekNumber, dayIndex, dayOffsets),
      plannedSets: null,
      jitGeneratedAt: null,
    }
  })
}

export function generateProgram(input: GenerateProgramInput): GeneratedProgramStructure {
  const { totalWeeks, trainingDaysPerWeek, startDate } = input
  const selectedDays = input.trainingDays ?? DEFAULT_TRAINING_DAYS[trainingDaysPerWeek]
  const dayOffsets = computeDayOffsets(selectedDays)
  const sessions: SessionScaffold[] = []

  for (let week = 1; week <= totalWeeks; week++) {
    if (isDeloadWeek(week, totalWeeks)) {
      sessions.push(...generateDeloadWeek(week, totalWeeks, dayOffsets, startDate))
    } else {
      const blockNumber = getBlockNumber(week) as 1 | 2 | 3
      const weekInBlock = getWeekInBlock(week)
      sessions.push(...generateWeekSessions(week, blockNumber, weekInBlock, dayOffsets, startDate))
    }
  }

  return { sessions }
}

export function generateAuxiliaryAssignments(
  _totalWeeks: number,
  auxiliaryPool: AuxiliaryPool,
): AuxiliaryAssignment[] {
  const assignments: AuxiliaryAssignment[] = []
  const lifts: Lift[] = ['squat', 'bench', 'deadlift']

  for (let blockNumber = 1; blockNumber <= 3; blockNumber++) {
    for (const lift of lifts) {
      const pool = auxiliaryPool[lift]
      if (!pool || pool.length < 2) continue

      const poolSize = pool.length
      const blockIndex = blockNumber - 1
      const pos1 = (blockIndex * 2) % poolSize
      const pos2 = (blockIndex * 2 + 1) % poolSize

      assignments.push({
        blockNumber: blockNumber as 1 | 2 | 3,
        lift,
        exercise1: pool[pos1],
        exercise2: pool[pos2],
      })
    }
  }

  return assignments
}
