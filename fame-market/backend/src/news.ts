import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { databaseConfigured, getPool } from './database.js';

const ALGORITHM_VERSION = 'news-pulse-12h-v1';
const NEWS_PROVIDER = 'gdelt';
const DEFAULT_GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const DEFAULT_GDELT_MIN_INTERVAL_MS = 6_000;
const GDELT_MAX_ATTEMPTS = 3;

let nextGdeltRequestAt = 0;

const positiveWords = new Set([
  'acuerdo', 'award', 'awards', 'collaboration', 'colaboracion', 'crece',
  'crecimiento', 'cresce', 'destaque', 'exito', 'ganador', 'ganadora', 'gana',
  'growth', 'hit', 'lidera', 'lanzamiento', 'lancamento', 'parceria', 'premio',
  'record', 'recorde', 'release', 'success', 'sucesso', 'tour', 'triunfo',
  'viral', 'winner', 'wins'
]);

const negativeWords = new Set([
  'baja', 'cae', 'caida', 'cancelado', 'cancelada', 'cancelled', 'cancels',
  'decline', 'delay', 'delayed', 'desplome', 'fracaso', 'falla', 'fall', 'falls',
  'loses', 'loss', 'perde', 'perdida', 'pierde', 'queda', 'retrasado',
  'retrasada', 'queda'
]);

const reviewWords = new Set([
  'abuse', 'abuso', 'accident', 'accidente', 'accusation', 'acusacion',
  'acusado', 'acusada', 'arrest', 'arrestado', 'arrestada', 'assault',
  'crime', 'crimen', 'death', 'demanda', 'died', 'fallece', 'fallecido',
  'fallecida', 'fraud', 'fraude', 'investigacion', 'investigation', 'lawsuit',
  'muerte', 'presunto', 'presunta', 'violence', 'violencia'
]);

const negations = new Set(['nao', 'no', 'not', 'nunca', 'sem', 'sin', 'without']);

type SignalMode = 'shadow' | 'applied' | 'skipped' | 'halted';

interface ArtistNewsTarget {
  id: string;
  slug: string;
  name: string;
  category: string;
  profession: string | null;
}

