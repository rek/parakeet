# Spec: JIT Volume Augmentation

**Status**: Implemented
**Domain**: Training Engine + UI

## What This Covers

After generating the regular session (main lift + prescribed aux), the JIT pipeline checks whether any muscle group is below MEV for the week. If so, it selects an exercise from the user's pool that targets that muscle and appends it as a "top-up" aux entry. This makes the program self-correcting when volume is being missed.

Depends on:
- **Muscle mappings** (Feature 1) — `getMusclesForExercise()` in `muscle-mapper.ts`
- **Exercise type system** (Bug 1) — only `weighted` and `bodyweight` exercises are top-up candidates; `timed` is excluded

## Implementation

### Engine — `packages/training-engine/src/generator/jit-session-generator.ts`

- [x] Added `auxiliaryPool?: string[]`, `sessionIndex?: number`, `totalSessionsThisWeek?: number`, `allOneRmKg?: Partial<Record<Lift, number>>` to `JITInput`
- [x] Added `isTopUp?: boolean` and `topUpReason?: string` to `AuxiliaryWork` interface
- [x] Added Step 6b "Volume Top-Up" in the pipeline — runs after `buildAuxiliaryWork` (Step 6), before warmup (Step 8)
- [x] New function `buildVolumeTopUp()` in same file
- [x] Exercise scoring: `rankExercises()` replaces `qualifying[0]` — 7-factor weighted scorer in `exercise-scorer.ts`; `sorenessRatings`, `sleepQuality`, `energyLevel` threaded from `JITInput`; movement patterns tracked across iterations for diversity
- [x] Catalog metadata: `MovementPattern`, `Equipment`, `ComplexityTier`, `isCompound` on `ExerciseCatalogEntry`; auto-deriving resolvers (`resolveMovementPattern`, `resolveEquipment`, `resolveIsCompound`, `resolveComplexityTier`); 31 entries with explicit overrides

**`buildVolumeTopUp()` actual algorithm:**
1. Build main lift muscle contributions map (from `getMusclesForLift`)
2. For each muscle where `mev > 0`: `projected = weeklyVol + floor(mainLiftSetCount × contrib)`; pro-rate MEV by week progress: `effectiveMev = ceil(mev × sessionIndex / totalSessionsThisWeek)` (falls back to full `mev` when params are absent); `deficit = effectiveMev - projected`; collect where `deficit > 0`
3. Sort by deficit descending, take top 2
4. For each: filter `auxiliaryPool` for exercises where `getMusclesForExercise(ex)` has contribution ≥ 1.0 for that muscle, not `timed`, not already in `usedExercises` (starts from `activeAuxiliaries`, grows as top-ups are picked)
5. If no match: skip. Otherwise rank qualifying exercises via `rankExercises()` (exercise scorer) and pick highest-scored candidate. Scorer considers: muscle deficit coverage (0.30), soreness avoidance (0.25), movement pattern diversity (0.15), fatigue appropriateness (0.10), upcoming lift protection (0.10), main lift specificity (0.05), compound/isolation balance (0.05). Track selected movement patterns across iterations for diversity scoring.
6. `setCount = max(1, min(3, deficit, remainingMrv))`; weight uses `getLiftForExercise(exercise)` to look up the correct 1RM from `allOneRmKg` (falls back to primary lift `oneRmKg` when absent or exercise has no catalog lift); reps from `AUX_REP_TARGETS`
7. Append `AuxiliaryWork` with `isTopUp: true`, `topUpReason: "<muscle> below MEV"` (underscores replaced with spaces)
8. Per top-up: push `"Added <exercise>: <topUpReason>"` into `rationale[]`

Note: top-up skipped silently (no warning) when no candidate exists; rationale entry only added when a top-up is actually selected.

