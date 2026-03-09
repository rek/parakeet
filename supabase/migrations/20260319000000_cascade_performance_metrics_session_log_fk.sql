-- Fix: performance_metrics.session_log_id FK was missing ON DELETE CASCADE,
-- causing "Failed to delete session_logs" when deleting user data.

ALTER TABLE "public"."performance_metrics"
  DROP CONSTRAINT "performance_metrics_session_log_id_fkey";

ALTER TABLE "public"."performance_metrics"
  ADD CONSTRAINT "performance_metrics_session_log_id_fkey"
  FOREIGN KEY ("session_log_id") REFERENCES "public"."session_logs"("id")
  ON DELETE CASCADE;
