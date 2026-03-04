# Spec: Cycle Tracking Data

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Supabase schema and data-access functions for storing the user's menstrual cycle configuration (enabled toggle, cycle length, last period start date) and recording the cycle phase at session log time.

### Period Start History (added 2026-03-11)

A `period_starts` table stores every recorded period start as an event row. When the user picks a date in settings, `addPeriodStart` upserts a row and syncs `cycle_tracking.last_period_start` to the most-recent entry. Deleting an entry (via `deletePeriodStart`) re-syncs the cache. The settings screen shows the full history list with per-entry Remove buttons.

New DB objects:
- `period_starts` table (`id`, `user_id`, `start_date DATE`, `created_at`) with unique index on `(user_id, start_date)`
- RLS policy: `users_own_data`
- Migration: `20260311000000_add_period_start_history.sql`

New lib functions in `cycle-tracking.ts`:
- `getPeriodStartHistory(userId)` → `PeriodStartEntry[]` (descending by date)
- `addPeriodStart(userId, startDate)` → `PeriodStartEntry[]` (upsert + sync cache)
- `deletePeriodStart(userId, entryId)` → `PeriodStartEntry[]` (delete + sync cache)

## Tasks

### DB Migration

**`supabase/migrations/20260227000000_add_cycle_tracking.sql`:**
- [ ] Create `cycle_tracking` table:
  ```sql
  CREATE TABLE cycle_tracking (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_enabled    BOOLEAN NOT NULL DEFAULT false,
    cycle_length_days INT NOT NULL DEFAULT 28,
    last_period_start DATE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
  );

  ALTER TABLE cycle_tracking ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users manage own cycle config"
    ON cycle_tracking FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ```
- [ ] Add `cycle_phase` column to `session_logs`:
  ```sql
  ALTER TABLE session_logs
    ADD COLUMN cycle_phase TEXT
      CHECK (cycle_phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal', 'late_luteal'));
  ```
  - Nullable — populated only when cycle tracking is enabled at session time

### Data Access Lib

**`apps/parakeet/src/modules/cycle-tracking/lib/cycle-tracking.ts`:**
- [ ] Export `CycleConfig` interface: `{ is_enabled, cycle_length_days, last_period_start }`
- [ ] `getCycleConfig(userId: string): Promise<CycleConfig>` — get or create user's cycle config (upsert on first access)
- [ ] `updateCycleConfig(userId: string, update: Partial<Pick<CycleConfig, 'is_enabled' | 'cycle_length_days' | 'last_period_start'>>): Promise<void>`
- [ ] `getCurrentCycleContext(userId: string): Promise<CycleContext | null>`
  - Returns null if `!is_enabled || !last_period_start`
  - Otherwise calls `computeCyclePhase(new Date(last_period_start), cycle_length_days)`
- [ ] `stampCyclePhaseOnSession(userId: string, sessionLogId: string): Promise<void>`
  - Gets current context via `getCurrentCycleContext`; if null → no-op
  - Otherwise updates `session_logs SET cycle_phase = $phase WHERE id = $sessionLogId AND user_id = $userId`

### React Query Hook

**`apps/parakeet/src/modules/cycle-tracking/hooks/useCyclePhase.ts`:**
- [ ] `useCyclePhase()` — React Query hook wrapping `getCurrentCycleContext(user.id)`
  - `staleTime: 5 * 60 * 1000` (5 min — phase changes slowly)

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-014-cycle-phase-calculator.md](../04-engine/engine-014-cycle-phase-calculator.md)
- [data-004-athlete-profile.md](./data-004-athlete-profile.md) — cycle tracking only relevant for female users
