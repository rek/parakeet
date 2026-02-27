-- Cycle tracking config per user
CREATE TABLE cycle_tracking (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled         BOOLEAN NOT NULL DEFAULT false,
  cycle_length_days  INT NOT NULL DEFAULT 28,
  last_period_start  DATE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE cycle_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cycle config"
  ON cycle_tracking FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Record which cycle phase a session was logged in
ALTER TABLE session_logs
  ADD COLUMN cycle_phase TEXT
    CHECK (cycle_phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal', 'late_luteal'));
