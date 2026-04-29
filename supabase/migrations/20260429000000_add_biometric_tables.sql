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
-- Drop old schema (created by squash migration with different columns).
-- Legacy columns (hrv_ms, sleep_quality_score, resting_hr_bpm, raw_payload) had
-- no app code beyond the generic reset.repository.ts table name list.

DROP TABLE IF EXISTS recovery_snapshots;

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
