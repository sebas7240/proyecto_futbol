ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS prize_min_users INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS prize_top_count INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS prize_note TEXT NOT NULL DEFAULT 'Premios manuales para el top 3 cuando Fame Plays llegue a 100 usuarios registrados.';

DO $$
BEGIN
  ALTER TABLE seasons
    ADD CONSTRAINT seasons_prize_min_users_valid
    CHECK (prize_min_users BETWEEN 1 AND 100000);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE seasons
    ADD CONSTRAINT seasons_prize_top_count_valid
    CHECK (prize_top_count BETWEEN 1 AND 100);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
