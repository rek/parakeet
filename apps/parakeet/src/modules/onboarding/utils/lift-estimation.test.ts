import { describe, expect, it } from 'vitest'
import { computeEstimated1RM, isLiftValid } from './lift-estimation'

// Epley formula: weight * (1 + reps / 30)
// e.g. 100kg × 3 reps → 100 * 1.1 = 110.0

describe('computeEstimated1RM', () => {
  describe('type 1rm', () => {
    it('returns formatted weight string for a valid weight', () => {
      expect(computeEstimated1RM({ type: '1rm', weightKg: '100', reps: '' })).toBe('100.0 kg')
    })

    it('returns — when weight is 0', () => {
      expect(computeEstimated1RM({ type: '1rm', weightKg: '0', reps: '' })).toBe('—')
    })

    it('returns — when weightKg is an empty string', () => {
      expect(computeEstimated1RM({ type: '1rm', weightKg: '', reps: '' })).toBe('—')
    })

    it('returns — for a negative weight', () => {
      expect(computeEstimated1RM({ type: '1rm', weightKg: '-10', reps: '' })).toBe('—')
    })

    it('ignores the reps field for type 1rm', () => {
      expect(computeEstimated1RM({ type: '1rm', weightKg: '80', reps: '999' })).toBe('80.0 kg')
    })
  })

  describe('type 3rm', () => {
    it('returns estimated 1RM string for valid weight and reps', () => {
      // 100 * (1 + 3/30) = 110.0
      expect(computeEstimated1RM({ type: '3rm', weightKg: '100', reps: '3' })).toBe('110.0 kg')
    })

    it('returns — when reps is less than 2', () => {
      expect(computeEstimated1RM({ type: '3rm', weightKg: '100', reps: '1' })).toBe('—')
    })

    it('returns — when reps is greater than 10', () => {
      expect(computeEstimated1RM({ type: '3rm', weightKg: '100', reps: '11' })).toBe('—')
    })

    it('returns — when reps is an empty string', () => {
      expect(computeEstimated1RM({ type: '3rm', weightKg: '100', reps: '' })).toBe('—')
    })

    it('accepts boundary reps value of 2', () => {
      // 100 * (1 + 2/30) ≈ 106.667
      const result = computeEstimated1RM({ type: '3rm', weightKg: '100', reps: '2' })
      expect(result).toBe('106.7 kg')
    })

    it('accepts boundary reps value of 10', () => {
      // 100 * (1 + 10/30) ≈ 133.333
      const result = computeEstimated1RM({ type: '3rm', weightKg: '100', reps: '10' })
      expect(result).toBe('133.3 kg')
    })
  })
})

describe('isLiftValid', () => {
  describe('type 1rm', () => {
    it('returns true for a valid weight', () => {
      expect(isLiftValid({ type: '1rm', weightKg: '100', reps: '' })).toBe(true)
    })

    it('returns false when weight is 0', () => {
      expect(isLiftValid({ type: '1rm', weightKg: '0', reps: '' })).toBe(false)
    })

    it('returns false for a negative weight', () => {
      expect(isLiftValid({ type: '1rm', weightKg: '-5', reps: '' })).toBe(false)
    })

    it('ignores the reps field for type 1rm', () => {
      expect(isLiftValid({ type: '1rm', weightKg: '80', reps: '' })).toBe(true)
      expect(isLiftValid({ type: '1rm', weightKg: '80', reps: '999' })).toBe(true)
    })
  })

  describe('type 3rm', () => {
    it('returns true for valid weight and reps', () => {
      expect(isLiftValid({ type: '3rm', weightKg: '100', reps: '5' })).toBe(true)
    })

    it('returns false when reps is less than 2', () => {
      expect(isLiftValid({ type: '3rm', weightKg: '100', reps: '1' })).toBe(false)
    })

    it('returns false when reps is greater than 10', () => {
      expect(isLiftValid({ type: '3rm', weightKg: '100', reps: '11' })).toBe(false)
    })

    it('returns false when reps is an empty string', () => {
      expect(isLiftValid({ type: '3rm', weightKg: '100', reps: '' })).toBe(false)
    })

    it('accepts boundary reps value of 2', () => {
      expect(isLiftValid({ type: '3rm', weightKg: '100', reps: '2' })).toBe(true)
    })

    it('accepts boundary reps value of 10', () => {
      expect(isLiftValid({ type: '3rm', weightKg: '100', reps: '10' })).toBe(true)
    })
  })
})
