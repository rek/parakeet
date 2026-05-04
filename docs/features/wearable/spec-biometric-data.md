# Spec: Biometric Data Tables

**Status**: Planned
**Domain**: Data
**Phase**: 1 (tables + repos) and 4 (session_logs HR cols)
**Owner**: any executor agent

## What This Covers

Two Supabase tables — `biometric_readings` (raw time-series from Health Connect) and `recovery_snapshots` (one computed row per user per day) — plus extensions to `session_logs` for intra-session HR. Includes RLS, indexes, retention strategy, and the typed repository layer in the wearable app module.

## Prerequisites

- [spec-biometric-types.md](./spec-biometric-types.md) — Zod schemas defining the typed shapes the repos parse.
- Supabase local stack running (see `docs/features/infra/spec-supabase.md` and `docs/guide/dev.md`).
- Repository pattern reference: `apps/parakeet/src/modules/disruptions/data/disruptions.repository.ts` is the canonical pattern (Supabase client + Zod parse on read + raw inserts).

## Migration Naming

Latest migrations end at `20260422100000_*`. This spec adds two:
- `supabase/migrations/20260429000000_add_biometric_tables.sql` — Phase 1
- `supabase/migrations/20260429000001_add_session_hr_data.sql` — Phase 4

## Tasks

### 1. Migration: biometric_readings + recovery_snapshots (Phase 1)

**File:** `supabase/migrations/20260429000000_add_biometric_tables.sql`

```sql
-- ── biometric_readings ──────────────────────────────────────────────────────

CREATE TABLE biometric_readings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
                'hrv_rmssd', 'resting_hr', 'sleep_duration',
                'deep_sleep_pct', 'rem_sleep_pct', 'spo2',
                'steps', 'active_minutes'
              )),
  value       NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  source      TEXT NOT NULL DEFAULT 'health_connect',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type, recorded_at)
);

CREATE INDEX idx_biometric_readings_baseline
  ON biometric_readings (user_id, type, recorded_at DESC);

ALTER TABLE biometric_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own biometric readings"
  ON biometric_readings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── recovery_snapshots ──────────────────────────────────────────────────────

CREATE TABLE recovery_snapshots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                   DATE NOT NULL,
  hrv_rmssd              NUMERIC,
  hrv_baseline_7d        NUMERIC,
  hrv_pct_change         NUMERIC,
  resting_hr             NUMERIC,
  resting_hr_baseline_7d NUMERIC,
  rhr_pct_change         NUMERIC,
  sleep_duration_min     NUMERIC,
  deep_sleep_pct         NUMERIC,
  rem_sleep_pct          NUMERIC,
  spo2_avg               NUMERIC,
  steps_24h              NUMERIC,
  active_minutes_24h     NUMERIC,
  readiness_score        NUMERIC,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_recovery_snapshots_date
  ON recovery_snapshots (user_id, date DESC);

ALTER TABLE recovery_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recovery snapshots"
  ON recovery_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Notes:**
- `(user_id, type, recorded_at)` UNIQUE on `biometric_readings` is the dedup mechanism for re-syncs — same reading from Health Connect with the same timestamp upserts as no-op.
- `(user_id, date)` UNIQUE on `recovery_snapshots` is the dedup mechanism for the same-day re-compute (foreground sync re-runs `computeAndStoreRecoverySnapshot`).
- All snapshot physiological fields are nullable — partial data is normal.
- `auth.users` references match other migrations (e.g. existing tables that reference `auth.users(id) ON DELETE CASCADE`).

### 2. Migration: session_logs HR columns (Phase 4)

**File:** `supabase/migrations/20260429000001_add_session_hr_data.sql`

```sql
ALTER TABLE session_logs
  ADD COLUMN hr_samples       JSONB,
  ADD COLUMN avg_hr           NUMERIC,
  ADD COLUMN max_hr           NUMERIC,
  ADD COLUMN hr_recovery_60s  NUMERIC;
```

- All columns nullable — populated only when wearable HR data is captured during the session.
- `hr_samples` shape: `[{ "timestamp_ms": number, "bpm": number }]` (validated by `SessionHrDataSchema`).
- `hr_recovery_60s`: BPM drop in 60s after final working set. Positive = good recovery.
- **Apply this migration only when starting Phase 4 work** — do not bundle with Phase 1.

### 3. Regenerate types

After **each** migration is applied:

- `npm run db:types` from repo root.
- Verify generated `apps/parakeet/supabase/types.ts` contains the new tables / columns.
- Commit the regenerated file alongside the migration.

### 4. Data retention

- `biometric_readings`: retain 90 days. Older readings can be pruned because baselines only use 7 days of data and `recovery_snapshots` preserves the computed values indefinitely.
  ```sql
  -- Run as a Supabase scheduled function; does NOT need to be in the migration
  DELETE FROM biometric_readings
  WHERE created_at < NOW() - INTERVAL '90 days';
  ```
  Schedule via Supabase Dashboard → Database → Scheduled Functions, or defer until storage becomes a concern (single-user app — low priority).

- `recovery_snapshots`: retain indefinitely. One row per user per day; used for cycle review trends.

### 5. Biometric repository

**File:** `apps/parakeet/src/modules/wearable/data/biometric.repository.ts`

```typescript
import { supabase } from '@platform/supabase';
import {
  BiometricReadingSchema,
  type BiometricReading,
  type BiometricReadingInsert,
  type BiometricType,
} from '@parakeet/shared-types';

