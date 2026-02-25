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

- [x] `generateJITSession(input: JITInput): JITOutput`

### Adjustment pipeline (applied in order)

- [x] **Step 1 — Base sets from formula**
  ```
  base = calculateSets(lift, intensityType, blockNumber, oneRmKg, formulaConfig)
  ```
- [x] **Step 2 — Performance adjustment (RPE history)**
  - If avg_rpe_deviation > 1.0 over last 2 sessions: `intensityMultiplier *= 0.975`
  - If avg_rpe_deviation < -1.0: `intensityMultiplier *= 1.025`
- [x] **Step 3 — Soreness adjustment**
  - If `sorenessModifier.recoveryMode`: replace base sets with recovery sets (40% × 3×5)
  - Otherwise: apply setReduction and intensityMultiplier from soreness modifier
- [x] **Step 4 — MRV check (primary muscles)**
  - Cap planned_sets to remaining MRV capacity per muscle
  - Set `skippedMainLift = true` if remaining <= 0
- [x] **Step 5 — Disruption override**
  - If any activeDisruptions affect this lift: apply disruption-adjuster reductions (takes full precedence over steps 2–4)
- [x] **Step 6 — Auxiliary work**
  - For each auxiliary exercise (2 total): base 3–4 sets × 8–12 reps at ~65–70% 1RM
  - Apply soreness check and MRV check per auxiliary muscle
- [x] **Step 7 — Final output assembly**
  - Apply intensityMultiplier to all weight_kg values → round to nearest 2.5kg
  - Compute volumeModifier and intensityModifier
- [x] **Step 8 — Warmup generation**
  - If mainLiftSets non-empty and not skippedMainLift: generate warmup from `mainLiftSets[0].weight_kg`

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

- [x] Squat 140kg, Block 1 Heavy, all soreness=1, no disruptions → `[{weight_kg: 112.5, reps: 5}, {weight_kg: 112.5, reps: 5}]`
- [x] Soreness=4 on quads → 0 planned sets clamped to 1 set at 107.5kg, warning added
- [x] 18 weekly quad sets (MRV=20) → main lift capped at 2 sets
- [x] 21 weekly quad sets (MRV=20) → `skippedMainLift: true`, warning added
- [x] 2 consecutive sessions RPE 9.5 (target 8.5) → weight reduced to 110kg (112.5 × 0.975 rounded)
- [x] Auxiliary: soreness=5 on chest during bench day → auxiliary Dips skipped
- [x] Disruption (knee injury) → overrides soreness adjustment with injury-specific reduction

## Dependencies

- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
- [engine-005-performance-adjuster.md](./engine-005-performance-adjuster.md)
- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [engine-008-auxiliary-exercise-rotation.md](./engine-008-auxiliary-exercise-rotation.md)
- [engine-009-soreness-adjuster.md](./engine-009-soreness-adjuster.md)
- [engine-010-warmup-calculator.md](./engine-010-warmup-calculator.md)
- [../01-infra/infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
