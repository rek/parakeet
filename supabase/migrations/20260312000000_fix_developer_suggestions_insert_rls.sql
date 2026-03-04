


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auxiliary_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "block_number" smallint NOT NULL,
    "lift" "text" NOT NULL,
    "exercise_1" "text" NOT NULL,
    "exercise_2" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auxiliary_assignments_block_number_check" CHECK (("block_number" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "auxiliary_assignments_lift_check" CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"])))
);


ALTER TABLE "public"."auxiliary_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auxiliary_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lift" "text" NOT NULL,
    "exercise_name" "text" NOT NULL,
    "pool_position" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "primary_muscles" "text"[] NOT NULL,
    CONSTRAINT "auxiliary_exercises_lift_check" CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"])))
);


ALTER TABLE "public"."auxiliary_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "compiled_report" "jsonb" NOT NULL,
    "llm_response" "jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cycle_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT false NOT NULL,
    "cycle_length_days" integer DEFAULT 28 NOT NULL,
    "last_period_start" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cycle_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."developer_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "program_id" "uuid",
    "description" "text" NOT NULL,
    "rationale" "text" NOT NULL,
    "developer_note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_reviewed" boolean DEFAULT false NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'unreviewed'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "developer_suggestions_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "developer_suggestions_status_check" CHECK (("status" = ANY (ARRAY['unreviewed'::"text", 'acknowledged'::"text", 'implemented'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."developer_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disruptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "program_id" "uuid",
    "session_ids_affected" "uuid"[],
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disruption_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "affected_date_start" "date" NOT NULL,
    "affected_date_end" "date",
    "affected_lifts" "text"[],
    "description" "text",
    "adjustment_applied" "jsonb",
    "resolved_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "disruptions_disruption_type_check" CHECK (("disruption_type" = ANY (ARRAY['injury'::"text", 'illness'::"text", 'travel'::"text", 'fatigue'::"text", 'equipment_unavailable'::"text", 'unprogrammed_event'::"text", 'other'::"text"]))),
    CONSTRAINT "disruptions_severity_check" CHECK (("severity" = ANY (ARRAY['minor'::"text", 'moderate'::"text", 'major'::"text"]))),
    CONSTRAINT "disruptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'resolved'::"text", 'monitoring'::"text"])))
);


ALTER TABLE "public"."disruptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formula_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "source" "text" NOT NULL,
    "overrides" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_rationale" "text",
    CONSTRAINT "formula_configs_source_check" CHECK (("source" = ANY (ARRAY['user'::"text", 'ai_suggestion'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."formula_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jit_comparison_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "jit_input" "jsonb" NOT NULL,
    "formula_output" "jsonb" NOT NULL,
    "llm_output" "jsonb" NOT NULL,
    "divergence" "jsonb" NOT NULL,
    "strategy_used" "text" NOT NULL
);


ALTER TABLE "public"."jit_comparison_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifter_maxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" NOT NULL,
    "squat_1rm_grams" integer NOT NULL,
    "bench_1rm_grams" integer NOT NULL,
    "deadlift_1rm_grams" integer NOT NULL,
    "squat_input_grams" integer,
    "squat_input_reps" smallint,
    "bench_input_grams" integer,
    "bench_input_reps" smallint,
    "deadlift_input_grams" integer,
    "deadlift_input_reps" smallint,
    CONSTRAINT "lifter_maxes_source_check" CHECK (("source" = ANY (ARRAY['input_1rm'::"text", 'input_3rm'::"text", 'mixed'::"text", 'system_calculated'::"text"])))
);


ALTER TABLE "public"."lifter_maxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muscle_volume_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "muscle_group" "text" NOT NULL,
    "mev_sets_per_week" smallint NOT NULL,
    "mrv_sets_per_week" smallint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "muscle_volume_config_muscle_group_check" CHECK (("muscle_group" = ANY (ARRAY['quads'::"text", 'hamstrings'::"text", 'glutes'::"text", 'lower_back'::"text", 'upper_back'::"text", 'chest'::"text", 'triceps'::"text", 'shoulders'::"text", 'biceps'::"text"])))
);


ALTER TABLE "public"."muscle_volume_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_log_id" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL,
    "lift" "text" NOT NULL,
    "intensity_type" "text" NOT NULL,
    "block_number" smallint,
    "week_number" smallint,
    "planned_volume_grams" integer,
    "actual_volume_grams" integer,
    "planned_intensity_pct" numeric(5,3),
    "actual_intensity_pct" numeric(5,3),
    "max_rpe_actual" numeric(3,1),
    "avg_rpe_actual" numeric(3,1),
    "completion_pct" numeric(5,2),
    "estimated_1rm_grams" integer,
    "sets_per_muscle" "jsonb",
    CONSTRAINT "performance_metrics_lift_check" CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"])))
);


