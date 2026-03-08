# Spec: JIT Volume Augmentation

**Status**: Planned
**Domain**: Training Engine + UI

## What This Covers

After generating the regular session (main lift + prescribed aux), the JIT pipeline checks whether any muscle group is below MEV for the week. If so, it selects an exercise from the user's pool that targets that muscle and appends it as a "top-up" aux entry. This makes the program self-correcting when volume is being missed.

Depends on:
- **Muscle mappings** (Feature 1) — `getMusclesForExercise()` in `muscle-mapper.ts`
- **Exercise type system** (Bug 1) — only `weighted` and `bodyweight` exercises are top-up candidates; `timed` is excluded

## Tasks

### Engine

**`packages/training-engine/src/generator/jit-session-generator.ts`:**

- [ ] Add `auxiliaryPool?: string[]` to `JITInput` — the full merged pool across all lifts (caller supplies this; used only for top-up candidate selection)
- [ ] Add `isTopUp?: boolean` and `topUpReason?: string` to `AuxiliaryWork` interface
- [ ] Add Step 7 in the pipeline: "Volume Top-Up" — runs after `buildAuxiliaryWork`, before warmup

**New function `buildVolumeTopUp()`** in the same file (or extracted to `auxiliary/volume-top-up.ts` if it grows large):

```
Inputs:
  weeklyVolumeToDate  — current weekly sets per muscle (from JITInput)
  mrvMevConfig        — MEV/MRV caps per muscle
  mainLiftSetCount    — sets generated for the main lift (to account for their volume before checking MEV)
  alreadyAssigned     — exercise names already in the session (activeAuxiliaries) — don't re-add
  auxiliaryPool       — full candidate pool (JITInput.auxiliaryPool)
  oneRmKg             — for weight calculation (delegates to same AUX_WEIGHT_PCT logic)
  biologicalSex       — for rep targets and weight scaling

Algorithm:
  1. For each muscle where mev > 0:
       deficit = mev - (weeklyVolumeToDate[muscle] ?? 0) - (mainLiftSetsContribution for that muscle)
     Collect muscles where deficit > 0 (i.e. still below MEV even after today's planned volume)
  2. Sort by deficit descending (most deficient first)
  3. Cap at 2 muscles
  4. For each deficient muscle:
       a. Filter auxiliaryPool to exercises where:
            - getMusclesForExercise(ex) has contribution >= 1.0 for this muscle
            - getExerciseType(ex) !== 'timed'
            - ex not in alreadyAssigned
       b. If no candidates: skip (note in warnings)
       c. Pick first candidate (pool order = user-defined preference)
       d. Clamp set count to min(3, floor(remaining MRV capacity for that muscle))
       e. Generate sets using same AUX_WEIGHT_PCT / AUX_REP_TARGETS logic
       f. Return AuxiliaryWork with isTopUp: true, topUpReason: "<muscle> below MEV"

Returns: AuxiliaryWork[] (empty if no top-ups needed)
```

- [ ] Append top-up results to `auxiliaryWork` in the JIT pipeline output
- [ ] Add `topUpCount` to `JITOutput.warnings` or rationale when top-ups are added (e.g. `"Added Romanian DL — hamstrings below MEV"`)

**Tests** (`src/generator/jit-session-generator.test.ts`):
- [ ] No top-up when all muscles at or above MEV
- [ ] Top-up added when muscle is below MEV and candidate exists in pool
- [ ] Top-up skipped for `timed` exercises
- [ ] Top-up skipped when exercise already in `activeAuxiliaries`
- [ ] Capped at 2 top-up exercises per session even when 3+ muscles are deficient
- [ ] Set count clamped by remaining MRV capacity
- [ ] No top-up when `auxiliaryPool` is not provided (field is optional — graceful degradation)

### Caller (App Layer)

**`apps/parakeet/src/modules/session/application/jit.ts`** (or wherever JIT is assembled):
- [ ] When building `JITInput`, fetch the full user pool via `getAuxiliaryPools(userId)` and merge all three lift pools into `auxiliaryPool: [...squat, ...bench, ...deadlift]` (deduped)
  - This gives the widest selection of exercises across all muscle groups
  - Already fetched for `activeAuxiliaries` at program creation — should be accessible at JIT time

### UI

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**
- [ ] Update local `AuxiliaryWork` interface to include `isTopUp?: boolean` and `topUpReason?: string`
- [ ] In the aux exercise list render, group top-up items separately below regular aux
- [ ] Show a divider label above the first top-up item: "Volume top-up"
- [ ] Show `topUpReason` as a small subtitle below the exercise name (e.g. "hamstrings below MEV")
- [ ] Top-up exercises render with same `SetRow` behaviour as regular aux (same `exerciseType` logic applies)

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
- **Disable toggle**: not needed (2-user app); can add later if wanted

## Dependencies

- [data-002-auxiliary-exercise-config.md](../05-data/data-002-auxiliary-exercise-config.md) — muscle mapping + exercise type system (both implemented)
- Design: [jit-volume-augmentation.md](../../design/jit-volume-augmentation.md)
- Engine: `packages/training-engine/src/volume/muscle-mapper.ts` — `getMusclesForExercise()`
- Engine: `packages/training-engine/src/auxiliary/exercise-types.ts` — `getExerciseType()`
