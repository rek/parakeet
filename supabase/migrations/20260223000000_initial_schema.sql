-- =============================================================================
-- Parakeet — initial schema
-- Weight storage convention: all weight_* columns are INTEGER grams
--   e.g., 140 kg  = 140000 g
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT,
  biological_sex  TEXT CHECK (biological_sex IN ('female', 'male')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- lifter_maxes  (append-only; newest row = current 1RMs)
-- ---------------------------------------------------------------------------
CREATE TABLE lifter_maxes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                TEXT NOT NULL CHECK (source IN ('input_1rm', 'input_3rm', 'system_calculated')),
  squat_1rm_grams       INTEGER NOT NULL,
  bench_1rm_grams       INTEGER NOT NULL,
  deadlift_1rm_grams    INTEGER NOT NULL,
  squat_input_grams     INTEGER,
  squat_input_reps      SMALLINT,
  bench_input_grams     INTEGER,
  bench_input_reps      SMALLINT,
  deadlift_input_grams  INTEGER,
  deadlift_input_reps   SMALLINT
);

ALTER TABLE lifter_maxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON lifter_maxes
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- formula_configs  (versioned; system defaults live in training-engine code)
-- ---------------------------------------------------------------------------
CREATE TABLE formula_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  source       TEXT NOT NULL CHECK (source IN ('user', 'ai_suggestion', 'system')),
  overrides    JSONB NOT NULL DEFAULT '{}',
  ai_rationale TEXT,
  UNIQUE(user_id, version)
);

ALTER TABLE formula_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON formula_configs
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
CREATE TABLE programs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version                INTEGER NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'completed', 'archived')),
  total_weeks            SMALLINT NOT NULL,
  training_days_per_week SMALLINT NOT NULL DEFAULT 3,
  start_date             DATE NOT NULL,
  lifter_maxes_id        UUID REFERENCES lifter_maxes(id),
  formula_config_id      UUID REFERENCES formula_configs(id),
  UNIQUE(user_id, version)
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON programs
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sessions  (planned_sets NULL until JIT runs at workout time)
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id         UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number        SMALLINT NOT NULL,
  day_number         SMALLINT NOT NULL,
  planned_date       DATE,
  primary_lift       TEXT NOT NULL CHECK (primary_lift IN ('squat', 'bench', 'deadlift')),
  intensity_type     TEXT NOT NULL CHECK (intensity_type IN ('heavy', 'explosive', 'rep', 'deload')),
  block_number       SMALLINT CHECK (block_number IN (1, 2, 3)),
  is_deload          BOOLEAN NOT NULL DEFAULT FALSE,
  status             TEXT NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  -- JIT-populated (NULL until user opens the session)
  planned_sets       JSONB,
  jit_generated_at   TIMESTAMPTZ,
  jit_input_snapshot JSONB,  -- audit trail: what data was used for JIT generation
  jit_strategy       TEXT CHECK (jit_strategy IN ('formula', 'llm', 'hybrid', 'formula_fallback')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- session_logs  (append-only completed performance records)
-- ---------------------------------------------------------------------------
CREATE TABLE session_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  duration_seconds     INTEGER,
  -- actual_sets: [{ set_number, weight_grams, reps_completed, rpe_actual, notes }]
  actual_sets          JSONB NOT NULL,
  session_rpe          NUMERIC(3,1),
  session_notes        TEXT,
  is_correction        BOOLEAN NOT NULL DEFAULT FALSE,
  corrects_log_id      UUID REFERENCES session_logs(id),
  completion_pct       NUMERIC(5,2),
  performance_vs_plan  TEXT CHECK (performance_vs_plan IN ('under', 'at', 'over', 'incomplete'))
);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON session_logs
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- soreness_checkins  (pre-workout, recorded per session)
-- ---------------------------------------------------------------------------
CREATE TABLE soreness_checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ratings: { quads: 1, hamstrings: 2, glutes: 1, lower_back: 3, ... }
  ratings     JSONB NOT NULL
);

ALTER TABLE soreness_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON soreness_checkins
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- disruptions  (training disruptions: injury, illness, travel, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE disruptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id            UUID REFERENCES programs(id),
  session_ids_affected  UUID[],
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disruption_type       TEXT NOT NULL CHECK (disruption_type IN (
                          'injury', 'illness', 'travel', 'fatigue',
                          'equipment_unavailable', 'unprogrammed_event', 'other'
                        )),
  severity              TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major')),
  affected_date_start   DATE NOT NULL,
  affected_date_end     DATE,
  affected_lifts        TEXT[],
  description           TEXT,
  adjustment_applied    JSONB,
  resolved_at           TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'resolved', 'monitoring'))
);

ALTER TABLE disruptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON disruptions
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- muscle_volume_config  (user MRV/MEV overrides; defaults in engine constants)
-- ---------------------------------------------------------------------------
CREATE TABLE muscle_volume_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle_group        TEXT NOT NULL CHECK (muscle_group IN (
                        'quads', 'hamstrings', 'glutes', 'lower_back',
                        'upper_back', 'chest', 'triceps', 'shoulders', 'biceps'
                      )),
  mev_sets_per_week   SMALLINT NOT NULL,
  mrv_sets_per_week   SMALLINT NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, muscle_group)
);

