ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'musica',
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS theme_tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE artists
  DROP CONSTRAINT IF EXISTS artists_category_check;

ALTER TABLE artists
  ADD CONSTRAINT artists_category_check
  CHECK (category IN ('musica', 'creadores', 'cine-tv', 'deportes', 'otros'));

UPDATE artists
SET category = 'musica',
    subcategory = CASE slug
      WHEN 'karol-g' THEN 'urbano-latino'
      WHEN 'bad-bunny' THEN 'trap-latino'
      WHEN 'shakira' THEN 'pop-latino'
      ELSE LOWER(REPLACE(genre, ' ', '-'))
    END,
    profession = CASE slug
      WHEN 'bad-bunny' THEN 'Cantante y compositor'
      ELSE 'Artista musical'
    END,
    theme_tags = CASE slug
      WHEN 'karol-g' THEN ARRAY['musica', 'latino', 'colombia', 'urbano']
      WHEN 'bad-bunny' THEN ARRAY['musica', 'latino', 'puerto-rico', 'trap']
      WHEN 'shakira' THEN ARRAY['musica', 'latino', 'colombia', 'pop']
      ELSE ARRAY['musica']
    END
WHERE category = 'musica';

CREATE TABLE IF NOT EXISTS user_interests (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('musica', 'creadores', 'cine-tv', 'deportes', 'otros')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category)
);

CREATE INDEX IF NOT EXISTS artists_category_status_idx
  ON artists (category, status, current_price DESC);
