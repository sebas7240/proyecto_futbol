CREATE TABLE IF NOT EXISTS client_error_reports (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL
    CHECK (kind IN ('error', 'unhandledrejection', 'react', 'manual')),
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT,
  path TEXT NOT NULL DEFAULT '/',
  user_agent TEXT,
  release TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_error_reports_created_idx
  ON client_error_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS client_error_reports_kind_created_idx
  ON client_error_reports (kind, created_at DESC);