ALTER TABLE "public"."performance_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."period_starts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."period_starts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lift" "text" NOT NULL,
    "pr_type" "text" NOT NULL,
    "value" numeric NOT NULL,
    "weight_kg" numeric,
    "session_id" "uuid",
    "achieved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "personal_records_lift_check" CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"]))),
    CONSTRAINT "personal_records_pr_type_check" CHECK (("pr_type" = ANY (ARRAY['estimated_1rm'::"text", 'volume'::"text", 'rep_at_weight'::"text"])))
);


ALTER TABLE "public"."personal_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "biological_sex" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date_of_birth" "date",
    "bodyweight_kg" numeric(5,2),
    CONSTRAINT "profiles_biological_sex_check" CHECK (("biological_sex" = ANY (ARRAY['female'::"text", 'male'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "total_weeks" smallint NOT NULL,
    "training_days_per_week" smallint DEFAULT 3 NOT NULL,
    "start_date" "date" NOT NULL,
    "lifter_maxes_id" "uuid",
    "formula_config_id" "uuid",
    CONSTRAINT "programs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recovery_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL,
    "source" "text" NOT NULL,
    "sleep_duration_minutes" integer,
    "sleep_quality_score" numeric(4,1),
    "hrv_ms" numeric(6,2),
    "resting_hr_bpm" smallint,
    "raw_payload" "jsonb"
);


ALTER TABLE "public"."recovery_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rest_configs" (
    "user_id" "uuid" NOT NULL,
    "lift" "text",
    "intensity_type" "text",
    "rest_seconds" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rest_configs_intensity_type_check" CHECK (("intensity_type" = ANY (ARRAY['heavy'::"text", 'explosive'::"text", 'rep'::"text", 'deload'::"text"]))),
    CONSTRAINT "rest_configs_lift_check" CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"]))),
    CONSTRAINT "rest_configs_rest_seconds_check" CHECK ((("rest_seconds" >= 30) AND ("rest_seconds" <= 600)))
);


ALTER TABLE "public"."rest_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "duration_seconds" integer,
    "actual_sets" "jsonb" NOT NULL,
    "session_rpe" numeric(3,1),
    "session_notes" "text",
    "is_correction" boolean DEFAULT false NOT NULL,
    "corrects_log_id" "uuid",
    "completion_pct" numeric(5,2),
    "performance_vs_plan" "text",
    "cycle_phase" "text",
    "auxiliary_sets" "jsonb",
    CONSTRAINT "session_logs_cycle_phase_check" CHECK (("cycle_phase" = ANY (ARRAY['menstrual'::"text", 'follicular'::"text", 'ovulatory'::"text", 'luteal'::"text", 'late_luteal'::"text"]))),
    CONSTRAINT "session_logs_performance_vs_plan_check" CHECK (("performance_vs_plan" = ANY (ARRAY['under'::"text", 'at'::"text", 'over'::"text", 'incomplete'::"text"])))
);


ALTER TABLE "public"."session_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_number" smallint NOT NULL,
    "day_number" smallint NOT NULL,
    "planned_date" "date",
    "primary_lift" "text" NOT NULL,
    "intensity_type" "text" NOT NULL,
    "block_number" smallint,
    "is_deload" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "planned_sets" "jsonb",
    "jit_generated_at" timestamp with time zone,
    "jit_input_snapshot" "jsonb",
    "jit_strategy" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "sessions_block_number_check" CHECK (("block_number" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "sessions_intensity_type_check" CHECK (("intensity_type" = ANY (ARRAY['heavy'::"text", 'explosive'::"text", 'rep'::"text", 'deload'::"text"]))),
    CONSTRAINT "sessions_jit_strategy_check" CHECK (("jit_strategy" = ANY (ARRAY['formula'::"text", 'llm'::"text", 'hybrid'::"text", 'formula_fallback'::"text"]))),
    CONSTRAINT "sessions_primary_lift_check" CHECK (("primary_lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"]))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'completed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."soreness_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ratings" "jsonb" NOT NULL,
    "skipped" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."soreness_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warmup_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lift" "text" NOT NULL,
    "protocol" "text" DEFAULT 'standard'::"text" NOT NULL,
    "custom_steps" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "warmup_configs_lift_check" CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text"]))),
    CONSTRAINT "warmup_configs_protocol_check" CHECK (("protocol" = ANY (ARRAY['standard'::"text", 'minimal'::"text", 'extended'::"text", 'empty_bar'::"text", 'custom'::"text", 'standard_female'::"text"])))
);


ALTER TABLE "public"."warmup_configs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auxiliary_assignments"
    ADD CONSTRAINT "auxiliary_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auxiliary_assignments"
    ADD CONSTRAINT "auxiliary_assignments_user_id_program_id_block_number_lift_key" UNIQUE ("user_id", "program_id", "block_number", "lift");



ALTER TABLE ONLY "public"."auxiliary_exercises"
    ADD CONSTRAINT "auxiliary_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auxiliary_exercises"
    ADD CONSTRAINT "auxiliary_exercises_user_id_lift_pool_position_key" UNIQUE ("user_id", "lift", "pool_position");



ALTER TABLE ONLY "public"."cycle_reviews"
    ADD CONSTRAINT "cycle_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_reviews"
    ADD CONSTRAINT "cycle_reviews_user_id_program_id_key" UNIQUE ("user_id", "program_id");



ALTER TABLE ONLY "public"."cycle_tracking"
    ADD CONSTRAINT "cycle_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_tracking"
    ADD CONSTRAINT "cycle_tracking_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."developer_suggestions"
    ADD CONSTRAINT "developer_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disruptions"
    ADD CONSTRAINT "disruptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formula_configs"
    ADD CONSTRAINT "formula_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formula_configs"
    ADD CONSTRAINT "formula_configs_user_id_version_key" UNIQUE ("user_id", "version");



ALTER TABLE ONLY "public"."jit_comparison_logs"
    ADD CONSTRAINT "jit_comparison_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lifter_maxes"
    ADD CONSTRAINT "lifter_maxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muscle_volume_config"
    ADD CONSTRAINT "muscle_volume_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muscle_volume_config"
    ADD CONSTRAINT "muscle_volume_config_user_id_muscle_group_key" UNIQUE ("user_id", "muscle_group");



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."period_starts"
    ADD CONSTRAINT "period_starts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_user_id_version_key" UNIQUE ("user_id", "version");



ALTER TABLE ONLY "public"."recovery_snapshots"
    ADD CONSTRAINT "recovery_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."soreness_checkins"
    ADD CONSTRAINT "soreness_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warmup_configs"
    ADD CONSTRAINT "warmup_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warmup_configs"
    ADD CONSTRAINT "warmup_configs_user_id_lift_key" UNIQUE ("user_id", "lift");



CREATE INDEX "idx_auxiliary_assignments_block" ON "public"."auxiliary_assignments" USING "btree" ("user_id", "program_id", "block_number");



CREATE INDEX "idx_cycle_reviews_user" ON "public"."cycle_reviews" USING "btree" ("user_id", "generated_at" DESC);



CREATE INDEX "idx_developer_suggestions_user" ON "public"."developer_suggestions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_lifter_maxes_user_time" ON "public"."lifter_maxes" USING "btree" ("user_id", "recorded_at" DESC);



CREATE INDEX "idx_perf_metrics_user_lift_time" ON "public"."performance_metrics" USING "btree" ("user_id", "lift", "recorded_at" DESC);



CREATE INDEX "idx_session_logs_user_time" ON "public"."session_logs" USING "btree" ("user_id", "logged_at" DESC);



CREATE INDEX "idx_sessions_program_week" ON "public"."sessions" USING "btree" ("program_id", "week_number");



CREATE INDEX "idx_sessions_user_date" ON "public"."sessions" USING "btree" ("user_id", "planned_date");



CREATE INDEX "idx_soreness_session" ON "public"."soreness_checkins" USING "btree" ("session_id");



CREATE INDEX "idx_warmup_configs_user" ON "public"."warmup_configs" USING "btree" ("user_id");



CREATE INDEX "jit_comparison_logs_created_at_idx" ON "public"."jit_comparison_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "jit_comparison_logs_user_id_idx" ON "public"."jit_comparison_logs" USING "btree" ("user_id");



CREATE UNIQUE INDEX "period_starts_user_date_uniq" ON "public"."period_starts" USING "btree" ("user_id", "start_date");



CREATE UNIQUE INDEX "pr_unique" ON "public"."personal_records" USING "btree" ("user_id", "lift", "pr_type", "weight_kg") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "rest_configs_unique" ON "public"."rest_configs" USING "btree" ("user_id", COALESCE("lift", '__all__'::"text"), COALESCE("intensity_type", '__all__'::"text"));



ALTER TABLE ONLY "public"."auxiliary_assignments"
    ADD CONSTRAINT "auxiliary_assignments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id");



ALTER TABLE ONLY "public"."auxiliary_assignments"
    ADD CONSTRAINT "auxiliary_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auxiliary_exercises"
    ADD CONSTRAINT "auxiliary_exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_reviews"
    ADD CONSTRAINT "cycle_reviews_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_reviews"
    ADD CONSTRAINT "cycle_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_tracking"
    ADD CONSTRAINT "cycle_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."developer_suggestions"
    ADD CONSTRAINT "developer_suggestions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id");



