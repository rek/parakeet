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

  // Recent performance history for same lift (last 6 sessions within 60 days)
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
  - If avg_rpe_deviation ≥ 0.75 over last 2 sessions: `intensityMultiplier *= 0.975` (small) or `*= 0.95` (large, ≥ 1.25)
  - If avg_rpe_deviation ≤ -0.75: `intensityMultiplier *= 1.025` (small) or `*= 1.05` (large, ≤ -1.25)
- [x] **Step 3 — Soreness adjustment**
  - If `input.intensityType === 'deload'`: skip this step entirely — deload sessions are already at recovery intensity and must not be further reduced by soreness
  - If `sorenessModifier.recoveryMode`: replace base sets with recovery sets (40% × 3×5)
  - Otherwise: apply setReduction and intensityMultiplier from soreness modifier
- [x] **Step 4 — MRV check (primary muscles)**
  - Cap planned_sets to remaining MRV capacity per muscle
  - Set `skippedMainLift = true` if remaining <= 0
- [x] **Step 5 — Disruption override**
  - If any activeDisruptions affect this lift: apply disruption-adjuster reductions (takes full precedence over steps 2–4)
  - **Deload interaction**: During deload weeks the base sets from Step 1 are already reduced (lower volume/intensity). Disruption reductions in Step 5 apply on top of those already-reduced values, so the effects compound conservatively. This is intentional — a disruption during a deload means even lighter work, which is the correct conservative response.
- [x] **Step 6 — Auxiliary work**
  - For each auxiliary exercise (2 total): base 3–4 sets at 67.5% 1RM (default), per-exercise rep target, RPE 7.5
  - Per-exercise weight %: `AUX_WEIGHT_PCT[exercise] ?? 0.675` — divergent exercises (Good Mornings, Bulgarian Split Squat, OHP, JM Press, curls) use lower percentages; see table in engine-019
  - Per-exercise rep target: `AUX_REP_TARGETS[exercise] ?? baseReps` — strength variations 4–6 reps; hypertrophy 8–12; isolation/high-rep 10–15
  - Apply soreness check and MRV check per auxiliary muscle
