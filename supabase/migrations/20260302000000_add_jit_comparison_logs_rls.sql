ALTER TABLE jit_comparison_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own jit logs"
  ON jit_comparison_logs
  FOR ALL
  USING (user_id = auth.uid());
