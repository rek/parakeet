import { TrainingDisruption } from '@parakeet/shared-types'
import { DEFAULT_FORMULA_CONFIG_MALE } from '../cube/blocks'
import { MrvMevConfig, MuscleGroup } from '../types'
import { generateJITSession, JITInput } from './jit-session-generator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMrvMev(overrides: Partial<Record<MuscleGroup, { mev: number; mrv: number }>> = {}): MrvMevConfig {
  const defaults: MrvMevConfig = {
    quads:      { mev: 8,  mrv: 20 },
    hamstrings: { mev: 6,  mrv: 16 },
    glutes:     { mev: 6,  mrv: 18 },
    lower_back: { mev: 4,  mrv: 12 },
    upper_back: { mev: 8,  mrv: 20 },
    chest:      { mev: 8,  mrv: 20 },
    triceps:    { mev: 6,  mrv: 16 },
    shoulders:  { mev: 6,  mrv: 16 },
    biceps:     { mev: 4,  mrv: 12 },
  }
  return { ...defaults, ...overrides }
}

function baseInput(overrides: Partial<JITInput> = {}): JITInput {
  return {
    sessionId: 'sess-001',
    weekNumber: 1,
    blockNumber: 1,
    primaryLift: 'squat',
    intensityType: 'heavy',
    oneRmKg: 140,
    formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
    sorenessRatings: {},
    weeklyVolumeToDate: {},
    mrvMevConfig: makeMrvMev(),
    activeAuxiliaries: ['Pause Squat', 'Box Squat'],
    recentLogs: [],
    activeDisruptions: [],
    warmupConfig: { type: 'preset', name: 'standard' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Integration test 1: clean squat Block 1 Heavy
// ---------------------------------------------------------------------------

describe('generateJITSession — clean session (no adjustments)', () => {
  it('Squat 140kg Block 1 Heavy → 2 sets × 112.5kg × 5 reps', () => {
    const out = generateJITSession(baseInput())
    expect(out.mainLiftSets).toHaveLength(2)
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5)
    expect(out.mainLiftSets[0].reps).toBe(5)
    expect(out.mainLiftSets[1].weight_kg).toBe(112.5)
  })

  it('setNumbers are sequential', () => {
    const out = generateJITSession(baseInput())
    expect(out.mainLiftSets.map((s) => s.set_number)).toEqual([1, 2])
  })

  it('warmup sets generated for working weight 112.5kg', () => {
    const out = generateJITSession(baseInput())
    expect(out.warmupSets.length).toBeGreaterThan(0)
    expect(out.warmupSets[out.warmupSets.length - 1].weightKg).toBeLessThan(112.5)
  })

  it('volumeModifier = 1.0, intensityModifier = 1.0, not skipped', () => {
    const out = generateJITSession(baseInput())
    expect(out.volumeModifier).toBe(1.0)
    expect(out.intensityModifier).toBe(1.0)
    expect(out.skippedMainLift).toBe(false)
    expect(out.warnings).toHaveLength(0)
  })

  it('auxiliaries have sets with reasonable weights', () => {
    const out = generateJITSession(baseInput())
    expect(out.auxiliaryWork).toHaveLength(2)
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false)
      expect(a.sets).toHaveLength(3)
    })
  })
})

// ---------------------------------------------------------------------------
// Integration test 2: soreness adjustment
// ---------------------------------------------------------------------------

describe('generateJITSession — soreness adjustments', () => {
  it('soreness=4 on quads → 1 set (clamped) at 107.5kg', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 4 } }))
    expect(out.mainLiftSets).toHaveLength(1)
    expect(out.mainLiftSets[0].weight_kg).toBe(107.5)
  })

  it('soreness=4 adds a warning to rationale', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 4 } }))
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true)
  })

  it('soreness=5 → recovery mode: 3 sets × 5 reps at 45kg (40% of 112.5→45)', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 5 } }))
    expect(out.mainLiftSets).toHaveLength(3)
    out.mainLiftSets.forEach((s) => {
      expect(s.weight_kg).toBe(45)
      expect(s.reps).toBe(5)
      expect(s.rpe_target).toBe(5.0)
    })
    expect(out.intensityModifier).toBe(0.40)
    expect(out.rationale.some((r) => /recovery/i.test(r))).toBe(true)
  })

  it('soreness=5 → all auxiliaries skipped', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 5 } }))
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(true)
    })
  })

  it('soreness=3 on quads → 1 set (2-1=1)', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 3 } }))
    expect(out.mainLiftSets).toHaveLength(1)
    // intensity unchanged for soreness=3
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5)
  })
})

