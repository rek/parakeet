import { describe, expect, it } from 'vitest'
import { detectOvertimeEdge } from './overtimeEdge'

describe('detectOvertimeEdge', () => {
  it('returns false when still within rest (remaining > 0)', () => {
    expect(detectOvertimeEdge(false, 5)).toBe(false)
    expect(detectOvertimeEdge(false, 1)).toBe(false)
  })

  it('returns true when crossing into overtime (remaining === 0)', () => {
    expect(detectOvertimeEdge(false, 0)).toBe(true)
  })

  it('returns true when crossing into overtime (remaining < 0, e.g. missed the zero tick)', () => {
    expect(detectOvertimeEdge(false, -1)).toBe(true)
    expect(detectOvertimeEdge(false, -60)).toBe(true)
  })

  it('returns false when already overtime (no repeated trigger)', () => {
    expect(detectOvertimeEdge(true, 0)).toBe(false)
    expect(detectOvertimeEdge(true, -1)).toBe(false)
    expect(detectOvertimeEdge(true, -60)).toBe(false)
  })

  it('returns false when timer was already overtime and remaining stays negative', () => {
    // Simulate multiple ticks in overtime — only the first should fire
    expect(detectOvertimeEdge(true, -5)).toBe(false)
    expect(detectOvertimeEdge(true, -10)).toBe(false)
  })
})
