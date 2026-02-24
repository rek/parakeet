# Spec: JIT Session Generator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

The Just-In-Time session generator is the core orchestrator that runs when a user opens their session after completing the soreness check-in. It synthesizes all current user state into a concrete, ready-to-execute workout with specific weights, sets, and reps.

## Tasks

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

### Input type

```typescript
interface JITInput {
  // Session context (from sessions table)
  sessionId: string
  weekNumber: number
  blockNumber: 1 | 2 | 3
  primaryLift: Lift
  intensityType: IntensityType

  // User's current 1RM (most recent lifter_maxes row)
  oneRmKg: number

  // Formula config (merged system defaults + user overrides)
  formulaConfig: FormulaConfig

  // Pre-workout soreness (from soreness_checkins)
  sorenessRatings: Record<MuscleGroup, SorenessLevel>

  // Volume context (computed from this week's session_logs)
  weeklyVolumeToDate: Record<MuscleGroup, number>
  mrvMevConfig: MrvMevConfig

  // Auxiliary exercises active this block (from auxiliary_assignments)
  activeAuxiliaries: [string, string]

  // Recent performance history for same lift (last 3 sessions)
  recentLogs: RecentSessionSummary[]

  // Active disruptions
  activeDisruptions: TrainingDisruption[]

  // Warmup protocol for this lift (from warmup_configs, falls back to 'standard')
  warmupConfig: WarmupProtocol
}
```

### Output type

```typescript
interface JITOutput {
  sessionId: string
  generatedAt: Date
  mainLiftSets: PlannedSet[]
  warmupSets: WarmupSet[]     // generated from mainLiftSets[0].weight_kg after Step 7
  auxiliaryWork: AuxiliaryWork[]
  volumeModifier: number      // final volume scale applied (0.0–1.2)
  intensityModifier: number   // final intensity scale applied (0.85–1.05)
  rationale: string[]         // plain-language explanations of all adjustments
  warnings: string[]          // "Approaching MRV for quads", etc.
  skippedMainLift: boolean    // true if MRV exceeded and main lift was skipped
}

interface AuxiliaryWork {
  exercise: string
  sets: PlannedSet[]
  skipped: boolean
  skipReason?: string
}
```

### Main function

- `generateJITSession(input: JITInput): JITOutput`

### Adjustment pipeline (applied in order)

**Step 1 — Base sets from formula**
```
base = calculateSets(lift, intensityType, blockNumber, oneRmKg, formulaConfig)
```

**Step 2 — Performance adjustment (RPE history)**
```
If last 2 completed sessions for same lift:
  avg_rpe_deviation = mean(actual_rpe - target_rpe)
  If avg_rpe_deviation > 1.0:
    intensityMultiplier *= 0.975 (-2.5%)
    rationale.push("Recent RPE above target — reduced intensity 2.5%")
  If avg_rpe_deviation < -1.0:
    intensityMultiplier *= 1.025 (+2.5%)
    rationale.push("Recent RPE below target — increased intensity 2.5%")
```

**Step 3 — Soreness adjustment**
```
primaryMuscles = getPrimaryMusclesForSession(lift)
worstSoreness = getWorstSoreness(primaryMuscles, sorenessRatings)
sorenessModifier = getSorenessModifier(worstSoreness)

If sorenessModifier.recoveryMode:
  Replace base sets with recovery sets (40% × 3×5)
  rationale.push("Severe soreness — recovery session")
  Skip to Step 6 (auxiliaries still apply soreness check)
Else:
  Apply setReduction and intensityMultiplier from soreness modifier
```

**Step 4 — MRV check (primary muscles)**
```
For each primary muscle of this lift:
  remaining = mrv[muscle] - weeklyVolumeToDate[muscle]
  If remaining <= 0:
    skippedMainLift = true
    warnings.push("MRV exceeded for [muscle] — main lift skipped")
    Break
  If planned_sets > remaining:
    planned_sets = remaining  (capped)
    warnings.push("Approaching MRV for [muscle] — sets capped at [remaining]")
```

**Step 5 — Disruption override**
```
If any activeDisruptions affect this lift:
  Apply disruption-adjuster reductions (takes full precedence over steps 2–4)
  rationale.push(disruption.description)
```

**Step 6 — Auxiliary work**
```
For each auxiliary exercise (2 total):
  base = 3–4 sets × 8–12 reps at ~65–70% of related lift oneRmKg (RPE 7–8)
  Apply soreness check for same muscle group:
    If soreness 3: reduce 1 set
    If soreness 4: reduce 1 set + intensity 5%
    If soreness 5: skip exercise entirely
  Apply MRV check for auxiliary's primary muscle:
    If remaining capacity < 1 set: skip, add warning
```

**Step 7 — Final output assembly**
```
Apply intensityMultiplier to all weight_kg values → round to nearest 2.5kg
Compute volumeModifier = finalSets / baseSets
Compute intensityModifier = final intensityMultiplier
Assemble JITOutput
```

**Step 8 — Warmup generation**
```
If mainLiftSets is non-empty and not skippedMainLift:
  workingWeight = mainLiftSets[0].weight_kg
  warmupSets = generateWarmupSets(workingWeight, warmupConfig)
  // Special case: recovery mode (soreness 5) → force 'minimal' protocol
  // Special case: workingWeight < 40kg → force 'minimal' protocol
Else:
  warmupSets = []  // no warmup if main lift is skipped
```

### Supabase integration (called from app after soreness check-in)

```typescript
// apps/parakeet/lib/session.ts
async function generateAndSaveSession(sessionId: string): Promise<JITOutput> {
  const [session, oneRm, formulaConfig, soreness, weeklyVolume, mrvConfig,
         auxiliaries, recentLogs, disruptions] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).single(),
    supabase.from('lifter_maxes').select('*').eq('lift', lift).order('recorded_at', { ascending: false }).limit(1).single(),
    // ... fetch all inputs
  ])

  const output = generateJITSession(input)

  // Write planned_sets and mark jit_generated_at
  await supabase.from('sessions').update({
    planned_sets: output.mainLiftSets,
    jit_generated_at: output.generatedAt.toISOString(),
    jit_input_snapshot: input,       // JSONB snapshot for debugging
  }).eq('id', sessionId)

  return output
}
```

### Integration tests

- Squat 140kg, Block 1 Heavy, all soreness=1, no disruptions → `[{weight_kg: 112.5, reps: 5}, {weight_kg: 112.5, reps: 5}]`
- Soreness=4 on quads → 0 planned sets clamped to 1 set at 107.5kg, warning added
- 18 weekly quad sets (MRV=20) → main lift capped at 2 sets
- 21 weekly quad sets (MRV=20) → `skippedMainLift: true`, warning added
- 2 consecutive sessions RPE 9.5 (target 8.5) → weight reduced to 110kg (112.5 × 0.975 rounded)
- Auxiliary: soreness=5 on chest during bench day → auxiliary Dips skipped
- Disruption (knee injury) → overrides soreness adjustment with injury-specific reduction

## Dependencies

- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
- [engine-005-performance-adjuster.md](./engine-005-performance-adjuster.md)
- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [engine-008-auxiliary-exercise-rotation.md](./engine-008-auxiliary-exercise-rotation.md)
- [engine-009-soreness-adjuster.md](./engine-009-soreness-adjuster.md)
- [engine-010-warmup-calculator.md](./engine-010-warmup-calculator.md)
- [../01-infra/infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
