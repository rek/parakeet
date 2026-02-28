# Spec: In-Session History Access

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Enables the user to navigate freely to any app screen (history, volume, achievements, etc.) while a session is in progress, and return via a persistent floating banner that shows the active lift and a live rest countdown. Requires migrating rest timer state from component-local to the session store so it survives navigation.

## Tasks

### 1. Session Store Extensions

**`apps/parakeet/src/store/sessionStore.ts`:**

Add to `SessionState` interface:
- [x] `sessionMeta: { primary_lift: string; intensity_type: string; block_number: number | null; week_number: number } | null`
- [x] `cachedJitData: string | null` — raw jitData route param string, stored for re-navigation
- [x] `timerState: TimerState | null` — see type below

Add `TimerState` interface (local to file):
```typescript
interface TimerState {
  visible: boolean
  durationSeconds: number
  elapsed: number                      // total seconds elapsed
  offset: number                       // user ±30s adjustments
  timerStartedAt: number | null        // Date.now() when timer last started/resumed
  pendingMainSetNumber: number | null
  pendingAuxExercise: string | null
  pendingAuxSetNumber: number | null
}
```

Add actions:
- [x] `setSessionMeta(meta: SessionState['sessionMeta']): void`
- [x] `setCachedJitData(raw: string): void`
- [x] `openTimer(opts: { durationSeconds: number; pendingMainSetNumber?: number; pendingAuxExercise?: string; pendingAuxSetNumber?: number }): void`
  - Sets `timerState.visible = true`, `timerStartedAt = Date.now()`, `elapsed = 0`, `offset = 0`
- [x] `tickTimer(): void`
  - Recomputes `elapsed = Math.floor((Date.now() - timerStartedAt) / 1000)` (handles catch-up on navigation return)
- [x] `adjustTimer(deltaSecs: number): void`
  - Mutates `timerState.offset += deltaSecs`; clamps so `durationSeconds + offset >= 0`
- [x] `closeTimer(): number`
  - Returns `timerState.elapsed` for set attribution; sets `timerState = null`

Extend `reset()`:
- [x] Also clear `sessionMeta`, `cachedJitData`, `timerState`

Extend `partialize`:
- [x] Add `sessionMeta`, `cachedJitData`, `timerState` to persisted fields
  - Note: `timerStartedAt` is a number (epoch ms), safe for JSON

### 2. Session Screen Refactor

**`apps/parakeet/src/app/session/[sessionId].tsx`:**

- [x] Remove local state: `timerVisible`, `timerDuration`, `timerLlmSuggestion`, `pendingRestSetNumber`, `pendingAuxRest`, `timerVisibleRef`
- [x] Pull `timerState`, `openTimer`, `adjustTimer`, `closeTimer`, `tickTimer`, `setSessionMeta`, `setCachedJitData` from `useSessionStore`
- [x] On bootstrap (jitData parse): call `setCachedJitData(jitData)` with the raw param string
- [x] After `getSession()` resolves: call `setSessionMeta(meta)`
- [x] Replace all `setTimerVisible(true)` / timer setup calls with `openTimer(opts)`
- [x] Replace `setTimerVisible(false)` + elapsed attribution with `closeTimer()` return value
- [x] Add `useFocusEffect` (from `expo-router`):
  - On focus: if `timerState?.visible && timerState.timerStartedAt`, call `tickTimer()` once (catch-up), then start `setInterval(() => tickTimer(), 1000)` stored in a ref
  - On blur / cleanup: clear the interval ref
- [x] Pass `elapsed={timerState?.elapsed ?? 0}` and `offset={timerState?.offset ?? 0}` to `<RestTimer>`
- [x] Pass `onAdjust={adjustTimer}` to `<RestTimer>` instead of internal ±30s handling

### 3. RestTimer Props Update

**`apps/parakeet/src/components/training/RestTimer.tsx`:**

- [x] Add props to `RestTimerProps`: `elapsed: number`, `offset: number`, `onAdjust: (deltaSecs: number) => void`
- [x] Remove internal `useRestTimer` hook (or gut its state — `elapsed` and `offset` now come from props)
- [x] `effectiveDuration` computed as `durationSeconds + offset` (same formula, now uses prop)
- [x] `remaining` computed as `Math.max(0, effectiveDuration - elapsed)`
- [x] `overtime` computed as `elapsed > effectiveDuration`
- [x] ±30s buttons call `onAdjust(±30)` instead of local state setters
- [x] `onDone` still called with `elapsed` (now the prop value)
  - Note: `actual_rest_seconds` attribution uses the `elapsed` prop, same as before

### 4. Return-to-Session Banner

**`apps/parakeet/src/components/session/ReturnToSessionBanner.tsx`:** _(new file)_

- [x] Read from `useSessionStore`: `sessionId`, `sessionMeta`, `cachedJitData`, `timerState`
- [x] Read current path via `usePathname()` from `expo-router`
- [x] Return `null` when:
  - `sessionId === null`
  - `usePathname()` starts with `/session`
- [x] Return `null` when `timerState?.visible !== true` (no active timer = no banner needed between sets)
  - _Rationale: banner is most useful during rest; between sets the tab bar suffices_
- [x] Local `useEffect` interval (1 second) that reads `timerState` from store to compute display values — does NOT call `tickTimer()` (only session screen does that)
- [x] Display: `"[Lift] — [Intensity] · [Block label]  |  Rest: M:SS"`
  - Lift: `capitalize(sessionMeta.primary_lift)`
  - Intensity: `capitalize(sessionMeta.intensity_type)`
  - Block label: `Block N · Week N` or `Week N` if no block
  - Rest countdown: `effectiveDuration - elapsed` formatted as `M:SS`; clamp at 0
  - When overtime: show `"Rest done"` in `colors.warning` text
- [x] Tap handler: `router.push({ pathname: '/session/[sessionId]', params: { sessionId, jitData: cachedJitData } })`
- [x] Styles: absolute positioned pill, `bottom: 80` (above tab bar), `alignSelf: 'center'`, `backgroundColor: colors.primary`, `borderRadius: radii.full`, `paddingHorizontal: spacing[4]`, `paddingVertical: spacing[2]`; overtime variant uses `colors.warning` background

### 5. Root Layout Integration

**`apps/parakeet/src/app/_layout.tsx`:**

- [x] Import `ReturnToSessionBanner`
- [x] Wrap `<Stack>` and `<ReturnToSessionBanner />` in a root `View` with `style={{ flex: 1 }}`
- [x] `ReturnToSessionBanner` sits after `<Stack>` with `style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}` and `pointerEvents="box-none"` on the wrapper so only the pill itself captures touches

## Dependencies

- [mobile-005-session-logging-screen.md](./mobile-005-session-logging-screen.md) — session screen being modified
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — RestTimer component being modified
- [in-session-history.md](../../design/in-session-history.md) — design doc
