import { createHash, randomUUID } from 'node:crypto';
import { databaseConfigured, getPool } from './database.js';
import { MarketError } from './market.js';

export const imageUsageStatuses = [
  'none',
  'unverified',
  'owned',
  'licensed',
  'provider_authorized'
] as const;

export type ImageUsageStatus = (typeof imageUsageStatuses)[number];
export type RightsRequestType =
  | 'correction'
  | 'removal'
  | 'trademark'
  | 'image'
  | 'other';
export type RightsRequestStatus =
  | 'open'
  | 'reviewing'
  | 'resolved'
  | 'rejected';

export function publicArtistImage(
  imageUrl: string | null | undefined,
  status: ImageUsageStatus | null | undefined
) {
  return status === 'owned' ||
    status === 'licensed' ||
    status === 'provider_authorized'
    ? imageUrl?.trim() ?? ''
    : '';
}

interface RightsRequestInput {
  requesterName: string;
  requesterEmail: string;
  requestType: RightsRequestType;
  subject: string;
  message: string;
  evidenceUrl?: string;
}

const memoryRequests: Array<
  RightsRequestInput & {
    id: string;
    status: RightsRequestStatus;
    adminNotes: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  }
> = [];

function hashIp(ip: string) {
  return createHash('sha256')
    .update(`${process.env.RIGHTS_IP_HASH_SALT ?? 'development'}:${ip}`)
    .digest('hex');
}

export async function createRightsRequest(
  input: RightsRequestInput,
  sourceIp: string
) {
  if (!databaseConfigured()) {
    const now = new Date().toISOString();
    const request = {
      ...input,
      id: randomUUID(),
      status: 'open' as const,
      adminNotes: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null
    };
    memoryRequests.unshift(request);
    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt
    };
  }

  const result = await getPool().query<{
    id: string;
    status: RightsRequestStatus;
    created_at: Date;
  }>(
    `
      INSERT INTO rights_requests (
        requester_name, requester_email, request_type, subject, message,
        evidence_url, source_ip_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, status, created_at
    `,
    [
      input.requesterName,
      input.requesterEmail,
      input.requestType,
      input.subject,
      input.message,
      input.evidenceUrl || null,
      hashIp(sourceIp)
    ]
  );
  return {
    id: result.rows[0]!.id,
    status: result.rows[0]!.status,
    createdAt: result.rows[0]!.created_at.toISOString()
  };
}

export async function listRightsRequests() {
  if (!databaseConfigured()) return memoryRequests;

  const result = await getPool().query<{
    id: string;
    requester_name: string;
    requester_email: string;
    request_type: RightsRequestType;
    subject: string;
    message: string;
    evidence_url: string | null;
    status: RightsRequestStatus;
    admin_notes: string | null;
    created_at: Date;
    updated_at: Date;
    resolved_at: Date | null;
  }>(`
    SELECT id, requester_name, requester_email, request_type, subject, message,
      evidence_url, status, admin_notes, created_at, updated_at, resolved_at
    FROM rights_requests
    ORDER BY
      CASE status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 250
  `);
  return result.rows.map((row) => ({
    id: row.id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requestType: row.request_type,
    subject: row.subject,
    message: row.message,
    evidenceUrl: row.evidence_url,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null
  }));
}

export async function updateRightsRequest(
  requestId: string,
  status: RightsRequestStatus,
  adminNotes: string | null,
  actor = 'admin'
) {
  if (!databaseConfigured()) {
    const request = memoryRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new MarketError(
        'Solicitud de derechos no encontrada.',
        'RIGHTS_REQUEST_NOT_FOUND',
        404
      );
    }
    request.status = status;
    request.adminNotes = adminNotes;
    request.updatedAt = new Date().toISOString();
    request.resolvedAt =
      status === 'resolved' || status === 'rejected'
        ? request.updatedAt
        : null;
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        UPDATE rights_requests
        SET status = $2,
          admin_notes = $3,
          updated_at = NOW(),
          resolved_at = CASE
            WHEN $2 IN ('resolved', 'rejected') THEN NOW()
            ELSE NULL
          END
        WHERE id = $1
        RETURNING id
      `,
      [requestId, status, adminNotes]
    );
    if (!result.rowCount) {
      throw new MarketError(
        'Solicitud de derechos no encontrada.',
        'RIGHTS_REQUEST_NOT_FOUND',
        404
      );
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES ($1, 'rights.request.review', 'rights_request', $2, $3)
      `,
      [actor, requestId, { status, adminNotes }]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listArtistRights() {
  if (!databaseConfigured()) return [];
  const result = await getPool().query<{
    id: string;
    name: string;
    symbol: string;
    image_url: string | null;
    image_usage_status: ImageUsageStatus;
    image_source_url: string | null;
    image_license: string | null;
    image_attribution: string | null;
    rights_reviewed_at: Date | null;
    rights_notes: string | null;
  }>(`
    SELECT id, name, symbol, image_url, image_usage_status, image_source_url,
      image_license, image_attribution, rights_reviewed_at, rights_notes
    FROM artists
    ORDER BY name
  `);
  return result.rows.map((row) => ({
    artistId: row.id,
    artistName: row.name,
    artistSymbol: row.symbol,
    imageUrl: row.image_url ?? '',
    imageUsageStatus: row.image_usage_status,
    imageSourceUrl: row.image_source_url ?? '',
    imageLicense: row.image_license ?? '',
    imageAttribution: row.image_attribution ?? '',
    rightsReviewedAt: row.rights_reviewed_at?.toISOString() ?? null,
    rightsNotes: row.rights_notes ?? ''
  }));
}

interface ArtistRightsInput {
  imageUrl: string;
  imageUsageStatus: ImageUsageStatus;
  imageSourceUrl: string;
  imageLicense: string;
  imageAttribution: string;
  rightsNotes: string;
}

export async function updateArtistRights(
  artistId: string,
  input: ArtistRightsInput,
  actor = 'admin'
) {
  if (!databaseConfigured()) {
    throw new MarketError(
      'El registro de licencias requiere PostgreSQL.',
      'DATABASE_REQUIRED',
      503
    );
  }
  const approved = ['owned', 'licensed', 'provider_authorized'].includes(
    input.imageUsageStatus
  );
  if (approved && (!input.imageUrl || !input.imageSourceUrl)) {
    throw new MarketError(
      'Una imagen aprobada requiere URL de imagen y fuente verificable.',
      'IMAGE_RIGHTS_INCOMPLETE'
    );
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        UPDATE artists
        SET image_url = NULLIF($2, ''),
          image_usage_status = $3,
          image_source_url = NULLIF($4, ''),
          image_license = NULLIF($5, ''),
          image_attribution = NULLIF($6, ''),
          rights_reviewed_at = NOW(),
          rights_notes = NULLIF($7, '')
        WHERE id = $1
        RETURNING id
      `,
      [
        artistId,
        input.imageUrl,
        input.imageUsageStatus,
        input.imageSourceUrl,
        input.imageLicense,
        input.imageAttribution,
        input.rightsNotes
      ]
    );
    if (!result.rowCount) {
      throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES ($1, 'artist.rights.update', 'artist', $2, $3)
      `,
      [
        actor,
        artistId,
        {
          imageUsageStatus: input.imageUsageStatus,
          imageSourceUrl: input.imageSourceUrl,
          imageLicense: input.imageLicense,
          imageAttribution: input.imageAttribution
        }
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
