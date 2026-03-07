# Spec: Unending Program Mode

**Status**: Implemented
**Domain**: Program Management

## What This Covers

A second program mode (`unending`) alongside the existing `scheduled` mode. No pre-planned schedule is generated. Only the next single session exists at any time; after it is completed, the next is lazily generated from history.

Also covers global rename of "Abandon" → "End Program" across all program types, and triggering a cycle review when an unending program is manually ended.

## DB Migration

**`supabase/migrations/20260307000000_add_unending_program_mode.sql`:**
- [x] `programs.program_mode TEXT NOT NULL DEFAULT 'scheduled'` — check constraint: `scheduled | unending`
- [x] `programs.unending_session_counter INTEGER NOT NULL DEFAULT 0`
- [x] `programs.total_weeks` — drop NOT NULL (nullable for unending programs)
- [x] `supabase/types.ts` updated to reflect new columns (hand-edited — see dev.md note)

## Training Engine

**`packages/training-engine/src/generator/program-generator.ts`:**
- [x] `nextUnendingSession(input: NextUnendingSessionInput): NextUnendingSessionResult`
  - `weekNumber = floor(sessionCounter / trainingDaysPerWeek) + 1`
  - `dayNumber = (sessionCounter % trainingDaysPerWeek) + 1`
  - `primaryLift` — cycles through LIFT_ORDER by `sessionCounter % daysPerWeek % 4`
  - `blockNumber = (floor((weekNumber - 1) / 3) % 3) + 1` — cycles 1→2→3→1… indefinitely
  - `isDeload = weekNumber % 4 === 0`
  - `intensityType` — delegates to `getIntensityTypeForWeek(weekNumber, lift)`; deload weeks override to `'deload'`
- [x] Exported from `packages/training-engine/src/modules/program-generation/index.ts`

**Types:**
```typescript
export type NextUnendingSessionInput = {
  sessionCounter: number
  trainingDaysPerWeek: number
}
export type NextUnendingSessionResult = {
  weekNumber: number
  dayNumber: number
  primaryLift: Lift
  intensityType: IntensityType
  blockNumber: 1 | 2 | 3
  isDeload: boolean
}
```

## Shared Types

**`packages/shared-types/src/program.schema.ts`:**
- [x] `ProgramSchema.program_mode: z.enum(['scheduled', 'unending']).default('scheduled')`
- [x] `ProgramSchema.total_weeks: z.number().int().positive().nullable()`
- [x] `ProgramSchema.unending_session_counter: z.number().int().min(0).default(0)`

## Program Module

**`apps/parakeet/src/shared/types/domain.ts`:**
- [x] `ProgramListItem` — added `program_mode` and `unending_session_counter` to the `Pick`

**`apps/parakeet/src/modules/program/data/program.repository.ts`:**
- [x] `updateUnendingSessionCounter(programId, newCount)` — increments the counter after each lazy-generated session
- [x] `fetchActiveProgramMode(userId)` — returns `{ id, program_mode, training_days_per_week, unending_session_counter }` (no sessions join)
- [x] `fetchProgramsList` — returns `program_mode` and `unending_session_counter` fields

**`apps/parakeet/src/modules/program/application/unending-session.ts`** (dedicated orchestration file):
- [x] `UnendingProgramRef` interface — `{ id, training_days_per_week, unending_session_counter }`
- [x] `appendNextUnendingSession(program, userId, plannedDate, options?)` — owns all unending session row building, insertion, and counter management; `options.skipCounterIncrement: true` for program-creation call site

**`apps/parakeet/src/modules/program/application/program.service.ts`:**
- [x] `CreateProgramInput.totalWeeks` — now optional
- [x] `CreateProgramInput.programMode?: 'scheduled' | 'unending'`
- [x] `buildProgram` — branches on `isUnending`:
  - Unending: inserts program row; calls `appendNextUnendingSession(..., { skipCounterIncrement: true })` for the first session; auxiliary assignments still generated (3 blocks)
  - Scheduled: existing flow unchanged
- [x] `updateProgramStatus(programId, status, options?)` — `options.triggerCycleReview` calls `onCycleComplete(programId, userId)` after archiving; used when ending an unending program
- [x] Re-exports `fetchActiveProgramMode` and `updateUnendingSessionCounter` from repository

## Session Module

**`apps/parakeet/src/modules/session/application/session.service.ts`:**
- [x] `findTodaySession(userId)` — for unending programs: fetches program mode first; if current session is `null` OR `completed`, checks for an existing planned session first (idempotency guard via `fetchPlannedSessionForProgram`); only generates if none exists
- [x] `generateNextUnendingSession(program: UnendingProgramRef, userId)` (private) — delegates to `appendNextUnendingSession` then fetches via `fetchPlannedSessionForProgram` (not `fetchTodaySession`, which returns the stale completed session)
- [x] `completeSession` — skips 80% `onCycleComplete` gate when `program_mode === 'unending'` (cycle review only triggered via "End Program")

**`apps/parakeet/src/modules/session/data/session.repository.ts`:**
- [x] `fetchOverdueScheduledSessions` — joins `programs!inner(program_mode)` and filters `.eq('programs.program_mode', 'scheduled')` so unending sessions (always dated today) are never marked missed
- [x] `fetchSessionCompletionContext` — joins `programs(program_mode)` to expose program mode to achievement detection
- [x] `fetchPlannedSessionForProgram(programId, userId)` — fetches the earliest planned session for a given program; used by `findTodaySession` to guard against duplicate generation on pull-to-refresh

**`apps/parakeet/src/shared/types/domain.ts`:**
- [x] `SessionCompletionContext.programMode: string | null` — added so achievement hooks can gate on program mode

**`apps/parakeet/src/modules/achievements/hooks/useAchievementDetection.ts`:**
- [x] `detectAchievements` — skips `checkCycleCompletion` when `programMode === 'unending'`; prevents spurious "Cycle complete!" badge after the first unending session

## Regression Guards

| Risk | Guard |
|---|---|
| Unending sessions marked missed | `fetchOverdueScheduledSessions` filters `program_mode = 'scheduled'` |
| Auto cycle review fires mid-unending | `completeSession` checks `program_mode` before 80% gate |
| "Cycle complete" badge fires on every unending session | `detectAchievements` checks `programMode !== 'unending'` before `checkCycleCompletion` |
| User blocked from training again same day (unending) | `findTodaySession` treats `completed` sessions as "no session" for unending programs |
| Pull-to-refresh generates duplicate sessions (unending) | `findTodaySession` checks `fetchPlannedSessionForProgram` before generating; `generateNextUnendingSession` returns planned session not completed one |
| `total_weeks` null breaks scheduled paths | All call sites use `?? 0` or `?? 9` fallback |
| Auxiliary exercises screen breaks | `currentBlockNumber` branches on `program_mode` to derive block from `unending_session_counter` |
| Cycle review compilation breaks | `total_weeks ?? 0` in `cycle-review.repository.ts` |