interface GdeltArticle {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

export interface NewsSignalInput {
  publishedAt: Date;
  sourceDomain: string;
  sentimentScore: number;
  reviewRequired?: boolean;
}

export interface CalculatedNewsSignal {
  articleCount: number;
  sourceCount: number;
  reviewRequiredCount: number;
  attentionScore: number;
  sentimentScore: number;
  confidence: number;
  proposedDeltaBps: number;
  recentWeight: number;
  baselineWeight: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function gdeltMinimumInterval() {
  return clamp(
    Number(process.env.NEWS_GDELT_MIN_INTERVAL_MS ?? DEFAULT_GDELT_MIN_INTERVAL_MS),
    1_000,
    30_000
  );
}

async function waitForGdeltSlot() {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextGdeltRequestAt);
  nextGdeltRequestAt = scheduledAt + gdeltMinimumInterval();
  const delay = scheduledAt - now;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function postponeGdeltRequests(delayMs: number) {
  nextGdeltRequestAt = Math.max(nextGdeltRequestAt, Date.now() + delayMs);
}

function normalizedText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function words(value: string) {
  return normalizedText(value).match(/[a-z0-9]+/g) ?? [];
}

export function analyzeNewsSentiment(title: string) {
  const tokens = words(title);
  const reviewTerms = tokens.filter((token) => reviewWords.has(token));
  let score = 0;
  let matchedTerms = 0;
  tokens.forEach((token, index) => {
    const direction = positiveWords.has(token)
      ? 1
      : negativeWords.has(token)
        ? -1
        : 0;
    if (!direction) return;
    matchedTerms += 1;
    const negated = tokens
      .slice(Math.max(0, index - 3), index)
      .some((candidate) => negations.has(candidate));
    score += negated ? -direction : direction;
  });
  const normalizedScore = matchedTerms
    ? clamp(score / Math.sqrt(matchedTerms + 1), -1, 1)
    : 0;
  const reviewRequired = reviewTerms.length > 0;
  return {
    score: reviewRequired ? 0 : normalizedScore,
    label: reviewRequired
      ? 'review'
      : normalizedScore > 0.12
        ? 'positive'
        : normalizedScore < -0.12
          ? 'negative'
          : 'neutral',
    reviewRequired,
    matchedTerms,
    reviewTerms: [...new Set(reviewTerms)]
  } as const;
}

export function calculateNewsSignal(
  input: NewsSignalInput[],
  now = new Date()
): CalculatedNewsSignal {
  const reviewRequiredCount = input.filter((item) => item.reviewRequired).length;
  const eligible = input.filter((item) => {
    const ageHours = (now.getTime() - item.publishedAt.getTime()) / 3_600_000;
    return !item.reviewRequired && ageHours >= 0 && ageHours <= 48;
  });
  let recentWeight = 0;
  let baselineWeight = 0;
  let sentimentTotal = 0;
  let sentimentWeight = 0;
  const domains = new Set<string>();

  for (const item of eligible) {
    const ageHours = (now.getTime() - item.publishedAt.getTime()) / 3_600_000;
    const recencyWeight = Math.exp(-ageHours / 18);
    if (ageHours <= 12) recentWeight += recencyWeight;
    else baselineWeight += recencyWeight;
    sentimentTotal += clamp(item.sentimentScore, -1, 1) * recencyWeight;
    sentimentWeight += recencyWeight;
    if (item.sourceDomain) domains.add(item.sourceDomain.toLowerCase());
  }

  const baselinePerWindow = baselineWeight / 3;
  const attentionScore = eligible.length
    ? clamp(
        Math.tanh(Math.log((recentWeight + 0.75) / (baselinePerWindow + 0.75)) / 1.3),
        -1,
        1
      )
    : 0;
  const sentimentScore = sentimentWeight
    ? clamp(sentimentTotal / sentimentWeight, -1, 1)
    : 0;
  const sourceCount = domains.size;
  const confidence = clamp(
    Math.min(eligible.length / 5, 1) * 0.45 + Math.min(sourceCount / 4, 1) * 0.55,
    0,
    1
  );
  const composite = sentimentScore * 0.58 + attentionScore * 0.42;
  const proposedDeltaBps =
    eligible.length >= 2 && sourceCount >= 2 && Math.abs(composite) >= 0.12
      ? clamp(Math.round(composite * 12 * confidence), -12, 12)
      : 0;

  return {
    articleCount: eligible.length,
    sourceCount,
    reviewRequiredCount,
    attentionScore,
    sentimentScore,
    confidence,
    proposedDeltaBps,
    recentWeight,
    baselineWeight
  };
}

export function newsSignalMode(): 'shadow' | 'applied' {
  return process.env.NEWS_SIGNAL_MODE === 'applied' &&
    process.env.NEWS_PRICE_IMPACT_ENABLED === 'true'
    ? 'applied'
    : 'shadow';
}

function categoryContext(category: string) {
  const contexts: Record<string, string> = {
    musica: '(music OR musica OR singer OR cantante OR album OR tour)',
    creadores: '(creator OR influencer OR youtube OR twitch OR streamer)',
    'cine-tv': '(actor OR actress OR film OR movie OR serie OR television)',
    deportes: '(sports OR deporte OR football OR futbol OR tennis OR basketball)'
  };
  return contexts[category] ?? '(celebrity OR cultura OR entertainment)';
}

function buildGdeltUrl(artist: ArtistNewsTarget) {
  const url = new URL(process.env.NEWS_GDELT_URL || DEFAULT_GDELT_URL);
  url.search = new URLSearchParams({
    query: `\"${artist.name}\" ${categoryContext(artist.category)}`,
    mode: 'ArtList',
    maxrecords: '30',
    format: 'json',
    sort: 'datedesc',
    timespan: '48h'
  }).toString();
  return url;
}

function cleanTitle(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid'].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function gdeltDate(value: string | undefined) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function relevantTitle(title: string, artistName: string) {
  const haystack = normalizedText(title);
  const nameTokens = words(artistName).filter((token) => token.length > 2);
  return nameTokens.length > 0 && nameTokens.every((token) => haystack.includes(token));
}

async function ensureNewsSource(artist: ArtistNewsTarget, sourceUrl: string) {
  const result = await getPool().query<{ id: string }>(
    `
      INSERT INTO entity_sources (
        artist_id, provider, source_type, external_id, source_url,
        display_name, usage_mode, license_notes, metadata
      ) VALUES ($1, $2, 'news_search', $3, $4, $5, $6, $7, $8)
      ON CONFLICT (artist_id, provider, external_id)
      DO UPDATE SET source_url = EXCLUDED.source_url,
        display_name = EXCLUDED.display_name,
        usage_mode = EXCLUDED.usage_mode,
        metadata = EXCLUDED.metadata
      RETURNING id
    `,
    [
      artist.id,
      NEWS_PROVIDER,
      artist.slug,
      sourceUrl,
      `Noticias sobre ${artist.name}`,
      newsSignalMode() === 'applied' ? 'price_signal' : 'shadow_signal',
      'Titulares y enlaces publicos descubiertos por GDELT. Fame Plays no republica el articulo.',
      { queryType: 'exact-name-category-context', provider: 'GDELT DOC 2.0' }
    ]
  );
  return result.rows[0]!.id;
}

async function fetchNews(artist: ArtistNewsTarget) {
  const url = buildGdeltUrl(artist);
  let lastError: unknown;

  for (let attempt = 1; attempt <= GDELT_MAX_ATTEMPTS; attempt += 1) {
    await waitForGdeltSlot();
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15_000)
      });
      if (response.ok) {
        const payload = (await response.json()) as { articles?: GdeltArticle[] };
        const articles = Array.isArray(payload.articles) ? payload.articles : [];
        return { url: url.toString(), articles };
      }

