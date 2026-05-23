-- Add 'error' state + error_message column to cycle_reviews so the UI can
-- surface a failed LLM generation and stop polling. Without this the pending
-- row stays "pending" forever after an LLM failure, leaving the UI to spin.
--
-- Also adds a unique suggestion_index column to formula_configs and
-- developer_suggestions for idempotent partial-retry storage (one row per
-- (cycle_review_id, suggestion_index)).
--
-- Companion to changes in apps/parakeet/src/modules/cycle-review.

ALTER TABLE public.cycle_reviews
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Replace the CHECK constraint to allow 'error' as a third state.
ALTER TABLE public.cycle_reviews
  DROP CONSTRAINT IF EXISTS cycle_reviews_generation_status_check;

ALTER TABLE public.cycle_reviews
  ADD CONSTRAINT cycle_reviews_generation_status_check
    CHECK (generation_status IN ('pending', 'complete', 'error'));

-- Idempotent insert support for downstream tables. suggestion_index pairs with
-- (cycle_review_id ?? a synthetic id from program+user). For now we just add
-- the column + index; the app inserts include it so partial retries upsert.
ALTER TABLE public.developer_suggestions
  ADD COLUMN IF NOT EXISTS cycle_review_id UUID
    REFERENCES public.cycle_reviews(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS suggestion_index SMALLINT;

CREATE UNIQUE INDEX IF NOT EXISTS developer_suggestions_review_idx
  ON public.developer_suggestions (cycle_review_id, suggestion_index)
  WHERE cycle_review_id IS NOT NULL AND suggestion_index IS NOT NULL;
