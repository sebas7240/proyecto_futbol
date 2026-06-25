CREATE TABLE IF NOT EXISTS live_market_states (
  artist_id UUID PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,
  market_state TEXT NOT NULL CHECK (
    market_state IN ('bull', 'bear', 'sideways', 'volatile', 'viral')
  ),
  state_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  state_ends_at TIMESTAMPTZ NOT NULL,
  hype_score NUMERIC(8, 4) NOT NULL DEFAULT 50 CHECK (hype_score BETWEEN 0 AND 100),
  trend_bias_bps INTEGER NOT NULL DEFAULT 0 CHECK (trend_bias_bps BETWEEN -150 AND 150),
  volatility_bps INTEGER NOT NULL DEFAULT 10 CHECK (volatility_bps BETWEEN 1 AND 150),
  last_delta_bps INTEGER NOT NULL DEFAULT 0 CHECK (last_delta_bps BETWEEN -250 AND 250),
  last_tick_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS live_market_states_tick_idx
  ON live_market_states (last_tick_at NULLS FIRST, state_ends_at);