      lastError = new Error(`GDELT respondio HTTP ${response.status}.`);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === GDELT_MAX_ATTEMPTS) throw lastError;

      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      postponeGdeltRequests(
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : gdeltMinimumInterval()
      );
    } catch (error) {
      lastError = error;
      if (attempt === GDELT_MAX_ATTEMPTS) throw error;
      postponeGdeltRequests(gdeltMinimumInterval());
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No fue posible consultar GDELT.');
}

async function storeArticles(
  artist: ArtistNewsTarget,
  sourceId: string,
  articles: GdeltArticle[]
) {
  let stored = 0;
  for (const article of articles) {
    const title = cleanTitle(String(article.title || ''));
    const url = canonicalUrl(String(article.url || article.url_mobile || ''));
    const publishedAt = gdeltDate(article.seendate);
    if (!title || !url || !publishedAt || !relevantTitle(title, artist.name)) continue;
    const analysis = analyzeNewsSentiment(title);
    const domain = String(article.domain || new URL(url).hostname).toLowerCase();
    const externalId = createHash('sha256')
      .update(`${artist.id}:${url}`)
      .digest('hex');
    await getPool().query(
      `
        INSERT INTO content_items (
          artist_id, source_id, provider, external_id, content_type, title,
          thumbnail_url, published_at, source_url, eligibility_status, metadata
        ) VALUES ($1, $2, $3, $4, 'article', $5, $6, $7, $8, $9, $10)
        ON CONFLICT (provider, external_id)
        DO UPDATE SET title = EXCLUDED.title,
          thumbnail_url = EXCLUDED.thumbnail_url,
          published_at = EXCLUDED.published_at,
          source_url = EXCLUDED.source_url,
          eligibility_status = EXCLUDED.eligibility_status,
          metadata = EXCLUDED.metadata,
          last_synced_at = NOW()
      `,
      [
        artist.id,
        sourceId,
        NEWS_PROVIDER,
        externalId,
        title,
        canonicalUrl(String(article.socialimage || '')),
        publishedAt,
        url,
        analysis.reviewRequired ? 'pending_review' : 'eligible',
        {
          domain,
          language: String(article.language || ''),
          sourceCountry: String(article.sourcecountry || ''),
          sentimentScore: analysis.score,
          sentimentLabel: analysis.label,
          reviewRequired: analysis.reviewRequired,
          reviewTerms: analysis.reviewTerms
        }
      ]
    );
    stored += 1;
  }
  return stored;
}

async function loadSignalInput(artistId: string) {
  const result = await getPool().query<{
    published_at: Date;
    metadata: Record<string, unknown>;
  }>(
    `
      SELECT published_at, metadata
      FROM content_items
      WHERE artist_id = $1
        AND provider = $2
        AND content_type = 'article'
        AND published_at >= NOW() - INTERVAL '48 hours'
      ORDER BY published_at DESC
    `,
    [artistId, NEWS_PROVIDER]
  );
  return result.rows.map((row) => ({
    publishedAt: new Date(row.published_at),
    sourceDomain: String(row.metadata.domain || ''),
    sentimentScore: Number(row.metadata.sentimentScore || 0),
    reviewRequired: row.metadata.reviewRequired === true
  }));
}

function hourlyWindow(now: Date) {
  const window = new Date(now);
  window.setUTCMinutes(0, 0, 0);
  return window;
}

