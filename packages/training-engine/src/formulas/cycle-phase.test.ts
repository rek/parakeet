import { computeCyclePhase } from './cycle-phase'

function daysAfter(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
}

describe('computeCyclePhase — 28-day cycle', () => {
  const start = new Date('2026-01-01')

  it('day 1 (same day as period start) → menstrual, dayOfCycle: 1', () => {
    const ctx = computeCyclePhase(start, 28, start)
    expect(ctx.phase).toBe('menstrual')
    expect(ctx.dayOfCycle).toBe(1)
  })

  it('day 5 → menstrual', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 4))
    expect(ctx.phase).toBe('menstrual')
    expect(ctx.dayOfCycle).toBe(5)
  })

  it('day 6 → follicular', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 5))
    expect(ctx.phase).toBe('follicular')
    expect(ctx.dayOfCycle).toBe(6)
  })

  it('day 12 → ovulatory, isOvulatoryWindow: true', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 11))
    expect(ctx.phase).toBe('ovulatory')
    expect(ctx.isOvulatoryWindow).toBe(true)
  })

  it('day 16 → ovulatory, isOvulatoryWindow: true', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 15))
    expect(ctx.phase).toBe('ovulatory')
    expect(ctx.isOvulatoryWindow).toBe(true)
  })

  it('day 17 → luteal, isOvulatoryWindow: false', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 16))
    expect(ctx.phase).toBe('luteal')
    expect(ctx.isOvulatoryWindow).toBe(false)
  })

  it('day 24 → late_luteal, isLateLuteal: true', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 23))
    expect(ctx.phase).toBe('late_luteal')
    expect(ctx.isLateLuteal).toBe(true)
  })

  it('day 29 wraps to day 1 of next cycle → menstrual', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 28))
    expect(ctx.phase).toBe('menstrual')
    expect(ctx.dayOfCycle).toBe(1)
  })

  it('daysUntilNextPeriod is cycleLength − dayOfCycle', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 6))
    expect(ctx.dayOfCycle).toBe(7)
    expect(ctx.daysUntilNextPeriod).toBe(21)
  })

  it('day 28 → daysUntilNextPeriod = 0', () => {
    const ctx = computeCyclePhase(start, 28, daysAfter(start, 27))
    expect(ctx.dayOfCycle).toBe(28)
    expect(ctx.daysUntilNextPeriod).toBe(0)
  })
})

describe('computeCyclePhase — non-28-day cycle', () => {
  const start = new Date('2026-01-01')

  it('35-day cycle, day 17 → scaled to ~14 → ovulatory', () => {
    // scaledDay = round(17 * 28 / 35) = round(13.6) = 14 → ovulatory
    const ctx = computeCyclePhase(start, 35, daysAfter(start, 16))
    expect(ctx.dayOfCycle).toBe(17)
    expect(ctx.phase).toBe('ovulatory')
    expect(ctx.isOvulatoryWindow).toBe(true)
  })

  it('35-day cycle, day 1 → menstrual', () => {
    const ctx = computeCyclePhase(start, 35, start)
    expect(ctx.phase).toBe('menstrual')
  })

  it('35-day cycle wraps correctly at day 36', () => {
    const ctx = computeCyclePhase(start, 35, daysAfter(start, 35))
    expect(ctx.dayOfCycle).toBe(1)
    expect(ctx.phase).toBe('menstrual')
  })
})

describe('computeCyclePhase — default referenceDate', () => {
  it('returns a valid CycleContext when referenceDate is omitted', () => {
    const start = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const ctx = computeCyclePhase(start)
    expect(ctx.dayOfCycle).toBe(11)
    expect(typeof ctx.daysUntilNextPeriod).toBe('number')
  })
})
