import { InvalidInputError } from '../errors'
import {
  calculateSessionDate,
  computeDayOffsets,
  DEFAULT_TRAINING_DAYS,
  getBlockNumber,
  getIntensityTypeForWeek,
  getWeekInBlock,
  isDeloadWeek,
  nextDateForWeekday,
  nextTrainingDate,
} from './scheduler'

describe('getBlockNumber', () => {
  it.each([
    [1, 1], [2, 1], [3, 1],
    [4, 2], [5, 2], [6, 2],
    [7, 3], [8, 3], [9, 3],
  ])('week %i → block %i', (week, block) => {
    expect(getBlockNumber(week)).toBe(block)
  })
})

describe('getWeekInBlock', () => {
  it.each([
    [1, 1], [2, 2], [3, 3],
    [4, 1], [5, 2], [6, 3],
    [7, 1], [8, 2], [9, 3],
  ])('week %i → weekInBlock %i', (week, wib) => {
    expect(getWeekInBlock(week)).toBe(wib)
  })
})

describe('isDeloadWeek', () => {
  it('returns true when weekNumber === totalWeeks', () => {
    expect(isDeloadWeek(10, 10)).toBe(true)
  })

  it('returns false for non-final weeks', () => {
    expect(isDeloadWeek(9, 10)).toBe(false)
    expect(isDeloadWeek(1, 10)).toBe(false)
  })
})

describe('getIntensityTypeForWeek — all 9 week/lift combinations', () => {
  // Block 1 (weeks 1-3)
  it.each([
    [1, 'squat',    'heavy'],
    [1, 'bench',    'rep'],
    [1, 'deadlift', 'explosive'],
    [2, 'squat',    'explosive'],
    [2, 'bench',    'heavy'],
    [2, 'deadlift', 'rep'],
    [3, 'squat',    'rep'],
    [3, 'bench',    'explosive'],
    [3, 'deadlift', 'heavy'],
  ] as const)('week %i %s → %s', (week, lift, expected) => {
    expect(getIntensityTypeForWeek(week, lift)).toBe(expected)
  })

  // Block 2 repeats the same rotation (weeks 4-6)
  it.each([
    [4, 'squat',    'heavy'],
    [4, 'bench',    'rep'],
    [4, 'deadlift', 'explosive'],
    [6, 'squat',    'rep'],
    [6, 'bench',    'explosive'],
    [6, 'deadlift', 'heavy'],
  ] as const)('block 2: week %i %s → %s', (week, lift, expected) => {
    expect(getIntensityTypeForWeek(week, lift)).toBe(expected)
  })

  // Week 10 → deload for all lifts
  it.each(['squat', 'bench', 'deadlift'] as const)('week 10 %s → deload', (lift) => {
    expect(getIntensityTypeForWeek(10, lift)).toBe('deload')
  })
})

describe('DEFAULT_TRAINING_DAYS', () => {
  it('3-day defaults to Mon/Wed/Fri (1, 3, 5)', () => {
    expect(DEFAULT_TRAINING_DAYS[3]).toEqual([1, 3, 5])
  })

  it('4-day defaults to Mon/Tue/Thu/Sat (1, 2, 4, 6)', () => {
    expect(DEFAULT_TRAINING_DAYS[4]).toEqual([1, 2, 4, 6])
  })
})

describe('computeDayOffsets', () => {
  it('Mon/Wed/Fri → [0, 2, 4]', () => {
    expect(computeDayOffsets([1, 3, 5])).toEqual([0, 2, 4])
  })

  it('Mon/Tue/Thu/Sat → [0, 1, 3, 5]', () => {
    expect(computeDayOffsets([1, 2, 4, 6])).toEqual([0, 1, 3, 5])
  })

  it('sorts before computing offsets', () => {
    expect(computeDayOffsets([5, 1, 3])).toEqual([0, 2, 4])
  })
})

describe('nextDateForWeekday', () => {
  it('returns a date in the future (never today)', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result = nextDateForWeekday(today.getDay())
    expect(result.getTime()).toBeGreaterThan(today.getTime())
  })

  it('returns a date on the requested weekday', () => {
    // Monday = 1
    const result = nextDateForWeekday(1)
    expect(result.getDay()).toBe(1)
  })
})

describe('nextTrainingDate', () => {
  // Use new Date(y, m-1, d) for local-time construction (avoids UTC parse issues)
  it('returns today when today is a training day', () => {
    const wed = new Date(2026, 2, 11) // Wed Mar 11
    const result = nextTrainingDate([1, 3, 5], wed)
    expect(result).toBe(wed.toISOString().split('T')[0])
  })

  it('returns the next training day when today is not a training day', () => {
    const tue = new Date(2026, 2, 10) // Tue Mar 10
    const expected = new Date(2026, 2, 11) // Wed Mar 11
    expect(nextTrainingDate([1, 3, 5], tue)).toBe(expected.toISOString().split('T')[0])
  })

  it('wraps to next week when no remaining training days this week', () => {
    const sat = new Date(2026, 2, 14) // Sat Mar 14
    const expected = new Date(2026, 2, 16) // Mon Mar 16
    expect(nextTrainingDate([1, 3, 5], sat)).toBe(expected.toISOString().split('T')[0])
  })

  it('handles Sunday training day on Sunday', () => {
    const sun = new Date(2026, 2, 8) // Sun Mar 8
    const result = nextTrainingDate([0, 2, 4], sun)
    expect(result).toBe(sun.toISOString().split('T')[0])
  })

  it('handles unsorted training days input', () => {
    const tue = new Date(2026, 2, 10) // Tue Mar 10
    const expected = new Date(2026, 2, 11) // Wed Mar 11
    expect(nextTrainingDate([5, 1, 3], tue)).toBe(expected.toISOString().split('T')[0])
  })
})

describe('calculateSessionDate', () => {
  const monday = new Date('2026-01-05') // a Monday
  const monWedFriOffsets = [0, 2, 4]

  it('week 1 day 1 (3-day Mon/Wed/Fri) = start date', () => {
    const result = calculateSessionDate(monday, 1, 0, monWedFriOffsets)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-05')
  })

  it('week 1 day 2 (3-day Mon/Wed/Fri) = start + 2 days (Wed)', () => {
    const result = calculateSessionDate(monday, 1, 1, monWedFriOffsets)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-07')
  })

  it('week 1 day 3 (3-day Mon/Wed/Fri) = start + 4 days (Fri)', () => {
    const result = calculateSessionDate(monday, 1, 2, monWedFriOffsets)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-09')
  })

  it('week 2 day 3 (3-day Mon/Wed/Fri) = start + 11 days', () => {
    const result = calculateSessionDate(monday, 2, 2, monWedFriOffsets)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-16')
  })

  it('does not mutate the startDate', () => {
    const original = monday.toISOString()
    calculateSessionDate(monday, 3, 0, monWedFriOffsets)
    expect(monday.toISOString()).toBe(original)
  })

  it('throws for out-of-range dayIndex', () => {
    expect(() => calculateSessionDate(monday, 1, 3, monWedFriOffsets)).toThrow(InvalidInputError)
  })
})
