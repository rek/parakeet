-- Rest time overrides per user, optionally scoped to lift and/or intensity type.
-- NULL lift   = applies to all lifts
-- NULL intensity_type = applies to all intensity types
-- Lookup precedence (most specific wins): lift+intensity > lift+NULL > NULL+intensity > NULL+NULL

CREATE TABLE rest_configs (
  user_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lift           text CHECK (lift IN ('squat', 'bench', 'deadlift')),
  intensity_type text CHECK (intensity_type IN ('heavy', 'explosive', 'rep', 'deload')),
  rest_seconds   integer     NOT NULL CHECK (rest_seconds BETWEEN 30 AND 600),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Unique index uses COALESCE so two NULLs are treated as equal (standard PK can't do this)
CREATE UNIQUE INDEX rest_configs_unique
  ON rest_configs (user_id, COALESCE(lift::text, '__all__'), COALESCE(intensity_type::text, '__all__'));

ALTER TABLE rest_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own rest configs"
  ON rest_configs FOR ALL USING (auth.uid() = user_id);
