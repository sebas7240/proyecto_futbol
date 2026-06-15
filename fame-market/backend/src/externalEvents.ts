import { getPool } from './database.js';
import { MarketError } from './market.js';

export const externalEventTypes = [
  'correction',
  'media',
  'platform',
  'legal',
  'manual'
] as const;

export const externalEventDirections = [
  'positive',
  'negative',
  'neutral'
] as const;

export const externalEventVisibilityStatuses = [
  'draft',
  'public',
  'archived'
] as const;

export const externalEventReviewStatuses = [
  'pending',
  'approved',
  'rejected'
] as const;

export interface ExternalEventInput {
  eventType: (typeof externalEventTypes)[number];
  title: string;
  description: string;
  sourceUrl: string;
  occurredAt: string;
  impactDirection: (typeof externalEventDirections)[number];
  proposedDeltaBps: number;
  visibilityStatus: (typeof externalEventVisibilityStatuses)[number];
  reviewStatus: (typeof externalEventReviewStatuses)[number];
  adminNotes: string;
}

interface ExternalEventRow {
  id: string;
  artist_id: string;
  artist_name: string;
  artist_slug: string;
  event_type: ExternalEventInput['eventType'];
  title: string;
  description: string;
  source_url: string;
  occurred_at: Date;
  impact_direction: ExternalEventInput['impactDirection'];
  proposed_delta_bps: number;
  applied_delta_bps: number;
  visibility_status: ExternalEventInput['visibilityStatus'];
  review_status: ExternalEventInput['reviewStatus'];
  created_by: string;
  reviewed_by: string | null;
  admin_notes: string;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
}

function mapEvent(row: ExternalEventRow) {
  return {
    id: row.id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    artistSlug: row.artist_slug,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    occurredAt: row.occurred_at.toISOString(),
    impactDirection: row.impact_direction,
    proposedDeltaBps: row.proposed_delta_bps,
    appliedDeltaBps: row.applied_delta_bps,
    visibilityStatus: row.visibility_status,
    reviewStatus: row.review_status,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    adminNotes: row.admin_notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null
  };
}

export async function listPublicExternalEventsBySlug(
  slug: string,
  limit = 8
) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const result = await getPool().query<ExternalEventRow>(
    `
      SELECT event.*, artist.name AS artist_name, artist.slug AS artist_slug
      FROM external_events event
      JOIN artists artist ON artist.id = event.artist_id
      WHERE artist.slug = $1
        AND event.visibility_status = 'public'
        AND event.review_status = 'approved'
      ORDER BY event.occurred_at DESC, event.created_at DESC
      LIMIT $2
    `,
    [slug, safeLimit]
  );
  return result.rows.map(mapEvent);
}

export async function listAdminExternalEvents(limit = 100) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const result = await getPool().query<ExternalEventRow>(
    `
      SELECT event.*, artist.name AS artist_name, artist.slug AS artist_slug
      FROM external_events event
      JOIN artists artist ON artist.id = event.artist_id
      ORDER BY event.created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );
  return result.rows.map(mapEvent);
}

export async function createExternalEvent(
  artistId: string,
  input: ExternalEventInput,
  createdBy: string
) {
  const artist = await getPool().query('SELECT id FROM artists WHERE id = $1', [
    artistId
  ]);
  if (!artist.rowCount) {
    throw new MarketError('Figura no encontrada.', 'ARTIST_NOT_FOUND', 404);
  }
  const result = await getPool().query<ExternalEventRow>(
    `
      INSERT INTO external_events (
        artist_id, event_type, title, description, source_url, occurred_at,
        impact_direction, proposed_delta_bps, visibility_status,
        review_status, created_by, admin_notes, reviewed_by, reviewed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        CASE WHEN $10 IN ('approved', 'rejected') THEN $11 ELSE NULL END,
        CASE WHEN $10 IN ('approved', 'rejected') THEN NOW() ELSE NULL END
      )
      RETURNING *,
        (SELECT name FROM artists WHERE id = $1) AS artist_name,
        (SELECT slug FROM artists WHERE id = $1) AS artist_slug
    `,
    [
      artistId,
      input.eventType,
      input.title,
      input.description,
      input.sourceUrl,
      input.occurredAt,
      input.impactDirection,
      input.proposedDeltaBps,
      input.visibilityStatus,
      input.reviewStatus,
      createdBy,
      input.adminNotes
    ]
  );
  return mapEvent(result.rows[0]!);
}

export async function updateExternalEvent(
  eventId: string,
  input: Partial<ExternalEventInput>,
  reviewedBy: string
) {
  const current = await getPool().query<ExternalEventRow>(
    `
      SELECT event.*, artist.name AS artist_name, artist.slug AS artist_slug
      FROM external_events event
      JOIN artists artist ON artist.id = event.artist_id
      WHERE event.id = $1
    `,
    [eventId]
  );
  const event = current.rows[0];
  if (!event) {
    throw new MarketError('Evento no encontrado.', 'EXTERNAL_EVENT_NOT_FOUND', 404);
  }
  const nextReviewStatus = input.reviewStatus ?? event.review_status;
  const result = await getPool().query<ExternalEventRow>(
    `
      UPDATE external_events
      SET event_type = $2,
        title = $3,
        description = $4,
        source_url = $5,
        occurred_at = $6,
        impact_direction = $7,
        proposed_delta_bps = $8,
        visibility_status = $9,
        review_status = $10,
        admin_notes = $11,
        reviewed_by = CASE
          WHEN $10 IN ('approved', 'rejected') THEN $12
          ELSE reviewed_by
        END,
        reviewed_at = CASE
          WHEN $10 IN ('approved', 'rejected') THEN NOW()
          ELSE reviewed_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *,
        (SELECT name FROM artists WHERE id = external_events.artist_id) AS artist_name,
        (SELECT slug FROM artists WHERE id = external_events.artist_id) AS artist_slug
    `,
    [
      eventId,
      input.eventType ?? event.event_type,
      input.title ?? event.title,
      input.description ?? event.description,
      input.sourceUrl ?? event.source_url,
      input.occurredAt ?? event.occurred_at.toISOString(),
      input.impactDirection ?? event.impact_direction,
      input.proposedDeltaBps ?? event.proposed_delta_bps,
      input.visibilityStatus ?? event.visibility_status,
      nextReviewStatus,
      input.adminNotes ?? event.admin_notes,
      reviewedBy
    ]
  );
  return mapEvent(result.rows[0]!);
}
