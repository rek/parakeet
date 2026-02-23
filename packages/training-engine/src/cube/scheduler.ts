import { IntensityType, Lift } from '@parakeet/shared-types'
import { InvalidInputError } from '../errors'

// Cube Method rotation: index = weekInBlock - 1
const CUBE_ROTATION: Record<number, Record<Lift, IntensityType>> = {
  1: { squat: 'heavy', bench: 'rep', deadlift: 'explosive' },
  2: { squat: 'explosive', bench: 'heavy', deadlift: 'rep' },
  3: { squat: 'rep', bench: 'explosive', deadlift: 'heavy' },
}

// Day offsets from program start (Monday = 0)
const DAY_OFFSETS: Record<number, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
}

export function getBlockNumber(weekNumber: number): 1 | 2 | 3 {
  return (Math.floor((weekNumber - 1) / 3) + 1) as 1 | 2 | 3
}

export function getWeekInBlock(weekNumber: number): 1 | 2 | 3 {
  return (((weekNumber - 1) % 3) + 1) as 1 | 2 | 3
}

export function isDeloadWeek(weekNumber: number, totalWeeks: number): boolean {
  return weekNumber === totalWeeks
}

export function getIntensityTypeForWeek(weekNumber: number, lift: Lift): IntensityType {
  // Weeks beyond the 3-block structure (week 10+) are deload
  if (getBlockNumber(weekNumber) > 3) return 'deload'
  const weekInBlock = getWeekInBlock(weekNumber)
  return CUBE_ROTATION[weekInBlock][lift]
}

export function calculateSessionDate(
  startDate: Date,
  weekNumber: number,
  dayIndex: number, // 0-based index within training days
  trainingDaysPerWeek: number,
): Date {
  const offsets = DAY_OFFSETS[trainingDaysPerWeek]
  if (!offsets) {
    throw new InvalidInputError(
      `Unsupported trainingDaysPerWeek: ${trainingDaysPerWeek}. Supported: 3, 4, 5.`,
    )
  }
  if (dayIndex < 0 || dayIndex >= offsets.length) {
    throw new InvalidInputError(
      `dayIndex ${dayIndex} out of range for ${trainingDaysPerWeek}-day program.`,
    )
  }
  const weekOffset = (weekNumber - 1) * 7
  const dayOffset = offsets[dayIndex]
  const result = new Date(startDate)
  result.setDate(result.getDate() + weekOffset + dayOffset)
  return result
}
