# mobile-037: Rest Timer — Auto-Hide, Prepare Warning & Lift Tracking

## Problem

The "Done resting" button requires phone interaction at the exact moment the user wants to rush to the bar. Rest time accuracy is also poor: pressing early under-counts rest, pressing late over-counts by including lift setup time.

---

## New Behaviour Overview

```
Set N complete
  → Rest timer opens (countdown from e.g. 3:00)
  → At 0:15 remaining → warning sound + haptic ("prepare")
  → At 0:00 → "done" sound plays → timer auto-hides after ~1.5s
  → PostRestOverlay appears with two buttons:
       [ Lift complete ]   [ Reset 15s ]
  → User lifts set N+1
  → User returns, presses "Lift complete"
       → actual_lift_seconds = time since overlay appeared
       → estimated_lift_seconds = 2 × planned_reps (informational)
       → overlay hides → user logs set N+1 normally
       → next rest timer opens
```

**Early dismiss** (user finishes resting before 0:00): "Done resting" button still works. Pressing it skips straight to PostRestOverlay.

**"Reset 15s"**: User wasn't ready when overlay appeared. Pressing it starts a 15-second countdown shown on the overlay. When it finishes (or they press "Lift complete"), normal flow resumes. Each press adds 15 seconds to `actual_rest_seconds`.

---

## State Machine

```
idle
  ──[set complete]──▶  RESTING  (RestTimer countdown visible)
                           │
               ┌───────────┴──────────────┐
         [Done resting]              [hits 0:00 → auto-hide]
               └──────────┬───────────────┘
                           ▼
                       LIFTING  (PostRestOverlay visible)
                           │
               ┌───────────┴──────────────┐
         [Reset 15s]                [Lift complete]
               ▼                          │
           RESETTING                      │
        (15s countdown)                   │
               │                          │
         [count ends]                     │
               └──────────────────────────▶ idle
```

---

## actual_rest_seconds Accuracy

| Old approach | New approach |
|---|---|
| Measured from set complete → "Done resting" press | Measured from set complete → timer hits 0 (or early "Done resting") |
| Includes phone-pickup time, varies with user speed | Equals the timer duration exactly |
| Over-counts if user presses button after lifting | Each "Reset 15s" adds 15s (user-acknowledged) |

`actual_rest_seconds` is written to the set at the moment the timer closes (auto or early). Each "Reset 15s" press increments the stored value by 15 and re-writes it.

---

## Lift Duration Tracking (informational, not stored to DB)

When "Lift complete" is pressed:
- `actual_lift_seconds = (Date.now() - postRestStartedAt) / 1000`
- `estimated_lift_seconds = 2 × planned_reps`

These are logged for awareness only. No new DB columns in this spec.

---

## Technical Design

### 1. RestTimer.tsx

**New props:**
```ts
autoHideOnExpiry?: boolean   // default false — when true, calls onDone automatically at 0:00
```

**15-second warning** (internal, no new prop):
```ts
const warnFiredRef = useRef(false)

// Reset when timer starts (durationSeconds or offset changes)
useEffect(() => { warnFiredRef.current = false }, [durationSeconds, offset])

// Fire once when remaining crosses 15
useEffect(() => {
  if (remaining <= 15 && remaining > 0 && !warnFiredRef.current) {
    warnFiredRef.current = true
    if (hapticAlertRef.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (audioAlertRef.current) playDing()  // single ding as warning
  }
}, [remaining])
```

**Auto-hide at expiry:**
```ts
const autoHideFiredRef = useRef(false)

useEffect(() => {
  if (!autoHideOnExpiry) return
  if (!overtime || autoHideFiredRef.current) return
  autoHideFiredRef.current = true
  // Sound already played by existing overtime effect; delay slightly for UX
  const t = setTimeout(() => onDone(elapsed + offset), 1500)
  return () => clearTimeout(t)
}, [overtime, autoHideOnExpiry])
```

`remaining` is already computed as `Math.max(0, durationSeconds + offset - elapsed)`.

---

### 2. New component: PostRestOverlay

**File:** `apps/parakeet/src/components/training/PostRestOverlay.tsx`

**Props:**
```ts
interface PostRestOverlayProps {
  plannedReps: number          // for estimated lift time display
  onLiftComplete: () => void
  onReset15s: () => void
  resetCountdown: number | null // null = idle, N = counting down
}
```

**Renders** (same position as RestTimer overlay — absolute top):
- Brief label: "Go lift!" (or empty — let buttons speak)
- Primary button: "Lift complete" (large, full-width)
- Secondary button: "Reset 15s" — when `resetCountdown !== null`, shows countdown number instead of "15s"
- Estimated lift time hint: `~${2 * plannedReps}s` (shown below buttons as muted text)

---

### 3. Session screen: PostRestState

**New local state** (not in store — pure UI):
```ts
interface PostRestState {
  pendingMainSetNumber: number | null
  pendingAuxExercise: string | null
  pendingAuxSetNumber: number | null
  actualRestSeconds: number
  liftStartedAt: number          // Date.now() when overlay appeared
  plannedReps: number            // from plannedSets, for estimated lift time
  resetSecondsRemaining: number | null
}

const [postRestState, setPostRestState] = useState<PostRestState | null>(null)
```

