# Skip an auxiliary set mid-session

Lets a lifter opt out of an individual **planned auxiliary set** during a live
workout — machine busy, ran out of time, or simply doesn't want it — without it
reading as a missed/failed set.

## Scope

- **Auxiliary only.** Main working sets are not skippable; they are the core of a
  powerlifting session. Auxiliary covers JIT-prescribed accessories and volume
  top-up work.
- **Skip, not delete.** A skipped set greys out to "Set N — Skipped" with a
  restore (↺) control and stays in the list. `set_number` is preserved, so
  adaptation lookups (`auxAdaptations[*].sets.find(set_number)`) and weight
  placeholders (`aw.sets[set_number - 1]`) stay aligned — no renumbering.
- **Ad-hoc sets are unaffected** — user-added sets keep their existing
  hard-delete `×` (`removeAdHocSet`), since deleting a self-added set is the
  right model there.

## Behaviour

- Skip is offered only on **incomplete** aux sets (the `×` is hidden once a set
  is completed). Fully reversible via restore.
- A skipped set is **never written to `set_logs`** — the persistence subscriber
  (`useSetPersistence`) and `flushUnsyncedSets`/`completeSession` all gate on
  `is_completed`, which a skipped set never reaches.
- A skipped set is **excluded from completion stats** (`computeSessionStats`)
  from both numerator and denominator, so it reads as resolved, not missed.

## Code

### `modules/session/store/sessionStore.ts`
- `AuxiliaryActualSet.skipped?: boolean` — persisted via the existing
  `auxiliarySets` partialize, so it survives an app kill mid-session.
- `setAuxSetSkipped(exercise, setNumber, skipped)` → `sessionStore.ts:setAuxSetSkipped`
  — flips the flag on the matching aux set; leaves `set_number` untouched.

### `modules/session/utils/session-stats.ts`
- `computeSessionStats` filters `skipped` aux out of the active set before
  deriving `isAuxOnly`, `totalSets`, and `completedSets`.

### `modules/session/ui/AuxSetRow.tsx`
- `AuxSetRow` → wraps an aux `SetRow`. Renders the greyed "Skipped + restore"
  state when `isSkipped`, otherwise the row plus the skip `×` (only when
  `!isCompleted`).

### `app/(tabs)/session/[sessionId].tsx`
- Regular and volume-top-up aux `SetRow`s are wrapped in `AuxSetRow`, wired to
  `setAuxSetSkipped`.