ALTER TABLE muscle_volume_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON muscle_volume_config
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- auxiliary_exercises  (exercise pool per lift, user-customizable)
-- ---------------------------------------------------------------------------
CREATE TABLE auxiliary_exercises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lift             TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  exercise_name    TEXT NOT NULL,
  pool_position    INTEGER NOT NULL,  -- order in the rotation pool
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  primary_muscles  TEXT[] NOT NULL,   -- muscle groups this exercise targets
  UNIQUE(user_id, lift, pool_position)
);

ALTER TABLE auxiliary_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON auxiliary_exercises
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- auxiliary_assignments  (which 2 exercises are active per block per lift)
-- ---------------------------------------------------------------------------
CREATE TABLE auxiliary_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id   UUID NOT NULL REFERENCES programs(id),
  block_number SMALLINT NOT NULL CHECK (block_number IN (1, 2, 3)),
  lift         TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  exercise_1   TEXT NOT NULL,
  exercise_2   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id, block_number, lift)
);

ALTER TABLE auxiliary_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON auxiliary_assignments
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- performance_metrics  (computed locally in app, synced to Supabase)
-- ---------------------------------------------------------------------------
CREATE TABLE performance_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_log_id        UUID NOT NULL REFERENCES session_logs(id),
  recorded_at           TIMESTAMPTZ NOT NULL,
  lift                  TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  intensity_type        TEXT NOT NULL,
  block_number          SMALLINT,
  week_number           SMALLINT,
  planned_volume_grams  INTEGER,
  actual_volume_grams   INTEGER,
  planned_intensity_pct NUMERIC(5,3),
  actual_intensity_pct  NUMERIC(5,3),
  max_rpe_actual        NUMERIC(3,1),
  avg_rpe_actual        NUMERIC(3,1),
  completion_pct        NUMERIC(5,2),
  estimated_1rm_grams   INTEGER,
  -- sets per muscle group this session (for weekly volume tracking)
  sets_per_muscle       JSONB  -- { quads: 2, glutes: 2, hamstrings: 1 }
);

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON performance_metrics
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- warmup_configs  (protocol per lift; falls back to 'standard' if no row)
-- ---------------------------------------------------------------------------
CREATE TABLE warmup_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lift         TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  protocol     TEXT NOT NULL DEFAULT 'standard'
                 CHECK (protocol IN ('standard', 'minimal', 'extended', 'empty_bar', 'custom')),
  custom_steps JSONB,  -- [{ pct: number, reps: number }] only when protocol = 'custom'
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lift)
);

ALTER TABLE warmup_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON warmup_configs
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recovery_snapshots  (stub for future wearable/HRV integration)
-- ---------------------------------------------------------------------------
CREATE TABLE recovery_snapshots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at            TIMESTAMPTZ NOT NULL,
  source                 TEXT NOT NULL,
  sleep_duration_minutes INTEGER,
  sleep_quality_score    NUMERIC(4,1),
  hrv_ms                 NUMERIC(6,2),
  resting_hr_bpm         SMALLINT,
  raw_payload            JSONB
);

ALTER TABLE recovery_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON recovery_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- cycle_reviews  (AI-generated end-of-cycle analysis, one per program)
-- ---------------------------------------------------------------------------
CREATE TABLE cycle_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  compiled_report  JSONB NOT NULL,  -- CycleReport struct
  llm_response     JSONB NOT NULL,  -- CycleReview struct
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE cycle_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON cycle_reviews
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- developer_suggestions  (AI structural suggestions surfaced to the developer)
-- ---------------------------------------------------------------------------
CREATE TABLE developer_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id      UUID REFERENCES programs(id),
  description     TEXT NOT NULL,
  rationale       TEXT NOT NULL,
  developer_note  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_reviewed     BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE developer_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON developer_suggestions
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX idx_lifter_maxes_user_time       ON lifter_maxes(user_id, recorded_at DESC);
CREATE INDEX idx_sessions_user_date           ON sessions(user_id, planned_date);
CREATE INDEX idx_sessions_program_week        ON sessions(program_id, week_number);
CREATE INDEX idx_session_logs_user_time       ON session_logs(user_id, logged_at DESC);
CREATE INDEX idx_soreness_session             ON soreness_checkins(session_id);
CREATE INDEX idx_perf_metrics_user_lift_time  ON performance_metrics(user_id, lift, recorded_at DESC);
CREATE INDEX idx_auxiliary_assignments_block  ON auxiliary_assignments(user_id, program_id, block_number);
CREATE INDEX idx_warmup_configs_user          ON warmup_configs(user_id);
CREATE INDEX idx_cycle_reviews_user           ON cycle_reviews(user_id, generated_at DESC);
CREATE INDEX idx_developer_suggestions_user   ON developer_suggestions(user_id, created_at DESC);