async function applyNewsPrice(
  client: PoolClient,
  signalId: string,
  artistId: string,
  proposedDeltaBps: number
) {
  const artistResult = await client.query<{
    current_price: string;
    daily_anchor_price: string;
    status: string;
  }>(
    `SELECT current_price, daily_anchor_price, status FROM artists WHERE id = $1 FOR UPDATE`,
    [artistId]
  );
  const seasonResult = await client.query<{ id: string }>(
    `SELECT id FROM seasons WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1`
  );
  const artist = artistResult.rows[0];
  const season = seasonResult.rows[0];
  if (!artist || artist.status !== 'active' || !season) return { applied: 0, mode: 'halted' as const };

  const usedResult = await client.query<{ used_bps: string }>(
    `
      SELECT COALESCE(SUM(ABS(applied_delta_bps)), 0) AS used_bps
      FROM news_signals
      WHERE artist_id = $1
        AND window_ends_at >= date_trunc('day', NOW())
    `,
    [artistId]
  );
  const maximumDailyBps = clamp(Number(process.env.NEWS_MAX_DAILY_BPS ?? 15), 1, 30);
  const remainingBps = Math.max(0, maximumDailyBps - Number(usedResult.rows[0]?.used_bps || 0));
  const requestedBps = Math.sign(proposedDeltaBps) * Math.min(Math.abs(proposedDeltaBps), remainingBps);
  if (!requestedBps) return { applied: 0, mode: 'halted' as const };

  const currentPrice = Number(artist.current_price);
  const anchorPrice = Number(artist.daily_anchor_price);
  const lowerBand = anchorPrice * 0.994;
  const upperBand = anchorPrice * 1.006;
  const nextPrice = clamp(
    currentPrice * (1 + requestedBps / 10_000),
    lowerBand,
    upperBand
  );
  const appliedBps = Math.round(((nextPrice / currentPrice) - 1) * 10_000);
  if (!appliedBps) return { applied: 0, mode: 'halted' as const };

  await client.query(
    `UPDATE artists SET current_price = $2, version = version + 1 WHERE id = $1`,
    [artistId, nextPrice.toFixed(6)]
  );
  await client.query(
    `
      INSERT INTO price_ticks (
        artist_id, season_id, price, source_type, source_reference
      ) VALUES ($1, $2, $3, 'news', $4)
    `,
    [artistId, season.id, nextPrice.toFixed(6), signalId]
  );
  return { applied: appliedBps, mode: 'applied' as const };
}

