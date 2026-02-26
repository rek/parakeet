-- Stores side-by-side formula vs LLM JIT outputs for developer analysis.
-- Owner-only app: no RLS needed on this table.
-- 90-day retention recommended (run via Supabase scheduled function):
--   DELETE FROM jit_comparison_logs WHERE created_at < now() - INTERVAL '90 days';

CREATE TABLE jit_comparison_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  session_id      uuid REFERENCES sessions(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  jit_input       jsonb NOT NULL,
  formula_output  jsonb NOT NULL,
  llm_output      jsonb NOT NULL,
  divergence      jsonb NOT NULL,
  strategy_used   text NOT NULL   -- 'llm' | 'formula_fallback'
);

CREATE INDEX jit_comparison_logs_user_id_idx ON jit_comparison_logs (user_id);
CREATE INDEX jit_comparison_logs_created_at_idx ON jit_comparison_logs (created_at DESC);
