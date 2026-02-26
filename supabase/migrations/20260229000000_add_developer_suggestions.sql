CREATE TABLE developer_suggestions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES profiles(id),
  program_id    uuid NOT NULL REFERENCES programs(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  description   text NOT NULL,
  rationale     text NOT NULL,
  developer_note text NOT NULL,
  priority      text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status        text NOT NULL DEFAULT 'unreviewed'
                  CHECK (status IN ('unreviewed', 'acknowledged', 'implemented', 'dismissed')),
  reviewed_at   timestamptz
);

ALTER TABLE developer_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read developer suggestions"
  ON developer_suggestions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "service role writes developer suggestions"
  ON developer_suggestions FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated users update developer suggestions"
  ON developer_suggestions FOR UPDATE USING (auth.uid() IS NOT NULL);
