-- Allow standalone soreness check-ins (not tied to a session)
-- Required for unprogrammed event soreness injection (disruptions-005)
ALTER TABLE soreness_checkins ALTER COLUMN session_id DROP NOT NULL;
