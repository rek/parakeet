import { getMusclesForLift } from './muscle-mapper'
import {
  DEFAULT_MRV_MEV_CONFIG,
  classifyVolumeStatus,
  computeRemainingCapacity,
  computeWeeklyVolume,
} from './mrv-mev-calculator'

describe('computeWeeklyVolume', () => {
  it('3 squat sessions × 5 sets → quads: 15', () => {
    const logs = Array.from({ length: 3 }, () => ({ lift: 'squat' as const, completedSets: 5 }))
    const volume = computeWeeklyVolume(logs, getMusclesForLift)
    expect(volume.quads).toBe(15)
    expect(volume.glutes).toBe(15)
    expect(volume.hamstrings).toBe(7) // floor(15 × 0.5)
    expect(volume.lower_back).toBe(7)
  })

  it('1 bench session × 3 sets → chest: 3, triceps: 1 (floor of 1.5), shoulders: 1', () => {
    const logs = [{ lift: 'bench' as const, completedSets: 3 }]
    const volume = computeWeeklyVolume(logs, getMusclesForLift)
    expect(volume.chest).toBe(3)
    expect(volume.triceps).toBe(1) // floor(3 × 0.5) = 1
    expect(volume.shoulders).toBe(1)
  })

  it('initialises all muscle groups to 0 when no logs provided', () => {
    const volume = computeWeeklyVolume([], getMusclesForLift)
    expect(volume.quads).toBe(0)
    expect(volume.biceps).toBe(0)
  })

  it('accumulates across multiple sessions', () => {
    const logs = [
      { lift: 'squat' as const, completedSets: 4 },
      { lift: 'deadlift' as const, completedSets: 3 },
    ]
    const volume = computeWeeklyVolume(logs, getMusclesForLift)
    // glutes: squat 4×1.0 + deadlift 3×1.0 = 7
    expect(volume.glutes).toBe(7)
    // hamstrings: squat 4×0.5 + deadlift 3×1.0 = 2 + 3 = 5
    expect(volume.hamstrings).toBe(5)
  })
})

describe('classifyVolumeStatus', () => {
  it('12 quad sets (MEV=8, MRV=20) → in_range', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 12 }
    const status = classifyVolumeStatus(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(status.quads).toBe('in_range')
  })

  it('19 quad sets (MRV=20) → approaching_mrv', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 19 }
    const status = classifyVolumeStatus(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(status.quads).toBe('approaching_mrv')
  })

  it('18 quad sets (MRV=20) → approaching_mrv (within 2)', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 18 }
    const status = classifyVolumeStatus(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(status.quads).toBe('approaching_mrv')
  })

  it('20 quad sets (MRV=20) → at_mrv', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 20 }
    const status = classifyVolumeStatus(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(status.quads).toBe('at_mrv')
  })

  it('21 quad sets (MRV=20) → exceeded_mrv', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 21 }
    const status = classifyVolumeStatus(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(status.quads).toBe('exceeded_mrv')
  })

  it('4 quad sets (MEV=8) → below_mev', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 4 }
    const status = classifyVolumeStatus(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(status.quads).toBe('below_mev')
  })
})

describe('computeRemainingCapacity', () => {
  it('18 quad sets logged, MRV=20 → remaining: 2', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 18 }
    const remaining = computeRemainingCapacity(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(remaining.quads).toBe(2)
  })

  it('22 quad sets logged, MRV=20 → remaining: -2 (exceeded)', () => {
    const volume = { ...Object.fromEntries(Object.keys(DEFAULT_MRV_MEV_CONFIG).map((m) => [m, 0])), quads: 22 }
    const remaining = computeRemainingCapacity(volume as ReturnType<typeof computeWeeklyVolume>, DEFAULT_MRV_MEV_CONFIG)
    expect(remaining.quads).toBe(-2)
  })
})
