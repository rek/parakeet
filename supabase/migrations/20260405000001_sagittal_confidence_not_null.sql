-- Make sagittal_confidence non-nullable now that all rows are backfilled.
-- See issue #174.

-- Safety: ensure no nulls slipped through between migrations
UPDATE session_videos SET sagittal_confidence = 0.8 WHERE sagittal_confidence IS NULL;

ALTER TABLE session_videos ALTER COLUMN sagittal_confidence SET NOT NULL;
