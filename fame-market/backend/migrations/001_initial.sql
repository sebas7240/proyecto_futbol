CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  genre TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_price NUMERIC(18, 6) NOT NULL,
  opening_price NUMERIC(18, 6) NOT NULL,
  daily_anchor_price NUMERIC(18, 6) NOT NULL,
  liquidity NUMERIC(18, 6) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artist_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  youtube_channel_id TEXT UNIQUE NOT NULL,
  uploads_playlist_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  handle TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  artist_channel_id UUID REFERENCES artist_channels(id) ON DELETE SET NULL,
  youtube_video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  video_type TEXT NOT NULL DEFAULT 'video',
  eligibility_status TEXT NOT NULL DEFAULT 'eligible',
  youtube_url TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_snapshots (
  id BIGSERIAL PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  trading_closes_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  starting_balance NUMERIC(18, 2) NOT NULL,
  status TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active_idx
  ON seasons (status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  available_balance NUMERIC(18, 2) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, season_id)
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  average_cost NUMERIC(18, 6) NOT NULL,
  realized_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_id, artist_id)
);

CREATE TABLE IF NOT EXISTS trade_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  average_price NUMERIC(18, 6) NOT NULL,
  gross_amount NUMERIC(18, 2) NOT NULL,
  fee NUMERIC(18, 2) NOT NULL,
  net_amount NUMERIC(18, 2) NOT NULL,
  new_price NUMERIC(18, 6) NOT NULL,
  artist_version INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  artist_id UUID NOT NULL REFERENCES artists(id),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity INTEGER NOT NULL,
  average_price NUMERIC(18, 6) NOT NULL,
  gross_amount NUMERIC(18, 2) NOT NULL,
  fee NUMERIC(18, 2) NOT NULL,
  realized_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  trade_id UUID REFERENCES trades(id),
  entry_type TEXT NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  balance_after NUMERIC(18, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_ticks (
  id BIGSERIAL PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES artists(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  price NUMERIC(18, 6) NOT NULL,
  buy_volume INTEGER NOT NULL DEFAULT 0,
  sell_volume INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_ticks_artist_time_idx
  ON price_ticks (artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_snapshots_video_time_idx
  ON video_snapshots (video_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS trades_wallet_time_idx
  ON trades (wallet_id, created_at DESC);

INSERT INTO artists (
  id, slug, symbol, name, country, genre, image_url,
  current_price, opening_price, daily_anchor_price, liquidity
) VALUES
(
  '10000000-0000-4000-8000-000000000001',
  'karol-g', 'KAROL', 'Karol G', 'Colombia', 'Urbano latino',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
  118.42, 112.60, 118.42, 2200
),
(
  '10000000-0000-4000-8000-000000000002',
  'bad-bunny', 'BENITO', 'Bad Bunny', 'Puerto Rico', 'Trap latino',
  'https://images.unsplash.com/photo-1521337581100-8ca9a73a5f79?auto=format&fit=crop&w=900&q=80',
  104.75, 106.20, 104.75, 2600
),
(
  '10000000-0000-4000-8000-000000000003',
  'shakira', 'SHAKI', 'Shakira', 'Colombia', 'Pop latino',
  'https://images.unsplash.com/photo-1516575334481-f85287c2c82d?auto=format&fit=crop&w=900&q=80',
  127.18, 119.90, 127.18, 2400
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO seasons (
  id, name, starts_at, trading_closes_at, ends_at, starting_balance, status
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'Temporada Latina Beta',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '6 days',
  NOW() + INTERVAL '6 days 30 minutes',
  10000,
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO price_ticks (artist_id, season_id, price, created_at)
SELECT
  artist_id,
  '20000000-0000-4000-8000-000000000001',
  price,
  NOW() - age
FROM (
  VALUES
    ('10000000-0000-4000-8000-000000000001'::uuid, 112.60, INTERVAL '72 hours'),
    ('10000000-0000-4000-8000-000000000001'::uuid, 114.10, INTERVAL '48 hours'),
    ('10000000-0000-4000-8000-000000000001'::uuid, 116.30, INTERVAL '24 hours'),
    ('10000000-0000-4000-8000-000000000001'::uuid, 118.42, INTERVAL '0 hours'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 106.20, INTERVAL '72 hours'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 105.70, INTERVAL '48 hours'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 105.10, INTERVAL '24 hours'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 104.75, INTERVAL '0 hours'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 119.90, INTERVAL '72 hours'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 121.50, INTERVAL '48 hours'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 124.20, INTERVAL '24 hours'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 127.18, INTERVAL '0 hours')
) AS seed(artist_id, price, age)
WHERE NOT EXISTS (SELECT 1 FROM price_ticks);

INSERT INTO videos (
  id, artist_id, youtube_video_id, title, thumbnail_url, published_at,
  youtube_url, eligibility_status
) VALUES
(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'demo-karol-1',
  'Nuevo lanzamiento oficial',
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80',
  NOW() - INTERVAL '2 days',
  'https://www.youtube.com/',
  'eligible'
),
(
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'demo-benito-1',
  'Presentacion en vivo',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
  NOW() - INTERVAL '4 days',
  'https://www.youtube.com/',
  'eligible'
),
(
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  'demo-shakira-1',
  'Sesion oficial de estudio',
  'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=800&q=80',
  NOW() - INTERVAL '6 days',
  'https://www.youtube.com/',
  'eligible'
)
ON CONFLICT (youtube_video_id) DO NOTHING;

INSERT INTO video_snapshots (video_id, view_count, like_count, comment_count)
SELECT id,
  CASE youtube_video_id
    WHEN 'demo-karol-1' THEN 4281000
    WHEN 'demo-benito-1' THEN 6920000
    ELSE 3850000
  END,
  CASE youtube_video_id
    WHEN 'demo-karol-1' THEN 312000
    WHEN 'demo-benito-1' THEN 488000
    ELSE 276000
  END,
  CASE youtube_video_id
    WHEN 'demo-karol-1' THEN 18400
    WHEN 'demo-benito-1' THEN 26300
    ELSE 15700
  END
FROM videos
WHERE youtube_video_id LIKE 'demo-%'
  AND NOT EXISTS (
    SELECT 1 FROM video_snapshots snapshot WHERE snapshot.video_id = videos.id
  );
