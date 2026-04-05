# sessions-008: Ad-Hoc Workouts

Enables users to start a standalone workout at any time, outside of any program.

## Two modes

1. **Free-form ad-hoc** (default): No primary lift or intensity type. User adds exercises as they go. For logging supplementary work (burpees, kettlebell swings, HIIT, etc.).
2. **Lift-specific ad-hoc** (legacy): Tied to squat/bench/deadlift + intensity type. Full JIT pipeline runs.

## DB changes

### Migration `20260314000000` (original)
- `sessions.program_id` nullable — marks ad-hoc sessions
- `sessions.block_number` nullable
- `sessions.week_number = 0` (sentinel; DB requires non-null)
- `sessions.day_number = 0` (sentinel)

### Migration `20260308000000` (free-form extension)
- `sessions.primary_lift` nullable — `CHECK (primary_lift IS NULL OR primary_lift = ANY(...))`
- `sessions.intensity_type` nullable — same pattern
- `sessions.activity_name TEXT` — optional label for free-form sessions

## Code

### `modules/session/data/session.repository.ts`
- `insertAdHocSession({ userId, lift?, intensityType?, activityName? })` — all fields optional. Free-form sets `primary_lift=null, intensity_type=null, activity_name=<name>`.

### `modules/session/application/session.service.ts`
- `createAdHocSession(userId, options?)` — options: `{ lift?, intensityType?, activityName? }`. Returns sessionId.
- `completeSession` — allows 0 `actualSets` when `auxiliarySets` exist (aux-only free-form sessions). Skips performance adjuster when no `primary_lift`.

### `modules/jit/lib/jit.ts`
- `runJITForSession` — early-returns empty JIT output when `session.primary_lift === null`.
- For lift-specific ad-hoc (`program_id=null` but `primary_lift` set): derives `blockNumber` from `intensityType` (heavy→1, explosive→2, rep→3), uses `DEFAULT_AUXILIARY_POOLS`, skips program-week volume.

### `app/(tabs)/session/adhoc.tsx`
- Activity name text input + "Start Workout" button.
- On start: creates session, transitions to `in_progress`, navigates to session screen with `freeForm=1` param (bypasses soreness/JIT).

### `app/(tabs)/session/[sessionId].tsx`
- Accepts `freeForm` search param: initializes with empty main sets, no warmup. User builds workout via "+ Add Exercise".
- Hides warmup and working sets sections when no main lift sets.
- Shows `activity_name` in header for free-form sessions.
- Complete button enabled when any set (main or auxiliary) is completed.

### `app/(tabs)/session/complete.tsx`
- Derived stats (total/completed/completion%) use auxiliary sets when no main lift sets exist.

### `components/training/WorkoutCard.tsx`
- Free-form: shows `activity_name` or "Ad-Hoc Workout" as title, "Add exercises as you go" instead of set count.
- Start/resume routes directly to session screen (skips soreness/JIT).

### `platform/store/sessionStore.ts`
- `sessionMeta.primary_lift` and `intensity_type` now `string | null`.
- `sessionMeta.activity_name` added (optional).

## Unchanged flows

- History tab: `fetchCompletedSessions` fetches all user sessions — both ad-hoc types appear automatically.
- Achievements, streaks, PR detection: operate on `session_logs` regardless of program.
- Volume tracking: free-form auxiliary exercises contribute to weekly volume via `getCurrentWeekLogs`.
- `completeSession`: no cycle-completion gate fires when `program_id` is null (existing guard).
