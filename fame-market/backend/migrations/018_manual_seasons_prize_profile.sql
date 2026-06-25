ALTER TABLE seasons
  DROP CONSTRAINT IF EXISTS seasons_status_check;

ALTER TABLE seasons
  ADD CONSTRAINT seasons_status_check
  CHECK (status IN ('scheduled', 'active', 'frozen', 'closed'));

CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_scheduled_idx
  ON seasons (status)
  WHERE status = 'scheduled';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS solana_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS prize_contact_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prize_wallet_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_prize_wallet_idx
  ON users (prize_wallet_updated_at DESC)
  WHERE solana_wallet_address IS NOT NULL;
