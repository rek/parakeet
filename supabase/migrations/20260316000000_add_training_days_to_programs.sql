ALTER TABLE programs ADD COLUMN IF NOT EXISTS training_days smallint[] DEFAULT NULL;
