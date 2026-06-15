CREATE TABLE IF NOT EXISTS attention_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  weight_bps INTEGER NOT NULL DEFAULT 10000
    CHECK (weight_bps BETWEEN 0 AND 10000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS attention_observations (
  id BIGSERIAL PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES attention_sources(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  observed_at DATE NOT NULL,
  metric_value NUMERIC(24, 6) NOT NULL CHECK (metric_value >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, metric_name, observed_at)
);

CREATE TABLE IF NOT EXISTS attention_signals (
  id BIGSERIAL PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  window_ends_on DATE NOT NULL,
  algorithm_version TEXT NOT NULL,
  normalized_score NUMERIC(12, 8) NOT NULL,
  proposed_delta_bps INTEGER NOT NULL,
  applied_delta_bps INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(8, 6) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_count INTEGER NOT NULL CHECK (source_count >= 1),
  mode TEXT NOT NULL CHECK (mode IN ('shadow', 'applied', 'skipped', 'halted')),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, window_ends_on, algorithm_version)
);

CREATE INDEX IF NOT EXISTS attention_sources_artist_idx
  ON attention_sources (artist_id, enabled);
CREATE INDEX IF NOT EXISTS attention_observations_source_time_idx
  ON attention_observations (source_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS attention_signals_artist_time_idx
  ON attention_signals (artist_id, window_ends_on DESC);

INSERT INTO attention_sources (
  artist_id, provider, external_id, source_url, weight_bps, metadata
)
SELECT
  artist.id,
  'wikimedia',
  seed.project || ':' || seed.article_title,
  'https://' || seed.project || '/wiki/' || seed.article_title,
  10000,
  jsonb_build_object(
    'project', seed.project,
    'articleTitle', seed.article_title,
    'access', 'all-access',
    'agent', 'user'
  )
FROM (
  VALUES
    ('karol-g', 'es.wikipedia.org', 'Karol_G'),
    ('bad-bunny', 'es.wikipedia.org', 'Bad_Bunny'),
    ('shakira', 'es.wikipedia.org', 'Shakira')
) AS seed(slug, project, article_title)
JOIN artists artist ON artist.slug = seed.slug
ON CONFLICT (artist_id, provider, external_id) DO NOTHING;
