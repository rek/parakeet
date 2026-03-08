import { IntensityType, Lift } from '@parakeet/shared-types'
import { InvalidInputError } from '../errors'

// Cube Method rotation: index = weekInBlock - 1
const CUBE_ROTATION: Record<number, Record<Lift, IntensityType>> = {
  1: { squat: 'heavy', bench: 'rep', deadlift: 'explosive' },
  2: { squat: 'explosive', bench: 'heavy', deadlift: 'rep' },
  3: { squat: 'rep', bench: 'explosive', deadlift: 'heavy' },
}

// Default training weekdays per frequency (0=Sun, 1=Mon, ..., 6=Sat)
export const DEFAULT_TRAINING_DAYS: Record<number, number[]> = {
  3: [1, 3, 5],      // Mon, Wed, Fri
  4: [1, 2, 4, 6],   // Mon, Tue, Thu, Sat
  5: [1, 2, 3, 5, 6],
}

// Given selected weekday indices, return offsets from the earliest day
export function computeDayOffsets(selectedDays: number[]): number[] {
  const sorted = [...selectedDays].sort((a, b) => a - b)
  return sorted.map((d) => d - sorted[0])
}

// Next date that falls on a given weekday (0=Sun..6=Sat), always in the future
export function nextDateForWeekday(weekday: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const diff = (weekday - d.getDay() + 7) % 7
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff))
  return d
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

// Nearest date (today or future) that falls on one of the given training weekdays.
// Returns today if today is a training day, otherwise the next future training day.
export function nextTrainingDate(trainingDays: number[], referenceDate?: Date): string {
  const d = referenceDate ? new Date(referenceDate) : new Date()
  d.setHours(0, 0, 0, 0)
  const today = d.getDay()

  if (trainingDays.includes(today)) {
    return d.toISOString().split('T')[0]
  }

  const sorted = [...trainingDays].sort((a, b) => a - b)
  for (const day of sorted) {
    if (day > today) {
      d.setDate(d.getDate() + (day - today))
      return d.toISOString().split('T')[0]
    }
  }
  // Wrap to next week
  const daysUntilNext = 7 - today + sorted[0]
  d.setDate(d.getDate() + daysUntilNext)
  return d.toISOString().split('T')[0]
}

export function calculateSessionDate(
  startDate: Date,
  weekNumber: number,
  dayIndex: number, // 0-based index within training days
  dayOffsets: number[], // offsets in days from startDate for each training day
): Date {
  if (dayIndex < 0 || dayIndex >= dayOffsets.length) {
    throw new InvalidInputError(
      `dayIndex ${dayIndex} out of range for ${dayOffsets.length}-day program.`,
    )
  }
  const weekOffset = (weekNumber - 1) * 7
  const dayOffset = dayOffsets[dayIndex]
  const result = new Date(startDate)
  result.setDate(result.getDate() + weekOffset + dayOffset)
  return result
}
