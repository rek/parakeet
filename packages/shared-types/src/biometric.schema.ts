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
  source: z.string(),
  created_at: z.iso.datetime(),
});

export type BiometricReading = z.infer<typeof BiometricReadingSchema>;

export const BiometricReadingInsertSchema = BiometricReadingSchema.omit({
  id: true,
  created_at: true,
});

export type BiometricReadingInsert = z.infer<typeof BiometricReadingInsertSchema>;

// ── Daily recovery snapshot ───────────────────────────────────────────────────

export const RecoverySnapshotSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  date: z.iso.date(),
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
  hr_recovery_60s: z.number().nullable(),
});

export type SessionHrData = z.infer<typeof SessionHrDataSchema>;
