import { InvalidInputError } from '../errors'
import { estimateOneRepMax, estimateOneRepMax_Brzycki, estimateOneRepMax_Epley } from './one-rep-max'
import { gramsToKg, kgToGrams, roundToNearest } from './weight-rounding'

describe('estimateOneRepMax_Epley', () => {
  it('calculates 1RM from a 3-rep set', () => {
    expect(estimateOneRepMax_Epley(130, 3)).toBeCloseTo(143, 1)
  })

  it('returns weight unchanged when reps === 1', () => {
    expect(estimateOneRepMax_Epley(100, 1)).toBe(100)
  })

  it('throws InvalidInputError for negative weight', () => {
    expect(() => estimateOneRepMax_Epley(-5, 3)).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for zero weight', () => {
    expect(() => estimateOneRepMax_Epley(0, 3)).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for zero reps', () => {
    expect(() => estimateOneRepMax_Epley(100, 0)).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for reps > 20', () => {
    expect(() => estimateOneRepMax_Epley(100, 21)).toThrow(InvalidInputError)
  })
})

describe('estimateOneRepMax_Brzycki', () => {
  it('calculates 1RM from a 5-rep set', () => {
    // 100 / (1.0278 - 0.0278*5) = 100 / 0.8888 ≈ 112.5
    expect(estimateOneRepMax_Brzycki(100, 5)).toBeCloseTo(112.5, 0)
  })

  it('returns weight unchanged when reps === 1', () => {
    expect(estimateOneRepMax_Brzycki(100, 1)).toBe(100)
  })

  it('throws InvalidInputError for invalid inputs', () => {
    expect(() => estimateOneRepMax_Brzycki(-5, 3)).toThrow(InvalidInputError)
  })
})

describe('estimateOneRepMax', () => {
  it('defaults to Epley formula', () => {
    expect(estimateOneRepMax(130, 3)).toBeCloseTo(estimateOneRepMax_Epley(130, 3), 5)
  })

  it('uses Brzycki when specified', () => {
    expect(estimateOneRepMax(100, 5, '1rm_brzycki')).toBeCloseTo(
      estimateOneRepMax_Brzycki(100, 5),
      5,
    )
  })
})

describe('roundToNearest', () => {
  it('rounds down to nearest 2.5kg', () => {
    expect(roundToNearest(113.3)).toBe(112.5)
  })

  it('rounds up to nearest 2.5kg', () => {
    expect(roundToNearest(114.0)).toBe(115.0)
  })

  it('leaves an already-rounded value unchanged', () => {
    expect(roundToNearest(100.0)).toBe(100.0)
  })

  it('supports a custom increment', () => {
    expect(roundToNearest(101, 5)).toBe(100)
    expect(roundToNearest(103, 5)).toBe(105)
  })
})

describe('gramsToKg', () => {
  it('converts grams to kg', () => {
    expect(gramsToKg(140000)).toBe(140.0)
  })
})

describe('kgToGrams', () => {
  it('converts kg to integer grams', () => {
    expect(kgToGrams(112.5)).toBe(112500)
  })

  it('rounds to nearest gram', () => {
    expect(kgToGrams(100.0001)).toBe(100000)
  })
})