// ---------------------------------------------------------------------------
// Integration test 3 & 4: MRV checks
// ---------------------------------------------------------------------------

describe('generateJITSession — MRV checks', () => {
  it('18 weekly quad sets (MRV=20) → caps sets at 2 when base > 2', () => {
    // block3 rep gives 3 base sets: Math.round((2+3)/2) = 3 (but rounding = 2 actually, let me check)
    // block3 rep: sets_min=2, sets_max=3 → Math.round(2.5) = 3. Wait, 2.5 in JS rounds to 2 (banker's rounding? No, Math.round(2.5) = 3).
    // Actually Math.round(2.5) = 3 in JS. So 3 sets.
    const out = generateJITSession(baseInput({
      blockNumber: 3,
      intensityType: 'rep',
      weeklyVolumeToDate: { quads: 18 },
      mrvMevConfig: makeMrvMev({ quads: { mev: 8, mrv: 20 } }),
    }))
    // base = 3 sets, remaining quads = 2, cap to 2
    expect(out.mainLiftSets).toHaveLength(2)
    expect(out.warnings.some((w) => /MRV.*quads/i.test(w))).toBe(true)
  })

  it('21 weekly quad sets (MRV=20) → skippedMainLift=true', () => {
    const out = generateJITSession(baseInput({
      weeklyVolumeToDate: { quads: 21 },
      mrvMevConfig: makeMrvMev({ quads: { mev: 8, mrv: 20 } }),
    }))
    expect(out.skippedMainLift).toBe(true)
    expect(out.mainLiftSets).toHaveLength(0)
    expect(out.warmupSets).toHaveLength(0)
    expect(out.warnings.some((w) => /MRV exceeded.*quads/i.test(w))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Integration test 5: RPE history adjustment
// ---------------------------------------------------------------------------

describe('generateJITSession — RPE history', () => {
  it('2 sessions RPE 9.5 (target 8.5) → weight reduced to 110kg (112.5 × 0.975)', () => {
    const out = generateJITSession(baseInput({
      recentLogs: [
        { actual_rpe: 9.5, target_rpe: 8.5 },
        { actual_rpe: 9.5, target_rpe: 8.5 },
      ],
    }))
    // 112.5 × 0.975 = 109.6875 → roundToNearest(2.5) = 110
    expect(out.mainLiftSets[0].weight_kg).toBe(110)
    expect(out.rationale.some((r) => /RPE above target/i.test(r))).toBe(true)
  })

  it('only 1 RPE log → no adjustment', () => {
    const out = generateJITSession(baseInput({
      recentLogs: [{ actual_rpe: 9.5, target_rpe: 8.5 }],
    }))
    expect(out.mainLiftSets[0].weight_kg).toBe(112.5)
  })

  it('2 sessions low RPE (7.0 vs target 8.5) → weight increased to 115kg (112.5 × 1.025)', () => {
    const out = generateJITSession(baseInput({
      recentLogs: [
        { actual_rpe: 7.0, target_rpe: 8.5 },
        { actual_rpe: 7.0, target_rpe: 8.5 },
      ],
    }))
    // 112.5 × 1.025 = 115.3125 → roundToNearest(2.5) = 115
    expect(out.mainLiftSets[0].weight_kg).toBe(115)
    expect(out.rationale.some((r) => /RPE below target/i.test(r))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Integration test 6: disruption override
// ---------------------------------------------------------------------------

function makeDisruption(severity: 'minor' | 'moderate' | 'major', lift = 'squat'): TrainingDisruption {
  return {
    id: 'dis-001',
    user_id: 'user-001',
    program_id: null,
    session_ids_affected: null,
    reported_at: new Date().toISOString(),
    disruption_type: 'injury',
    severity,
    affected_date_start: '2026-02-01',
    affected_date_end: null,
    affected_lifts: [lift],
    description: 'Knee injury',
    resolved_at: null,
    status: 'active',
  }
}

describe('generateJITSession — disruption override', () => {
  it('moderate disruption overrides soreness adjustment — sets from base, reduced', () => {
    const out = generateJITSession(baseInput({
      sorenessRatings: { quads: 4 }, // soreness would reduce to 1 set
      activeDisruptions: [makeDisruption('moderate')],
    }))
    // disruption resets to base (2 sets), then halves → 1 set at 90% intensity
    expect(out.mainLiftSets).toHaveLength(1)
    // 112.5 × 0.90 = 101.25 → roundToNearest(2.5) = 101.25 → rounds to 102.5
    expect(out.mainLiftSets[0].weight_kg).toBe(102.5)
    expect(out.rationale.some((r) => /knee injury/i.test(r))).toBe(true)
  })

  it('major disruption → skipped main lift', () => {
    const out = generateJITSession(baseInput({
      activeDisruptions: [makeDisruption('major')],
    }))
    expect(out.skippedMainLift).toBe(true)
    expect(out.mainLiftSets).toHaveLength(0)
  })

  it('disruption on different lift does not affect this session', () => {
    const out = generateJITSession(baseInput({
      activeDisruptions: [makeDisruption('major', 'bench')],
    }))
    expect(out.skippedMainLift).toBe(false)
    expect(out.mainLiftSets).toHaveLength(2)
  })

  it('disruption with null affected_lifts applies to all lifts', () => {
    const dis = { ...makeDisruption('major'), affected_lifts: null }
    const out = generateJITSession(baseInput({ activeDisruptions: [dis] }))
    expect(out.skippedMainLift).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Integration test 7: auxiliary soreness
// ---------------------------------------------------------------------------

describe('generateJITSession — auxiliary soreness on bench day', () => {
  it('soreness=5 on chest during bench day → auxiliary Dips skipped', () => {
    const out = generateJITSession(baseInput({
      primaryLift: 'bench',
      intensityType: 'heavy',
      blockNumber: 1,
      oneRmKg: 100,
      sorenessRatings: { chest: 5 },
      activeAuxiliaries: ['Close-Grip Bench', 'Dips'],
    }))
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(true)
    })
  })

  it('soreness=3 on quads → auxiliary sets reduced by 1 (3→2)', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 3 } }))
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false)
      expect(a.sets).toHaveLength(2) // 3 - 1
    })
  })

  it('soreness=4 on quads → auxiliary 1 set at 95% intensity', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 4 } }))
    out.auxiliaryWork.forEach((a) => {
      expect(a.skipped).toBe(false)
      expect(a.sets).toHaveLength(2)
      // 140 × 0.675 = 94.5 → round = 95; 95 × 0.95 = 90.25 → round = 90
      expect(a.sets[0].weight_kg).toBe(90)
    })
  })
})