export async function upsertBiometricReadings(
  userId: string,
  readings: Omit<BiometricReadingInsert, 'user_id'>[]
): Promise<{ insertedCount: number }> {
  if (readings.length === 0) return { insertedCount: 0 };
  const rows = readings.map((r) => ({ ...r, user_id: userId }));
  const { data, error } = await supabase
    .from('biometric_readings')
    .upsert(rows, {
      onConflict: 'user_id,type,recorded_at',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) throw error;
  return { insertedCount: data?.length ?? 0 };
}

export async function fetchReadingsForBaseline(
  userId: string,
  type: BiometricType,
  days: number
): Promise<BiometricReading[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('biometric_readings')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => BiometricReadingSchema.parse(row));
}

export async function fetchLatestReading(
  userId: string,
  type: BiometricType
): Promise<BiometricReading | null> {
  const { data, error } = await supabase
    .from('biometric_readings')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? BiometricReadingSchema.parse(data) : null;
}
```

### 6. Recovery repository

**File:** `apps/parakeet/src/modules/wearable/data/recovery.repository.ts`

```typescript
import { supabase } from '@platform/supabase';
import {
  RecoverySnapshotSchema,
  type RecoverySnapshot,
  type RecoverySnapshotInsert,
} from '@parakeet/shared-types';

export async function upsertRecoverySnapshot(
  userId: string,
  snapshot: Omit<RecoverySnapshotInsert, 'user_id'>
): Promise<RecoverySnapshot> {
  const { data, error } = await supabase
    .from('recovery_snapshots')
    .upsert(
      { ...snapshot, user_id: userId },
      { onConflict: 'user_id,date' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return RecoverySnapshotSchema.parse(data);
}

export async function fetchTodaySnapshot(
  userId: string
): Promise<RecoverySnapshot | null> {
  const today = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD in user TZ assumption
  const { data, error } = await supabase
    .from('recovery_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  if (error) throw error;
  return data ? RecoverySnapshotSchema.parse(data) : null;
}

export async function fetchSnapshotsForRange(
  userId: string,
  startDate: string,        // YYYY-MM-DD
  endDate: string           // YYYY-MM-DD inclusive
): Promise<RecoverySnapshot[]> {
  const { data, error } = await supabase
    .from('recovery_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => RecoverySnapshotSchema.parse(row));
}
```

**Convention notes for executor:**
- Use `supabase` client from `@platform/supabase` (matches existing repo pattern).
- Always `.parse(row)` on read — surface schema drift early. Existing repos do this (see `disruptions.repository.ts`).
- Throw on `error` — caller handles retry / `captureException`.
- `fetchTodaySnapshot` uses local-date string. Document assumption: app treats "today" as device-local. Acceptable for single-user-per-account model.

### 7. Module barrel additions

**File:** `apps/parakeet/src/modules/wearable/data/index.ts` (create)

```typescript
export * from './biometric.repository';
export * from './recovery.repository';
```

(Re-exported from `apps/parakeet/src/modules/wearable/index.ts` per [spec-pipeline.md](./spec-pipeline.md) §Module public API.)

## Validation

- `npx supabase migration up` (or `npm run db:reset`) — both migrations apply cleanly.
- `npm run db:types` — generates types; verify `biometric_readings`, `recovery_snapshots`, and `session_logs.hr_samples` all appear.
- Insert two rows with the same `(user_id, type, recorded_at)` — second is a no-op.
- Insert two `recovery_snapshots` rows for the same `(user_id, date)` — second upserts.
- RLS check: log in as user A, attempt to select user B's reading → empty result.

## Out of Scope

- Sync logic (read from Health Connect, normalise) — see [spec-pipeline.md](./spec-pipeline.md).
- Recovery snapshot computation (baselines, score) — see [spec-pipeline.md](./spec-pipeline.md) + [spec-readiness-adjuster.md](./spec-readiness-adjuster.md).

## Dependencies

- [spec-biometric-types.md](./spec-biometric-types.md) — must land first so repos can `.parse()`.
- [docs/features/infra/spec-supabase.md](../infra/spec-supabase.md) — local Supabase + migration workflow (existing reference).

## Domain References

- [domain/athlete-signals.md](../../domain/athlete-signals.md)
