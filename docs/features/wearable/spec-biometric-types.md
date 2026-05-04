# Spec: Biometric Zod Schemas

**Status**: Planned
**Domain**: Types
**Phase**: 1 (Data Pipeline)
**Owner**: any executor agent

## What This Covers

Zod schemas + inferred TypeScript types for wearable biometric data: raw readings from Health Connect, daily computed recovery snapshots, and intra-session HR samples. Used for Supabase row validation, JIT input typing, Health Connect normalisation, and session log writes.

These types live in the shared `@parakeet/shared-types` package so the training engine, app module, and any future package can consume them without circular dependencies.

## Prerequisites

- None. This spec is the entry point for Phase 1 — schemas come before everything else so the migration ([spec-biometric-data.md](./spec-biometric-data.md)) and module code ([spec-pipeline.md](./spec-pipeline.md)) can reference the types.
- Repo pattern reference: existing `packages/shared-types/src/disruption.schema.ts` + `packages/shared-types/src/modules/disruption/index.ts` is the canonical pattern.

## Tasks

### 1. Create `biometric.schema.ts`

**File:** `packages/shared-types/src/biometric.schema.ts`

```typescript
import { z } from 'zod';

// ── Raw readings ──────────────────────────────────────────────────────────────

export const BiometricTypeSchema = z.enum([
  'hrv_rmssd',
  'resting_hr',
  'sleep_duration',
  'deep_sleep_pct',
  'rem_sleep_pct',
  'spo2',
  'steps',
  'active_minutes',
]);

export type BiometricType = z.infer<typeof BiometricTypeSchema>;

export const BiometricReadingSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  type: BiometricTypeSchema,
  value: z.number(),
  recorded_at: z.iso.datetime(),
  source: z.string(),                  // device name or 'health_connect'
  created_at: z.iso.datetime(),
});

export type BiometricReading = z.infer<typeof BiometricReadingSchema>;

/** Insert shape — id + created_at supplied by DB. */
export const BiometricReadingInsertSchema = BiometricReadingSchema.omit({
  id: true,
  created_at: true,
});

export type BiometricReadingInsert = z.infer<typeof BiometricReadingInsertSchema>;

// ── Daily recovery snapshot ───────────────────────────────────────────────────

export const RecoverySnapshotSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  date: z.iso.date(),                                // YYYY-MM-DD
  hrv_rmssd: z.number().nullable(),
  hrv_baseline_7d: z.number().nullable(),
  hrv_pct_change: z.number().nullable(),
  resting_hr: z.number().nullable(),
  resting_hr_baseline_7d: z.number().nullable(),
  rhr_pct_change: z.number().nullable(),
  sleep_duration_min: z.number().nullable(),
  deep_sleep_pct: z.number().min(0).max(100).nullable(),
  rem_sleep_pct: z.number().min(0).max(100).nullable(),
  spo2_avg: z.number().min(0).max(100).nullable(),
  steps_24h: z.number().nullable(),
  active_minutes_24h: z.number().nullable(),
  readiness_score: z.number().min(0).max(100).nullable(),
  created_at: z.iso.datetime(),
});

export type RecoverySnapshot = z.infer<typeof RecoverySnapshotSchema>;

export const RecoverySnapshotInsertSchema = RecoverySnapshotSchema.omit({
  id: true,
  created_at: true,
});

export type RecoverySnapshotInsert = z.infer<typeof RecoverySnapshotInsertSchema>;

// ── Intra-session HR (Phase 4) ────────────────────────────────────────────────

export const HrSampleSchema = z.object({
  timestamp_ms: z.number().int().nonnegative(),
  bpm: z.number().min(30).max(250),
});

export type HrSample = z.infer<typeof HrSampleSchema>;

export const SessionHrDataSchema = z.object({
  hr_samples: z.array(HrSampleSchema),
  avg_hr: z.number().nullable(),
  max_hr: z.number().nullable(),
  hr_recovery_60s: z.number().nullable(),  // BPM drop in first 60s post-final-set
});

export type SessionHrData = z.infer<typeof SessionHrDataSchema>;
```

**Notes for executor:**
- Use `z.iso.datetime()` and `z.iso.date()` (existing project convention — see `disruption.schema.ts`).
- Use `z.uuid()` shorthand (existing convention).
- Do NOT add `.strict()` — match existing schema convention (allow Supabase to add columns without breaking parses).
- All snapshot numeric fields are `.nullable()` because partial data is the norm: a user may wear a tracker but skip sleep tracking, etc.

### 2. Create the module barrel

**File:** `packages/shared-types/src/modules/biometric/index.ts`

```typescript
export * from '../../biometric.schema';
```

This matches the pattern of every other module in `packages/shared-types/src/modules/*/index.ts` (verified against `disruption/index.ts`).

### 3. Wire the module into the package root

**File:** `packages/shared-types/src/index.ts`

Add a single line in the existing `export * from './modules/...'` block (alphabetical ordering not enforced — match neighbors):

```typescript
export * from './modules/biometric';
```

### 4. Regenerate Supabase types (deferred)

After [spec-biometric-data.md](./spec-biometric-data.md) migration is applied:

- Run `npm run db:types` from repo root.
- Verify `apps/parakeet/supabase/types.ts` (or wherever `db:types` writes) now contains `biometric_readings` and `recovery_snapshots` table definitions.
- Do NOT hand-edit the generated file.

This step belongs in the data spec but is restated here because it's the only thing required from this spec to "complete" once the migration lands.

## Validation

- `npx tsc -p packages/shared-types --noEmit` — no errors.
- `import { BiometricReading, RecoverySnapshot, HrSample } from '@parakeet/shared-types'` resolves in both `apps/parakeet` and `packages/training-engine`.
- `BiometricReadingSchema.parse({...})` accepts a sample reading; rejects an unknown `type`.
- `RecoverySnapshotSchema.parse({...})` accepts a row with all-null physiological fields (a user with permission but no sleep that night).

## Out of Scope

- Database migration — see [spec-biometric-data.md](./spec-biometric-data.md).
- Engine `JITInput` extension — see [spec-readiness-adjuster.md](./spec-readiness-adjuster.md).
- App-side codecs / repository CRUD — see [spec-pipeline.md](./spec-pipeline.md).

## Dependencies

- None upstream. This spec is the root of the wearable type graph.
- Downstream: every other wearable spec imports from `@parakeet/shared-types`.

## Domain References

- [domain/athlete-signals.md](../../domain/athlete-signals.md) — signal catalog (HRV, RHR, sleep stages)
- [guide/code-style.md](../../guide/code-style.md) — Zod conventions
