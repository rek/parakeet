import { describe, it, expect } from 'vitest'
import { parseWeightInput } from './weight-input'

describe('parseWeightInput', () => {
  it('parses integer weights', () => {
    expect(parseWeightInput('20')).toBe(20)
    expect(parseWeightInput('100')).toBe(100)
  })

  it('parses decimal weights', () => {
    expect(parseWeightInput('20.5')).toBe(20.5)
    expect(parseWeightInput('67.5')).toBe(67.5)
    expect(parseWeightInput('2.25')).toBe(2.25)
  })

  it('parses trailing dot as integer (parseFloat behavior)', () => {
    // "20." mid-typing — parseFloat("20.") = 20, which is valid
    // The text state preserves "20." for display; the numeric value is 20
    expect(parseWeightInput('20.')).toBe(20)
  })

  it('returns 0 for empty string', () => {
    expect(parseWeightInput('')).toBe(0)
  })

  it('returns 0 for lone dot', () => {
    expect(parseWeightInput('.')).toBe(0)
  })

  it('returns 0 for non-numeric input', () => {
    expect(parseWeightInput('abc')).toBe(0)
    expect(parseWeightInput('--')).toBe(0)
  })

  it('returns 0 for negative values', () => {
    expect(parseWeightInput('-5')).toBe(0)
  })

  it('handles leading dot as decimal', () => {
    expect(parseWeightInput('.5')).toBe(0.5)
  })
})
