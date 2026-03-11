import { describe, expect, it } from 'vitest'
import { computeRpeAdjustmentNote } from './rpe-helpers'

describe('computeRpeAdjustmentNote', () => {
  it('returns empty string when rpeTarget is null', () => {
    expect(computeRpeAdjustmentNote(null, 8.5)).toBe('')
  })

  it('returns empty string when lastSessionRpe is null', () => {
    expect(computeRpeAdjustmentNote(8.0, null)).toBe('')
  })

  it('returns empty string when both are null', () => {
    expect(computeRpeAdjustmentNote(null, null)).toBe('')
  })

  it('returns adjust-down note when lastSessionRpe - rpeTarget is exactly 1.0 (boundary)', () => {
    expect(computeRpeAdjustmentNote(8.0, 9.0)).toBe(' — load may adjust down')
  })

  it('returns adjust-down note when lastSessionRpe exceeds rpeTarget by more than 1.0', () => {
    expect(computeRpeAdjustmentNote(8.0, 9.5)).toBe(' — load may adjust down')
  })

  it('returns adjust-up note when rpeTarget - lastSessionRpe is exactly 1.5 (boundary)', () => {
    expect(computeRpeAdjustmentNote(9.5, 8.0)).toBe(' — load may adjust up')
  })

  it('returns adjust-up note when rpeTarget exceeds lastSessionRpe by more than 1.5', () => {
    expect(computeRpeAdjustmentNote(10.0, 8.0)).toBe(' — load may adjust up')
  })

  it('returns empty string when difference is within range', () => {
    // target 8, actual 8.5: lastSessionRpe - rpeTarget = 0.5, below 1.0
    expect(computeRpeAdjustmentNote(8.0, 8.5)).toBe('')
  })

  it('returns empty string when rpeTarget - lastSessionRpe is 1.4 (just below adjust-up threshold)', () => {
    expect(computeRpeAdjustmentNote(9.4, 8.0)).toBe('')
  })
})
