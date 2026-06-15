import { getPool } from './database.js';
import { MarketError } from './market.js';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

interface YouTubeChannel {
  id: string;
  snippet?: {
    title?: string;
    customUrl?: string;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface YouTubePlaylistItem {
  contentDetails?: {
    videoId?: string;
  };
}

interface YouTubeVideo {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: {
    duration?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

function apiKey() {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new MarketError(
      'YOUTUBE_API_KEY no esta configurada.',
      'YOUTUBE_NOT_CONFIGURED',
      503
    );
  }
  return process.env.YOUTUBE_API_KEY;
}

async function youtubeRequest<T>(
  resource: string,
  parameters: Record<string, string>
): Promise<T> {
  const url = new URL(`${YOUTUBE_API}/${resource}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('key', apiKey());

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(12_000)
  });
  const body = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new MarketError(
      body.error?.message ?? 'YouTube no pudo completar la solicitud.',
      'YOUTUBE_API_ERROR',
      502
    );
  }
  return body;
}

function durationInSeconds(duration?: string) {
  if (!duration) return null;
  const match = duration.match(
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
  );
  if (!match) return null;
  return (
    Number(match[1] ?? 0) * 86_400 +
    Number(match[2] ?? 0) * 3_600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}

function bestThumbnail(video: YouTubeVideo) {
  const thumbnails = video.snippet?.thumbnails;
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ''
  );
}

export async function resolveYouTubeChannel(input: {
  channelId?: string;
  handle?: string;
}) {
  if (!input.channelId && !input.handle) {
    throw new MarketError(
      'Envia channelId o handle.',
      'YOUTUBE_CHANNEL_REQUIRED'
    );
  }
  const parameters: Record<string, string> = {
    part: 'snippet,contentDetails'
  };
  if (input.channelId) parameters.id = input.channelId;
  else parameters.forHandle = input.handle!.replace(/^@/, '');

  const body = await youtubeRequest<{ items?: YouTubeChannel[] }>(
    'channels',
    parameters
  );
  const channel = body.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel || !uploadsPlaylistId) {
    throw new MarketError(
      'No se encontro un canal oficial con ese identificador.',
      'YOUTUBE_CHANNEL_NOT_FOUND',
      404
    );
  }
  return {
    youtubeChannelId: channel.id,
    uploadsPlaylistId,
    channelTitle: channel.snippet?.title ?? channel.id,
    handle: channel.snippet?.customUrl ?? input.handle ?? null
  };
}

export async function registerArtistChannel(
  artistId: string,
  input: { channelId?: string; handle?: string; isPrimary?: boolean }
) {
  const artist = await getPool().query('SELECT id FROM artists WHERE id = $1', [
    artistId
  ]);
  if (!artist.rowCount) {
    throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
  }
  const channel = await resolveYouTubeChannel(input);
  const result = await getPool().query(
    `
      INSERT INTO artist_channels (
        artist_id, youtube_channel_id, uploads_playlist_id, channel_title,
        handle, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (youtube_channel_id)
      DO UPDATE SET
        artist_id = EXCLUDED.artist_id,
        uploads_playlist_id = EXCLUDED.uploads_playlist_id,
        channel_title = EXCLUDED.channel_title,
        handle = EXCLUDED.handle,
        is_primary = EXCLUDED.is_primary
      RETURNING *
    `,
    [
      artistId,
      channel.youtubeChannelId,
      channel.uploadsPlaylistId,
      channel.channelTitle,
      channel.handle,
      input.isPrimary ?? true
    ]
  );
  const savedChannel = result.rows[0];
  await getPool().query(
    `
      INSERT INTO entity_sources (
        artist_id, provider, source_type, external_id, source_url,
        display_name, is_primary, usage_mode, license_notes, metadata,
        last_synced_at
      ) VALUES ($1, 'youtube', 'channel', $2, $3, $4, $5, 'display_only', $6, $7, NOW())
      ON CONFLICT (artist_id, provider, external_id)
      DO UPDATE SET
        source_url = EXCLUDED.source_url,
        display_name = EXCLUDED.display_name,
        is_primary = EXCLUDED.is_primary,
        metadata = EXCLUDED.metadata,
        last_synced_at = EXCLUDED.last_synced_at,
        last_error = NULL
    `,
    [
      artistId,
      channel.youtubeChannelId,
      `https://www.youtube.com/channel/${channel.youtubeChannelId}`,
      channel.channelTitle,
      input.isPrimary ?? true,
      'Datos publicos de YouTube usados como referencia informativa.',
      {
        uploadsPlaylistId: channel.uploadsPlaylistId,
        handle: channel.handle
      }
    ]
  );
  return savedChannel;
}

export async function syncArtistChannel(channelId: string) {
  const channelResult = await getPool().query<{
    id: string;
    artist_id: string;
    youtube_channel_id: string;
    uploads_playlist_id: string;
    channel_title: string;
    handle: string | null;
    is_primary: boolean;
  }>(
    `
      SELECT id, artist_id, youtube_channel_id, uploads_playlist_id,
        channel_title, handle, is_primary
      FROM artist_channels
      WHERE id = $1
    `,
    [channelId]
  );
  const channel = channelResult.rows[0];
  if (!channel) {
    throw new MarketError(
      'Canal de artista no encontrado.',
      'ARTIST_CHANNEL_NOT_FOUND',
      404
    );
  }

  const playlist = await youtubeRequest<{ items?: YouTubePlaylistItem[] }>(
    'playlistItems',
    {
      part: 'contentDetails',
      playlistId: channel.uploads_playlist_id,
      maxResults: '10'
    }
  );
  const videoIds = (playlist.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((value): value is string => Boolean(value));
  if (!videoIds.length) {
    await getPool().query(
      'UPDATE artist_channels SET last_synced_at = NOW() WHERE id = $1',
      [channel.id]
    );
    await getPool().query(
      `
        UPDATE entity_sources
        SET last_synced_at = NOW(), last_error = NULL
        WHERE artist_id = $1
          AND provider = 'youtube'
          AND external_id = $2
      `,
      [channel.artist_id, channel.youtube_channel_id]
    );
    return { channelId: channel.id, videos: 0 };
  }

  const body = await youtubeRequest<{ items?: YouTubeVideo[] }>('videos', {
    part: 'snippet,statistics,contentDetails',
    id: videoIds.join(',')
  });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const sourceResult = await client.query<{ id: string }>(
      `
        INSERT INTO entity_sources (
          artist_id, provider, source_type, external_id, source_url,
          display_name, is_primary, usage_mode, license_notes, metadata,
          last_synced_at
        ) VALUES ($1, 'youtube', 'channel', $2, $3, $4, $5, 'display_only', $6, $7, NOW())
        ON CONFLICT (artist_id, provider, external_id)
        DO UPDATE SET
          source_url = EXCLUDED.source_url,
          display_name = EXCLUDED.display_name,
          is_primary = EXCLUDED.is_primary,
          metadata = EXCLUDED.metadata,
          last_synced_at = EXCLUDED.last_synced_at,
          last_error = NULL
        RETURNING id
      `,
      [
        channel.artist_id,
        channel.youtube_channel_id,
        `https://www.youtube.com/channel/${channel.youtube_channel_id}`,
        channel.channel_title,
        channel.is_primary,
        'Datos publicos de YouTube usados como referencia informativa.',
        {
          uploadsPlaylistId: channel.uploads_playlist_id,
          handle: channel.handle
        }
      ]
    );
    const sourceId = sourceResult.rows[0]!.id;
    let synced = 0;
    for (const video of body.items ?? []) {
      if (
        !video.snippet?.publishedAt ||
        video.snippet.liveBroadcastContent === 'live'
      ) {
        continue;
      }
      const duration = durationInSeconds(video.contentDetails?.duration);
      const videoType = duration !== null && duration <= 60 ? 'short' : 'video';
      const saved = await client.query<{ id: string }>(
        `
          INSERT INTO videos (
            artist_id, artist_channel_id, youtube_video_id, title,
            thumbnail_url, published_at, duration_seconds, video_type,
            youtube_url, last_synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (youtube_video_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            thumbnail_url = EXCLUDED.thumbnail_url,
            published_at = EXCLUDED.published_at,
            duration_seconds = EXCLUDED.duration_seconds,
            video_type = EXCLUDED.video_type,
            youtube_url = EXCLUDED.youtube_url,
            last_synced_at = NOW()
          RETURNING id
        `,
        [
          channel.artist_id,
          channel.id,
          video.id,
          video.snippet.title ?? 'Video oficial',
          bestThumbnail(video),
          video.snippet.publishedAt,
          duration,
          videoType,
          `https://www.youtube.com/watch?v=${video.id}`
        ]
      );
      await client.query(
        `
          INSERT INTO video_snapshots (
            video_id, view_count, like_count, comment_count
          ) VALUES ($1, $2, $3, $4)
        `,
        [
          saved.rows[0]!.id,
          Number(video.statistics?.viewCount ?? 0),
          Number(video.statistics?.likeCount ?? 0),
          Number(video.statistics?.commentCount ?? 0)
        ]
      );
      const contentItem = await client.query<{ id: string }>(
        `
          INSERT INTO content_items (
            artist_id, source_id, provider, external_id, content_type, title,
            thumbnail_url, published_at, duration_seconds, source_url,
            eligibility_status, metadata, last_synced_at
          ) VALUES ($1, $2, 'youtube', $3, $4, $5, $6, $7, $8, $9, 'eligible', $10, NOW())
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
            last_synced_at = NOW()
          RETURNING id
        `,
        [
          channel.artist_id,
          sourceId,
          video.id,
          videoType,
          video.snippet.title ?? 'Video oficial',
          bestThumbnail(video),
          video.snippet.publishedAt,
          duration,
          `https://www.youtube.com/watch?v=${video.id}`,
          { legacyVideoId: saved.rows[0]!.id }
        ]
      );
      await client.query(
        `
          INSERT INTO content_snapshots (
            content_item_id, view_count, like_count, comment_count
          ) VALUES ($1, $2, $3, $4)
        `,
        [
          contentItem.rows[0]!.id,
          Number(video.statistics?.viewCount ?? 0),
          Number(video.statistics?.likeCount ?? 0),
          Number(video.statistics?.commentCount ?? 0)
        ]
      );
      synced += 1;
    }
    await client.query(
      'UPDATE artist_channels SET last_synced_at = NOW() WHERE id = $1',
      [channel.id]
    );
    if (synced > 0) {
      await client.query(
        `
          DELETE FROM videos
          WHERE artist_id = $1
            AND youtube_video_id LIKE 'demo-%'
        `,
        [channel.artist_id]
      );
    }
    await client.query('COMMIT');
    return { channelId: channel.id, videos: synced };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncYouTubeChannels(artistId?: string) {
  const result = await getPool().query<{ id: string }>(
    `
      SELECT id
      FROM artist_channels
      WHERE ($1::uuid IS NULL OR artist_id = $1::uuid)
      ORDER BY is_primary DESC, created_at ASC
    `,
    [artistId ?? null]
  );
  const outcomes = [];
  for (const channel of result.rows) {
    try {
      outcomes.push({
        ok: true,
        ...(await syncArtistChannel(channel.id))
      });
    } catch (error) {
      outcomes.push({
        ok: false,
        channelId: channel.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
  return outcomes;
}

export async function pruneYouTubeSnapshots() {
  const result = await getPool().query(
    `
      DELETE FROM video_snapshots
      WHERE captured_at < NOW() - INTERVAL '30 days'
    `
  );
  return result.rowCount ?? 0;
}
