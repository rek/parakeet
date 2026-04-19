-- No-op: period_starts is created by the initial schema squash
-- (20260312000000_fix_developer_suggestions_insert_rls.sql). This migration
-- previously backfilled the table on prod; left in place as a no-op so
-- supabase's migration history on prod stays consistent.
SELECT 1;
