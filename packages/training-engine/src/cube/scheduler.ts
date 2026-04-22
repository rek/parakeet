import { IntensityType, Lift } from '@parakeet/shared-types';

import { InvalidInputError } from '../errors';
import { localDateString } from '../utils/date';

// Cube Method rotation: index = weekInBlock - 1
const CUBE_ROTATION: Record<number, Record<Lift, IntensityType>> = {
  1: { squat: 'heavy', bench: 'rep', deadlift: 'explosive' },
  2: { squat: 'explosive', bench: 'heavy', deadlift: 'rep' },
  3: { squat: 'rep', bench: 'explosive', deadlift: 'heavy' },
};

export interface IntensityTypeSignals {
  primaryMuscleSoreness: number | null;
  daysSinceLastSession: number | null;
  recentRpe: number[];
  lastIntensityType: IntensityType | null;
}

const INTENSITY_ROTATION: IntensityType[] = ['heavy', 'explosive', 'rep'];

export function selectIntensityTypeForUnending(
  _lift: Lift,
  weekNumber: number,
  signals: IntensityTypeSignals
): IntensityType {
  const { primaryMuscleSoreness, daysSinceLastSession, recentRpe, lastIntensityType } = signals;

  if (weekNumber % 4 === 0) return 'deload';

  if (primaryMuscleSoreness !== null && primaryMuscleSoreness >= 7) return 'rep';

  if (daysSinceLastSession !== null && daysSinceLastSession >= 10) return 'heavy';

  const rpeValues = recentRpe.filter((r): r is number => r != null);
  if (rpeValues.length > 0) {
    const avg = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
    if (avg >= 8.5) return 'explosive';
  }

  if (lastIntensityType !== null && lastIntensityType !== 'deload') {
    const idx = INTENSITY_ROTATION.indexOf(lastIntensityType);
    if (idx !== -1) return INTENSITY_ROTATION[(idx + 1) % INTENSITY_ROTATION.length];
  }

  return 'heavy';
}

// Default training weekdays per frequency (0=Sun, 1=Mon, ..., 6=Sat)
export const DEFAULT_TRAINING_DAYS: Record<number, number[]> = {
  3: [1, 3, 5], // Mon, Wed, Fri
  4: [1, 2, 4, 6], // Mon, Tue, Thu, Sat
  5: [1, 2, 3, 5, 6],
};

// Given selected weekday indices, return offsets from the earliest day
export function computeDayOffsets(selectedDays: number[]): number[] {
  const sorted = [...selectedDays].sort((a, b) => a - b);
  return sorted.map((d) => d - sorted[0]);
}

// Next date that falls on a given weekday (0=Sun..6=Sat), today or future
export function nextDateForWeekday(weekday: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Count training weeks (exclude every 4th week which is a deload).
// Only valid for non-deload weeks — deload weeks are handled by generateDeloadWeek.
function trainingWeekIndex(weekNumber: number): number {
  return weekNumber - Math.floor(weekNumber / 4);
}

export function getBlockNumber(weekNumber: number): number {
  return Math.ceil(trainingWeekIndex(weekNumber) / 3);
}

export function getWeekInBlock(weekNumber: number): 1 | 2 | 3 {
  return (((trainingWeekIndex(weekNumber) - 1) % 3) + 1) as 1 | 2 | 3;
}

export function isDeloadWeek(weekNumber: number, totalWeeks: number): boolean {
  return weekNumber % 4 === 0 || weekNumber === totalWeeks;
}

export function getIntensityTypeForWeek(
  weekNumber: number,
  lift: Lift
): IntensityType {
  const weekInBlock = getWeekInBlock(weekNumber);
  return CUBE_ROTATION[weekInBlock][lift];
}

// Nearest date (today or future) that falls on one of the given training weekdays.
// Returns today if today is a training day, otherwise the next future training day.
export function nextTrainingDate(
  trainingDays: number[],
  referenceDate?: Date
): string {
  const d = referenceDate ? new Date(referenceDate) : new Date();
  d.setHours(0, 0, 0, 0);
  const today = d.getDay();

  if (trainingDays.includes(today)) {
    return localDateString(d);
  }

  const sorted = [...trainingDays].sort((a, b) => a - b);
  for (const day of sorted) {
    if (day > today) {
      d.setDate(d.getDate() + (day - today));
      return localDateString(d);
    }
  }
  // Wrap to next week
  const daysUntilNext = 7 - today + sorted[0];
  d.setDate(d.getDate() + daysUntilNext);
  return localDateString(d);
}

export function calculateSessionDate(
  startDate: Date,
  weekNumber: number,
  dayIndex: number, // 0-based index within training days
  dayOffsets: number[] // offsets in days from startDate for each training day
): Date {
  if (dayIndex < 0 || dayIndex >= dayOffsets.length) {
    throw new InvalidInputError(
      `dayIndex ${dayIndex} out of range for ${dayOffsets.length}-day program.`
    );
  }
  const weekOffset = (weekNumber - 1) * 7;
  const dayOffset = dayOffsets[dayIndex];
  const result = new Date(startDate);
  result.setDate(result.getDate() + weekOffset + dayOffset);
  return result;
}
