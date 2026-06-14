ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_value NUMERIC(18, 2) NOT NULL,
  return_percent NUMERIC(12, 4) NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  trade_count INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS rankings_season_rank_idx
  ON rankings (season_id, rank);

CREATE INDEX IF NOT EXISTS wallets_season_idx
  ON wallets (season_id);
