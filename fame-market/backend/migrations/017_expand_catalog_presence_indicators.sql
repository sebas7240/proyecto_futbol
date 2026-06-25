CREATE TABLE IF NOT EXISTS online_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  path TEXT NOT NULL DEFAULT '/',
  ip_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS online_sessions_last_seen_idx
  ON online_sessions (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS online_sessions_user_seen_idx
  ON online_sessions (user_id, last_seen_at DESC)
  WHERE user_id IS NOT NULL;

WITH catalog (
  id, slug, symbol, name, country, genre, category, subcategory, profession,
  theme_tags, volatility_profile, risk_level, strategy_notes,
  current_price, opening_price, daily_anchor_price, liquidity
) AS (
  VALUES
    (
      '10000000-0000-4000-8000-000000000030'::uuid,
      'billie-eilish', 'BILL', 'Billie Eilish', 'Estados Unidos', 'Pop',
      'musica', 'pop-global', 'Cantante',
      ARRAY['musica', 'pop', 'usa', 'global'],
      'balanced', 3,
      'Artista global con alta sensibilidad a lanzamientos, premios y giras.',
      121.40, 118.80, 121.40, 2450
    ),
    (
      '10000000-0000-4000-8000-000000000031'::uuid,
      'sabrina-carpenter', 'SABR', 'Sabrina Carpenter', 'Estados Unidos', 'Pop',
      'musica', 'pop-global', 'Cantante y actriz',
      ARRAY['musica', 'pop', 'cine-tv', 'viral'],
      'volatile', 4,
      'Perfil pop con picos por sencillos, videos y conversacion social.',
      86.70, 83.20, 86.70, 1700
    ),
    (
      '10000000-0000-4000-8000-000000000032'::uuid,
      'the-weeknd', 'WKND', 'The Weeknd', 'Canada', 'R&B / Pop',
      'musica', 'pop-global', 'Cantante',
      ARRAY['musica', 'rnb', 'canada', 'global'],
      'stable', 2,
      'Figura de streaming masivo, estable pero fuerte ante lanzamientos globales.',
      136.90, 133.60, 136.90, 2800
    ),
    (
      '10000000-0000-4000-8000-000000000033'::uuid,
      'travis-scott', 'TRVS', 'Travis Scott', 'Estados Unidos', 'Hip hop',
      'musica', 'hip-hop', 'Rapero',
      ARRAY['musica', 'hip-hop', 'usa', 'tour'],
      'volatile', 4,
      'Activo de alto ruido: moda, conciertos y lanzamientos pueden moverlo rapido.',
      104.20, 101.10, 104.20, 2300
    ),
    (
      '10000000-0000-4000-8000-000000000034'::uuid,
      'olivia-rodrigo', 'OLIV', 'Olivia Rodrigo', 'Estados Unidos', 'Pop rock',
      'musica', 'pop-global', 'Cantante y actriz',
      ARRAY['musica', 'pop', 'joven', 'global'],
      'balanced', 3,
      'Popularidad joven con reacciones fuertes a tours, premios y estrenos.',
      94.60, 91.70, 94.60, 1900
    ),
    (
      '10000000-0000-4000-8000-000000000035'::uuid,
      'rosalia', 'ROSA', 'Rosalia', 'Espana', 'Pop urbano',
      'musica', 'latin-pop', 'Cantante',
      ARRAY['musica', 'latam', 'espana', 'moda'],
      'balanced', 3,
      'Activo cultural con catalizadores por musica, moda y colaboraciones.',
      88.30, 86.40, 88.30, 1750
    ),
    (
      '10000000-0000-4000-8000-000000000036'::uuid,
      'kai-cenat', 'KAI', 'Kai Cenat', 'Estados Unidos', 'Streaming',
      'creadores', 'streaming', 'Streamer',
      ARRAY['creadores', 'twitch', 'streaming', 'viral'],
      'volatile', 5,
      'Creador de alta volatilidad por directos, colaboraciones y tendencias virales.',
      74.25, 71.40, 74.25, 1350
    ),
    (
      '10000000-0000-4000-8000-000000000037'::uuid,
      'ishowspeed', 'SPEED', 'IShowSpeed', 'Estados Unidos', 'Streaming',
      'creadores', 'streaming', 'Streamer',
      ARRAY['creadores', 'youtube', 'viral', 'deportes'],
      'volatile', 5,
      'Perfil meme/viral con movimientos bruscos por clips y colaboraciones.',
      78.80, 75.50, 78.80, 1450
    ),
    (
      '10000000-0000-4000-8000-000000000038'::uuid,
      'mark-rober', 'ROBER', 'Mark Rober', 'Estados Unidos', 'Ciencia / YouTube',
      'creadores', 'educacion', 'Creador',
      ARRAY['creadores', 'youtube', 'ciencia', 'educacion'],
      'stable', 2,
      'Creador de alta confianza, menos volatil y sensible a videos grandes.',
      92.10, 89.70, 92.10, 1800
    ),
    (
      '10000000-0000-4000-8000-000000000039'::uuid,
      'charli-damelio', 'CHAR', 'Charli D''Amelio', 'Estados Unidos', 'Social media',
      'creadores', 'tiktok', 'Creadora',
      ARRAY['creadores', 'tiktok', 'moda', 'usa'],
      'balanced', 3,
      'Figura social con catalizadores por marcas, shows y tendencias cortas.',
      80.40, 78.60, 80.40, 1550
    ),
    (
      '10000000-0000-4000-8000-000000000040'::uuid,
      'khaby-lame', 'KHABY', 'Khaby Lame', 'Italia', 'Social media',
      'creadores', 'tiktok', 'Creador',
      ARRAY['creadores', 'tiktok', 'global', 'comedia'],
      'balanced', 3,
      'Reconocimiento global, con movimientos por campanas y presencia internacional.',
      76.90, 74.80, 76.90, 1500
    ),
    (
      '10000000-0000-4000-8000-000000000041'::uuid,
      'kylian-mbappe', 'MBAP', 'Kylian Mbappe', 'Francia', 'Futbol',
      'deportes', 'futbol', 'Futbolista',
      ARRAY['deportes', 'futbol', 'europa', 'mundial'],
      'volatile', 4,
      'Activo deportivo de alta exposicion: goles, lesiones y torneos lo mueven.',
      128.30, 124.90, 128.30, 2900
    ),
    (
      '10000000-0000-4000-8000-000000000042'::uuid,
      'vinicius-junior', 'VINI', 'Vinicius Junior', 'Brasil', 'Futbol',
      'deportes', 'futbol', 'Futbolista',
      ARRAY['deportes', 'futbol', 'brasil', 'europa'],
      'volatile', 4,
      'Figura de futbol con alta reaccion por partidos grandes y premios.',
      117.80, 114.20, 117.80, 2550
    ),
    (
      '10000000-0000-4000-8000-000000000043'::uuid,
      'lamine-yamal', 'YAMAL', 'Lamine Yamal', 'Espana', 'Futbol',
      'deportes', 'futbol', 'Futbolista',
      ARRAY['deportes', 'futbol', 'underdog', 'espana'],
      'underdog', 5,
      'Joven de crecimiento explosivo: mucho potencial y alta volatilidad.',
      82.50, 79.20, 82.50, 1500
    ),
    (
      '10000000-0000-4000-8000-000000000044'::uuid,
      'max-verstappen', 'MAXV', 'Max Verstappen', 'Paises Bajos', 'Formula 1',
      'deportes', 'formula-1', 'Piloto',
      ARRAY['deportes', 'f1', 'europa', 'competicion'],
      'balanced', 3,
      'Activo de rendimiento: carreras, poles y titulos generan catalizadores claros.',
      111.60, 108.90, 111.60, 2250
    ),
    (
      '10000000-0000-4000-8000-000000000045'::uuid,
      'caitlin-clark', 'CLARK', 'Caitlin Clark', 'Estados Unidos', 'Baloncesto',
      'deportes', 'baloncesto', 'Baloncestista',
      ARRAY['deportes', 'wnba', 'usa', 'crecimiento'],
      'volatile', 4,
      'Perfil deportivo en expansion con picos por records, audiencias y playoffs.',
      84.75, 81.80, 84.75, 1600
    ),
    (
      '10000000-0000-4000-8000-000000000046'::uuid,
      'shohei-ohtani', 'OHTNI', 'Shohei Ohtani', 'Japon', 'Beisbol',
      'deportes', 'beisbol', 'Beisbolista',
      ARRAY['deportes', 'mlb', 'japon', 'global'],
      'stable', 2,
      'Superestrella deportiva global con catalizadores por records y temporadas.',
      119.90, 116.80, 119.90, 2400
    ),
    (
      '10000000-0000-4000-8000-000000000047'::uuid,
      'timothee-chalamet', 'TIMO', 'Timothee Chalamet', 'Estados Unidos', 'Cine',
      'cine-tv', 'cine', 'Actor',
      ARRAY['cine-tv', 'cine', 'moda', 'premios'],
      'balanced', 3,
      'Actor de alta conversacion por estrenos, premios y campanas de moda.',
      89.20, 86.10, 89.20, 1750
    ),
    (
      '10000000-0000-4000-8000-000000000048'::uuid,
      'sydney-sweeney', 'SYD', 'Sydney Sweeney', 'Estados Unidos', 'Cine / TV',
      'cine-tv', 'cine-tv', 'Actriz',
      ARRAY['cine-tv', 'streaming', 'moda', 'usa'],
      'volatile', 4,
      'Figura de alta atencion social con picos por estrenos y marcas.',
      83.95, 80.90, 83.95, 1650
    ),
    (
      '10000000-0000-4000-8000-000000000049'::uuid,
      'tom-holland', 'TOMH', 'Tom Holland', 'Reino Unido', 'Cine',
      'cine-tv', 'cine', 'Actor',
      ARRAY['cine-tv', 'cine', 'global', 'franquicias'],
      'balanced', 3,
      'Popularidad global con movimientos por franquicias, estrenos y anuncios.',
      102.40, 99.20, 102.40, 2100
    )
)
INSERT INTO artists (
  id, slug, symbol, name, country, genre, category, subcategory, profession,
  theme_tags, volatility_profile, risk_level, strategy_notes, image_url,
  image_usage_status, current_price, opening_price, daily_anchor_price,
  liquidity
)
SELECT
  id, slug, symbol, name, country, genre, category, subcategory, profession,
  theme_tags, volatility_profile, risk_level, strategy_notes, NULL, 'none',
  current_price, opening_price, daily_anchor_price, liquidity
FROM catalog
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  genre = EXCLUDED.genre,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  profession = EXCLUDED.profession,
  theme_tags = EXCLUDED.theme_tags,
  volatility_profile = EXCLUDED.volatility_profile,
  risk_level = EXCLUDED.risk_level,
  strategy_notes = EXCLUDED.strategy_notes,
  image_url = CASE
    WHEN artists.image_usage_status IN ('owned', 'licensed', 'provider_authorized')
      THEN artists.image_url
    ELSE NULL
  END,
  image_usage_status = CASE
    WHEN artists.image_usage_status IN ('owned', 'licensed', 'provider_authorized')
      THEN artists.image_usage_status
    ELSE 'none'
  END;

WITH catalog (slug) AS (
  VALUES
    ('billie-eilish'), ('sabrina-carpenter'), ('the-weeknd'),
    ('travis-scott'), ('olivia-rodrigo'), ('rosalia'), ('kai-cenat'),
    ('ishowspeed'), ('mark-rober'), ('charli-damelio'), ('khaby-lame'),
    ('kylian-mbappe'), ('vinicius-junior'), ('lamine-yamal'),
    ('max-verstappen'), ('caitlin-clark'), ('shohei-ohtani'),
    ('timothee-chalamet'), ('sydney-sweeney'), ('tom-holland')
),
points (multiplier, age) AS (
  VALUES
    (0.982::numeric, INTERVAL '96 hours'),
    (0.991::numeric, INTERVAL '72 hours'),
    (1.006::numeric, INTERVAL '48 hours'),
    (0.997::numeric, INTERVAL '24 hours'),
    (1.000::numeric, INTERVAL '0 hours')
)
INSERT INTO price_ticks (artist_id, season_id, price, created_at, source_type)
SELECT
  artist.id,
  season.id,
  ROUND((artist.current_price * points.multiplier)::numeric, 6),
  NOW() - points.age,
  'market'
FROM catalog
JOIN artists artist ON artist.slug = catalog.slug
CROSS JOIN LATERAL (
  SELECT id
  FROM seasons
  WHERE status = 'active'
  ORDER BY starts_at DESC
  LIMIT 1
) season
CROSS JOIN points
WHERE NOT EXISTS (
  SELECT 1 FROM price_ticks tick WHERE tick.artist_id = artist.id
);

WITH sources (slug, project, article_title) AS (
  VALUES
    ('billie-eilish', 'en.wikipedia.org', 'Billie_Eilish'),
    ('sabrina-carpenter', 'en.wikipedia.org', 'Sabrina_Carpenter'),
    ('the-weeknd', 'en.wikipedia.org', 'The_Weeknd'),
    ('travis-scott', 'en.wikipedia.org', 'Travis_Scott'),
    ('olivia-rodrigo', 'en.wikipedia.org', 'Olivia_Rodrigo'),
    ('rosalia', 'en.wikipedia.org', 'Rosalía'),
    ('kai-cenat', 'en.wikipedia.org', 'Kai_Cenat'),
    ('ishowspeed', 'en.wikipedia.org', 'IShowSpeed'),
    ('mark-rober', 'en.wikipedia.org', 'Mark_Rober'),
    ('charli-damelio', 'en.wikipedia.org', 'Charli_D''Amelio'),
    ('khaby-lame', 'en.wikipedia.org', 'Khaby_Lame'),
    ('kylian-mbappe', 'en.wikipedia.org', 'Kylian_Mbappé'),
    ('vinicius-junior', 'en.wikipedia.org', 'Vinícius_Júnior'),
    ('lamine-yamal', 'en.wikipedia.org', 'Lamine_Yamal'),
    ('max-verstappen', 'en.wikipedia.org', 'Max_Verstappen'),
    ('caitlin-clark', 'en.wikipedia.org', 'Caitlin_Clark'),
    ('shohei-ohtani', 'en.wikipedia.org', 'Shohei_Ohtani'),
    ('timothee-chalamet', 'en.wikipedia.org', 'Timothée_Chalamet'),
    ('sydney-sweeney', 'en.wikipedia.org', 'Sydney_Sweeney'),
    ('tom-holland', 'en.wikipedia.org', 'Tom_Holland')
)
INSERT INTO attention_sources (
  artist_id, provider, external_id, source_url, weight_bps, enabled, metadata
)
SELECT
  artist.id,
  'wikimedia',
  sources.project || ':' || sources.article_title,
  'https://' || sources.project || '/wiki/' || sources.article_title,
  10000,
  TRUE,
  jsonb_build_object(
    'project', sources.project,
    'articleTitle', sources.article_title,
    'access', 'all-access',
    'agent', 'user'
  )
FROM sources
JOIN artists artist ON artist.slug = sources.slug
ON CONFLICT (artist_id, provider, external_id)
DO UPDATE SET
  source_url = EXCLUDED.source_url,
  enabled = TRUE,
  metadata = EXCLUDED.metadata,
  last_error = NULL;
