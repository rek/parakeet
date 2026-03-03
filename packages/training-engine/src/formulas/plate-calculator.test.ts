import { describe, it, expect } from 'vitest'
import { calculatePlates } from './plate-calculator'

describe('calculatePlates', () => {
  it('100kg with 20kg bar → 1×25 + 1×15 per side, remainder 0', () => {
    const result = calculatePlates(100, 20)
    expect(result.barKg).toBe(20)
    expect(result.totalKg).toBe(100)
    expect(result.remainder).toBe(0)
    expect(result.platesPerSide).toEqual([
      { kg: 25, count: 1 },
      { kg: 15, count: 1 },
    ])
  })

  it('20kg with 20kg bar → bar only, no plates, remainder 0', () => {
    const result = calculatePlates(20, 20)
    expect(result.platesPerSide).toEqual([])
    expect(result.remainder).toBe(0)
    expect(result.totalKg).toBe(20)
  })

  it('21kg with 20kg bar → remainder 0.5', () => {
    const result = calculatePlates(21, 20)
    expect(result.remainder).toBe(0.5)
  })

  it('60kg with 15kg bar (women) → 1×20 + 1×2.5 per side, remainder 0', () => {
    const result = calculatePlates(60, 15)
    expect(result.barKg).toBe(15)
    expect(result.totalKg).toBe(60)
    expect(result.remainder).toBe(0)
    // 22.5kg per side → 1×20 + 1×2.5
    expect(result.platesPerSide).toEqual([
      { kg: 20, count: 1 },
      { kg: 2.5, count: 1 },
    ])
  })

  it('140kg with 20kg bar → 2×25 + 1×20 per side, remainder 0', () => {
    const result = calculatePlates(140, 20)
    expect(result.remainder).toBe(0)
    // 60kg per side → 2×25 + 1×10
    expect(result.platesPerSide).toEqual([
      { kg: 25, count: 2 },
      { kg: 10, count: 1 },
    ])
  })

  it('bar-only check: targetKg equals barKg', () => {
    const result = calculatePlates(15, 15)
    expect(result.platesPerSide).toEqual([])
    expect(result.remainder).toBe(0)
  })
})
