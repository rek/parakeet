-- Add generation_status to track pending vs complete reviews.
-- Pending rows are written before LLM call so the UI can offer retry if generation fails.
-- Existing rows default to 'complete' (they already have llm_response populated).
-- compiled_report and llm_response become nullable to allow pending-only rows.

ALTER TABLE public.cycle_reviews
  ADD COLUMN generation_status TEXT NOT NULL DEFAULT 'complete'
    CHECK (generation_status IN ('pending', 'complete')),
  ALTER COLUMN compiled_report DROP NOT NULL,
  ALTER COLUMN llm_response DROP NOT NULL;
