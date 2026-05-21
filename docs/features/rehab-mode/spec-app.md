# Spec: Rehab Mode App-Layer Module

**Status**: Planned
**Domain**: parakeet App

## What This Covers

The `@modules/rehab-mode` module: service, hooks, and JIT input wiring. Provides the public API the UI consumes for CRUD, and threads the active rehab cap through `JITInput` so the engine can enforce it.

The module follows the same layered shape as `@modules/disruptions` (`data/` → `services/` → `hooks/` → `index.ts`).

## Tasks

**Module skeleton: `apps/parakeet/src/modules/rehab-mode/`**

- [ ] `index.ts` — public API: `RehabModeService`, `useActiveRehabCaps`, `useRehabCapForLift`, `useRehabModeMutations`, type re-exports
- [ ] `data/rehab-mode.repository.ts` — see [spec-data.md](./spec-data.md)
- [ ] `services/rehab-mode.service.ts` — see below
- [ ] `hooks/useActiveRehabCaps.ts`, `hooks/useRehabCapForLift.ts`, `hooks/useRehabModeMutations.ts` — React Query hooks
- [ ] `constants/index.ts` — query key namespace (see below), default cap percentage (50% of 1RM)

**Service: `services/rehab-mode.service.ts`**

- [ ] `enableRehabCap(userId, input: CreateRehabCapInput): Promise<RehabCap>` — wraps repository insert, throws a user-friendly error if the unique constraint fires ("Rehab Mode is already active for {lift}.")
- [ ] `updateRehabCap(id, userId, patch: UpdateRehabCapInput): Promise<RehabCap>`
- [ ] `endRehabCap(id, userId): Promise<RehabCap>` — wraps repository endRehabCap
- [ ] `getActiveCapForLift(userId, lift): Promise<RehabCap | null>` — convenience for JIT input assembly

**React Query keys: extend `apps/parakeet/src/platform/query/keys.ts`**

- [ ] `qk.rehabMode.active(userId)` — list of active caps for user
- [ ] `qk.rehabMode.byLift(userId, lift)` — single active cap per lift
- [ ] `qk.rehabMode.history(userId)` — paginated history

**Hooks**

- [ ] `useActiveRehabCaps(userId)` — returns `RehabCap[]`, populates the Today screen chip row
- [ ] `useRehabCapForLift(userId, lift)` — returns `RehabCap | null`, drives per-lift UI affordances (RPE pill, cap banner)
- [ ] `useRehabModeMutations()` — `enable`, `update`, `end` mutations. Each mutation invalidates:
  - `qk.rehabMode.active(userId)`
  - `qk.rehabMode.byLift(userId, lift)`
  - `qk.session.today(userId)` — Today screen chip changes
  - `qk.program.active(userId)` — future sessions' JIT prescriptions will change next time they generate
  - `qk.session.detail(sessionId)` for any currently-rendered session whose primary lift matches — the live prescription will recompute on next open

**JIT input wiring: `apps/parakeet/src/modules/jit/lib/buildJitInput.ts`** (or equivalent assembler)

- [ ] Add a parallel fetch for `getActiveCapForLift(userId, session.primary_lift)`.
- [ ] Populate `JITInput.activeRehabCap` when present.
- [ ] When assembling `recentLogs` for the performance adjuster, set `containedRehabSets: true` for any session whose `set_logs` rows include `during_rehab: true` on the matching lift. The repository query for recent sessions needs to pull the `during_rehab` column to compute this — update the SELECT list.

**Set-log write path: `apps/parakeet/src/modules/session/data/set-log.repository.ts`** (or equivalent)

- [ ] At set-log insert, compute `during_rehab` server-side via a small helper: `isLiftInRehab(userId, lift, atTimestamp) → boolean`. Reads `rehab_caps` for an active cap on `lift` where `started_at <= atTimestamp AND (ended_at is null OR ended_at >= atTimestamp)`.
- [ ] Accept `pain_limited` from the UI; default `false` if absent.
- [ ] Do **not** allow client-supplied `during_rehab` — always computed server-side from the live `rehab_caps` state. Prevents drift if the UI gets out of sync.

**Today-screen chip integration: `apps/parakeet/src/app/(tabs)/today.tsx`**

- [ ] Render the rehab-cap chip alongside (or just after) the existing disruption chip row, via a new `RehabCapChipsRow` component in `modules/rehab-mode/ui/`.

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
