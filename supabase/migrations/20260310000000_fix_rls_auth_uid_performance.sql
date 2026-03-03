-- Fix RLS policy performance: wrap auth.uid() in (select ...) so Postgres
-- evaluates it once per query rather than once per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- cycle_tracking
DROP POLICY IF EXISTS "Users manage own cycle config" ON "public"."cycle_tracking";
CREATE POLICY "Users manage own cycle config" ON "public"."cycle_tracking"
  USING ((select auth.uid()) = "user_id")
  WITH CHECK ((select auth.uid()) = "user_id");

-- developer_suggestions (two separate policies)
DROP POLICY IF EXISTS "authenticated users can read developer suggestions" ON "public"."developer_suggestions";
CREATE POLICY "authenticated users can read developer suggestions" ON "public"."developer_suggestions"
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated users update developer suggestions" ON "public"."developer_suggestions";
CREATE POLICY "authenticated users update developer suggestions" ON "public"."developer_suggestions"
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

-- personal_records
DROP POLICY IF EXISTS "users manage own personal records" ON "public"."personal_records";
CREATE POLICY "users manage own personal records" ON "public"."personal_records"
  USING ((select auth.uid()) = "user_id");

-- rest_configs
DROP POLICY IF EXISTS "users manage own rest configs" ON "public"."rest_configs";
CREATE POLICY "users manage own rest configs" ON "public"."rest_configs"
  USING ((select auth.uid()) = "user_id");

-- jit_comparison_logs
DROP POLICY IF EXISTS "users see own jit logs" ON "public"."jit_comparison_logs";
CREATE POLICY "users see own jit logs" ON "public"."jit_comparison_logs"
  USING ("user_id" = (select auth.uid()));

-- auxiliary_assignments
DROP POLICY IF EXISTS "users_own_data" ON "public"."auxiliary_assignments";
CREATE POLICY "users_own_data" ON "public"."auxiliary_assignments"
  USING ((select auth.uid()) = "user_id");

-- auxiliary_exercises
DROP POLICY IF EXISTS "users_own_data" ON "public"."auxiliary_exercises";
CREATE POLICY "users_own_data" ON "public"."auxiliary_exercises"
  USING ((select auth.uid()) = "user_id");

-- cycle_reviews
DROP POLICY IF EXISTS "users_own_data" ON "public"."cycle_reviews";
CREATE POLICY "users_own_data" ON "public"."cycle_reviews"
  USING ((select auth.uid()) = "user_id");

-- developer_suggestions (ownership row filter)
DROP POLICY IF EXISTS "users_own_data" ON "public"."developer_suggestions";
CREATE POLICY "users_own_data" ON "public"."developer_suggestions"
  USING ((select auth.uid()) = "user_id");

-- disruptions
DROP POLICY IF EXISTS "users_own_data" ON "public"."disruptions";
CREATE POLICY "users_own_data" ON "public"."disruptions"
  USING ((select auth.uid()) = "user_id");

-- formula_configs
DROP POLICY IF EXISTS "users_own_data" ON "public"."formula_configs";
CREATE POLICY "users_own_data" ON "public"."formula_configs"
  USING ((select auth.uid()) = "user_id");

-- lifter_maxes
DROP POLICY IF EXISTS "users_own_data" ON "public"."lifter_maxes";
CREATE POLICY "users_own_data" ON "public"."lifter_maxes"
  USING ((select auth.uid()) = "user_id");

-- muscle_volume_config
DROP POLICY IF EXISTS "users_own_data" ON "public"."muscle_volume_config";
CREATE POLICY "users_own_data" ON "public"."muscle_volume_config"
  USING ((select auth.uid()) = "user_id");

-- performance_metrics
DROP POLICY IF EXISTS "users_own_data" ON "public"."performance_metrics";
CREATE POLICY "users_own_data" ON "public"."performance_metrics"
  USING ((select auth.uid()) = "user_id");

-- programs
DROP POLICY IF EXISTS "users_own_data" ON "public"."programs";
CREATE POLICY "users_own_data" ON "public"."programs"
  USING ((select auth.uid()) = "user_id");

-- recovery_snapshots
DROP POLICY IF EXISTS "users_own_data" ON "public"."recovery_snapshots";
CREATE POLICY "users_own_data" ON "public"."recovery_snapshots"
  USING ((select auth.uid()) = "user_id");

-- session_logs
DROP POLICY IF EXISTS "users_own_data" ON "public"."session_logs";
CREATE POLICY "users_own_data" ON "public"."session_logs"
  USING ((select auth.uid()) = "user_id");

-- sessions
DROP POLICY IF EXISTS "users_own_data" ON "public"."sessions";
CREATE POLICY "users_own_data" ON "public"."sessions"
  USING ((select auth.uid()) = "user_id");

-- soreness_checkins
DROP POLICY IF EXISTS "users_own_data" ON "public"."soreness_checkins";
CREATE POLICY "users_own_data" ON "public"."soreness_checkins"
  USING ((select auth.uid()) = "user_id");

-- warmup_configs
DROP POLICY IF EXISTS "users_own_data" ON "public"."warmup_configs";
CREATE POLICY "users_own_data" ON "public"."warmup_configs"
  USING ((select auth.uid()) = "user_id");

-- profiles
DROP POLICY IF EXISTS "users_own_profile" ON "public"."profiles";
CREATE POLICY "users_own_profile" ON "public"."profiles"
  USING ((select auth.uid()) = "id");
