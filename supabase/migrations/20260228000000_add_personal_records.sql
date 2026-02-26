CREATE TABLE personal_records (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  lift        text NOT NULL CHECK (lift IN ('squat', 'bench', 'deadlift')),
  pr_type     text NOT NULL CHECK (pr_type IN ('estimated_1rm','volume','rep_at_weight')),
  value       numeric NOT NULL,
  weight_kg   numeric,
  session_id  uuid REFERENCES sessions(id),
  achieved_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pr_unique ON personal_records (user_id, lift, pr_type, COALESCE(weight_kg::text, '__none__'));

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own personal records"
  ON personal_records FOR ALL USING (auth.uid() = user_id);
