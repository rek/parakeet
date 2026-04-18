# Spec: PR Detection & Achievement Engine

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Pure functions that evaluate session data and return earned personal records (stars), session streaks, and cycle completion status. Runs locally in the app after each session completion. Results are stored in Supabase.

## Tasks

### PR Detection

**File: `packages/training-engine/src/achievements/pr-detection.ts`**

```typescript
type PRType = 'estimated_1rm' | 'volume' | 'rep_at_weight'

interface PR {
  type: PRType
  lift: Lift
  value: number           // kg for 1rm, kg³ for volume, reps for rep_at_weight
  weightKg?: number       // only for rep_at_weight
  sessionId: string
  achievedAt: string      // ISO timestamp
}

interface PRCheckInput {
  sessionId: string
  lift: Lift
  completedSets: Array<{
    weightKg: number
    reps: number
    rpe?: number
    estimated1rmKg?: number   // pre-computed by engine-001 if RPE was logged
  }>
  historicalPRs: {
    best1rmKg: number
    bestVolumeKgCubed: number          // max single-session sets×reps×weight
    repPRs: Record<number, number>     // weightKg → best reps ever at that weight
  }
}
```

- [x] `detectSessionPRs(input: PRCheckInput): PR[]`
  - **Estimated 1RM PR**: if any set's `estimated1rmKg` > `historicalPRs.best1rmKg` → return PR. Only sets with RPE ≥ 8.5 and no active Major disruption are eligible (same gate as engine-001 high-confidence estimation).
  - **Volume PR**: compute `sum(weightKg × reps)` across all completed sets for this session. If > `historicalPRs.bestVolumeKgCubed` → return PR.
  - **Rep PR at Weight**: for each set, check if `reps > historicalPRs.repPRs[weightKg]`. Round weight to nearest 2.5kg before lookup. Return PR for each new rep-at-weight. Cap at 3 rep-at-weight PRs per session (suppress lower-significance ones if many are detected).
  - Sessions with an active **Major** disruption: skip all PR detection. Minor/Moderate disruptions: PRs count. "Active" uses the same definition as `disruptions-003`: `status != 'resolved'` AND (`affected_date_end` is null OR `affected_date_end >= today`). The caller (`useAchievementDetection.ts`) must pass `activeDisruptions` from `getActiveDisruptions()`.

**Unit tests (`packages/training-engine/src/achievements/pr-detection.test.ts`):**
- [x] New 1RM (RPE 9.0, 3×140kg) → 1rm PR returned
- [x] Existing 1RM better than new → no PR
- [x] RPE < 8.5 → no 1RM PR eligible
- [x] Volume PR: higher total than history → volume PR returned
- [x] Rep at weight: 6 reps at 120kg when prev best was 5 → rep PR returned
- [x] Multiple rep PRs same session → capped at 3
- [x] Major disruption active → empty result

---

### Streak Tracking

**File: `packages/training-engine/src/achievements/pr-detection.ts`**

```typescript
interface WeekStatus {
  weekStartDate: string      // ISO Monday
  scheduled: number
  completed: number
  skippedWithDisruption: number
  unaccountedMisses: number
}

interface StreakResult {
  currentStreak: number       // consecutive fully-completed program weeks
  longestStreak: number
  lastCleanWeekDate: string
}
```

- [x] `computeStreak(weekHistory: WeekStatus[]): StreakResult`
  - A week is **clean** iff all of: `scheduled > 0` AND `completed === scheduled` AND `skippedWithDisruption === 0` AND `unaccountedMisses === 0`. The streak rewards executing the plan — any miss (disruption or not) breaks it.
  - The **current in-progress week must be filtered out upstream** by the caller (`buildWeekStatuses`). `computeStreak` assumes every entry in `weekHistory` is a complete past week.
  - **Imported sessions** (`intensity_type = 'import'`) must be filtered out upstream (`fetchSessionsForStreak`) so they never contribute to week history.
  - Walk backwards through `weekHistory` from the most recent complete week.
  - `currentStreak` = count of consecutive clean weeks ending at the most recent complete week.
  - `longestStreak` = max run of consecutive clean weeks across all history.
  - A week with no scheduled sessions (deload, program gap) is skipped (neither breaks nor extends).

