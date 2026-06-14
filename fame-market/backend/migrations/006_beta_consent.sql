CREATE TABLE IF NOT EXISTS user_consents (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rules_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, rules_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS user_consents_user_time_idx
  ON user_consents (user_id, accepted_at DESC);