ALTER TABLE ONLY "public"."developer_suggestions"
    ADD CONSTRAINT "developer_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."disruptions"
    ADD CONSTRAINT "disruptions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id");



ALTER TABLE ONLY "public"."disruptions"
    ADD CONSTRAINT "disruptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."formula_configs"
    ADD CONSTRAINT "formula_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jit_comparison_logs"
    ADD CONSTRAINT "jit_comparison_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."jit_comparison_logs"
    ADD CONSTRAINT "jit_comparison_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lifter_maxes"
    ADD CONSTRAINT "lifter_maxes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muscle_volume_config"
    ADD CONSTRAINT "muscle_volume_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_session_log_id_fkey" FOREIGN KEY ("session_log_id") REFERENCES "public"."session_logs"("id");



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_starts"
    ADD CONSTRAINT "period_starts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_formula_config_id_fkey" FOREIGN KEY ("formula_config_id") REFERENCES "public"."formula_configs"("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_lifter_maxes_id_fkey" FOREIGN KEY ("lifter_maxes_id") REFERENCES "public"."lifter_maxes"("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recovery_snapshots"
    ADD CONSTRAINT "recovery_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rest_configs"
    ADD CONSTRAINT "rest_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_corrects_log_id_fkey" FOREIGN KEY ("corrects_log_id") REFERENCES "public"."session_logs"("id");



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soreness_checkins"
    ADD CONSTRAINT "soreness_checkins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soreness_checkins"
    ADD CONSTRAINT "soreness_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warmup_configs"
    ADD CONSTRAINT "warmup_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users manage own cycle config" ON "public"."cycle_tracking" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "authenticated users can read developer suggestions" ON "public"."developer_suggestions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "authenticated users update developer suggestions" ON "public"."developer_suggestions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



ALTER TABLE "public"."auxiliary_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auxiliary_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."developer_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disruptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."formula_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jit_comparison_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifter_maxes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muscle_volume_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."period_starts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recovery_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rest_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."soreness_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users manage own personal records" ON "public"."personal_records" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users manage own rest configs" ON "public"."rest_configs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users see own jit logs" ON "public"."jit_comparison_logs" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users_own_data" ON "public"."auxiliary_assignments" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."auxiliary_exercises" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."cycle_reviews" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."developer_suggestions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."disruptions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."formula_configs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."lifter_maxes" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."muscle_volume_config" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."performance_metrics" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."period_starts" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."programs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."recovery_snapshots" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."session_logs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."sessions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."soreness_checkins" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_data" ON "public"."warmup_configs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_profile" ON "public"."profiles" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."warmup_configs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON TABLE "public"."auxiliary_assignments" TO "anon";
GRANT ALL ON TABLE "public"."auxiliary_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."auxiliary_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."auxiliary_exercises" TO "anon";
GRANT ALL ON TABLE "public"."auxiliary_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."auxiliary_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_reviews" TO "anon";
GRANT ALL ON TABLE "public"."cycle_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_tracking" TO "anon";
GRANT ALL ON TABLE "public"."cycle_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."developer_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."developer_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."developer_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."disruptions" TO "anon";
GRANT ALL ON TABLE "public"."disruptions" TO "authenticated";
GRANT ALL ON TABLE "public"."disruptions" TO "service_role";



GRANT ALL ON TABLE "public"."formula_configs" TO "anon";
GRANT ALL ON TABLE "public"."formula_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."formula_configs" TO "service_role";



GRANT ALL ON TABLE "public"."jit_comparison_logs" TO "anon";
GRANT ALL ON TABLE "public"."jit_comparison_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."jit_comparison_logs" TO "service_role";



GRANT ALL ON TABLE "public"."lifter_maxes" TO "anon";
GRANT ALL ON TABLE "public"."lifter_maxes" TO "authenticated";
GRANT ALL ON TABLE "public"."lifter_maxes" TO "service_role";



GRANT ALL ON TABLE "public"."muscle_volume_config" TO "anon";
GRANT ALL ON TABLE "public"."muscle_volume_config" TO "authenticated";
GRANT ALL ON TABLE "public"."muscle_volume_config" TO "service_role";



GRANT ALL ON TABLE "public"."performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."period_starts" TO "anon";
GRANT ALL ON TABLE "public"."period_starts" TO "authenticated";
GRANT ALL ON TABLE "public"."period_starts" TO "service_role";



GRANT ALL ON TABLE "public"."personal_records" TO "anon";
GRANT ALL ON TABLE "public"."personal_records" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_records" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON TABLE "public"."recovery_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."recovery_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."recovery_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."rest_configs" TO "anon";
GRANT ALL ON TABLE "public"."rest_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."rest_configs" TO "service_role";



GRANT ALL ON TABLE "public"."session_logs" TO "anon";
GRANT ALL ON TABLE "public"."session_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."session_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."soreness_checkins" TO "anon";
GRANT ALL ON TABLE "public"."soreness_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."soreness_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."warmup_configs" TO "anon";
GRANT ALL ON TABLE "public"."warmup_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."warmup_configs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

