import { computeWilks2020 } from './wilks'

describe('computeWilks2020', () => {
  it('total <= 0 → 0', () => {
    expect(computeWilks2020(0, 75, 'male')).toBe(0)
    expect(computeWilks2020(-10, 75, 'female')).toBe(0)
  })

  it('female 60kg BW, 400kg total → ~535 (tolerance ±2)', () => {
    const score = computeWilks2020(400, 60, 'female')
    expect(score).toBeGreaterThan(533)
    expect(score).toBeLessThan(537)
  })

  it('male 83kg BW, 600kg total → ~481 (tolerance ±2)', () => {
    const score = computeWilks2020(600, 83, 'male')
    expect(score).toBeGreaterThan(479)
    expect(score).toBeLessThan(483)
  })

  it('lighter male lifter scores higher than heavier with same total', () => {
    const score70 = computeWilks2020(600, 70, 'male')
    const score90 = computeWilks2020(600, 90, 'male')
    expect(score70).toBeGreaterThan(score90)
  })

  it('bodyweight below 40kg is clamped to 40kg — result is non-zero', () => {
    const score = computeWilks2020(100, 25, 'male')
    expect(score).toBeGreaterThan(0)
  })

  it('bodyweight at exactly 40kg and below 40kg give the same result (clamping)', () => {
    expect(computeWilks2020(200, 40, 'male')).toBe(computeWilks2020(200, 30, 'male'))
  })

  it('result is rounded to 2 decimal places', () => {
    const score = computeWilks2020(300, 75, 'male')
    const decimals = (score.toString().split('.')[1] ?? '').length
    expect(decimals).toBeLessThanOrEqual(2)
  })
})
