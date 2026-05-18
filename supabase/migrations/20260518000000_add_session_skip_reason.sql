-- Add skip_reason to sessions. The skip-session UI prompts the user for an
-- optional reason; until now that input was dropped on the floor because
-- there was no column to store it. Nullable: legacy rows + skips without a
-- reason are still valid.

ALTER TABLE "public"."sessions" ADD COLUMN "skip_reason" "text";
