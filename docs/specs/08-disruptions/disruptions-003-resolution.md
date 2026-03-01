# Spec: Disruption Resolution

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

How active disruptions are resolved when the user recovers — marking them done, reverting affected sessions to normal loading, and removing the chip from the Today screen.

## Data layer (`lib/disruptions.ts`)

`resolveDisruption(disruptionId, userId, resolvedAt?)` sets the disruption status to `resolved` and stamps `resolved_at` (defaults to now if not provided). It then clears `planned_sets` and `jit_generated_at` on all `planned` sessions listed in `session_ids_affected`, so JIT regenerates them at normal loading on next open.

`getActiveDisruptions(userId)` returns all disruptions where status is not `resolved`, ordered newest-first. Used by the Today screen chip row.

`getDisruptionHistory(userId, { page, pageSize })` returns paginated full history for a future history view.

`getDisruption(disruptionId, userId)` returns a single disruption by ID.

## Today screen chip row (`today.tsx`)

Active disruptions are fetched separately from the session (React Query key: `['disruptions', 'active', userId]`). The `DisruptionChipsRow` component (`components/disruption/DisruptionChipsRow.tsx`) renders a horizontal scrollable row of pill chips — one per active disruption — always visible regardless of whether there is a session today. Each chip shows `⚡ {type}` with a severity-colored border and dot (minor=amber, moderate=orange, major=red). Tapping a chip opens a bottom sheet modal with full details (description, affected lifts, until date) and a "Mark Resolved" button.

## Recovery flow

- [x] User sees chip row: e.g. `⚡ Illness` chip with amber border
- [x] User taps chip → bottom sheet modal shows type, severity pill, description, affected lifts, end date
- [x] User taps "Mark Resolved" → Alert confirms → `resolveDisruption` called, `resolved_at` stamped to now
- [x] Disruption status set to `resolved` in DB
- [x] future `planned_sets` and `jit_generated_at` cleared on all planned sessions that were adjusted
- [x] React Query invalidates active disruptions query → banner disappears
- [x] Next time user opens an affected session, JIT runs fresh at normal loading

`WorkoutCard` has no disruption awareness — the prop was removed entirely. Resolution and display both live in `today.tsx`.

## Session revert

There is no stored program snapshot. JIT re-generation is the authoritative way to restore normal weights. Clearing `planned_sets` + `jit_generated_at` on the affected sessions is sufficient — on next open those sessions regenerate as if the disruption never existed.

## Dependencies

- [disruptions-002-apply-adjustment.md](./disruptions-002-apply-adjustment.md)
