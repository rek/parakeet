CREATE TABLE IF NOT EXISTS developer_suggestions (
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

ALTER TABLE developer_suggestions
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Backfill defaults for rows created by older schema versions.
UPDATE developer_suggestions
SET
  priority = COALESCE(priority, 'medium'),
  status = COALESCE(status, 'unreviewed');

ALTER TABLE developer_suggestions
  ALTER COLUMN priority SET DEFAULT 'medium',
  ALTER COLUMN status SET DEFAULT 'unreviewed';

ALTER TABLE developer_suggestions
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'developer_suggestions_priority_check'
  ) THEN
    ALTER TABLE developer_suggestions
      ADD CONSTRAINT developer_suggestions_priority_check
      CHECK (priority IN ('high', 'medium', 'low'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'developer_suggestions_status_check'
  ) THEN
    ALTER TABLE developer_suggestions
      ADD CONSTRAINT developer_suggestions_status_check
      CHECK (status IN ('unreviewed', 'acknowledged', 'implemented', 'dismissed'));
  END IF;
END $$;

ALTER TABLE developer_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read developer suggestions" ON developer_suggestions;
DROP POLICY IF EXISTS "service role writes developer suggestions" ON developer_suggestions;
DROP POLICY IF EXISTS "authenticated users update developer suggestions" ON developer_suggestions;

CREATE POLICY "authenticated users can read developer suggestions"
  ON developer_suggestions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "service role writes developer suggestions"
  ON developer_suggestions FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated users update developer suggestions"
  ON developer_suggestions FOR UPDATE USING (auth.uid() IS NOT NULL);
