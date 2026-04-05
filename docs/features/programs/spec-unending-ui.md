# Spec: Unending Program UI

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

UI changes for unending program mode: onboarding Program Style toggle, review screen handling, program tab unending branch, and global "Abandon" → "End Program" rename.

## Onboarding — Program Settings

**`apps/parakeet/src/app/(auth)/onboarding/program-settings.tsx`:**
- [x] `programMode` state (`'scheduled' | 'unending'`, default `'scheduled'`)
- [x] **Program Style** segmented toggle (above Duration picker): "Scheduled" | "Unending"
- [x] Duration picker hidden when `programMode === 'unending'`
- [x] `programMode` passed as route param to `review.tsx`

## Onboarding — Review Screen

**`apps/parakeet/src/app/(auth)/onboarding/review.tsx`:**
- [x] Reads `programMode` from local search params; `isUnending = programMode === 'unending'`
- [x] Header subtitle: `"Unending program · pick your N training days"` vs `"N-week program · ..."`
- [x] Week 1 preview replaced with first-session info card for unending: title `"Squat · Heavy · Block 1"`, note about JIT generation
- [x] `handleStart` passes `programMode: 'unending'` to `createProgram(...)` (no `totalWeeks`)

## Program Tab

**`apps/parakeet/src/app/(tabs)/program.tsx`:**

**Unending branch:**
- [x] Uses `useTodaySession()` hook for next-session card data
- [x] Header: `"My Program · Unending"` subtitle + `"Session N"` counter (from `unending_session_counter + 1`)
- [x] Single **next session card** showing: lift name (capitalized), intensity type badge, block badge
- [x] No week grid, no ScrollView for sessions
- [x] "End Program" button (red) — Alert title: `"End Program"`, message: `"This will archive your program and generate a cycle review."`, destructive confirm action
- [x] On confirm: `updateProgramStatus(id, 'archived', { triggerCycleReview: true, userId })`

**Next session preview (formula estimate):**
- [x] Three parallel queries (enabled only for unending): `getCurrentOneRmKg`, `getFormulaConfig`, `getRecentLiftHistory(lift, 1)`
- [x] Calls `calculateSets(lift, intensityType, blockNumber, oneRmKg, formulaConfig)` in a try/catch to produce estimated sets
- [x] Card shows: `~{weight}kg · {sets}×{reps} · RPE {target}` from first set; `reps_range` formatted as `min–max`
- [x] If last session RPE available: `"Last RPE: {rpe} — load may adjust down/up"` based on delta vs target RPE (≥1.0 above → down; ≥1.5 below → up)
- [x] Bottom note: `"Formula estimate · adjusted at session start"` (or fallback `"Sets generated when you start"` if estimate unavailable)

**Scheduled branch (unchanged except rename):**
- [x] "Abandon" button text → "End Program"
- [x] Alert title/button: "End Program" (same archive behavior, no cycle review change)
- [x] All existing week grid logic unchanged

## Auxiliary Exercises Settings

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**
- [x] `currentBlockNumber` call handles nullable `total_weeks`: for unending programs, derives block from `unending_session_counter` and `training_days_per_week`; for scheduled uses `total_weeks ?? 9`
