WITH catalog (
  id, slug, symbol, name, country, genre, category, subcategory, profession,
  theme_tags, volatility_profile, risk_level, strategy_notes, current_price,
  opening_price, daily_anchor_price, liquidity
) AS (
  VALUES
    (
      '10000000-0000-4000-8000-000000000001'::uuid,
      'karol-g', 'KAROL', 'Karol G', 'Colombia', 'Urbano latino',
      'musica', 'urbano-latino', 'Artista musical',
      ARRAY['musica', 'latino', 'colombia', 'urbano'],
      'balanced', 3,
      'Figura de alta demanda con actividad frecuente y liquidez media.',
      118.42, 112.60, 118.42, 2200
    ),
    (
      '10000000-0000-4000-8000-000000000002'::uuid,
      'bad-bunny', 'BENITO', 'Bad Bunny', 'Puerto Rico', 'Trap latino',
      'musica', 'trap-latino', 'Cantante y compositor',
      ARRAY['musica', 'latino', 'puerto-rico', 'trap'],
      'volatile', 4,
      'Figura muy seguida; puede moverse fuerte con lanzamientos, tendencias o noticias verificadas.',
      104.75, 106.20, 104.75, 2600
    ),
    (
      '10000000-0000-4000-8000-000000000003'::uuid,
      'shakira', 'SHAKI', 'Shakira', 'Colombia', 'Pop latino',
      'musica', 'pop-latino', 'Artista musical',
      ARRAY['musica', 'latino', 'colombia', 'pop'],
      'stable', 2,
      'Figura consolidada con base amplia; perfil mas defensivo dentro del mercado ficticio.',
      127.18, 119.90, 127.18, 2400
    ),
    (
      '10000000-0000-4000-8000-000000000004'::uuid,
      'feid', 'FEID', 'Feid', 'Colombia', 'Urbano latino',
      'musica', 'urbano-latino', 'Artista musical',
      ARRAY['musica', 'latino', 'colombia', 'urbano'],
      'volatile', 4,
      'Perfil de crecimiento rapido; sensible a lanzamientos, giras y tendencias sociales.',
      86.40, 83.80, 86.40, 1850
    ),
    (
      '10000000-0000-4000-8000-000000000005'::uuid,
      'j-balvin', 'JBALV', 'J Balvin', 'Colombia', 'Urbano latino',
      'musica', 'urbano-latino', 'Artista musical',
      ARRAY['musica', 'latino', 'colombia', 'urbano'],
      'balanced', 3,
      'Marca global latina con movimientos moderados y buen reconocimiento.',
      93.15, 91.50, 93.15, 1950
    ),
    (
      '10000000-0000-4000-8000-000000000006'::uuid,
      'rauw-alejandro', 'RAUW', 'Rauw Alejandro', 'Puerto Rico', 'Urbano latino',
      'musica', 'urbano-latino', 'Artista musical',
      ARRAY['musica', 'latino', 'puerto-rico', 'urbano'],
      'volatile', 4,
      'Alta sensibilidad a colaboraciones, giras y lanzamientos recientes.',
      88.75, 87.30, 88.75, 1800
    ),
    (
      '10000000-0000-4000-8000-000000000007'::uuid,
      'peso-pluma', 'PPLUMA', 'Peso Pluma', 'Mexico', 'Regional mexicano',
      'musica', 'regional-mexicano', 'Artista musical',
      ARRAY['musica', 'mexico', 'regional', 'corridos'],
      'volatile', 4,
      'Figura de alta volatilidad por ciclos virales y colaboraciones.',
      91.80, 89.20, 91.80, 1900
    ),
    (
      '10000000-0000-4000-8000-000000000008'::uuid,
      'anitta', 'ANITA', 'Anitta', 'Brasil', 'Pop/funk',
      'musica', 'pop-global', 'Artista musical',
      ARRAY['musica', 'brasil', 'pop', 'global'],
      'balanced', 3,
      'Figura internacional con actividad multilingue y presencia de marca.',
      84.60, 82.90, 84.60, 1700
    ),
    (
      '10000000-0000-4000-8000-000000000009'::uuid,
      'dua-lipa', 'DUA', 'Dua Lipa', 'Reino Unido', 'Pop',
      'musica', 'pop-global', 'Artista musical',
      ARRAY['musica', 'global', 'pop'],
      'stable', 2,
      'Perfil global relativamente estable con picos por lanzamientos y giras.',
      121.25, 118.40, 121.25, 2500
    ),
    (
      '10000000-0000-4000-8000-000000000010'::uuid,
      'taylor-swift', 'TSWFT', 'Taylor Swift', 'Estados Unidos', 'Pop',
      'musica', 'pop-global', 'Artista musical',
      ARRAY['musica', 'global', 'pop', 'usa'],
      'stable', 2,
      'Figura de escala masiva; movimientos defensivos con picos por eventos mayores.',
      138.90, 135.20, 138.90, 3200
    ),
    (
      '10000000-0000-4000-8000-000000000011'::uuid,
      'drake', 'DRAKE', 'Drake', 'Canada', 'Hip hop',
      'musica', 'hip-hop', 'Artista musical',
      ARRAY['musica', 'global', 'hip-hop', 'canada'],
      'balanced', 3,
      'Activo global con sensibilidad a lanzamientos, colaboraciones y debates publicos.',
      116.10, 115.00, 116.10, 2600
    ),
    (
      '10000000-0000-4000-8000-000000000012'::uuid,
      'mrbeast', 'MRBST', 'MrBeast', 'Estados Unidos', 'Video digital',
      'creadores', 'youtube-global', 'Creador de contenido',
      ARRAY['creadores', 'youtube', 'global', 'retos'],
      'volatile', 4,
      'Creador con picos fuertes por publicaciones virales y proyectos grandes.',
      132.40, 128.80, 132.40, 3000
    ),
    (
      '10000000-0000-4000-8000-000000000013'::uuid,
      'ibai-llanos', 'IBAI', 'Ibai Llanos', 'Espana', 'Streaming',
      'creadores', 'streaming', 'Creador y presentador',
      ARRAY['creadores', 'streaming', 'espana', 'eventos'],
      'balanced', 3,
      'Creador fuerte en eventos; puede moverse por directos y colaboraciones.',
      97.35, 94.80, 97.35, 2100
    ),
    (
      '10000000-0000-4000-8000-000000000014'::uuid,
      'auronplay', 'AURON', 'AuronPlay', 'Espana', 'Streaming',
      'creadores', 'streaming', 'Creador de contenido',
      ARRAY['creadores', 'streaming', 'espana'],
      'balanced', 3,
      'Base amplia con movimientos moderados segun actividad y conversacion.',
      89.90, 88.40, 89.90, 1850
    ),
    (
      '10000000-0000-4000-8000-000000000015'::uuid,
      'thegrefg', 'GREFG', 'TheGrefg', 'Espana', 'Gaming',
      'creadores', 'gaming', 'Creador de contenido',
      ARRAY['creadores', 'gaming', 'espana', 'streaming'],
      'volatile', 4,
      'Perfil sensible a eventos de gaming, directos y colaboraciones.',
      80.70, 79.10, 80.70, 1600
    ),
    (
      '10000000-0000-4000-8000-000000000016'::uuid,
      'luisito-comunica', 'LUISITO', 'Luisito Comunica', 'Mexico', 'Video digital',
      'creadores', 'viajes', 'Creador de contenido',
      ARRAY['creadores', 'youtube', 'mexico', 'viajes'],
      'balanced', 3,
      'Creador latino con actividad internacional y audiencia diversificada.',
      82.85, 81.30, 82.85, 1700
    ),
    (
      '10000000-0000-4000-8000-000000000017'::uuid,
      'el-rubius', 'RUBIUS', 'El Rubius', 'Espana', 'Gaming',
      'creadores', 'gaming', 'Creador de contenido',
      ARRAY['creadores', 'gaming', 'espana', 'youtube'],
      'stable', 2,
      'Creador historico con base defensiva y menor volatilidad diaria.',
      86.10, 85.50, 86.10, 1750
    ),
    (
      '10000000-0000-4000-8000-000000000018'::uuid,
      'zendaya', 'ZNDYA', 'Zendaya', 'Estados Unidos', 'Cine y television',
      'cine-tv', 'actuacion', 'Actriz',
      ARRAY['cine-tv', 'global', 'actuacion', 'moda'],
      'balanced', 3,
      'Figura global con picos por estrenos, alfombras rojas y campanas.',
      119.80, 117.70, 119.80, 2450
    ),
    (
      '10000000-0000-4000-8000-000000000019'::uuid,
      'pedro-pascal', 'PEDRO', 'Pedro Pascal', 'Chile/Estados Unidos', 'Cine y television',
      'cine-tv', 'actuacion', 'Actor',
      ARRAY['cine-tv', 'global', 'actuacion', 'latam'],
      'balanced', 3,
      'Actor con alta conversacion por estrenos y franquicias.',
      111.45, 108.20, 111.45, 2300
    ),
    (
      '10000000-0000-4000-8000-000000000020'::uuid,
      'jenna-ortega', 'JENNA', 'Jenna Ortega', 'Estados Unidos', 'Cine y television',
      'cine-tv', 'actuacion', 'Actriz',
      ARRAY['cine-tv', 'global', 'actuacion'],
      'volatile', 4,
      'Perfil joven con picos fuertes por estrenos, trailers y fandom.',
      99.25, 96.10, 99.25, 2050
    ),
    (
      '10000000-0000-4000-8000-000000000021'::uuid,
      'salma-hayek', 'SALMA', 'Salma Hayek', 'Mexico', 'Cine',
      'cine-tv', 'actuacion', 'Actriz y productora',
      ARRAY['cine-tv', 'mexico', 'actuacion'],
      'stable', 2,
      'Figura consolidada con comportamiento mas defensivo y picos por apariciones.',
      78.40, 77.60, 78.40, 1500
    ),
    (
      '10000000-0000-4000-8000-000000000022'::uuid,
      'dwayne-johnson', 'ROCK', 'Dwayne Johnson', 'Estados Unidos', 'Cine',
      'cine-tv', 'actuacion', 'Actor',
      ARRAY['cine-tv', 'global', 'accion', 'fitness'],
      'balanced', 3,
      'Marca personal fuerte con movimientos por cine, deporte y negocios.',
      113.65, 112.20, 113.65, 2400
    ),
    (
      '10000000-0000-4000-8000-000000000023'::uuid,
      'selena-gomez', 'SELENA', 'Selena Gomez', 'Estados Unidos', 'Musica y television',
      'cine-tv', 'musica-actuacion', 'Artista y actriz',
      ARRAY['cine-tv', 'musica', 'global', 'pop'],
      'stable', 2,
      'Figura transversal con demanda sostenida en musica, television y marca personal.',
      109.20, 106.90, 109.20, 2250
    ),
    (
      '10000000-0000-4000-8000-000000000024'::uuid,
      'lionel-messi', 'MESSI', 'Lionel Messi', 'Argentina', 'Futbol',
      'deportes', 'futbol', 'Futbolista',
      ARRAY['deportes', 'futbol', 'argentina', 'global'],
      'stable', 2,
      'Leyenda estable; picos por partidos, records y noticias verificadas.',
      141.30, 139.00, 141.30, 3400
    ),
    (
      '10000000-0000-4000-8000-000000000025'::uuid,
      'cristiano-ronaldo', 'CR7', 'Cristiano Ronaldo', 'Portugal', 'Futbol',
      'deportes', 'futbol', 'Futbolista',
      ARRAY['deportes', 'futbol', 'portugal', 'global'],
      'stable', 2,
      'Figura global con base defensiva y picos por goles o records.',
      137.75, 136.20, 137.75, 3350
    ),
    (
      '10000000-0000-4000-8000-000000000026'::uuid,
      'neymar', 'NEY', 'Neymar', 'Brasil', 'Futbol',
      'deportes', 'futbol', 'Futbolista',
      ARRAY['deportes', 'futbol', 'brasil', 'global'],
      'volatile', 4,
      'Alta volatilidad por lesiones, fichajes, partidos y actividad social.',
      102.55, 101.20, 102.55, 2150
    ),
    (
      '10000000-0000-4000-8000-000000000027'::uuid,
      'lebron-james', 'LBRON', 'LeBron James', 'Estados Unidos', 'Baloncesto',
      'deportes', 'baloncesto', 'Baloncestista',
      ARRAY['deportes', 'nba', 'usa', 'global'],
      'stable', 2,
      'Perfil deportivo global, estable y sensible a records o finales.',
      124.50, 122.80, 124.50, 2750
    ),
    (
      '10000000-0000-4000-8000-000000000028'::uuid,
      'carlos-alcaraz', 'ALCRZ', 'Carlos Alcaraz', 'Espana', 'Tenis',
      'deportes', 'tenis', 'Tenista',
      ARRAY['deportes', 'tenis', 'espana'],
      'volatile', 4,
      'Perfil deportivo con movimientos por torneos, lesiones y rankings.',
      95.95, 92.80, 95.95, 2000
    ),
    (
      '10000000-0000-4000-8000-000000000029'::uuid,
      'simone-biles', 'BILES', 'Simone Biles', 'Estados Unidos', 'Gimnasia',
      'deportes', 'gimnasia', 'Gimnasta',
      ARRAY['deportes', 'gimnasia', 'usa', 'olimpicos'],
      'balanced', 3,
      'Figura deportiva de reconocimiento alto con picos por competencias mayores.',
      90.35, 88.90, 90.35, 1850
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
    ('karol-g'), ('bad-bunny'), ('shakira'), ('feid'), ('j-balvin'),
    ('rauw-alejandro'), ('peso-pluma'), ('anitta'), ('dua-lipa'),
    ('taylor-swift'), ('drake'), ('mrbeast'), ('ibai-llanos'),
    ('auronplay'), ('thegrefg'), ('luisito-comunica'), ('el-rubius'),
    ('zendaya'), ('pedro-pascal'), ('jenna-ortega'), ('salma-hayek'),
    ('dwayne-johnson'), ('selena-gomez'), ('lionel-messi'),
    ('cristiano-ronaldo'), ('neymar'), ('lebron-james'),
    ('carlos-alcaraz'), ('simone-biles')
),
points (multiplier, age) AS (
  VALUES
    (0.985::numeric, INTERVAL '72 hours'),
    (0.995::numeric, INTERVAL '48 hours'),
    (1.004::numeric, INTERVAL '24 hours'),
    (1.000::numeric, INTERVAL '0 hours')
)
INSERT INTO price_ticks (artist_id, season_id, price, created_at)
SELECT
  artist.id,
  season.id,
  ROUND((artist.current_price * points.multiplier)::numeric, 6),
  NOW() - points.age
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
    ('karol-g', 'es.wikipedia.org', 'Karol_G'),
    ('bad-bunny', 'es.wikipedia.org', 'Bad_Bunny'),
    ('shakira', 'es.wikipedia.org', 'Shakira'),
    ('feid', 'en.wikipedia.org', 'Feid'),
    ('j-balvin', 'en.wikipedia.org', 'J_Balvin'),
    ('rauw-alejandro', 'en.wikipedia.org', 'Rauw_Alejandro'),
    ('peso-pluma', 'en.wikipedia.org', 'Peso_Pluma'),
    ('anitta', 'en.wikipedia.org', 'Anitta_(singer)'),
    ('dua-lipa', 'en.wikipedia.org', 'Dua_Lipa'),
    ('taylor-swift', 'en.wikipedia.org', 'Taylor_Swift'),
    ('drake', 'en.wikipedia.org', 'Drake_(musician)'),
    ('mrbeast', 'en.wikipedia.org', 'MrBeast'),
    ('ibai-llanos', 'en.wikipedia.org', 'Ibai_Llanos'),
    ('auronplay', 'en.wikipedia.org', 'AuronPlay'),
    ('thegrefg', 'en.wikipedia.org', 'TheGrefg'),
    ('luisito-comunica', 'en.wikipedia.org', 'Luisito_Comunica'),
    ('el-rubius', 'en.wikipedia.org', 'El_Rubius'),
    ('zendaya', 'en.wikipedia.org', 'Zendaya'),
    ('pedro-pascal', 'en.wikipedia.org', 'Pedro_Pascal'),
    ('jenna-ortega', 'en.wikipedia.org', 'Jenna_Ortega'),
    ('salma-hayek', 'en.wikipedia.org', 'Salma_Hayek'),
    ('dwayne-johnson', 'en.wikipedia.org', 'Dwayne_Johnson'),
    ('selena-gomez', 'en.wikipedia.org', 'Selena_Gomez'),
    ('lionel-messi', 'en.wikipedia.org', 'Lionel_Messi'),
    ('cristiano-ronaldo', 'en.wikipedia.org', 'Cristiano_Ronaldo'),
    ('neymar', 'en.wikipedia.org', 'Neymar'),
    ('lebron-james', 'en.wikipedia.org', 'LeBron_James'),
    ('carlos-alcaraz', 'en.wikipedia.org', 'Carlos_Alcaraz'),
    ('simone-biles', 'en.wikipedia.org', 'Simone_Biles')
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
