# Spec: Database Migrations (Supabase)

**Status**: Implemented
**Domain**: Infrastructure

## What This Covers

Supabase migration files for the full schema. All weights stored as integer grams. New tables for MRV/MEV, soreness, auxiliaries, cycle reviews, and developer suggestions compared to v1. `edge_cases` renamed to `disruptions`.

## Tasks

**Migration tooling:**
- [x] Migrations live at `supabase/migrations/` (managed by Supabase CLI)
- [x] Create new migration: `supabase migration new <name>`
- [x] Apply locally: `supabase db reset`
- [x] Apply to prod: `supabase db push --db-url $PROD_DB_URL`
- [x] Generate TypeScript types: `npm run db:types` (after `npm run db:start`)

**`20260223000000_initial_schema.sql` — all 16 tables:**

```sql
-- Weight storage: all weight_* columns are INTEGER grams (e.g., 140kg = 140000)

-- Extend Supabase auth.users
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   TEXT,
  biological_sex TEXT CHECK (biological_sex IN ('female', 'male')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1RM snapshots (append-only, newest = current)
CREATE TABLE lifter_maxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('input_1rm', 'input_3rm', 'mixed', 'system_calculated')),
  squat_1rm_grams INTEGER NOT NULL,
  bench_1rm_grams INTEGER NOT NULL,
  deadlift_1rm_grams INTEGER NOT NULL,
  squat_input_grams INTEGER,
  squat_input_reps SMALLINT,
  bench_input_grams INTEGER,
  bench_input_reps SMALLINT,
  deadlift_input_grams INTEGER,
  deadlift_input_reps SMALLINT
);

-- Formula overrides (versioned; system defaults live in training-engine code)
CREATE TABLE formula_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL CHECK (source IN ('user', 'ai_suggestion', 'system')),
  overrides JSONB NOT NULL DEFAULT '{}',
  ai_rationale TEXT,
  UNIQUE(user_id, version)
);

-- Program structure (NO planned_sets — those are JIT-generated)
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  total_weeks SMALLINT NOT NULL,
  training_days_per_week SMALLINT NOT NULL DEFAULT 3,
  start_date DATE NOT NULL,
  lifter_maxes_id UUID NOT NULL REFERENCES lifter_maxes(id),
  formula_config_id UUID NOT NULL REFERENCES formula_configs(id),
  UNIQUE(user_id, version)
);

-- Session placeholders (planned_sets NULL until JIT runs)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number SMALLINT NOT NULL,
  day_number SMALLINT NOT NULL,
  planned_date DATE,
  primary_lift TEXT NOT NULL CHECK (primary_lift IN ('squat', 'bench', 'deadlift')),
  intensity_type TEXT NOT NULL CHECK (intensity_type IN ('heavy', 'explosive', 'rep', 'deload')),
  block_number SMALLINT CHECK (block_number IN (1, 2, 3)),
  is_deload BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  -- JIT-populated fields (NULL until user opens session)
  planned_sets JSONB,
  jit_generated_at TIMESTAMPTZ,
  jit_input_snapshot JSONB,   -- records what data was used for JIT (audit trail)
  jit_strategy TEXT CHECK (jit_strategy IN ('formula', 'llm', 'hybrid', 'formula_fallback')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completed performance (append-only)
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  -- actual_sets: [{ set_number, weight_grams, reps_completed, rpe_actual, notes }]
  actual_sets JSONB NOT NULL,
  session_rpe NUMERIC(3,1),
  session_notes TEXT,
  is_correction BOOLEAN NOT NULL DEFAULT FALSE,
  corrects_log_id UUID REFERENCES session_logs(id),
  completion_pct NUMERIC(5,2),
  performance_vs_plan TEXT CHECK (performance_vs_plan IN ('under', 'at', 'over', 'incomplete'))
);

-- Pre-workout soreness (recorded per session, per muscle group)
CREATE TABLE soreness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ratings: { quads: 1, hamstrings: 2, glutes: 1, lower_back: 3, ... }
  ratings JSONB NOT NULL
);

-- Disruption events (injury, illness, travel, etc.)
-- Note: was named edge_cases in earlier drafts
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

-- User's MRV/MEV per muscle group (defaults come from training-engine constants)
CREATE TABLE muscle_volume_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN (
    'quads', 'hamstrings', 'glutes', 'lower_back',
    'upper_back', 'chest', 'triceps', 'shoulders', 'biceps'
  )),
  mev_sets_per_week SMALLINT NOT NULL,
  mrv_sets_per_week SMALLINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, muscle_group)
);

-- Exercise pool per lift (user-customizable)
CREATE TABLE auxiliary_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lift TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  exercise_name TEXT NOT NULL,
  pool_position INTEGER NOT NULL,  -- order in the rotation pool
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  primary_muscles TEXT[] NOT NULL,  -- muscle groups this exercise targets
  UNIQUE(user_id, lift, pool_position)
);

-- Active auxiliary assignments per block (which 2 exercises are in use)
CREATE TABLE auxiliary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id),
  block_number SMALLINT NOT NULL CHECK (block_number IN (1, 2, 3)),
  lift TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  exercise_1 TEXT NOT NULL,
  exercise_2 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id, block_number, lift)
);

-- Performance time-series (computed locally, synced to Supabase)
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_log_id UUID NOT NULL REFERENCES session_logs(id),
  recorded_at TIMESTAMPTZ NOT NULL,
  lift TEXT NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  intensity_type TEXT NOT NULL,
  block_number SMALLINT,
  week_number SMALLINT,
  planned_volume_grams INTEGER,
  actual_volume_grams INTEGER,
  planned_intensity_pct NUMERIC(5,3),
  actual_intensity_pct NUMERIC(5,3),
  max_rpe_actual NUMERIC(3,1),
  avg_rpe_actual NUMERIC(3,1),
  completion_pct NUMERIC(5,2),
  estimated_1rm_grams INTEGER,
  -- Sets per muscle group this session (for weekly volume tracking)
  sets_per_muscle JSONB  -- { quads: 2, glutes: 2, hamstrings: 1 }
);

-- Warmup protocol per lift (defaults to 'standard' if no row)
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

-- Future recovery data (stub)
CREATE TABLE recovery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  sleep_duration_minutes INTEGER,
  sleep_quality_score NUMERIC(4,1),
  hrv_ms NUMERIC(6,2),
  resting_hr_bpm SMALLINT,
  raw_payload JSONB
);

-- AI-generated end-of-cycle analysis (one per program)
CREATE TABLE cycle_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  compiled_report  JSONB NOT NULL,  -- CycleReport struct
  llm_response     JSONB NOT NULL,  -- CycleReview struct
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

-- AI structural suggestions surfaced to the developer
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
```

**RLS policies (apply to every user table — see infra-003-supabase-setup.md).**

**Indexes:**
```sql
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
```

## Table Summary (16 total)

| Table | Notes |
|-------|-------|
| `profiles` | `biological_sex` column added |
| `lifter_maxes` | Append-only 1RM snapshots |
| `formula_configs` | Versioned formula overrides |
| `programs` | Structural scaffold, no sets |
| `sessions` | `jit_strategy` column added |
| `session_logs` | Append-only completed sets |
| `soreness_checkins` | Pre-workout per-muscle ratings |
| `disruptions` | Renamed from `edge_cases`; `session_ids_affected UUID[]`; `disruption_type` with `unprogrammed_event` |
| `muscle_volume_config` | MRV/MEV user overrides |
| `auxiliary_exercises` | Exercise pool per lift |
| `auxiliary_assignments` | Active 2 exercises per block |
| `performance_metrics` | Computed locally, synced |
| `warmup_configs` | Protocol per lift |
| `recovery_snapshots` | HRV/sleep stub |
| `cycle_reviews` | AI end-of-cycle review, one per program |
| `developer_suggestions` | AI structural suggestions for developer |

## Dependencies

- [infra-003-supabase-setup.md](./infra-003-supabase-setup.md)
