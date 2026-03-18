-- Per-athlete modifier calibration offsets learned from trace + RPE outcomes
CREATE TABLE modifier_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  modifier_source text NOT NULL,
  adjustment numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'exploring',
  sample_count integer NOT NULL DEFAULT 0,
  mean_bias numeric,
  calibrated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (user_id, modifier_source),
  CONSTRAINT valid_source CHECK (
    modifier_source IN ('rpe_history', 'readiness', 'cycle_phase', 'soreness', 'disruption')
  )
);

ALTER TABLE modifier_calibrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_own ON modifier_calibrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own ON modifier_calibrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own ON modifier_calibrations FOR UPDATE USING (auth.uid() = user_id);