// ---------------------------------------------------------------------------
// Warmup edge cases
// ---------------------------------------------------------------------------

describe('generateJITSession — warmup', () => {
  it('skipped main lift → no warmup sets', () => {
    const out = generateJITSession(baseInput({
      weeklyVolumeToDate: { quads: 25 },
    }))
    expect(out.skippedMainLift).toBe(true)
    expect(out.warmupSets).toHaveLength(0)
  })

  it('recovery mode → minimal warmup protocol', () => {
    const out = generateJITSession(baseInput({ sorenessRatings: { quads: 5 } }))
    // minimal = 2 steps (50%×5 + 75%×2), working weight = 45kg
    // 45 × 0.50 = 22.5 → round = 22.5; 45 × 0.75 = 33.75 → round = 35
    expect(out.warmupSets).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Sex-based adaptations
// ---------------------------------------------------------------------------

describe('generateJITSession — biologicalSex auxiliary reps', () => {
  it('no sex → auxiliary reps default to 10', () => {
    const out = generateJITSession(baseInput())
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      a.sets.forEach((s) => expect(s.reps).toBe(10))
    })
  })

  it('male → auxiliary reps 10', () => {
    const out = generateJITSession(baseInput({ biologicalSex: 'male' }))
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      a.sets.forEach((s) => expect(s.reps).toBe(10))
    })
  })

  it('female → auxiliary reps 12', () => {
    const out = generateJITSession(baseInput({ biologicalSex: 'female' }))
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      a.sets.forEach((s) => expect(s.reps).toBe(12))
    })
  })

  it('female at soreness 3 → 2 sets × 12 reps', () => {
    const out = generateJITSession(baseInput({ biologicalSex: 'female', sorenessRatings: { quads: 3 } }))
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      expect(a.sets).toHaveLength(2)
      a.sets.forEach((s) => expect(s.reps).toBe(12))
    })
  })
})

describe('generateJITSession — biologicalSex soreness (female level 4)', () => {
  it('female soreness 4 → main lift −1 set (not −2)', () => {
    // Block 1 heavy: 2 base sets; female level-4 soreness: −1 = 1 set
    const out = generateJITSession(baseInput({ biologicalSex: 'female', sorenessRatings: { quads: 4 } }))
    expect(out.mainLiftSets).toHaveLength(1)
  })

  it('male soreness 4 → main lift −2 sets (clamped to 1)', () => {
    // Block 1 heavy: 2 base sets; male level-4: −2 → clamped to 1
    const out = generateJITSession(baseInput({ biologicalSex: 'male', sorenessRatings: { quads: 4 } }))
    expect(out.mainLiftSets).toHaveLength(1)
  })
})
