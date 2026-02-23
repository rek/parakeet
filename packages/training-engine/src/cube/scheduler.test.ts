import { InvalidInputError } from '../errors'
import {
  calculateSessionDate,
  getBlockNumber,
  getIntensityTypeForWeek,
  getWeekInBlock,
  isDeloadWeek,
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

describe('calculateSessionDate', () => {
  const monday = new Date('2026-01-05') // a Monday

  it('week 1 day 1 (3-day program) = start date', () => {
    const result = calculateSessionDate(monday, 1, 0, 3)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-05')
  })

  it('week 1 day 2 (3-day program) = start + 2 days', () => {
    const result = calculateSessionDate(monday, 1, 1, 3)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-07')
  })

  it('week 1 day 3 (3-day program) = start + 4 days', () => {
    const result = calculateSessionDate(monday, 1, 2, 3)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-09')
  })

  it('week 2 day 3 (3-day program) = start + 11 days', () => {
    const result = calculateSessionDate(monday, 2, 2, 3)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-16')
  })

  it('does not mutate the startDate', () => {
    const original = monday.toISOString()
    calculateSessionDate(monday, 3, 0, 3)
    expect(monday.toISOString()).toBe(original)
  })

  it('throws for unsupported trainingDaysPerWeek', () => {
    expect(() => calculateSessionDate(monday, 1, 0, 2)).toThrow(InvalidInputError)
  })

  it('throws for out-of-range dayIndex', () => {
    expect(() => calculateSessionDate(monday, 1, 3, 3)).toThrow(InvalidInputError)
  })
})
