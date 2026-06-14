ALTER TABLE rankings
  ADD COLUMN IF NOT EXISTS badges TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  UNIQUE (season_id, user_id, code)
);

CREATE TABLE IF NOT EXISTS action_rate_limits (
  rate_key TEXT NOT NULL,
  action TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_key, action)
);

CREATE INDEX IF NOT EXISTS fraud_alerts_review_idx
  ON fraud_alerts (status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS fraud_alerts_season_user_idx
  ON fraud_alerts (season_id, user_id);

CREATE INDEX IF NOT EXISTS action_rate_limits_updated_idx
  ON action_rate_limits (updated_at);
