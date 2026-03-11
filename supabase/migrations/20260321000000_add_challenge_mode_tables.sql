-- Challenge reviews: post-hoc LLM review of formula JIT decisions
CREATE TABLE IF NOT EXISTS challenge_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  concerns JSONB NOT NULL DEFAULT '[]',
  suggested_overrides JSONB
);

CREATE INDEX idx_challenge_reviews_user_date
  ON challenge_reviews (user_id, created_at DESC);

ALTER TABLE challenge_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own challenge reviews"
  ON challenge_reviews FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own challenge reviews"
  ON challenge_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Decision replay logs: retrospective scoring after session completion
CREATE TABLE IF NOT EXISTS decision_replay_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prescription_score INTEGER NOT NULL,
  rpe_accuracy INTEGER NOT NULL,
  volume_appropriateness TEXT NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_decision_replay_logs_user_date
  ON decision_replay_logs (user_id, created_at DESC);

ALTER TABLE decision_replay_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own decision replay logs"
  ON decision_replay_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own decision replay logs"
  ON decision_replay_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
