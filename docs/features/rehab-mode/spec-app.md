# Spec: Rehab Mode App-Layer Module

**Status**: Planned
**Domain**: parakeet App

## What This Covers

The `@modules/rehab-mode` module: service, hooks, and JIT input wiring. Provides the public API the UI consumes for CRUD, and threads the active rehab cap through `JITInput` so the engine can enforce it.

The module follows the same layered shape as `@modules/disruptions` (`data/` → `services/` → `hooks/` → `index.ts`).

## Tasks

**Module skeleton: `apps/parakeet/src/modules/rehab-mode/`**

- [x] `index.ts` — public API: barrel exports the service + queryOptions factory + typed error + types. Raw repository is module-internal.
      → `apps/parakeet/src/modules/rehab-mode/index.ts`
- [x] `data/rehab-mode.repository.ts` — see [spec-data.md](./spec-data.md)
      → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.ts`
- [x] `application/rehab-mode.service.ts` — verb-named wrappers around the repo (`application/`, not `services/`, per house convention — see `apps/parakeet/CLAUDE.md`).
      → `apps/parakeet/src/modules/rehab-mode/application/rehab-mode.service.ts`
- [x] `hooks/useActiveRehabCaps.ts` — both `useActiveRehabCaps` and `useRehabCapForLift` (single file by convention).
      → `apps/parakeet/src/modules/rehab-mode/hooks/useActiveRehabCaps.ts`
- [x] `hooks/useRehabModeMutations.ts` — `enable`, `update`, `end` mutations. Each `onSuccess` invalidates `rehabModeQueries.all()`, the active program, and all session queries so future JIT regeneration picks up the new state.
      → `apps/parakeet/src/modules/rehab-mode/hooks/useRehabModeMutations.ts`

**Service: `application/rehab-mode.service.ts`**

- [x] `enableRehabCap`, `updateRehabCap`, `endRehabCap`, `getActiveRehabCaps`, `getActiveRehabCapForLift`, `getRehabCap`, `getRehabCapHistory`. The typed `ActiveRehabCapExistsError` from the repository propagates unchanged so callers can `catch` it without string-matching PG codes.
      → `apps/parakeet/src/modules/rehab-mode/application/rehab-mode.service.ts`

**React Query factory: `data/rehab-mode.queries.ts`**

Per `apps/parakeet/CLAUDE.md` new-code convention: `queryOptions` factories live co-located with the data layer; no entries on the legacy `qk.*` helper.

- [x] `rehabModeQueries.activeCaps(userId)`
- [x] `rehabModeQueries.activeForLift(userId, lift)`
- [x] `rehabModeQueries.history(userId, paging)`
      → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.queries.ts`

**Hooks**

- [ ] `useActiveRehabCaps(userId)` — returns `RehabCap[]`, populates the Today screen chip row
- [ ] `useRehabCapForLift(userId, lift)` — returns `RehabCap | null`, drives per-lift UI affordances (RPE pill, cap banner)
- [ ] `useRehabModeMutations()` — `enable`, `update`, `end` mutations. Each mutation invalidates:
  - `qk.rehabMode.active(userId)`
  - `qk.rehabMode.byLift(userId, lift)`
  - `qk.session.today(userId)` — Today screen chip changes
  - `qk.program.active(userId)` — future sessions' JIT prescriptions will change next time they generate
  - `qk.session.detail(sessionId)` for any currently-rendered session whose primary lift matches — the live prescription will recompute on next open

**JIT input wiring: `apps/parakeet/src/modules/jit/lib/jit.ts`**

- [x] Parallel fetch added for `getActiveRehabCapForLift(userId, lift)` alongside the recent-logs + aux-history fetches. Wrapped into `{ lift, capKg }` for the engine input.
      → `apps/parakeet/src/modules/jit/lib/jit.ts`
- [x] `JITInput.activeRehabCap` populated when a cap exists for the current lift.
      → `apps/parakeet/src/modules/jit/lib/jit.ts`
- [x] `recentLogs` carry `containedRehabSets: true` for any session whose `set_logs` rows include `during_rehab=true`. Repository SELECT now pulls the column and aggregates per session via `SessionSetsBucket.containedRehabSets`. Each `ActualSetKg` passed to `computeWeightDeviation` is also tagged `duringRehab` so working-1RM excludes them.
      → `apps/parakeet/src/modules/jit/data/jit.repository.ts`, `apps/parakeet/src/modules/jit/lib/jit.ts`

**Set-log write path: `apps/parakeet/src/modules/session/data/session.repository.ts` + DB trigger**

- [x] `during_rehab` is stamped server-side by the `set_logs_stamp_during_rehab` BEFORE INSERT/UPDATE trigger. Client value is ignored — the trigger looks up the parent session's `primary_lift`, checks `rehab_caps` for an active cap, and sets the flag accordingly. Prevents UI-cache drift; can't be bypassed by any client.
      → `supabase/migrations/20260522000000_rehab_during_trigger.sql`
- [x] `UpsertSetLogInput.painLimited?: boolean` accepted (default false); flows through to the row.
      → `apps/parakeet/src/modules/session/data/session.repository.ts`

**PR detection gate: `apps/parakeet/src/modules/achievements/hooks/useAchievementDetection.ts`**

- [x] `sessionContainedRehabSets(sessionId)` repository helper added (returns true if any of the session's `set_logs` was stamped `during_rehab`). Fetched in parallel with session context inside `detectAchievements`. When true, the entire PR-detection branch is skipped — no e1RM, no volume, no rep-at-weight PRs are stored, and downstream badges don't see them. Streak + cycle-completion logic still runs because the rehab session is still a session.
      → `apps/parakeet/src/modules/session/data/session.repository.ts`, `apps/parakeet/src/modules/achievements/hooks/useAchievementDetection.ts`

**Today-screen chip integration: `apps/parakeet/src/app/(tabs)/today.tsx`**

- [ ] Render the rehab-cap chip alongside (or just after) the existing disruption chip row, via a new `RehabCapChipsRow` component in `modules/rehab-mode/ui/` — **Phase 4 (UI).**

**Unit / integration tests**

- [ ] `services/__tests__/rehab-mode.service.test.ts`:
  - `enableRehabCap` on a lift with an already-active cap throws a typed error
  - `endRehabCap` allows a subsequent `enableRehabCap` on the same lift
- [ ] `set-log.repository.test.ts`:
  - Inserting a set during an active cap stamps `during_rehab: true` regardless of what the client sends
  - `pain_limited` flows through from client input
  - Set inserted on bench while squat is in rehab → `during_rehab: false` (rehab is per-lift)

## Dependencies

- [spec-data.md](./spec-data.md) — table + schemas
- [spec-engine.md](./spec-engine.md) — engine consumes `JITInput.activeRehabCap`
- [jit-pipeline/spec-generator.md](../jit-pipeline/spec-generator.md) — JIT input shape

## Domain References

- [domain/athlete-signals.md](../../domain/athlete-signals.md) — RPE signal (now extended with `pain_limited`)
