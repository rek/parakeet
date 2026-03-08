# sessions-008: Ad-Hoc Workouts

Enables users to start a standalone workout at any time, outside of any program.

## DB changes

No new migration. Reuses existing nullable columns:
- `sessions.program_id = null` — marks ad-hoc (vs. `intensity_type = 'import'` which marks CSV imports)
- `sessions.block_number = null`
- `sessions.week_number = 0` (sentinel; DB requires non-null)
- `sessions.day_number = 0` (sentinel)

## New code

### `modules/session/data/session.repository.ts`
- `insertAdHocSession({ userId, lift, intensityType })` — inserts a session row with `program_id=null`, sentinel week/day, `planned_date=today`, `status=planned`.

### `modules/session/application/session.service.ts`
- `createAdHocSession(userId, lift, intensityType): Promise<string>` — calls `insertAdHocSession`, returns sessionId. Exported via `modules/session/index.ts`.

### `modules/jit/lib/jit.ts`
Modified `runJITForSession` to handle `session.program_id === null`:
- Derives `blockNumber` from `intensityType`: heavy→1, explosive→2, rep→3.
- Uses `DEFAULT_AUXILIARY_POOLS[lift]` directly (no block-rotation assignment lookup).
- Skips program-week volume query; passes empty `weeklyVolumeToDate`.

### `app/(tabs)/session/adhoc.tsx`
New screen:
- Lift picker: squat / bench / deadlift
- Intensity picker: heavy / explosive / rep (with description)
- Start button: calls `createAdHocSession` then routes to `/session/soreness?sessionId=<id>`

### `app/(tabs)/today.tsx`
- Adds "+ Ad-Hoc Workout" button below the session cards when a program exists.

### `components/training/WorkoutCard.tsx`
- Shows "Ad-Hoc Workout" as the block/week label when `session.program_id === null`.

## Unchanged flows

- Soreness screen: reads `session.primary_lift` — works unchanged.
- Session logging screen: unchanged.
- `completeSession`: no cycle-completion gate fires when `program_id` is null (existing guard).
- History tab: `fetchCompletedSessions` fetches all user sessions — ad-hoc sessions appear automatically.
- Achievements, streaks, PR detection: all operate on `session_logs` regardless of program.
