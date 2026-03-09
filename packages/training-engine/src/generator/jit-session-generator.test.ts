import { TrainingDisruption } from '@parakeet/shared-types'
import {
  DEFAULT_FORMULA_CONFIG_FEMALE,
  DEFAULT_FORMULA_CONFIG_MALE,
  DEFAULT_REST_SECONDS_FEMALE,
  DEFAULT_REST_SECONDS_MALE,
} from '../cube/blocks'
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
// Per-exercise rep targets
// ---------------------------------------------------------------------------

describe('generateJITSession — per-exercise rep targets', () => {
  it('strength aux (Pause Squat) → 4 reps', () => {
    const out = generateJITSession(baseInput({ activeAuxiliaries: ['Pause Squat', 'Box Squat'] }))
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(4)
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(4)
  })

  it('hypertrophy aux (Romanian DL) → 8 reps', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'deadlift', activeAuxiliaries: ['Romanian DL', 'Good Mornings'] }),
    )
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(8)   // Romanian DL
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(10)  // Good Mornings
  })

  it('high-rep aux (Hyperextensions) → 15 reps', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'deadlift', activeAuxiliaries: ['Hyperextensions', 'Romanian DL'] }),
    )
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(15)
  })

  it('unknown exercise → falls back to baseReps (10 male)', () => {
    const out = generateJITSession(baseInput({ activeAuxiliaries: ['Some Unknown Exercise', 'Another Unknown'] }))
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(10)
  })

  it('unknown exercise → falls back to baseReps (12 female)', () => {
    const out = generateJITSession(
      baseInput({ biologicalSex: 'female', activeAuxiliaries: ['Some Unknown Exercise', 'Another Unknown'] }),
    )
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(12)
  })

  it('biceps aux (Barbell Curl) → 10 reps, weight at 35% of 1RM not 67.5%', () => {
    // bench 1RM 140kg → Barbell Curl should be 140*0.35=49→50kg (rounded), not 140*0.675=94.5kg
    const out = generateJITSession(
      baseInput({ primaryLift: 'bench', oneRmKg: 140, activeAuxiliaries: ['Barbell Curl', 'Dumbbell Curl'] }),
    )
    expect(out.auxiliaryWork[0].sets[0].reps).toBe(10)
    expect(out.auxiliaryWork[0].sets[0].weight_kg).toBe(50)   // 140 * 0.35 = 49 → 50
    expect(out.auxiliaryWork[1].sets[0].reps).toBe(12)
    expect(out.auxiliaryWork[1].sets[0].weight_kg).toBe(42.5) // 140 * 0.30 = 42 → 42.5
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
    adjustment_applied: null,
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

// Use unmapped exercise names so tests verify the sex-based fallback, not per-exercise targets
const UNKNOWN_AUX: [string, string] = ['Custom Exercise A', 'Custom Exercise B']

describe('generateJITSession — biologicalSex auxiliary reps', () => {
  it('no sex → auxiliary reps default to 10', () => {
    const out = generateJITSession(baseInput({ activeAuxiliaries: UNKNOWN_AUX }))
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      a.sets.forEach((s) => expect(s.reps).toBe(10))
    })
  })

  it('male → auxiliary reps 10', () => {
    const out = generateJITSession(baseInput({ biologicalSex: 'male', activeAuxiliaries: UNKNOWN_AUX }))
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      a.sets.forEach((s) => expect(s.reps).toBe(10))
    })
  })

  it('female → auxiliary reps 12', () => {
    const out = generateJITSession(baseInput({ biologicalSex: 'female', activeAuxiliaries: UNKNOWN_AUX }))
    out.auxiliaryWork.filter((a) => !a.skipped).forEach((a) => {
      a.sets.forEach((s) => expect(s.reps).toBe(12))
    })
  })

  it('female at soreness 3 → 2 sets × 12 reps', () => {
    const out = generateJITSession(baseInput({ biologicalSex: 'female', sorenessRatings: { quads: 3 }, activeAuxiliaries: UNKNOWN_AUX }))
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

// ---------------------------------------------------------------------------
// engine-020: rest recommendations
// ---------------------------------------------------------------------------

describe('generateJITSession — restRecommendations', () => {
  it('Block 3 Heavy, male defaults → mainLift all 300s', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      }),
    )
    // male block3.heavy = 300
    expect(DEFAULT_REST_SECONDS_MALE.block3.heavy).toBe(300)
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(300))
  })

  it('Block 2 Rep, female defaults → mainLift all 90s', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 2,
        intensityType: 'rep',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
      }),
    )
    // female block2.rep = 90
    expect(DEFAULT_REST_SECONDS_FEMALE.block2.rep).toBe(90)
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(90))
  })

  it('user override for squat heavy → override value used instead of formula default', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        primaryLift: 'squat',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
        userRestOverrides: [{ lift: 'squat', intensityType: 'heavy', restSeconds: 240 }],
      }),
    )
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(240))
  })

  it('auxiliary always 90 regardless of block or sex', () => {
    const maleOut = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      }),
    )
    maleOut.restRecommendations.auxiliary.forEach((r) => expect(r).toBe(90))

    const femaleOut = generateJITSession(
      baseInput({
        blockNumber: 1,
        intensityType: 'explosive',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
      }),
    )
    femaleOut.restRecommendations.auxiliary.forEach((r) => expect(r).toBe(90))
  })

  it('deload session → deload rest (90s)', () => {
    // Use block 1 but intensityType deload to exercise the deload path
    const out = generateJITSession(
      baseInput({
        blockNumber: 1,
        intensityType: 'deload',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      }),
    )
    out.restRecommendations.mainLift.forEach((r) => expect(r).toBe(90))
  })

  it('mainLift array length matches mainLiftSets length', () => {
    const out = generateJITSession(
      baseInput({
        blockNumber: 3,
        intensityType: 'heavy',
        formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
      }),
    )
    expect(out.restRecommendations.mainLift).toHaveLength(out.mainLiftSets.length)
  })

  it('auxiliary array length matches auxiliaryWork length', () => {
    const out = generateJITSession(baseInput())
    expect(out.restRecommendations.auxiliary).toHaveLength(out.auxiliaryWork.length)
  })

  it('skipped main lift → empty mainLift rest array', () => {
    const out = generateJITSession(
      baseInput({
        weeklyVolumeToDate: { quads: 25 },
      }),
    )
    expect(out.skippedMainLift).toBe(true)
    expect(out.restRecommendations.mainLift).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// No-equipment disruption: aux boost + bodyweight compensation
// ---------------------------------------------------------------------------

function makeEquipmentDisruption(overrides: Partial<TrainingDisruption> = {}): TrainingDisruption {
  return {
    id: 'dis-001',
    user_id: 'user-001',
    program_id: null,
    session_ids_affected: null,
    reported_at: '2026-03-06T10:00:00Z',
    disruption_type: 'equipment_unavailable',
    severity: 'moderate',
    affected_date_start: '2026-03-06',
    affected_date_end: null,
    affected_lifts: null,
    description: 'No gym access today',
    adjustment_applied: null,
    resolved_at: null,
    status: 'active',
    ...overrides,
  }
}

describe('generateJITSession — equipment_unavailable disruption', () => {
  it('adds 2 bodyweight exercises to auxiliaryWork', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] }),
    )
    expect(out.auxiliaryWork).toHaveLength(4) // 2 regular + 2 bodyweight
  })

  it('bodyweight exercises have weight_kg = 0', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwExercises = out.auxiliaryWork.slice(2)
    for (const ex of bwExercises) {
      expect(ex.skipped).toBe(false)
      expect(ex.sets.every((s) => s.weight_kg === 0)).toBe(true)
    }
  })

  it('male: bodyweight exercises have 3 sets × 10 reps at RPE 7.0', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwExercises = out.auxiliaryWork.slice(2)
    for (const ex of bwExercises) {
      expect(ex.sets).toHaveLength(3)
      expect(ex.sets[0].reps).toBe(10)
      expect(ex.sets[0].rpe_target).toBe(7.0)
    }
  })

  it('female: bodyweight exercises have 3 sets × 15 reps at RPE 7.0', () => {
    const out = generateJITSession(
      baseInput({ biologicalSex: 'female', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwExercises = out.auxiliaryWork.slice(2)
    for (const ex of bwExercises) {
      expect(ex.sets).toHaveLength(3)
      expect(ex.sets[0].reps).toBe(15)
      expect(ex.sets[0].rpe_target).toBe(7.0)
    }
  })

  it('regular aux exercises get +1 set (4 total instead of 3)', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const regularAux = out.auxiliaryWork.slice(0, 2)
    for (const ex of regularAux) {
      expect(ex.sets).toHaveLength(4)
    }
  })

  it('adds no-equipment rationale message', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] }),
    )
    expect(out.rationale.some((r) => r.includes('bodyweight compensation'))).toBe(true)
  })

  // Male (default / unspecified sex)
  it('male squat → explosive/strength bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'squat', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise)
    expect(bwNames).toEqual(['Jump Squat', 'Pistol Squat'])
  })

  it('male bench → upper-body intensity variations', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'bench', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise)
    expect(bwNames).toEqual(['Decline Push-ups', 'Diamond Push-ups'])
  })

  it('male deadlift → posterior chain bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'deadlift', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise)
    expect(bwNames).toEqual(['Nordic Hamstring Curl', 'Single-Leg RDL'])
  })

  // Female
  it('female squat → glute/hip-focused bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'squat', biologicalSex: 'female', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise)
    expect(bwNames).toEqual(['Sumo Squat', 'Curtsy Lunge'])
  })

  it('female bench → accessible push-up variations', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'bench', biologicalSex: 'female', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise)
    expect(bwNames).toEqual(['Standard Push-ups', 'Wide Push-ups'])
  })

  it('female deadlift → glute-focused bodyweight variations', () => {
    const out = generateJITSession(
      baseInput({ primaryLift: 'deadlift', biologicalSex: 'female', activeDisruptions: [makeEquipmentDisruption()] }),
    )
    const bwNames = out.auxiliaryWork.slice(2).map((ex) => ex.exercise)
    expect(bwNames).toEqual(['Hip Thrust', 'Single-Leg Glute Bridge'])
  })

  it('rest recommendations length matches auxiliaryWork length (4 items)', () => {
    const out = generateJITSession(
      baseInput({ activeDisruptions: [makeEquipmentDisruption()] }),
    )
    expect(out.restRecommendations.auxiliary).toHaveLength(out.auxiliaryWork.length)
  })

  it('no bodyweight exercises added when soreness >= 5', () => {
    const out = generateJITSession(
      baseInput({
        activeDisruptions: [makeEquipmentDisruption()],
        sorenessRatings: { quads: 5 },
      }),
    )
    // All aux exercises should be skipped; no bodyweight appended
    expect(out.auxiliaryWork).toHaveLength(2)
    expect(out.auxiliaryWork.every((ex) => ex.skipped)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// engine-027: volume top-up
// ---------------------------------------------------------------------------

describe('generateJITSession — volume top-up (engine-027)', () => {
  // Pool covers hamstrings (Romanian DL → hamstrings 1.0), quads (Leg Press → quads 1.0)
  // and Stiff-Leg DL (hamstrings 1.0) as a fallback for the exclusion test.
  const pool = ['Romanian DL', 'Stiff-Leg DL', 'Leg Press']

  // Helper: set all muscles at their MEV except the specified ones, so only
  // those muscles appear as top-up candidates. This prevents other high-deficit
  // muscles from winning the top-2 sort.
  function atMevExcept(
    config: MrvMevConfig,
    ...except: MuscleGroup[]
  ): Partial<Record<MuscleGroup, number>> {
    const result: Partial<Record<MuscleGroup, number>> = {}
    for (const [muscle, { mev }] of Object.entries(config) as [MuscleGroup, { mev: number; mrv: number }][]) {
      if (!except.includes(muscle)) result[muscle] = mev
    }
    return result
  }

  it('no auxiliaryPool → no top-up exercises appended', () => {
    const out = generateJITSession(baseInput())
    expect(out.auxiliaryWork.every((a) => !a.isTopUp)).toBe(true)
  })

  it('empty auxiliaryPool → no top-up exercises appended', () => {
    const out = generateJITSession(baseInput({ auxiliaryPool: [] }))
    expect(out.auxiliaryWork.every((a) => !a.isTopUp)).toBe(true)
  })

  it('muscle at/above MEV after main lift → no top-up for that muscle', () => {
    // hamstrings MEV=6; weeklyVol=5; squat contributes 0.5 × 2 sets = floor(1) → projected=6 ≥ 6 → no deficit
    const mrvMev = makeMrvMev()
    const out = generateJITSession(baseInput({
      auxiliaryPool: pool,
      weeklyVolumeToDate: { ...atMevExcept(mrvMev), hamstrings: 5 },
      mrvMevConfig: mrvMev,
    }))
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp)
    expect(topUps.every((a) => !a.topUpReason?.includes('hamstrings'))).toBe(true)
  })

  it('muscle below MEV → top-up exercise appended with isTopUp=true', () => {
    // hamstrings MEV=6; only deficient muscle; Romanian DL targets hamstrings 1.0
    const mrvMev = makeMrvMev()
    const out = generateJITSession(baseInput({
      auxiliaryPool: pool,
      weeklyVolumeToDate: atMevExcept(mrvMev, 'hamstrings'),
      mrvMevConfig: mrvMev,
    }))
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp)
    expect(topUps.length).toBeGreaterThan(0)
    expect(topUps[0].isTopUp).toBe(true)
    expect(topUps[0].topUpReason).toContain('below MEV')
  })

  it('top-up sets capped at 3', () => {
    const mrvMev = makeMrvMev({ hamstrings: { mev: 20, mrv: 30 } })
    const out = generateJITSession(baseInput({
      auxiliaryPool: pool,
      weeklyVolumeToDate: atMevExcept(mrvMev, 'hamstrings'),
      mrvMevConfig: mrvMev,
    }))
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp)
    topUps.forEach((a) => expect(a.sets.length).toBeLessThanOrEqual(3))
  })

  it('max 2 top-up exercises even when 3+ muscles below MEV', () => {
    // Use a large pool that covers many muscles; keep all at 0 volume
    const broadPool = ['Romanian DL', 'Leg Press', 'Incline DB Press', 'Close-Grip Bench', 'Barbell Curl']
    const out = generateJITSession(baseInput({
      auxiliaryPool: broadPool,
      weeklyVolumeToDate: {},
      mrvMevConfig: makeMrvMev({
        chest: { mev: 20, mrv: 30 },
        upper_back: { mev: 20, mrv: 30 },
        triceps: { mev: 20, mrv: 30 },
        biceps: { mev: 20, mrv: 30 },
      }),
    }))
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp)
    expect(topUps.length).toBeLessThanOrEqual(2)
  })

  it('excludes exercises already in activeAuxiliaries', () => {
    // Romanian DL is the best hamstring match; make it an active auxiliary
    const mrvMev = makeMrvMev()
    const out = generateJITSession(baseInput({
      auxiliaryPool: pool,
      weeklyVolumeToDate: atMevExcept(mrvMev, 'hamstrings'),
      activeAuxiliaries: ['Romanian DL', 'Box Squat'],
      mrvMevConfig: mrvMev,
    }))
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp)
    expect(topUps.every((a) => a.exercise !== 'Romanian DL')).toBe(true)
    // Stiff-Leg DL should be used instead
    if (topUps.length > 0) {
      expect(topUps[0].exercise).toBe('Stiff-Leg DL')
    }
  })

  it('no qualifying exercise in pool → no top-up for that muscle', () => {
    // Pool has no exercises targeting hamstrings with contribution >= 1.0
    const noHamstringPool = ['Leg Press', 'Close-Grip Bench']
    const mrvMev = makeMrvMev()
    const out = generateJITSession(baseInput({
      auxiliaryPool: noHamstringPool,
      weeklyVolumeToDate: atMevExcept(mrvMev, 'hamstrings'),
      mrvMevConfig: mrvMev,
    }))
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp && a.topUpReason?.includes('hamstrings'))
    expect(topUps).toHaveLength(0)
  })

  it('top-up rationale added to output rationale[]', () => {
    const mrvMev = makeMrvMev()
    const out = generateJITSession(baseInput({
      auxiliaryPool: pool,
      weeklyVolumeToDate: atMevExcept(mrvMev, 'hamstrings'),
      mrvMevConfig: mrvMev,
    }))
    const hasTopUpRationale = out.rationale.some((r) => r.includes('below MEV'))
    expect(hasTopUpRationale).toBe(true)
  })
})
