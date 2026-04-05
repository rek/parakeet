# mobile-037: Rest Timer — Auto-Dismiss, PostRestOverlay & Failed Reps Input

**Status: Implemented**

---

## Problem

The original "Done resting" button required phone interaction at the exact moment the user wanted to rush to the bar. Failed sets had no reps-captured UI, so actual reps hit were never logged.

---

## Behaviour

```
Set N complete
  → Rest timer opens (countdown)
  → RPE picker appears alongside timer — user rates effort for set N during rest
  → Timer expires (auto-dismiss ~1.5s after 0:00) OR user presses "Done resting"
  → Pending RPE is cleared (so PostRestOverlay and RPE picker never coexist)
  → PostRestOverlay appears:

      Set N+1 — 120kg × 5      ← context label (if data available)
      Go lift!
      [ Complete ]  [ Failed ]
      [ Reset 15s ]
      ~10s estimated lift time

  → User lifts set N+1, then presses Complete or Failed

  Complete path:
    → Set N+1 marked complete (planned weight + reps)
    → SetRow for N+1 syncs isCompleted=true → filled blue tick + green row
    → RPE picker queued for N+1
    → Rest timer starts for N+1 (unless last set)

  Failed path:
    → Overlay switches to reps-input mode:

        How many reps?
        [ − ]  3  [ + ]
        [ Confirm ]
          Back

    → User adjusts reps to what they actually hit (default = planned reps, min 0)
    → Confirm:
        → Set N+1 marked complete with actual reps + is_completed = true
        → rpe_actual = 10 auto-set (failed = max effort, no picker shown)
        → SetRow for N+1 syncs isCompleted=true → filled blue tick
        → Failure counter incremented
        → Remaining plan adapted (weight/rep reduction)
    → Back: returns to normal Complete/Failed overlay without side effects

  Reset 15s:
    → 15-second countdown shown on overlay
    → actual_rest_seconds incremented by 15 each press
```

---

## State Machine

```
idle
  ──[set N ticked]──▶  RESTING  (RestTimer countdown + RPE picker)
                           │
               ┌───────────┴──────────────┐
         [Done resting]              [hits 0:00 → auto-dismiss]
               └──────────┬───────────────┘
                           │  (pending RPE cleared)
                           ▼
                       LIFTING  (PostRestOverlay visible)
                           │
          ┌────────────────┼────────────────┐
     [Reset 15s]    [Complete]          [Failed]
          ▼               │                 ▼
     RESETTING             │          FAILED_REPS_INPUT
   (15s countdown)         │          (reps stepper)
          │                │            [Confirm] / [Back]
     [count ends]          │               │
          └────────────────▼───────────────┘
                          idle
```

---

## actual_rest_seconds Accuracy

`actual_rest_seconds` is written to the set when the timer closes (auto or early-dismiss). Each "Reset 15s" press increments the stored value by 15.

---

## Technical Design

### PostRestState (`modules/session/model/types.ts`)

```ts
interface PostRestState {
  pendingMainSetNumber: number | null   // set whose rest just ended
  pendingAuxExercise: string | null
  pendingAuxSetNumber: number | null
  actualRestSeconds: number
  liftStartedAt: number
  plannedReps: number          // next set's planned reps (0-indexed: plannedSets[pendingMain])
  plannedWeightKg: number | null  // next set's weight for context label
  nextSetNumber: number | null    // set the user is about to do
  resetSecondsRemaining: number | null
}
```

### handleTimerDone (`modules/session/hooks/useSetCompletionFlow.ts`)

- Clears `pendingRpeSetNumber` and `pendingAuxRpe` before creating `postRestState`
- Sets `plannedReps = plannedSets[pendingMain]?.reps` (0-indexed — next set, not prev)
- Sets `plannedWeightKg` and `nextSetNumber` for the context label

### handleLiftFailed(actualReps: number)

For main lifts:
- Marks `nextSetNumber` as complete with `reps_completed = actualReps, is_completed = true`
- Queues RPE for `nextSetNumber`
- Calls `recordSetFailure()` and `adaptRemainingPlan()`

### PostRestOverlay (`modules/session/ui/PostRestOverlay.tsx`)

Props:
```ts
interface PostRestOverlayProps {
  plannedReps: number
  plannedWeightKg?: number | null
  nextSetNumber?: number | null
  onLiftComplete: () => void
  onLiftFailed: (reps: number) => void
  onReset15s: () => void
  resetCountdown: number | null
}
```

Local state: `failedReps: number | null`
- `null` → normal mode (Go lift! + Complete/Failed/Reset)
- `number` → failed-reps-input mode (stepper + Confirm/Back)

---

## Files Modified

| File | Change |
|------|--------|
| `modules/session/model/types.ts` | Added `plannedWeightKg`, `nextSetNumber` to `PostRestState` |
| `modules/session/hooks/useSetCompletionFlow.ts` | `handleTimerDone` clears RPE, fixes plannedReps index, adds context fields; `handleLiftFailed(actualReps)` marks set done with `rpe_actual: 10` |
| `modules/session/ui/PostRestOverlay.tsx` | Added context label, `onLiftFailed(reps)` sig, failed-reps-input mode |
| `modules/session/ui/RestTimer.tsx` | `autoHideOnExpiry` prop (fires `onDone` ~1.5s after overtime) |
| `modules/session/ui/SetRow.tsx` | Added `isCompleted?` prop + one-way sync effect for store-driven completion |
| `app/(tabs)/session/[sessionId].tsx` | Passes `plannedWeightKg`, `nextSetNumber` to PostRestOverlay; passes `isCompleted` to SetRow |

---

## Edge Cases

| Scenario | Result |
|---|---|
| Timer expires while RPE still pending | RPE auto-cleared; PostRestOverlay appears cleanly |
| User presses "Done resting" early | handleTimerDone fires; RPE cleared; PostRestOverlay appears |
| Failed with 0 reps | − button disabled at 0; Confirm records 0 reps, marks set complete |
| "Back" from failed mode | Returns to normal overlay, no store writes, no failure recorded |
| Aux set failed | Logs rest only; no reps-input shown (aux failures don't trigger adaptation) |
| Last set failed | No rest timer starts after; RPE queued; "Complete Workout" available |