**Unit tests:**
- [x] 5 consecutive clean weeks → streak = 5
- [x] Miss in week 3, then 2 clean → streak = 2, longest = depends on history before week 3
- [x] Disruption-logged miss → **breaks** streak (strict rule)
- [x] Partial-completion week (completed < scheduled) → breaks streak
- [x] No-show (no log, no disruption) → breaks streak
- [x] Empty history → streak = 0
- [x] Current in-progress week is filtered by `buildWeekStatuses` (never emitted)
- [x] Imported sessions filtered by `fetchSessionsForStreak`

---

### Cycle Completion Detection

**File: `packages/training-engine/src/achievements/cycle-completion.ts`**

```typescript
interface CycleCompletionInput {
  totalScheduledSessions: number
  completedSessions: number
  skippedWithDisruption: number
}

interface CycleCompletionResult {
  isComplete: boolean
  completionPct: number
  qualifiesForBadge: boolean    // completionPct >= 0.80
}
```

- [x] `checkCycleCompletion(input: CycleCompletionInput): CycleCompletionResult`
  - `completionPct = (completedSessions + skippedWithDisruption) / totalScheduledSessions`
  - `qualifiesForBadge = completionPct >= 0.80`
  - Called from `onCycleComplete()` in `apps/parakeet/src/modules/program/application/program.service.ts` (already fires at ≥80% — this function provides the formal calculation)

**Unit tests:**
- [x] 16/20 sessions completed, 0 disruptions → 80% → qualifies
- [x] 15/20 → 75% → does not qualify
- [x] 18/20 + 2 disruption-skipped → 100% → qualifies
- [x] 0 sessions → completionPct = 0 → does not qualify

---

### Supabase Integration

Called from `apps/parakeet/src/modules/session/application/session.service.ts` → `completeSession()`:

```typescript
// After session completion, in completeSession():
const historicalPRs = await getPRHistory(userId, lift)
const earnedPRs = detectSessionPRs({ sessionId, lift, completedSets, historicalPRs })

if (earnedPRs.length > 0) {
  await supabase.from('personal_records').upsert(
    earnedPRs.map(pr => ({
      user_id: userId,
      lift: pr.lift,
      pr_type: pr.type,
      value: pr.value,
      weight_kg: pr.weightKg ?? null,
      session_id: pr.sessionId,
      achieved_at: pr.achievedAt,
    })),
    { onConflict: 'user_id,lift,pr_type,weight_kg' }  // upsert: replace only if new value > old
  )
}
```

**`personal_records` table (add to migration):**
```sql
CREATE TABLE personal_records (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  lift        lift_type NOT NULL,
  pr_type     text NOT NULL CHECK (pr_type IN ('estimated_1rm','volume','rep_at_weight')),
  value       numeric NOT NULL,
  weight_kg   numeric,          -- only for rep_at_weight
  session_id  uuid REFERENCES sessions(id),
  achieved_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pr_unique ON personal_records (user_id, lift, pr_type, COALESCE(weight_kg, -1));
```

**`getPRHistory(userId, lift)` in `apps/parakeet/src/modules/achievements/application/achievement.service.ts`:**
- Fetch all rows from `personal_records` for this user+lift
- Map into `historicalPRs` shape expected by `detectSessionPRs`

## Dependencies

- [engine-001-one-rep-max-formulas.md](./engine-001-one-rep-max-formulas.md) — estimated1rmKg pre-computation
- [sessions-003-session-completion-api.md](../session/spec-completion.md) — completeSession hook
- [mobile-019-achievements-screen.md](./spec-screen.md) — consumes PR results
