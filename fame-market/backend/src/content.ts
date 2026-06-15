import { databaseConfigured, getPool } from './database.js';

type Numeric = string | number;

const number = (value: Numeric | null | undefined) => Number(value ?? 0);

export interface EntityContentItem {
  id: string;
  provider: string;
  contentType: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  sourceUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  capturedAt: string | null;
}

export interface EntitySource {
  id: string;
  provider: string;
  sourceType: string;
  externalId: string;
  sourceUrl: string;
  displayName: string;
  isPrimary: boolean;
  usageMode: string;
  licenseNotes: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export function contentToVideoSnapshot(item: EntityContentItem) {
  return {
    id: item.id,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    publishedAt: item.publishedAt ?? '',
    viewCount: item.viewCount,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    youtubeUrl: item.sourceUrl,
    capturedAt: item.capturedAt
  };
}

export async function listEntityContent(
  artistId: string,
  limit = 8
): Promise<EntityContentItem[]> {
  if (!databaseConfigured()) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const result = await getPool().query<{
    id: string;
    provider: string;
    content_type: string;
    title: string;
    thumbnail_url: string | null;
    published_at: Date | null;
    duration_seconds: number | null;
    source_url: string;
    view_count: Numeric;
    like_count: Numeric;
    comment_count: Numeric;
    captured_at: Date | null;
  }>(
    `
      SELECT item.id, item.provider, item.content_type, item.title,
        item.thumbnail_url, item.published_at, item.duration_seconds,
        item.source_url,
        COALESCE(snapshot.view_count, 0) AS view_count,
        COALESCE(snapshot.like_count, 0) AS like_count,
        COALESCE(snapshot.comment_count, 0) AS comment_count,
        snapshot.captured_at
      FROM content_items item
      LEFT JOIN LATERAL (
        SELECT view_count, like_count, comment_count, captured_at
        FROM content_snapshots
        WHERE content_item_id = item.id
        ORDER BY captured_at DESC
        LIMIT 1
      ) snapshot ON TRUE
      WHERE item.artist_id = $1
        AND item.eligibility_status = 'eligible'
      ORDER BY item.published_at DESC NULLS LAST, item.last_synced_at DESC
      LIMIT $2
    `,
    [artistId, safeLimit]
  );
  return result.rows.map((item) => ({
    id: item.id,
    provider: item.provider,
    contentType: item.content_type,
    title: item.title,
    thumbnailUrl: item.thumbnail_url ?? '',
    publishedAt: item.published_at
      ? new Date(item.published_at).toISOString()
      : null,
    durationSeconds: item.duration_seconds,
    sourceUrl: item.source_url,
    viewCount: number(item.view_count),
    likeCount: number(item.like_count),
    commentCount: number(item.comment_count),
    capturedAt: item.captured_at
      ? new Date(item.captured_at).toISOString()
      : null
  }));
}

export async function listEntitySourcesBySlug(
  slug: string
): Promise<EntitySource[]> {
  if (!databaseConfigured()) return [];
  const result = await getPool().query<{
    id: string;
    provider: string;
    source_type: string;
    external_id: string;
    source_url: string;
    display_name: string;
    is_primary: boolean;
    usage_mode: string;
    license_notes: string;
    last_synced_at: Date | null;
    last_error: string | null;
  }>(
    `
      SELECT source.id, source.provider, source.source_type,
        source.external_id, source.source_url, source.display_name,
        source.is_primary, source.usage_mode, source.license_notes,
        source.last_synced_at, source.last_error
      FROM entity_sources source
      JOIN artists artist ON artist.id = source.artist_id
      WHERE artist.slug = $1
      ORDER BY source.is_primary DESC, source.provider ASC, source.display_name ASC
    `,
    [slug]
  );
  return result.rows.map((source) => ({
    id: source.id,
    provider: source.provider,
    sourceType: source.source_type,
    externalId: source.external_id,
    sourceUrl: source.source_url,
    displayName: source.display_name,
    isPrimary: source.is_primary,
    usageMode: source.usage_mode,
    licenseNotes: source.license_notes,
    lastSyncedAt: source.last_synced_at
      ? new Date(source.last_synced_at).toISOString()
      : null,
    lastError: source.last_error
  }));
}
