CREATE TABLE weekly_body_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  program_id       UUID REFERENCES programs(id),
  week_number      INTEGER NOT NULL,
  felt_soreness    JSONB NOT NULL,
  predicted_fatigue JSONB NOT NULL,
  mismatches       JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE weekly_body_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own weekly body reviews"
  ON weekly_body_reviews
  FOR ALL
  USING (user_id = auth.uid());
