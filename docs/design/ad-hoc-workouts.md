# Ad-Hoc Workouts

**Status:** Implemented
**Spec:** `docs/specs/07-sessions/sessions-008-adhoc-workouts.md`

## Problem

Users want to train outside of their scheduled program — an extra squat day, a quick bench session, or just a workout when the program isn't dictating one. Currently all sessions must belong to a program; there is no way to log a workout without one.

## Goals

- Allow the user to start a workout at any time, for any lift, at any intensity, regardless of program state.
- Reuse the existing soreness → JIT → session logging flow with minimal new surface area.
- Ad-hoc workouts count toward weekly volume, streaks, and PR detection — they are full workouts.
- No cycle reviews or program completion gates apply to ad-hoc workouts.

## Non-goals

- No separate "ad-hoc program" or tracking concept.
- No block-rotation or auxiliary assignment rotation (no program state to rotate against).
- No scheduled/planned date other than today.

## Architecture

### DB

No new migration required. `sessions.program_id` is already nullable (migration `20260314000000_nullable_program_id_for_imports.sql`). `block_number` is already nullable.

Sentinel values for ad-hoc sessions:
- `program_id = null`
- `block_number = null`
- `week_number = 0` (DB requires non-null; 0 is the sentinel)
- `day_number = 0`
- `planned_date = today`
- `is_deload = false`
- `intensity_type`: user-selected (`heavy | explosive | rep`)

Ad-hoc sessions are distinguished from import sessions by `intensity_type != 'import'`.

### JIT

`runJITForSession` in `modules/jit/lib/jit.ts` is modified to handle `program_id = null`:
- `blockNumber`: derived from `intensityType` (heavy→1, explosive→2, rep→3)
- `activeAuxiliaries`: `DEFAULT_AUXILIARY_POOLS[lift]` (no block-based rotation)
- `weeklyVolumeToDate`: empty object (no program-week context; volume MRV logic still applies globally but no historical volume is pre-loaded)

### Session service

`createAdHocSession(userId, lift, intensityType)` creates the session row and returns the sessionId. This is the entry point for the ad-hoc flow.

### UI

New screen `app/(tabs)/session/adhoc.tsx`:
- Lift picker (squat | bench | deadlift)
- Intensity picker (heavy | explosive | rep)
- "Start" button → calls `createAdHocSession` → routes to `/session/soreness?sessionId=<id>`
- Soreness screen, JIT, and session logging screens are reused unchanged.

Today screen (`app/(tabs)/today.tsx`):
- "Ad-Hoc Workout" secondary button added below the program card section (when a program exists).

WorkoutCard:
- Displays "Ad-Hoc" as the block/week label when `program_id === null`.

## What doesn't change

- Soreness screen: reads `session.primary_lift` to show relevant muscles — works as-is.
- Session logging screen: works unchanged.
- `completeSession`: skips cycle completion gate when `program_id` is null — already the case.
- History tab: `fetchCompletedSessions` fetches all user sessions by `user_id` with no program filter — ad-hoc sessions appear automatically.
- Achievement detection, streaks, PR detection: all operate on session_logs regardless of program.