async function persistSignal(
  artistId: string,
  calculated: CalculatedNewsSignal,
  now: Date
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const desiredMode = newsSignalMode();
    const canApply =
      desiredMode === 'applied' &&
      calculated.proposedDeltaBps !== 0 &&
      calculated.sourceCount >= 2 &&
      calculated.confidence >= 0.4;
    const initialMode: SignalMode = desiredMode === 'shadow'
      ? 'shadow'
      : canApply
        ? 'shadow'
        : 'skipped';
    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO news_signals (
          artist_id, window_ends_at, algorithm_version, article_count,
          source_count, attention_score, sentiment_score, confidence,
          proposed_delta_bps, mode, breakdown
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (artist_id, window_ends_at, algorithm_version) DO NOTHING
        RETURNING id
      `,
      [
        artistId,
        hourlyWindow(now),
        ALGORITHM_VERSION,
        calculated.articleCount,
        calculated.sourceCount,
        calculated.attentionScore,
        calculated.sentimentScore,
        calculated.confidence,
        calculated.proposedDeltaBps,
        initialMode,
        {
          recentWeight: calculated.recentWeight,
          baselineWeight: calculated.baselineWeight,
          reviewRequiredCount: calculated.reviewRequiredCount,
          externalProvider: NEWS_PROVIDER
        }
      ]
    );
    const signalId = inserted.rows[0]?.id;
    if (!signalId) {
      await client.query('COMMIT');
      return { created: false, appliedDeltaBps: 0, mode: initialMode };
    }

    let appliedDeltaBps = 0;
    let mode: SignalMode = initialMode;
    if (canApply) {
      const application = await applyNewsPrice(
        client,
        signalId,
        artistId,
        calculated.proposedDeltaBps
      );
      appliedDeltaBps = application.applied;
      mode = application.mode;
      await client.query(
        `UPDATE news_signals SET applied_delta_bps = $2, mode = $3 WHERE id = $1`,
        [signalId, appliedDeltaBps, mode]
      );
    }
    await client.query('COMMIT');
    return { created: true, appliedDeltaBps, mode };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function syncArtistNews(artist: ArtistNewsTarget) {
  const fetched = await fetchNews(artist);
  const sourceId = await ensureNewsSource(artist, fetched.url);
  try {
    const stored = await storeArticles(artist, sourceId, fetched.articles);
    const now = new Date();
    const calculated = calculateNewsSignal(await loadSignalInput(artist.id), now);
    const signal = await persistSignal(artist.id, calculated, now);
    await getPool().query(
      `UPDATE entity_sources SET last_synced_at = NOW(), last_error = NULL WHERE id = $1`,
      [sourceId]
    );
    return { ok: true as const, artistId: artist.id, artistName: artist.name, fetched: fetched.articles.length, stored, calculated, signal };
  } catch (error) {
    await getPool().query(
      `UPDATE entity_sources SET last_error = $2 WHERE id = $1`,
      [sourceId, error instanceof Error ? error.message.slice(0, 1000) : 'Error desconocido']
    );
    throw error;
  }
}

export async function syncNewsPulse(artistId?: string) {
  if (!databaseConfigured()) return [];
  const result = await getPool().query<ArtistNewsTarget>(
    `
      SELECT id, slug, name, category, profession
      FROM artists
      WHERE status = 'active'
        AND ($1::uuid IS NULL OR id = $1)
      ORDER BY name
    `,
    [artistId || null]
  );
  const outcomes: Array<Awaited<ReturnType<typeof syncArtistNews>> | {
    ok: false;
    artistId: string;
    artistName: string;
    error: string;
  }> = [];
  const concurrency = clamp(Number(process.env.NEWS_SYNC_CONCURRENCY ?? 3), 1, 5);
  for (let index = 0; index < result.rows.length; index += concurrency) {
    const batch = result.rows.slice(index, index + concurrency);
    outcomes.push(...await Promise.all(batch.map(async (artist) => {
      try {
        return await syncArtistNews(artist);
      } catch (error) {
        return {
          ok: false as const,
          artistId: artist.id,
          artistName: artist.name,
          error: error instanceof Error ? error.message : 'Error desconocido'
        };
      }
    })));
  }
  return outcomes;
}

export async function getNewsPulseBySlug(slug: string) {
  if (!databaseConfigured()) return { mode: newsSignalMode(), signal: null, items: [] };
  const artistResult = await getPool().query<{ id: string }>(
    `SELECT id FROM artists WHERE slug = $1`,
    [slug]
  );
  const artistId = artistResult.rows[0]?.id;
  if (!artistId) return { mode: newsSignalMode(), signal: null, items: [] };
  const [items, signal] = await Promise.all([
    getPool().query<{
      id: string;
      title: string;
      source_url: string;
      thumbnail_url: string | null;
      published_at: Date;
      metadata: Record<string, unknown>;
    }>(
      `
        SELECT id, title, source_url, thumbnail_url, published_at, metadata
        FROM content_items
        WHERE artist_id = $1
          AND provider = $2
          AND content_type = 'article'
          AND eligibility_status = 'eligible'
        ORDER BY published_at DESC
        LIMIT 12
      `,
      [artistId, NEWS_PROVIDER]
    ),
    getPool().query<{
      window_ends_at: Date;
      article_count: number;
      source_count: number;
      attention_score: string;
      sentiment_score: string;
      confidence: string;
      proposed_delta_bps: number;
      applied_delta_bps: number;
      mode: SignalMode;
      created_at: Date;
    }>(
      `
        SELECT window_ends_at, article_count, source_count, attention_score,
          sentiment_score, confidence, proposed_delta_bps,
          applied_delta_bps, mode, created_at
        FROM news_signals
        WHERE artist_id = $1
        ORDER BY window_ends_at DESC
        LIMIT 1
      `,
      [artistId]
    )
  ]);
  const latest = signal.rows[0];
  return {
    mode: newsSignalMode(),
    signal: latest ? {
      windowEndsAt: latest.window_ends_at.toISOString(),
      articleCount: Number(latest.article_count),
      sourceCount: Number(latest.source_count),
      attentionScore: Number(latest.attention_score),
      sentimentScore: Number(latest.sentiment_score),
      confidence: Number(latest.confidence),
      proposedDeltaBps: Number(latest.proposed_delta_bps),
      appliedDeltaBps: Number(latest.applied_delta_bps),
      mode: latest.mode,
      createdAt: latest.created_at.toISOString()
    } : null,
    items: items.rows.map((item) => ({
      id: item.id,
      title: item.title,
      sourceUrl: item.source_url,
      thumbnailUrl: item.thumbnail_url ?? '',
      publishedAt: item.published_at.toISOString(),
      sourceDomain: String(item.metadata.domain || ''),
      language: String(item.metadata.language || ''),
      sentimentScore: Number(item.metadata.sentimentScore || 0),
      sentimentLabel: String(item.metadata.sentimentLabel || 'neutral')
    }))
  };
}
