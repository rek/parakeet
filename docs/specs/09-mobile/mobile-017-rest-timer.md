# Spec: Rest Timer UI

**Status**: Planned
**Domain**: parakeet App

## What This Covers

The between-set rest timer that starts automatically after a set is logged. Renders as a bottom sheet overlay on the session logging screen.

## Tasks

### Timer Component

**`apps/parakeet/components/training/RestTimer.tsx`:**

Props:
```typescript
interface RestTimerProps {
  durationSeconds: number          // from JITOutput.restRecommendations
  llmSuggestion?: {
    deltaSeconds: number
    formulaBaseSeconds: number
  }
  onDone: () => void               // called when user taps Done or timer hits 0
  intensityLabel: string           // e.g. "Block 3 · Heavy"
  isAuxiliary?: boolean            // true = smaller pill style
}
```

**State:**
- `remaining: number` — countdown in seconds, starts at `durationSeconds`
- `overtime: boolean` — true when remaining hits 0 and user hasn't dismissed
- `elapsed: number` — total seconds since timer started (used to record `actual_rest_seconds`)

**Behaviour:**
- Timer ticks every second via `useInterval` (or `setInterval` in a ref)
- At `remaining === 0`: trigger audio alert + haptic; flip to overtime mode (counts up, display turns red)
- `+30s` button: `remaining += 30` (ephemeral, does not persist)
- `−30s` button: `remaining = Math.max(0, remaining - 30)` (ephemeral)
- `Done resting` button: always visible; dismiss timer, call `onDone()` with `elapsed`
- Auto-dismiss: when the user taps the checkmark to log the next set, timer dismisses (session store action triggers this)

**Display:**
```
┌─────────────────────────────────────┐
│  Block 3 · Heavy                    │
│                                     │
│         04:32                       │  ← large countdown MM:SS
│                                     │
│  [AI: 4:30 suggested]               │  ← chip, shown only when |delta| >= 30s
│                                     │
│   [−30s]   [Done resting]   [+30s]  │
└─────────────────────────────────────┘
```

Overtime mode: countdown text turns red, shows "+00:12" style elapsed-over display.

AI suggestion chip: shown when `llmSuggestion` is present and `Math.abs(llmSuggestion.deltaSeconds) >= 30`. Text: "AI: [formulaBase ± delta] suggested". Tapping chip does nothing (informational only).

**Audio + haptic:**
- `expo-av` for audio: short tone at 0:00 (and optionally at 30s warning, user-configurable in mobile-018)
- `expo-haptics` for haptic: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` at 0:00

---

### Session Screen Integration

**`apps/parakeet/app/session/[sessionId].tsx`:**

- After `SetRow` checkmark tap → `sessionStore.completeSet(setNumber)` → trigger rest timer
- Timer renders as `<BottomSheet>` (using `@gorhom/bottom-sheet`) above the set list
- When timer dismisses, record `actual_rest_seconds` on the previous set in `sessionStore`:
  ```typescript
  sessionStore.updateSet(prevSetNumber, { actual_rest_seconds: elapsed })
  ```
- When user taps checkmark for the **next** set while timer is active: timer auto-dismisses, records elapsed

**Auxiliary sets:** Smaller pill timer rendered inline below the aux set row (not a bottom sheet). Fixed 90s, no +/− controls, no AI chip, no audio — just a compact countdown.

---

### Session Store Extension

**`apps/parakeet/store/sessionStore.ts`:**

Add `actual_rest_seconds?: number` to `ActualSet` type. Already persisted to MMKV — no other change needed.

---

### Actual Rest Logging

`actual_rest_seconds` flows through to `completeSession()` payload → stored in `session_logs.actual_sets` JSONB column (existing per-set data structure; add the field to the TypeScript type for `ActualSet`).

**Open question (deferred):** Timer start = set log tap (option 2 from design doc). Off by logging latency (~5–15s). Acceptable for v1. A "Start lift" button (option 1) is a future Settings → Training toggle.

## Dependencies

- [engine-020-rest-config.md](../04-engine/engine-020-rest-config.md) — `JITOutput.restRecommendations` source
- [engine-021-llm-rest-suggestions.md](../04-engine/engine-021-llm-rest-suggestions.md) — `llmRestSuggestion` field
- [mobile-005-session-logging-screen.md](./mobile-005-session-logging-screen.md) — session screen extended
- [mobile-018-rest-timer-settings.md](./mobile-018-rest-timer-settings.md) — audio/haptic toggle preferences
