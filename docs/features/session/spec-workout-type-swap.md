# Swap the planned lift on the generate screen (unending)

Lets a lifter on an **unending** program train a different lift than the
rotation prescribed — "I don't want the planned bench today, I'll squat instead"
— from the first screen of the generate flow (the soreness check-in).

## Scope & decisions

- **Unending programs only.** Scheduled fixed-length programs keep their locked
  scaffold (the selector is gated on `program_mode === 'unending'`).
- **Lift only.** The user picks squat / bench / deadlift; the recommended
  **intensity** (heavy/explosive/rep) is auto-recomputed for the chosen lift and
  shown read-only. No manual intensity override.
- **Rotation re-bases off what you did.** Unending picks the next lift from the
  last _resolved_ lift (`computeNextUnendingLift` ← `fetchLastResolvedLiftForProgram`).
  Changing this session's `primary_lift` is all that's needed — the displaced
  lift naturally becomes next. No counters touched; `week_number`/`day_number`/
  `block_number`/`is_deload` are unchanged (schedule position is preserved, only
  lift identity changes).

## Behaviour

- Selector sits at the top of the soreness screen. The rotation's original pick
  is captured at bootstrap and tagged **"Recommended"** even after a swap.
- Selecting a different lift persists immediately, then re-fetches the session so
  the soreness sliders re-derive to the new lift's primary muscles
  (`LIFT_PRIMARY_SORENESS_MUSCLES[primary_lift]`).
- Intensity is recomputed via `selectIntensityTypeForUnending(lift, week_number,
signals)` — same engine rule as next-session generation (see
  [domain/periodization.md](../../domain/periodization.md#unending-intensity-selection)).
- The stale (old-lift) JIT prescription is cleared (`planned_sets` +
  `jit_generated_at` → null); JIT regenerates off the updated session row when
  the user taps Generate.
- Auto-generate (`autoGenerate=1`) bypasses the selector and uses the
  recommended lift, unchanged.

## Code

### `packages/training-engine` (no change)

- `selectIntensityTypeForUnending`, `LIFTS`, `computeNextUnendingLift` — reused.

### `modules/session/data/session.repository.ts`

- `updateSessionLift(sessionId, primaryLift, intensityType)` — updates lift +
  intensity, nulls `planned_sets`/`jit_generated_at`; guarded to
  `status IN ('planned','in_progress')`.

### `modules/session/application/session.service.ts`

- `buildIntensitySignalsForLift(userId, lift)` — extracted from
  `generateNextUnendingSession` (now shared by both paths).
- `swapSessionLift({ sessionId, userId, newLift })` → recomputes intensity for
  the new lift and calls `updateSessionLift`. No-op when the lift is unchanged.

### `modules/session/ui/WorkoutTypeSelector.tsx`

- `WorkoutTypeSelector` — segmented lift chips; recommended tag; read-only
  "Intensity: X (auto)" note.

### `app/(tabs)/session/soreness.tsx`

- Fetches `programMode` + captures `recommendedLift` at bootstrap; renders the
  selector when unending; `handleSelectLift` calls `swapSessionLift` then
  refreshes the session.