**Tests** — 22 tests in `src/generator/jit-session-generator.test.ts`:
- [x] No `auxiliaryPool` → no top-ups
- [x] Empty `auxiliaryPool` → no top-ups
- [x] Muscle at/above MEV after main lift → no top-up for it
- [x] Muscle below MEV → top-up appended with `isTopUp: true`
- [x] Sets capped at 3
- [x] Max 2 top-ups across the session
- [x] Excludes exercises already in `activeAuxiliaries`
- [x] No qualifying exercise in pool → no top-up for that muscle
- [x] Top-up rationale added to `rationale[]`
- [x] Session 1/3: moderate deficit does NOT trigger (pro-rated MEV is low)
- [x] Session 3/3: full MEV applies (same as no pro-rating)
- [x] Session 2/3: only severe deficit triggers
- [x] Missing sessionIndex/totalSessionsThisWeek falls back to full MEV
- [x] Cross-lift top-up uses correct 1RM (bench exercise during squat day uses bench 1RM, not squat 1RM)
- [x] Missing allOneRmKg falls back to primary lift 1RM

### Caller — `apps/parakeet/src/modules/jit/lib/jit.ts`

- [x] Fetch all 3 lift 1RMs in parallel (`getCurrentOneRmKg` for squat/bench/deadlift) and pass as `allOneRmKg`
- [x] Fetch all 3 pools in parallel via `getAuxiliaryPools(userId)` (added alongside existing `getAuxiliaryPool` call)
- [x] Merge: `[...allPools.squat, ...allPools.bench, ...allPools.deadlift]` (not deduped — duplicates are filtered by `usedExercises` in the engine)
- [x] `auxiliaryPool: []` for ad-hoc sessions (no program context)
- [x] Actual file path: `apps/parakeet/src/modules/jit/lib/jit.ts` (not `modules/session/application/jit.ts` as spec assumed)
- [x] `fetchWeekSessionCounts()` and `fetchProgramWeekInfo()` in `jit.repository.ts` — fetched in parallel with `weekLogs`
- [x] Scheduled: `sessionIndex = completed + 1`, `totalSessionsThisWeek = total sessions for week`
- [x] Unending: `totalSessionsThisWeek = training_days_per_week`, `sessionIndex = (counter % daysPerWeek) + 1`

### UI — `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`

- [x] Updated local `AuxiliaryWork` interface with `isTopUp?` and `topUpReason?`
- [x] `auxByExercise` mapped with `origIndex` to preserve rest-timer index across two render groups
- [x] Split into `regularAux` (non-top-up) and `topUpAux` (top-up)
- [x] "VOLUME TOP-UP" divider (uppercase, muted, letter-spaced) above first top-up item
- [x] `topUpReason` rendered as muted italic subtitle below exercise name
- [x] Same `SetRow` / `handleAuxSetUpdate` flow — `origIndex` used instead of `exerciseIndex` to keep rest timer indexing correct

**Visual spec for top-up section:**
```
─── Volume top-up ────────────────────────
Romanian Dumbbell Deadlift
hamstrings below MEV
  Set 1   [    ] kg  ×  [  ]  [RPE]  [✓]
  Set 2   ...
  Set 3   ...
```

## Open Questions (resolved for implementation)

- **Pool source**: full merged pool across all 3 lifts (widest selection)
- **Max top-ups**: 1 exercise per deficient muscle, max 2 muscles per session
- **Set count**: max 3, clamped by remaining MRV capacity
- **Disable toggle**: not needed for now; can add via feature flags later

## Dependencies

- [data-002-auxiliary-exercise-config.md](../05-data/data-002-auxiliary-exercise-config.md) — muscle mapping + exercise type system (both implemented)
- Design: [jit-volume-augmentation.md](../../design/jit-volume-augmentation.md)
- Engine: `packages/training-engine/src/volume/muscle-mapper.ts` — `getMusclesForExercise()`
- Engine: `packages/training-engine/src/auxiliary/exercise-types.ts` — `getExerciseType()`
