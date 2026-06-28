ALTER TABLE positions
  ALTER COLUMN quantity TYPE NUMERIC(18, 6)
  USING quantity::numeric;

ALTER TABLE trades
  ALTER COLUMN quantity TYPE NUMERIC(18, 6)
  USING quantity::numeric;

ALTER TABLE trade_quotes
  ALTER COLUMN quantity TYPE NUMERIC(18, 6)
  USING quantity::numeric;

ALTER TABLE price_ticks
  ALTER COLUMN buy_volume TYPE NUMERIC(18, 6)
  USING buy_volume::numeric,
  ALTER COLUMN sell_volume TYPE NUMERIC(18, 6)
  USING sell_volume::numeric;

CREATE TABLE IF NOT EXISTS daily_position_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  reward_date DATE NOT NULL,
  total_value NUMERIC(18, 2) NOT NULL,
  position_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_id, reward_date)
);

CREATE TABLE IF NOT EXISTS daily_position_reward_items (
  id BIGSERIAL PRIMARY KEY,
  reward_id UUID NOT NULL REFERENCES daily_position_rewards(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id),
  quantity NUMERIC(18, 6) NOT NULL,
  price NUMERIC(18, 6) NOT NULL,
  market_value NUMERIC(18, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_position_rewards_wallet_date_idx
  ON daily_position_rewards (wallet_id, reward_date DESC);

CREATE INDEX IF NOT EXISTS daily_position_reward_items_reward_idx
  ON daily_position_reward_items (reward_id);
