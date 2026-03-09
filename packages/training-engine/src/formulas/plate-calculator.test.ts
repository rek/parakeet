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

  describe('availablePlates', () => {
    it('skips 25kg when not available → uses 20+5 instead', () => {
      // 100kg, 20kg bar → 40kg per side; normally 1×25+1×15, without 25 → 2×20
      const result = calculatePlates(100, 20, [20, 15, 10, 5, 2.5, 1.25])
      expect(result.platesPerSide).toEqual([
        { kg: 20, count: 2 },
      ])
      expect(result.remainder).toBe(0)
    })

    it('reports remainder when plates cannot make exact weight', () => {
      // 90kg, 20kg bar → 35kg per side; without 15 → 1×20 + 1×10 + 1×5 = 35kg
      const result = calculatePlates(90, 20, [20, 10, 5, 2.5, 1.25])
      expect(result.platesPerSide).toEqual([
        { kg: 20, count: 1 },
        { kg: 10, count: 1 },
        { kg: 5, count: 1 },
      ])
      expect(result.remainder).toBe(0)
    })

    it('returns remainder when exact weight is impossible with available plates', () => {
      // 95kg, 20kg bar → 37.5kg per side; only 20+10+5+2.5 available → 20+10+5+2.5=37.5 ✓
      const result = calculatePlates(95, 20, [20, 10, 5, 2.5, 1.25])
      expect(result.remainder).toBe(0)
    })
  })
})
