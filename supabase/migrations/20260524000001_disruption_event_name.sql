-- Add a dedicated event_name column to disruptions so that unprogrammed-event
-- names (e.g., "Hyrox race") are stored structured rather than mashed into the
-- free-text description column. Backfills existing unprogrammed_event rows by
-- splitting on the first ": " in description.

BEGIN;

ALTER TABLE "public"."disruptions"
  ADD COLUMN "event_name" text;

-- Backfill: for existing unprogrammed_event rows, extract anything before the
-- first ": " in description and move it to event_name. Strip the prefix from
-- description so the structured field becomes the source of truth. NULLIF on
-- event_name guards against descriptions that start with ": " (empty prefix)
-- producing a dirty empty-string row.
UPDATE "public"."disruptions"
SET
  "event_name" = NULLIF(split_part("description", ': ', 1), ''),
  "description" = NULLIF(substring("description" from position(': ' in "description") + 2), '')
WHERE
  "disruption_type" = 'unprogrammed_event'
  AND "description" IS NOT NULL
  AND position(': ' in "description") > 0;

-- Length guard that also rejects empty strings (NULL or 1..120 chars).
ALTER TABLE "public"."disruptions"
  ADD CONSTRAINT "disruptions_event_name_length" CHECK (
    "event_name" IS NULL OR char_length("event_name") BETWEEN 1 AND 120
  );

COMMIT;
