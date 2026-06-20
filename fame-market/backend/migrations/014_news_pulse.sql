CREATE TABLE IF NOT EXISTS news_signals (
  id BIGSERIAL PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  window_ends_at TIMESTAMPTZ NOT NULL,
  algorithm_version TEXT NOT NULL,
  article_count INTEGER NOT NULL CHECK (article_count >= 0),
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  attention_score NUMERIC(12, 8) NOT NULL CHECK (attention_score BETWEEN -1 AND 1),
  sentiment_score NUMERIC(12, 8) NOT NULL CHECK (sentiment_score BETWEEN -1 AND 1),
  confidence NUMERIC(8, 6) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  proposed_delta_bps INTEGER NOT NULL CHECK (proposed_delta_bps BETWEEN -15 AND 15),
  applied_delta_bps INTEGER NOT NULL DEFAULT 0 CHECK (applied_delta_bps BETWEEN -15 AND 15),
  mode TEXT NOT NULL CHECK (mode IN ('shadow', 'applied', 'skipped', 'halted')),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, window_ends_at, algorithm_version)
);

CREATE INDEX IF NOT EXISTS news_signals_artist_time_idx
  ON news_signals (artist_id, window_ends_at DESC);

ALTER TABLE price_ticks
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'market',
  ADD COLUMN IF NOT EXISTS source_reference TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_ticks_source_type_check'
  ) THEN
    ALTER TABLE price_ticks
      ADD CONSTRAINT price_ticks_source_type_check
      CHECK (source_type IN ('market', 'trade', 'news', 'season', 'external_event'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS content_items_news_artist_time_idx
  ON content_items (artist_id, published_at DESC)
  WHERE content_type = 'article';
