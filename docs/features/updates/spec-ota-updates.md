# OTA Updates

**Status**: Implemented

**Module**: `modules/updates`

**Depends on**: `expo-updates`, `@react-native-async-storage/async-storage`

---

## Overview

Parakeet uses Expo Updates to deliver over-the-air patches without a full app store release. The module handles the full lifecycle: check → download → ready banner → apply → rollback detection.

---

## Behaviour

### Update check triggers

- **App launch** — checked once on mount via `useEffect`
- **Foreground resume** — `AppState` change to `active` re-triggers the check
- **Manual** — `checkForUpdate()` forces a check regardless of debounce
- **Debounce** — 30 s between automatic checks; skipped if status is `ready` or `restarting`
- **Dev mode** — all checks are no-ops (`__DEV__ === true`)

### Status machine

```
idle → checking → downloading → ready → restarting
                ↘ up-to-date
                ↘ error
```

- `idle` — initial state
- `checking` — `Updates.checkForUpdateAsync()` in flight
- `downloading` — update available; `Updates.fetchUpdateAsync()` in flight
- `ready` — update downloaded; waiting for user to apply
- `restarting` — `Updates.reloadAsync()` called; app about to restart
- `up-to-date` — check completed, no update available
- `error` — check or download threw; error message stored in `state.error`; exception sent to Sentry

### Apply flow

1. Status set to `restarting`
2. `PendingReload` (previous `updateId` + timestamp) written to AsyncStorage under `@parakeet/ota-pending-reload`
3. `Updates.reloadAsync()` called with branded splash screen (dark background, white spinner)
4. On failure: AsyncStorage entry removed, status reverts to `ready`

### Rollback detection (boot)

On every app launch, `useOtaUpdates` reads `@parakeet/ota-pending-reload`:
- If present: remove it immediately (prevents double-processing on crash-loop), then compare `Updates.updateId` to the stored `previousUpdateId`
  - Different → `reloadOutcome = { type: 'applied', updateId: current }` (success)
  - Same or null → `reloadOutcome = { type: 'rolled-back' }` + Sentry error
- If absent: no outcome to surface

---

## UI

### `UpdateReadyBanner`

Rendered in the app shell. Shows conditionally:

| Condition | Appearance |
|-----------|-----------|
| `status === 'ready'` | Green pill — "Update ready — tap to restart" |
| `status === 'restarting'` | Green pill (disabled) — "Restarting…" |
| `reloadOutcome.type === 'applied'` | Green pill — "Update applied · {shortId}"; auto-dismisses after 4 s |
| `reloadOutcome.type === 'rolled-back'` | Red pill — "Update failed — rolled back"; tap to dismiss |

The banner is `null` for all other states.

---

## Public API (`modules/updates/index.ts`)

| Export | Type | Purpose |
|--------|------|---------|
| `OtaUpdatesProvider` | Component | Wraps app; drives the update state machine |
| `useOtaUpdateStatus` | Hook | Read update state anywhere in the tree |
| `UpdateReadyBanner` | Component | Self-contained banner; place in app shell |
| `OtaStatus` | Type | Status union |
| `OtaUpdateMeta` | Type | Channel, runtimeVersion, updateId, createdAt |
| `OtaUpdateState` | Type | Full state shape including actions |

---

## Implementation

- [x] `OtaStatus`, `OtaUpdateState`, `OtaUpdateMeta` types
  → `modules/updates/hooks/useOtaUpdates.ts`
- [x] `useOtaUpdates` — state machine, check/download/apply/rollback
  → `modules/updates/hooks/useOtaUpdates.ts:useOtaUpdates`
- [x] `OtaUpdatesContext` + `OtaUpdatesProvider` + `useOtaUpdateStatus`
  → `modules/updates/OtaUpdatesContext.tsx`
- [x] `UpdateReadyBanner` — ready/restarting/outcome banners
  → `modules/updates/ui/UpdateReadyBanner.tsx:UpdateReadyBanner`
