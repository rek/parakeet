# mobile-037: Rest Timer Auto-Dismiss on Set Start

## Problem

After completing a working set, a rest timer overlay appears. The only way to dismiss it is to press "Done resting", then rush to the barbell. This creates physical awkwardness — the user has to interact with the phone at the exact moment they want to be moving to lift.

Additionally, the user loses clarity on two separate events:
1. **When rest ended** (currently captured as "Done resting" press time)
2. **When the lift actually started** (not captured at all)

## Goal

Remove the need to explicitly press "Done resting" before lifting. The timer should auto-dismiss when the user naturally returns from their set and starts logging the next one. "Done resting" remains for early, explicit dismissal.

---

## Current Behaviour

```
Set N complete
  → openTimer({ durationSeconds, pendingMainSetNumber: N })
  → Timer overlay appears at top of screen (position: absolute, top: insets.top + 8)
  → User presses "Done resting"
    → closeTimer() → returns elapsed → timerState nulled
    → updateSet(N, { actual_rest_seconds: elapsed })
  → User taps Set N+1 weight input, logs, marks complete
  → openTimer for N+1 ...
```

---

## Proposed Behaviour

```
Set N complete
  → openTimer({ durationSeconds, pendingMainSetNumber: N })
  → Timer overlay appears
  → User puts phone down, goes and lifts Set N+1
  → User returns, taps weight input of Set N+1     ← NEW TRIGGER
    → handleSetStartLogging(N+1) fires
      → reads timerState.pendingMainSetNumber (= N) from store
      → closeTimer() → elapsed recorded for set N
      → updateSet(N, { actual_rest_seconds: elapsed })
  → User logs Set N+1 normally
  → openTimer for N+1 ...
```

"Done resting" also still works (existing path, no change).

---

## Technical Design

### SetRow changes (`components/training/SetRow.tsx`)

**New prop:**
```ts
onStartLogging?: () => void
```

**Fire-once guard** (prevents double-fire on weight then reps focus):
```ts
const hasStartedLoggingRef = useRef(false)

// Reset whenever set is un-completed
useEffect(() => {
  if (!isCompleted) hasStartedLoggingRef.current = false
}, [isCompleted])

function handleInputFocus() {
  if (!isCompleted && !hasStartedLoggingRef.current) {
    hasStartedLoggingRef.current = true
    onStartLogging?.()
  }
}
```

Add `onFocus={handleInputFocus}` to weight TextInput and reps TextInput.
Timed variant has no inputs — no change needed.

---

### Session screen changes (`app/(tabs)/session/[sessionId].tsx`)

**`handleSetStartLogging(setNumber: number)`** — useCallback with `[closeTimer, updateSet]`:

```ts
const { timerState } = useSessionStore.getState()
if (!timerState?.visible) return

const isMainTimer = timerState.pendingMainSetNumber !== null
const isPostWarmup = !isMainTimer && timerState.pendingAuxExercise === null

// Guard: only auto-dismiss if this is the set immediately following the pending one
if (isMainTimer && timerState.pendingMainSetNumber !== setNumber - 1) return

const elapsedSeconds = closeTimer()
if (isMainTimer) {
  updateSet(timerState.pendingMainSetNumber!, { actual_rest_seconds: elapsedSeconds })
}
// Post-warmup: close only — no set to attribute rest to
```

**`handleAuxSetStartLogging(exercise: string, setNumber: number)`** — useCallback with `[closeTimer, updateAuxiliarySet]`:

```ts
const { timerState } = useSessionStore.getState()
if (!timerState?.visible) return
if (
  timerState.pendingAuxExercise !== exercise ||
  timerState.pendingAuxSetNumber !== setNumber - 1
) return

const elapsedSeconds = closeTimer()
updateAuxiliarySet(exercise, timerState.pendingAuxSetNumber!, { actual_rest_seconds: elapsedSeconds })
```

**SetRow render sites** (~4 places in session screen):
```tsx
// Main sets loop
<SetRow
  ...
  onStartLogging={() => handleSetStartLogging(actualSet.set_number)}
/>

// Regular aux & top-up aux loops
<SetRow
  ...
  onStartLogging={() => handleAuxSetStartLogging(aw.exercise, setIndex + 1)}
/>

// Ad-hoc exercises loop
<SetRow
  ...
  onStartLogging={() => handleAuxSetStartLogging(exercise, setIndex + 1)}
/>
```

---

## Edge Cases

| Scenario | Result |
|---|---|
| User already pressed "Done resting" before focusing | `timerState?.visible` is false → no-op |
| Post-warmup timer, user focuses set 1 input | Closes post-warmup timer, no rest written to any set (correct) |
| User focuses weight, then reps on same set | `hasStartedLoggingRef` already true → second focus is no-op |
| User un-completes set N, re-completes | Ref resets on `isCompleted → false`; next focus fires correctly |
| User taps an already-completed set's input | `isCompleted` is true (inputs `editable={false}`) → guard blocks call |
| User focuses set N+2 input while timer for N is pending | `pendingMainSetNumber (N) !== setNumber - 1 (N+1)` → guard rejects |
| Aux: last set of exercise (no timer opened) | `timerState?.visible` false → no-op |

---

## What Is NOT Changed

- "Done resting" button — label, position, and behaviour unchanged
- Timer overlay layout, audio/haptic alerts — unchanged
- `actual_rest_seconds` data model — unchanged
- RestTimer component — unchanged
- AuxiliaryPill variant — unchanged (pill dismissal via its own "Done" button, same as before)

---

## Files to Modify

| File | Change summary |
|------|----------------|
| `apps/parakeet/src/components/training/SetRow.tsx` | `onStartLogging` prop + `hasStartedLoggingRef` + `onFocus` on inputs |
| `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` | Two new useCallbacks; `onStartLogging` wired to all SetRow sites |

---

## Verification

1. Complete set N → without pressing "Done resting" → tap weight of set N+1 → timer closes, rest logged on set N
2. Complete set N → press "Done resting" → tap weight of set N+1 → nothing (timer already gone)
3. Last warmup complete → post-warmup timer opens → tap weight of working set 1 → timer closes, no rest written
4. Aux set N (not last) complete → tap weight of aux set N+1 → aux pill closes, rest logged
5. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json` — no new errors
