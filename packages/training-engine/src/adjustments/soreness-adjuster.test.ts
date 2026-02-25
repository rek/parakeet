import { PlannedSet } from '@parakeet/shared-types'
import {
  applySorenessToSets,
  getPrimaryMusclesForSession,
  getSorenessModifier,
  getWorstSoreness,
} from './soreness-adjuster'

function makeSets(count: number, weightKg: number, reps = 5): PlannedSet[] {
  return Array.from({ length: count }, (_, i) => ({
    set_number: i + 1,
    weight_kg: weightKg,
    reps,
    rpe_target: 8,
  }))
}

describe('getSorenessModifier — female sex', () => {
  it('level 4 female → reduce 1 set, 3% intensity drop', () => {
    const m = getSorenessModifier(4, 'female')
    expect(m.setReduction).toBe(1)
    expect(m.intensityMultiplier).toBe(0.97)
    expect(m.recoveryMode).toBe(false)
  })

  it('level 5 female → recovery mode (unchanged from male)', () => {
    expect(getSorenessModifier(5, 'female').recoveryMode).toBe(true)
  })

  it('level 3 female → reduce 1 set (unchanged from male)', () => {
    const m = getSorenessModifier(3, 'female')
    expect(m.setReduction).toBe(1)
    expect(m.intensityMultiplier).toBe(1.0)
  })

  it('no sex arg → male table', () => {
    expect(getSorenessModifier(4).setReduction).toBe(2)
    expect(getSorenessModifier(4).intensityMultiplier).toBe(0.95)
  })

  it('explicit male → male table', () => {
    expect(getSorenessModifier(4, 'male').setReduction).toBe(2)
    expect(getSorenessModifier(4, 'male').intensityMultiplier).toBe(0.95)
  })
})

describe('getSorenessModifier', () => {
  it('level 1 → no adjustment', () => {
    const m = getSorenessModifier(1)
    expect(m.setReduction).toBe(0)
    expect(m.intensityMultiplier).toBe(1.0)
    expect(m.recoveryMode).toBe(false)
    expect(m.warning).toBeNull()
  })

  it('level 2 → same as level 1', () => {
    const m = getSorenessModifier(2)
    expect(m.setReduction).toBe(0)
    expect(m.recoveryMode).toBe(false)
  })

  it('level 3 → reduce 1 set', () => {
    const m = getSorenessModifier(3)
    expect(m.setReduction).toBe(1)
    expect(m.intensityMultiplier).toBe(1.0)
    expect(m.warning).toMatch(/moderate/i)
  })

  it('level 4 → reduce 2 sets, 5% intensity drop', () => {
    const m = getSorenessModifier(4)
    expect(m.setReduction).toBe(2)
    expect(m.intensityMultiplier).toBe(0.95)
  })

  it('level 5 → recovery mode', () => {
    const m = getSorenessModifier(5)
    expect(m.recoveryMode).toBe(true)
    expect(m.warning).toMatch(/severe/i)
  })
})

describe('applySorenessToSets', () => {
  it('soreness 1 → sets unchanged', () => {
    const sets = makeSets(3, 100)
    const result = applySorenessToSets(sets, getSorenessModifier(1))
    expect(result).toHaveLength(3)
    expect(result[0].weight_kg).toBe(100)
  })

  it('soreness 3 → planned 2 sets returns 1 set', () => {
    const sets = makeSets(2, 100)
    const result = applySorenessToSets(sets, getSorenessModifier(3))
    expect(result).toHaveLength(1)
  })

  it('soreness 4 → 2 sets at 112.5kg → 1 set (clamped) at 107.5kg', () => {
    const sets = makeSets(2, 112.5)
    const result = applySorenessToSets(sets, getSorenessModifier(4))
    // 2 - 2 = 0, clamped to minSets=1
    expect(result).toHaveLength(1)
    // 112.5 × 0.95 = 106.875 → roundToNearest(106.875, 2.5) = 107.5
    expect(result[0].weight_kg).toBe(107.5)
  })

  it('soreness 5 → recovery mode: 3 sets × 5 reps at 40% of original weight', () => {
    const sets = makeSets(4, 112.5)
    const result = applySorenessToSets(sets, getSorenessModifier(5))
    expect(result).toHaveLength(3)
    // 112.5 × 0.40 = 45.0
    result.forEach((s) => {
      expect(s.weight_kg).toBe(45)
      expect(s.reps).toBe(5)
      expect(s.rpe_target).toBe(5.0)
    })
  })

  it('recovery mode with very light weight floors to 20kg bar', () => {
    const sets = makeSets(3, 30)
    const result = applySorenessToSets(sets, getSorenessModifier(5))
    // 30 × 0.40 = 12 → roundToNearest = 12.5 → max(20, 12.5) = 20
    expect(result[0].weight_kg).toBe(20)
  })

  it('respects custom minSets parameter', () => {
    const sets = makeSets(3, 100)
    const result = applySorenessToSets(sets, getSorenessModifier(4), 2)
    // 3 - 2 = 1, but minSets=2 → 2 sets
    expect(result).toHaveLength(2)
  })
})

describe('getPrimaryMusclesForSession', () => {
  it('squat → quads, glutes, lower_back', () => {
    expect(getPrimaryMusclesForSession('squat')).toEqual(['quads', 'glutes', 'lower_back'])
  })

  it('bench → chest, triceps, shoulders', () => {
    expect(getPrimaryMusclesForSession('bench')).toEqual(['chest', 'triceps', 'shoulders'])
  })

  it('deadlift → hamstrings, glutes, lower_back, upper_back', () => {
    expect(getPrimaryMusclesForSession('deadlift')).toEqual(['hamstrings', 'glutes', 'lower_back', 'upper_back'])
  })
})

describe('getWorstSoreness', () => {
  it('returns the max soreness across given muscles', () => {
    expect(getWorstSoreness(
      ['quads', 'glutes', 'lower_back'],
      { quads: 2, glutes: 4, lower_back: 1 },
    )).toBe(4)
  })

  it('defaults to 1 for muscles missing from ratings', () => {
    expect(getWorstSoreness(['quads', 'glutes'], { quads: 2 })).toBe(2)
  })

  it('returns 1 when all muscles are fresh', () => {
    expect(getWorstSoreness(['chest', 'triceps'], { chest: 1, triceps: 1 })).toBe(1)
  })
})
