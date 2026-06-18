ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS volatility_profile TEXT NOT NULL DEFAULT 'balanced'
    CHECK (volatility_profile IN ('stable', 'balanced', 'volatile', 'underdog')),
  ADD COLUMN IF NOT EXISTS risk_level INTEGER NOT NULL DEFAULT 3
    CHECK (risk_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS strategy_notes TEXT NOT NULL DEFAULT '';

UPDATE artists
SET volatility_profile = 'balanced',
  risk_level = 3,
  strategy_notes = 'Figura de alta demanda con actividad frecuente y liquidez media.'
WHERE slug = 'karol-g';

UPDATE artists
SET volatility_profile = 'volatile',
  risk_level = 4,
  strategy_notes = 'Figura muy seguida; puede moverse fuerte con lanzamientos, tendencias o noticias verificadas.'
WHERE slug = 'bad-bunny';

UPDATE artists
SET volatility_profile = 'stable',
  risk_level = 2,
  strategy_notes = 'Figura consolidada con base amplia; perfil mas defensivo dentro del mercado ficticio.'
WHERE slug = 'shakira';