- [x] **Step 7 — Final output assembly**
  - Apply intensityMultiplier to all weight_kg values → round to the **effective plate increment** (GH#209). Default 2.5kg (smallest fractional plate × 2). When the lifter has disabled the 1.25kg plates the increment becomes 5kg; disabling 2.5s too makes it 10kg. The engine reads `JITInput.weightIncrementKg` (set by the app from `getDisabledPlates()` via `plateIncrementKg()`) and takes `max(formulaConfig.rounding_increment_kg, weightIncrementKg)` — the more restrictive wins. See `effectiveIncrementKg` in `formulas/weight-rounding.ts`.
  - Compute volumeModifier and intensityModifier
- [x] **Step 8 — Warmup generation**
  - If mainLiftSets non-empty and not skippedMainLift: resolve effective warmup protocol via `resolveEffectiveWarmupProtocol()` (respects recovery mode, weight < 40kg override, and explicit user config), then generate warmup from `mainLiftSets[0].weight_kg`

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

### Known issues (2026-05 review)

- [x] (landed) **`userAge` is plumbed into `JITInput` but never read.** `runJITForSession` derives age from `date_of_birth` and sets it on the input, but no engine consumer reads it. The LLM prompt template doesn't reference it either. Either wire age into soreness/readiness/recovery thresholds (the original intent per the inline comment "used by AI JIT generator for contextual advice"), or remove the field.
- [x] (landed) **`applyMrvCap` and `jit-constraints` use raw `getMusclesForLift` instead of `muscleMapper`.** The rest of the pipeline routes muscle contributions through `createMuscleMapper(input.customMuscleMap)`. The MRV cap step (engine/steps/applyMrvCap.ts:13) and the LLM hard-constraints enforcement (jit-constraints.ts:29) bypass the user's custom muscle map. Low blast radius today (custom map only affects aux), but is an inconsistency that will surface when custom mapping touches mains.
- [x] (landed) **`volumeModifier` denominator points at post-calibration `ctx.baseSets`.** Step 0 (`applyVolumeCalibration`) overwrites `ctx.baseSets` before the final assembly reads `mainLiftSets.length / ctx.baseSets.length`. When calibration added sets, the persisted `volumeModifier` underreports the true reduction; same issue at `auxVolumeRatio`. Either compute against the original `formulaConfig`-derived base, or rename to `volumeRatioVsCalibrated` and update telemetry consumers.
- [x] (landed) **LLM-strategy auxiliary work ignores soreness modifier reductions.** `llm-jit-generator.ts` (Step 6 in the LLM path) emits 3 sets (or 2 if `auxOverrides === 'reduce'`) modulated by the main lift's volume/intensity ratios. Soreness on aux muscles isn't consulted directly. Formula path's `processAuxExercise` uses `worstSoreness` per aux. Either run the engine's `processAuxExercise` over the LLM's aux output before returning, or require the LLM to honour per-aux soreness via the prompt + hard-constraints pass.
- [x] (landed) **Top-up MRV cap math doesn't account for overlapping muscle contributions in the same loop.** `applyVolumeTopUp` clamps each top-up exercise to `min(deficit, remainingMrv)` for its primary muscle, but exercises with contribution ≥1.0 to multiple muscles (e.g. incline DB press → chest, shoulders, triceps) can push a third muscle over MRV when stacked with another top-up that targets one of those secondaries. Add a unit test; consider recomputing `remainingMrv` after each iteration including same-loop additions.
- [x] (landed) **`generateWarmupSets` will crash if `warmupConfig` is null.** `resolveEffectiveWarmupProtocol` dereferences `opts.warmupConfig`. The app adapter sources it from `getWarmupConfig` which should always default — verify no path returns `null`. Defensive default to `{ type: 'preset', name: biologicalSex === 'female' ? 'standard_female' : 'standard' }` inside `resolveEffectiveWarmupProtocol`.
- [x] (landed) **`volume_calibration` runs on deload weeks; soreness/readiness/cycle-phase adjusters early-return.** `applyVolumeCalibration` only short-circuits the progressive-boost branch when `isDeload`; negative-direction signals (RPE > target, MRV cap) still fire. Combined with the deload baseline (~2 sets), a lifter who's been over-target this block lands on 1 set in a deload — recovery undershoots. Add the deload guard to the negative branch (or to the whole step).
- [ ] **JIT silently overwrites previously-applied disruption adjustments on soreness re-run.** Any second pass through `runJITForSession` calls `updateSessionJitOutput` and blindly overwrites `planned_sets`. If the user just accepted a disruption-applied weight cut and then redoes their soreness check-in (e.g., updates ratings after worse sleep), the disruption's hand-tuned planned sets are destroyed. Either gate the re-run with a confirm when `disruption.adjustment_applied` is set on this session, or compose the disruption's stored adjustment into the JIT input so re-runs reproduce it.
- [x] (landed) **`fetchUpcomingSessionLifts` returns missed/skipped sessions.** Filter is `neq('status','completed')`, so missed and skipped sessions count as "upcoming" in the JIT volume / scheduling context until reconciliation. Restrict to `status IN ('planned', 'in_progress')`.

### Integration tests

- [x] Squat 140kg, Block 1 Heavy, all soreness=1, no disruptions → `[{weight_kg: 112.5, reps: 5}, {weight_kg: 112.5, reps: 5}]`
- [x] Soreness=8 on quads → 0 planned sets clamped to 1 set at 107.5kg, warning added
- [x] 18 weekly quad sets (MRV=20) → main lift capped at 2 sets
- [x] 21 weekly quad sets (MRV=20) → `skippedMainLift: true`, warning added
- [x] 2 consecutive sessions RPE 9.5 (target 8.5) → weight reduced to 110kg (112.5 × 0.975 rounded)
- [x] Auxiliary: soreness=10 on chest during bench day → auxiliary Dips skipped
- [x] Disruption (knee injury) → overrides soreness adjustment with injury-specific reduction

## Dependencies

- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
- [engine-005-performance-adjuster.md](./engine-005-performance-adjuster.md)
- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [engine-008-auxiliary-exercise-rotation.md](./engine-008-auxiliary-exercise-rotation.md)
- [engine-009-soreness-adjuster.md](./engine-009-soreness-adjuster.md)
- [engine-010-warmup-calculator.md](./engine-010-warmup-calculator.md)
- [infra-002-supabase-setup.md](../infra/spec-supabase.md)
