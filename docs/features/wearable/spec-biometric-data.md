# Spec: Biometric Data Tables

**Status**: Planned
**Domain**: Data

## What This Covers

Supabase migrations for wearable biometric data storage: a `biometric_readings` table for raw time-series data from Health Connect, a `recovery_snapshots` table for computed daily recovery state, and extensions to `session_logs` for intra-session heart rate data.

## Tasks

### Migration: biometric_readings + recovery_snapshots

**`supabase/migrations/YYYYMMDD000000_add_biometric_tables.sql`:**

- [ ] Create `biometric_readings` table:
  ```sql
  CREATE TABLE biometric_readings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL
                    CHECK (type IN (
                      'hrv_rmssd', 'resting_hr', 'sleep_duration',
                      'deep_sleep_pct', 'rem_sleep_pct', 'spo2',
                      'steps', 'active_minutes'
                    )),
    value         NUMERIC NOT NULL,
    recorded_at   TIMESTAMPTZ NOT NULL,
    source        TEXT NOT NULL DEFAULT 'health_connect',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, type, recorded_at)
  );
  ```
  - The unique constraint prevents duplicate inserts on re-sync
  - Index on `(user_id, type, recorded_at DESC)` for baseline queries

- [ ] Create `recovery_snapshots` table:
  ```sql
  CREATE TABLE recovery_snapshots (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date                  DATE NOT NULL,
    hrv_rmssd             NUMERIC,
    hrv_baseline_7d       NUMERIC,
    hrv_pct_change        NUMERIC,
    resting_hr            NUMERIC,
    resting_hr_baseline_7d NUMERIC,
    rhr_pct_change        NUMERIC,
    sleep_duration_min    NUMERIC,
    deep_sleep_pct        NUMERIC,
    rem_sleep_pct         NUMERIC,
    spo2_avg              NUMERIC,
    steps_24h             NUMERIC,
    active_minutes_24h    NUMERIC,
    readiness_score       NUMERIC,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
  );
  ```

- [ ] RLS policies for both tables:
  ```sql
  ALTER TABLE biometric_readings ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users manage own biometric readings"
    ON biometric_readings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  ALTER TABLE recovery_snapshots ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users manage own recovery snapshots"
    ON recovery_snapshots FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ```

- [ ] Index for baseline lookups:
  ```sql
  CREATE INDEX idx_biometric_readings_baseline
    ON biometric_readings (user_id, type, recorded_at DESC);

  CREATE INDEX idx_recovery_snapshots_date
    ON recovery_snapshots (user_id, date DESC);
  ```

### Migration: session_logs HR columns (Phase 4)

**`supabase/migrations/YYYYMMDD000001_add_session_hr_data.sql`:**

- [ ] Add HR columns to `session_logs`:
  ```sql
  ALTER TABLE session_logs
    ADD COLUMN hr_samples JSONB,
    ADD COLUMN avg_hr NUMERIC,
    ADD COLUMN max_hr NUMERIC,
    ADD COLUMN hr_recovery_60s NUMERIC;
  ```
  - All nullable — populated only when wearable HR data is captured during session
  - `hr_samples` structure: `[{ "timestamp_ms": number, "bpm": number }]`
  - `hr_recovery_60s`: BPM drop in first 60 seconds after final working set (positive = good recovery)

### Data retention

- [ ] `biometric_readings`: retain 90 days. Older readings can be pruned since baselines only use 7 days and recovery snapshots preserve the computed values.
  ```sql
  -- Run periodically (cron or Supabase edge function)
  DELETE FROM biometric_readings
  WHERE created_at < NOW() - INTERVAL '90 days';
  ```

- [ ] `recovery_snapshots`: retain indefinitely — one row per user per day, used for trend analysis in cycle reviews.

### Biometric repository

**`apps/parakeet/src/modules/wearable/data/biometric.repository.ts`:**

- [ ] `upsertBiometricReadings(userId: string, readings: Array<{ type, value, recorded_at, source }>)` — bulk upsert using `ON CONFLICT (user_id, type, recorded_at) DO NOTHING`
  - Accepts array of normalized readings from Health Connect sync
  - Returns count of newly inserted rows

- [ ] `fetchReadingsForBaseline(userId: string, type: BiometricType, days: number)` — fetch last N days of readings for a given type, ordered by `recorded_at DESC`
  - Used by baseline service to compute 7-day rolling averages

- [ ] `fetchLatestReading(userId: string, type: BiometricType)` — single most recent reading
  - Used for "last sync" display in settings

### Recovery repository

**`apps/parakeet/src/modules/wearable/data/recovery.repository.ts`:**

- [ ] `upsertRecoverySnapshot(userId: string, snapshot: Omit<RecoverySnapshot, 'id' | 'created_at'>)` — upsert by `(user_id, date)`
  - Called by recovery service after computing today's snapshot

- [ ] `fetchTodaySnapshot(userId: string)` — fetch snapshot for today's date
  - Returns null if no snapshot exists (no wearable data)
  - Used by JIT orchestrator to populate wearable JITInput fields

- [ ] `fetchSnapshotsForRange(userId: string, startDate: string, endDate: string)` — fetch snapshots for a date range
  - Used by cycle review to include recovery trends in the cycle report

## Dependencies

- [infra-003-supabase-setup.md](../infra/spec-supabase.md) — Supabase local + migration workflow
- [types-002-biometric-schemas.md](./spec-biometric-types.md) — Zod schemas must align with table columns
