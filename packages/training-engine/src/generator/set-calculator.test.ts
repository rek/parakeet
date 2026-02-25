import { DEFAULT_FORMULA_CONFIG_MALE } from '../cube/blocks'
import { calculateSets, mergeFormulaConfig } from './set-calculator'

describe('calculateSets — heavy', () => {
  it('block 1 heavy, squat 1RM=140kg → 112.5kg × 2 sets × 5 reps', () => {
    const sets = calculateSets('squat', 'heavy', 1, 140, DEFAULT_FORMULA_CONFIG_MALE)
    expect(sets).toHaveLength(2)
    sets.forEach((s, i) => {
      expect(s.set_number).toBe(i + 1)
      expect(s.weight_kg).toBe(112.5) // 0.80 × 140 = 112 → 112.5
      expect(s.reps).toBe(5)
      expect(s.reps_range).toBeUndefined()
    })
  })

  it('block 3 heavy, deadlift 1RM=180kg → 162.5kg × 4 sets × 1-2 reps', () => {
    const sets = calculateSets('deadlift', 'heavy', 3, 180, DEFAULT_FORMULA_CONFIG_MALE)
    expect(sets).toHaveLength(4)
    sets.forEach((s) => {
      expect(s.weight_kg).toBe(162.5) // 0.90 × 180 = 162 → 162.5
      expect(s.reps).toBe(1)
      expect(s.reps_range).toEqual([1, 2])
    })
  })
})

describe('calculateSets — explosive', () => {
  it('block 1 explosive, bench 1RM=100kg → 65kg × 3 sets × 8 reps', () => {
    const sets = calculateSets('bench', 'explosive', 1, 100, DEFAULT_FORMULA_CONFIG_MALE)
    expect(sets).toHaveLength(3)
    sets.forEach((s) => {
      expect(s.weight_kg).toBe(65)
      expect(s.reps).toBe(8)
    })
  })
})

describe('calculateSets — rep', () => {
  it('block 2 rep, bench 1RM=100kg → 80kg, 2-3 sets, reps_range [4,8]', () => {
    const sets = calculateSets('bench', 'rep', 2, 100, DEFAULT_FORMULA_CONFIG_MALE)
    // midpoint of sets_min=2, sets_max=3 → Math.round(2.5) = 3
    expect(sets.length).toBeGreaterThanOrEqual(2)
    expect(sets.length).toBeLessThanOrEqual(3)
    sets.forEach((s) => {
      expect(s.weight_kg).toBe(80) // 0.80 × 100 = 80
      expect(s.reps_range).toEqual([4, 8])
    })
  })
})

describe('calculateSets — deload', () => {
  it('deload, squat 1RM=140kg → 56kg × 3 sets × 5 reps', () => {
    // 0.40 × 140 = 56.0, rounds to 55.0 (nearest 2.5) — 56/2.5 = 22.4 → round → 22 → 55
    const sets = calculateSets('squat', 'deload', 1, 140, DEFAULT_FORMULA_CONFIG_MALE)
    expect(sets).toHaveLength(3)
    sets.forEach((s) => {
      expect(s.weight_kg).toBe(55) // roundToNearest(56, 2.5) = 55
      expect(s.reps).toBe(5)
    })
  })
})

describe('mergeFormulaConfig', () => {
  it('user override of block1.heavy.pct=0.75, squat 140kg → 105kg', () => {
    const config = mergeFormulaConfig(DEFAULT_FORMULA_CONFIG_MALE, {
      block1: { heavy: { pct: 0.75 } },
    })
    const sets = calculateSets('squat', 'heavy', 1, 140, config)
    expect(sets[0].weight_kg).toBe(105) // 0.75 × 140 = 105
  })

  it('override only replaces specified fields; others retain system defaults', () => {
    const config = mergeFormulaConfig(DEFAULT_FORMULA_CONFIG_MALE, {
      block1: { heavy: { pct: 0.75 } },
    })
    // reps should remain at default (5)
    expect(config.block1.heavy.reps).toBe(5)
    // block2 should be completely unchanged
    expect(config.block2.heavy.pct).toBe(DEFAULT_FORMULA_CONFIG_MALE.block2.heavy.pct)
    // rounding_increment_kg unchanged
    expect(config.rounding_increment_kg).toBe(2.5)
  })

  it('empty overrides returns config equal to defaults', () => {
    const config = mergeFormulaConfig(DEFAULT_FORMULA_CONFIG_MALE, {})
    expect(config).toEqual(DEFAULT_FORMULA_CONFIG_MALE)
  })
})
