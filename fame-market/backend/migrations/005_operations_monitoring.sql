CREATE TABLE IF NOT EXISTS maintenance_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS maintenance_runs_job_time_idx
  ON maintenance_runs (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS maintenance_runs_status_time_idx
  ON maintenance_runs (status, started_at DESC);
