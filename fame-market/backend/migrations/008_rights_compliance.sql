ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS image_usage_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS image_source_url TEXT,
  ADD COLUMN IF NOT EXISTS image_license TEXT,
  ADD COLUMN IF NOT EXISTS image_attribution TEXT,
  ADD COLUMN IF NOT EXISTS rights_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rights_notes TEXT;

ALTER TABLE artists
  DROP CONSTRAINT IF EXISTS artists_image_usage_status_check;

ALTER TABLE artists
  ADD CONSTRAINT artists_image_usage_status_check
  CHECK (
    image_usage_status IN (
      'none',
      'unverified',
      'owned',
      'licensed',
      'provider_authorized'
    )
  );

CREATE TABLE IF NOT EXISTS rights_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (
    request_type IN ('correction', 'removal', 'trademark', 'image', 'other')
  ),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  evidence_url TEXT,
  source_ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'reviewing', 'resolved', 'rejected')
  ),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rights_requests_status_created_idx
  ON rights_requests (status, created_at DESC);

UPDATE artists
SET image_usage_status = 'unverified',
    rights_reviewed_at = NULL
WHERE image_url IS NOT NULL
  AND image_usage_status NOT IN ('owned', 'licensed', 'provider_authorized');
