import { MUSCLE_GROUPS, MrvMevConfig } from '../types'
import { computePredictedFatigue, detectMismatches } from './fatigue-predictor'

const CONFIG: MrvMevConfig = {
  quads:      { mev: 8,  mrv: 20 },
  hamstrings: { mev: 6,  mrv: 20 },
  glutes:     { mev: 0,  mrv: 16 },
  lower_back: { mev: 6,  mrv: 12 },
  upper_back: { mev: 10, mrv: 22 },
  chest:      { mev: 8,  mrv: 22 },
  triceps:    { mev: 6,  mrv: 20 },
  shoulders:  { mev: 8,  mrv: 20 },
  biceps:     { mev: 8,  mrv: 20 },
}

describe('computePredictedFatigue', () => {
  it('below MEV → predicted = 1', () => {
    const result = computePredictedFatigue({ quads: 2 }, CONFIG)
    expect(result.quads.predicted).toBe(1)
    expect(result.quads.status).toBe('below_mev')
  })

  it('in range → predicted = 2', () => {
    const result = computePredictedFatigue({ quads: 12 }, CONFIG)
    expect(result.quads.predicted).toBe(2)
    expect(result.quads.status).toBe('in_range')
  })

  it('approaching MRV (within 2) → predicted = 3', () => {
    // mrv=20, sets=19 → mrv - sets = 1 ≤ 2
    const result = computePredictedFatigue({ quads: 19 }, CONFIG)
    expect(result.quads.predicted).toBe(3)
  })

  it('at MRV → predicted = 4', () => {
    const result = computePredictedFatigue({ quads: 20 }, CONFIG)
    expect(result.quads.predicted).toBe(4)
  })

  it('exceeded MRV → predicted = 5', () => {
    const result = computePredictedFatigue({ quads: 22 }, CONFIG)
    expect(result.quads.predicted).toBe(5)
  })

  it('missing muscle defaults to 0 sets — quads (mev=8) → below_mev', () => {
    const result = computePredictedFatigue({}, CONFIG)
    expect(result.quads.predicted).toBe(1)
    expect(result.quads.status).toBe('below_mev')
  })

  it('glutes has mev=0, so 0 sets → in_range (predicted=2)', () => {
    const result = computePredictedFatigue({}, CONFIG)
    expect(result.glutes.predicted).toBe(2)
    expect(result.glutes.status).toBe('in_range')
  })

  it('volumePct reflects sets/mrv ratio', () => {
    const result = computePredictedFatigue({ quads: 10 }, CONFIG)
    expect(result.quads.volumePct).toBeCloseTo(0.5)
  })
})

describe('detectMismatches', () => {
  it('returns empty when all deltas < 2', () => {
    const predicted = computePredictedFatigue({ quads: 12 }, CONFIG) // predicted=2
    const mismatches = detectMismatches({ quads: 3 }, predicted) // delta=1
    expect(mismatches).toHaveLength(0)
  })

  it('flags mismatch when |felt - predicted| >= 2', () => {
    const predicted = computePredictedFatigue({ quads: 2 }, CONFIG) // predicted=1
    const mismatches = detectMismatches({ quads: 3 }, predicted) // delta=2
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].muscle).toBe('quads')
    expect(mismatches[0].direction).toBe('accumulating_fatigue')
    expect(mismatches[0].delta).toBe(2)
  })

  it('recovering_well when felt < predicted by >= 2', () => {
    const predicted = computePredictedFatigue({ quads: 20 }, CONFIG) // predicted=4
    const mismatches = detectMismatches({ quads: 1 }, predicted) // delta=3
    expect(mismatches[0].direction).toBe('recovering_well')
  })

  it('sorts by delta descending', () => {
    const predicted = computePredictedFatigue({ quads: 2, hamstrings: 2 }, CONFIG)
    // quads predicted=1, felt=4 → delta=3
    // hamstrings predicted=1, felt=3 → delta=2
    const mismatches = detectMismatches({ quads: 4, hamstrings: 3 }, predicted)
    expect(mismatches[0].muscle).toBe('quads')
    expect(mismatches[1].muscle).toBe('hamstrings')
  })
})
