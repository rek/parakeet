# Spec: Biometric Zod Schemas

**Status**: Planned
**Domain**: Types

## What This Covers

Zod schemas and inferred TypeScript types for wearable biometric data: raw readings from Health Connect and computed daily recovery snapshots. These schemas are used for Supabase row validation, JIT input enrichment, and Health Connect data normalization.

## Tasks

### Biometric schema module

**`packages/shared-types/src/modules/biometric.schema.ts`:**

- [ ] `BiometricTypeSchema` — `z.enum([ 'hrv_rmssd', 'resting_hr', 'sleep_duration', 'deep_sleep_pct', 'rem_sleep_pct', 'spo2', 'steps', 'active_minutes' ])`

- [ ] `BiometricReadingSchema` — row schema for `biometric_readings` table:
  - `id`: `z.string().uuid()`
  - `user_id`: `z.string().uuid()`
  - `type`: `BiometricTypeSchema`
  - `value`: `z.number()`
  - `recorded_at`: `z.string().datetime()`
  - `source`: `z.string()` — device name or `'health_connect'`
  - `created_at`: `z.string().datetime()`

- [ ] `RecoverySnapshotSchema` — row schema for `recovery_snapshots` table:
  - `id`: `z.string().uuid()`
  - `user_id`: `z.string().uuid()`
  - `date`: `z.string()` — `YYYY-MM-DD`
  - `hrv_rmssd`: `z.number().nullable()`
  - `hrv_baseline_7d`: `z.number().nullable()`
  - `hrv_pct_change`: `z.number().nullable()`
  - `resting_hr`: `z.number().nullable()`
  - `resting_hr_baseline_7d`: `z.number().nullable()`
  - `rhr_pct_change`: `z.number().nullable()`
  - `sleep_duration_min`: `z.number().nullable()`
  - `deep_sleep_pct`: `z.number().min(0).max(100).nullable()`
  - `rem_sleep_pct`: `z.number().min(0).max(100).nullable()`
  - `spo2_avg`: `z.number().min(0).max(100).nullable()`
  - `steps_24h`: `z.number().nullable()`
  - `active_minutes_24h`: `z.number().nullable()`
  - `readiness_score`: `z.number().min(0).max(100).nullable()`
  - `created_at`: `z.string().datetime()`

- [ ] `HrSampleSchema` — single HR sample for intra-session data:
  - `timestamp_ms`: `z.number()`
  - `bpm`: `z.number().min(30).max(250)`

- [ ] `SessionHrDataSchema` — HR summary stored on session_logs:
  - `hr_samples`: `z.array(HrSampleSchema)`
  - `avg_hr`: `z.number().nullable()`
  - `max_hr`: `z.number().nullable()`
  - `hr_recovery_60s`: `z.number().nullable()` — BPM drop in 60s post-last-set

- [ ] Infer and export TypeScript types from all schemas:
  - `BiometricType`, `BiometricReading`, `RecoverySnapshot`, `HrSample`, `SessionHrData`

### Export from shared-types index

**`packages/shared-types/src/index.ts`:**

- [ ] Add `export * from './modules/biometric'`

### Regenerate Supabase types

After data-008 migration is applied:

- [ ] Run `npm run db:types` to regenerate `supabase/types.ts`
- [ ] Verify new table types appear in generated output

## Dependencies

- [types-001-zod-schemas.md](./types-001-zod-schemas.md) — follows existing schema patterns
- [data-008-biometric-tables.md](../05-data/data-008-biometric-tables.md) — table schemas must align
