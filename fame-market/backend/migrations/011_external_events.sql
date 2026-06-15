CREATE TABLE IF NOT EXISTS external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('correction', 'media', 'platform', 'legal', 'manual')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL,
  impact_direction TEXT NOT NULL DEFAULT 'neutral'
    CHECK (impact_direction IN ('positive', 'negative', 'neutral')),
  proposed_delta_bps INTEGER NOT NULL DEFAULT 0
    CHECK (proposed_delta_bps BETWEEN -60 AND 60),
  applied_delta_bps INTEGER NOT NULL DEFAULT 0
    CHECK (applied_delta_bps BETWEEN -60 AND 60),
  visibility_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (visibility_status IN ('draft', 'public', 'archived')),
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  reviewed_by TEXT,
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS external_events_artist_time_idx
  ON external_events (artist_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS external_events_public_idx
  ON external_events (visibility_status, review_status, occurred_at DESC);