**Modified `handleTimerDone`** — now called both from "Done resting" press AND RestTimer auto-hide:
```ts
function handleTimerDone() {
  const pendingMain = timerState?.pendingMainSetNumber ?? null
  const pendingAuxExercise = timerState?.pendingAuxExercise ?? null
  const pendingAuxSet = timerState?.pendingAuxSetNumber ?? null
  const elapsedSeconds = closeTimer()

  // Write actual_rest_seconds immediately
  if (pendingMain !== null) {
    updateSet(pendingMain, { actual_rest_seconds: elapsedSeconds })
  } else if (pendingAuxExercise !== null && pendingAuxSet !== null) {
    updateAuxiliarySet(pendingAuxExercise, pendingAuxSet, { actual_rest_seconds: elapsedSeconds })
  }

  // Show PostRestOverlay (skip for post-warmup timer: both pending are null)
  if (pendingMain !== null || (pendingAuxExercise !== null && pendingAuxSet !== null)) {
    const plannedReps = pendingMain !== null
      ? (plannedSets[pendingMain - 1]?.reps ?? 0)
      : 0  // aux: could pass from aux set data
    setPostRestState({
      pendingMainSetNumber: pendingMain,
      pendingAuxExercise,
      pendingAuxSetNumber: pendingAuxSet,
      actualRestSeconds: elapsedSeconds,
      liftStartedAt: Date.now(),
      plannedReps,
      resetSecondsRemaining: null,
    })
  }
}
```

**"Reset 15s" handler:**
```ts
function handlePostRestReset() {
  if (!postRestState) return
  const newRest = postRestState.actualRestSeconds + 15
  // Re-write incremented rest time
  if (postRestState.pendingMainSetNumber !== null) {
    updateSet(postRestState.pendingMainSetNumber, { actual_rest_seconds: newRest })
  } else if (postRestState.pendingAuxExercise && postRestState.pendingAuxSetNumber !== null) {
    updateAuxiliarySet(postRestState.pendingAuxExercise, postRestState.pendingAuxSetNumber, { actual_rest_seconds: newRest })
  }
  setPostRestState((prev) => prev ? { ...prev, actualRestSeconds: newRest, resetSecondsRemaining: 15 } : null)
  // Start 15s countdown — tick via setInterval, clear when hits 0
}
```

**"Lift complete" handler:**
```ts
function handleLiftComplete() {
  if (!postRestState) return
  // Informational logging only
  const actual_lift_seconds = Math.round((Date.now() - postRestState.liftStartedAt) / 1000)
  const estimated_lift_seconds = 2 * postRestState.plannedReps
  console.log(`[lift] actual=${actual_lift_seconds}s estimated=${estimated_lift_seconds}s`)
  setPostRestState(null)
}
```

**Render the overlay:**
```tsx
{postRestState && (
  <PostRestOverlay
    plannedReps={postRestState.plannedReps}
    onLiftComplete={handleLiftComplete}
    onReset15s={handlePostRestReset}
    resetCountdown={postRestState.resetSecondsRemaining}
  />
)}
```

Pass `autoHideOnExpiry` to RestTimer:
```tsx
<RestTimer
  ...
  autoHideOnExpiry
  onDone={handleTimerDone}
/>
```

---

## Edge Cases

| Scenario | Result |
|---|---|
| User presses "Done resting" before 0:00 | `handleTimerDone` fires early; PostRestOverlay appears immediately |
| Post-warmup timer (no pending set) | Timer auto-hides normally; PostRestOverlay is skipped |
| User presses "Reset 15s" multiple times | Each press adds 15s to `actual_rest_seconds` and re-starts 15s countdown |
| User presses "Lift complete" during 15s countdown | Countdown interval cleared; overlay hides; rest already written |
| User completes session while PostRestOverlay is open | `handleComplete` should dismiss postRestState before navigating away |
| AuxiliaryPill (aux sets) | Pill stays manual ("Done" button); PostRestOverlay not shown for aux |

---

## What Is NOT Changed

- `actual_rest_seconds` DB column — same field, values now more accurate
- AuxiliaryPill behaviour — compact pill remains unchanged; no PostRestOverlay for aux
- Rest duration settings — unchanged
- Timer overlay position/styling — unchanged

---

## Files to Modify / Create

| File | Change |
|------|--------|
| `apps/parakeet/src/components/training/RestTimer.tsx` | `autoHideOnExpiry` prop; 15s warning haptic+sound; auto-call `onDone` after overtime |
| `apps/parakeet/src/components/training/PostRestOverlay.tsx` | **New** — "Lift complete" + "Reset 15s" card |
| `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` | `postRestState` local state; modified `handleTimerDone`; two new handlers; PostRestOverlay render |

---

## Verification

1. Timer counts to 0:15 → warning haptic + single ding fires once
2. Timer counts to 0:00 → "done" sound → overlay auto-hides ~1.5s later → PostRestOverlay appears
3. Press "Lift complete" → overlay hides → `actual_rest_seconds` already written; console logs lift times
4. Press "Reset 15s" → 15-second countdown shows → `actual_rest_seconds` incremented by 15 on set
5. Press "Reset 15s" → countdown → press "Lift complete" mid-count → overlay hides cleanly
6. Press "Done resting" before 0:00 → PostRestOverlay appears immediately with partial rest time
7. Post-warmup timer (no pending set) → auto-hides → no PostRestOverlay
8. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json` — no new errors
