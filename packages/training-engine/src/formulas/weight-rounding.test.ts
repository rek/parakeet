import { roundToNearest, gramsToKg, kgToGrams, estimateWorkingWeight } from './weight-rounding'

describe('roundToNearest', () => {
  it('rounds to 2.5 kg by default', () => {
    expect(roundToNearest(101)).toBe(100)
    expect(roundToNearest(103.75)).toBe(105)
  })

  it('rounds to custom increment', () => {
    expect(roundToNearest(101, 5)).toBe(100)
  })
})

describe('gramsToKg / kgToGrams', () => {
  it('converts grams to kg', () => {
    expect(gramsToKg(140000)).toBe(140)
  })

  it('converts kg to grams', () => {
    expect(kgToGrams(140)).toBe(140000)
  })
})

describe('estimateWorkingWeight', () => {
  it('defaults to 80% of 1RM, rounded to nearest 0.5 kg', () => {
    expect(estimateWorkingWeight(100)).toBe(80)
    expect(estimateWorkingWeight(137.5)).toBe(110)
    // 137.5 * 0.8 = 110.0 → 110
  })

  it('accepts custom working percentage', () => {
    expect(estimateWorkingWeight(100, 0.7)).toBe(70)
  })

  it('rounds to nearest 0.5 kg', () => {
    // 93 * 0.8 = 74.4 → round(74.4 * 2) / 2 = round(148.8) / 2 = 149/2 = 74.5
    expect(estimateWorkingWeight(93)).toBe(74.5)
  })
})
