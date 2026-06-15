CREATE TABLE IF NOT EXISTS entity_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  usage_mode TEXT NOT NULL DEFAULT 'display_only'
    CHECK (usage_mode IN ('display_only', 'shadow_signal', 'price_signal', 'manual_context')),
  license_notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artist_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS entity_sources_artist_idx
  ON entity_sources (artist_id, provider, is_primary DESC);

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  source_id UUID REFERENCES entity_sources(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'video'
    CHECK (content_type IN ('video', 'short', 'stream', 'article', 'post', 'event', 'other')),
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  source_url TEXT NOT NULL,
  eligibility_status TEXT NOT NULL DEFAULT 'eligible'
    CHECK (eligibility_status IN ('eligible', 'excluded', 'pending_review')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS content_items_artist_published_idx
  ON content_items (artist_id, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS content_items_source_idx
  ON content_items (source_id);

CREATE TABLE IF NOT EXISTS content_snapshots (
  id BIGSERIAL PRIMARY KEY,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_snapshots_item_captured_idx
  ON content_snapshots (content_item_id, captured_at DESC);

INSERT INTO entity_sources (
  artist_id, provider, source_type, external_id, source_url, display_name,
  is_primary, usage_mode, license_notes, metadata, last_synced_at, created_at
)
SELECT
  artist_id,
  'youtube',
  'channel',
  youtube_channel_id,
  'https://www.youtube.com/channel/' || youtube_channel_id,
  channel_title,
  is_primary,
  'display_only',
  'Datos publicos de YouTube usados como referencia informativa.',
  jsonb_build_object(
    'uploadsPlaylistId', uploads_playlist_id,
    'handle', handle
  ),
  last_synced_at,
  created_at
FROM artist_channels
ON CONFLICT (artist_id, provider, external_id)
DO UPDATE SET
  source_type = EXCLUDED.source_type,
  source_url = EXCLUDED.source_url,
  display_name = EXCLUDED.display_name,
  is_primary = EXCLUDED.is_primary,
  metadata = EXCLUDED.metadata,
  last_synced_at = EXCLUDED.last_synced_at;

INSERT INTO content_items (
  artist_id, source_id, provider, external_id, content_type, title,
  thumbnail_url, published_at, duration_seconds, source_url,
  eligibility_status, metadata, last_synced_at
)
SELECT
  video.artist_id,
  source.id,
  'youtube',
  video.youtube_video_id,
  CASE
    WHEN video.video_type IN ('video', 'short', 'stream', 'other') THEN video.video_type
    ELSE 'video'
  END,
  video.title,
  video.thumbnail_url,
  video.published_at,
  video.duration_seconds,
  video.youtube_url,
  video.eligibility_status,
  jsonb_build_object('legacyVideoId', video.id),
  video.last_synced_at
FROM videos video
LEFT JOIN artist_channels channel ON channel.id = video.artist_channel_id
LEFT JOIN entity_sources source
  ON source.artist_id = video.artist_id
  AND source.provider = 'youtube'
  AND source.external_id = channel.youtube_channel_id
ON CONFLICT (provider, external_id)
DO UPDATE SET
  artist_id = EXCLUDED.artist_id,
  source_id = EXCLUDED.source_id,
  content_type = EXCLUDED.content_type,
  title = EXCLUDED.title,
  thumbnail_url = EXCLUDED.thumbnail_url,
  published_at = EXCLUDED.published_at,
  duration_seconds = EXCLUDED.duration_seconds,
  source_url = EXCLUDED.source_url,
  eligibility_status = EXCLUDED.eligibility_status,
  metadata = EXCLUDED.metadata,
  last_synced_at = EXCLUDED.last_synced_at;

INSERT INTO content_snapshots (
  content_item_id, view_count, like_count, comment_count, captured_at
)
SELECT
  item.id,
  snapshot.view_count,
  snapshot.like_count,
  snapshot.comment_count,
  snapshot.captured_at
FROM video_snapshots snapshot
JOIN videos video ON video.id = snapshot.video_id
JOIN content_items item
  ON item.provider = 'youtube'
  AND item.external_id = video.youtube_video_id;
