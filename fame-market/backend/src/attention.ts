import { getPool } from './database.js';
import { MarketError } from './market.js';

const WIKIMEDIA_API =
  'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';
export const ATTENTION_ALGORITHM_VERSION = 'wikimedia-7d-vs-21d-v1';
export const ATTENTION_LOOKBACK_DAYS = 28;
export const ATTENTION_SHADOW_TARGET_DAYS = 30;
export const ATTENTION_FETCH_DAYS =
  ATTENTION_LOOKBACK_DAYS + ATTENTION_SHADOW_TARGET_DAYS + 6;
export const ATTENTION_MAX_SINGLE_SOURCE_BPS = 15;
export const ATTENTION_DEAD_ZONE = 0.08;
const ATTENTION_SIGNAL_SCALE = 0.75;
const DAY_MS = 86_400_000;

export function attentionMode() {
  return 'shadow' as const;
}

interface AttentionSourceRow {
  id: string;
  artist_id: string;
  artist_name: string;
  provider: string;
  external_id: string;
  source_url: string;
  weight_bps: number;
  metadata: {
    project?: string;
    articleTitle?: string;
    access?: string;
    agent?: string;
  };
}

interface WikimediaItem {
  project: string;
  article: string;
  granularity: string;
  timestamp: string;
  access: string;
  agent: string;
  views: number;
}

interface AttentionValue {
  date: string;
  value: number;
}

export interface AttentionCalculation {
  windowEndsOn: string;
  recentAverage: number;
  baselineAverage: number;
  growthLog: number;
  normalizedScore: number;
  proposedDeltaBps: number;
  confidence: number;
  observationCount: number;
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function dateOnly(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function validObservations(observations: AttentionValue[]) {
  const uniqueByDate = new Map(
    observations
      .filter(
        (item) =>
          /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
          Number.isFinite(item.value) &&
          item.value >= 0
      )
      .map((item) => [item.date, item.value])
  );
  return [...uniqueByDate.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
}

function isConsecutiveWindow(window: Array<[string, number]>) {
  return window.every(([date], index) => {
    if (index === 0) return true;
    const previous = window[index - 1]![0];
    return Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === DAY_MS;
  });
}

function calculateWindow(
  ordered: Array<[string, number]>
): AttentionCalculation {
  const values = ordered.map(([, value]) => value);
  const baselineAverage = average(values.slice(0, 21));
  const recentAverage = average(values.slice(21));
  const growthLog = Math.log((recentAverage + 1) / (baselineAverage + 1));
  const rawScore = Math.tanh(growthLog / ATTENTION_SIGNAL_SCALE);
  const normalizedScore =
    Math.abs(rawScore) < ATTENTION_DEAD_ZONE ? 0 : rawScore;
  const proposedDeltaBps = Math.round(
    normalizedScore * ATTENTION_MAX_SINGLE_SOURCE_BPS
  );

  return {
    windowEndsOn: ordered.at(-1)![0],
    recentAverage: round(recentAverage, 2),
    baselineAverage: round(baselineAverage, 2),
    growthLog: round(growthLog),
    normalizedScore: round(normalizedScore),
    proposedDeltaBps,
    confidence: 1,
    observationCount: ordered.length
  };
}

export function calculateAttentionSignals(
  observations: AttentionValue[],
  maximumWindows = ATTENTION_SHADOW_TARGET_DAYS
) {
  const ordered = validObservations(observations);
  const calculations: AttentionCalculation[] = [];
  for (
    let endIndex = ATTENTION_LOOKBACK_DAYS - 1;
    endIndex < ordered.length;
    endIndex += 1
  ) {
    const window = ordered.slice(
      endIndex - ATTENTION_LOOKBACK_DAYS + 1,
      endIndex + 1
    );
    if (window.length !== ATTENTION_LOOKBACK_DAYS || !isConsecutiveWindow(window)) {
      continue;
    }
    calculations.push(calculateWindow(window));
  }
  return calculations.slice(-Math.max(1, maximumWindows));
}

export function calculateAttentionSignal(
  observations: AttentionValue[]
): AttentionCalculation | null {
  return calculateAttentionSignals(observations, 1).at(-1) ?? null;
}

export interface AttentionEvaluation {
  observedDays: number;
  targetDays: number;
  coveragePercent: number;
  firstWindowEndsOn: string | null;
  lastWindowEndsOn: string | null;
  positiveDays: number;
  negativeDays: number;
  neutralDays: number;
  averageAbsoluteDeltaBps: number;
  maximumAbsoluteDeltaBps: number;
  standardDeviationBps: number;
  directionChanges: number;
  cumulativeProposedDeltaBps: number;
  dataReady: boolean;
}

export function evaluateAttentionHistory(
  samples: Array<{ date: string; proposedDeltaBps: number }>,
  targetDays = ATTENTION_SHADOW_TARGET_DAYS
): AttentionEvaluation {
  const byDate = new Map(
    samples
      .filter(
        (sample) =>
          /^\d{4}-\d{2}-\d{2}$/.test(sample.date) &&
          Number.isFinite(sample.proposedDeltaBps)
      )
      .map((sample) => [sample.date, sample.proposedDeltaBps])
  );
  const ordered = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-targetDays);
  const values = ordered.map(([, value]) => value);
  const mean = values.length ? average(values) : 0;
  const standardDeviation = values.length
    ? Math.sqrt(
        average(values.map((value) => Math.pow(value - mean, 2)))
      )
    : 0;
  const nonZeroDirections = values
    .filter((value) => value !== 0)
    .map((value) => Math.sign(value));
  const directionChanges = nonZeroDirections.reduce(
    (count, direction, index) =>
      index > 0 && direction !== nonZeroDirections[index - 1]
        ? count + 1
        : count,
    0
  );

  return {
    observedDays: ordered.length,
    targetDays,
    coveragePercent: round(
      Math.min(1, ordered.length / targetDays) * 100,
      1
    ),
    firstWindowEndsOn: ordered[0]?.[0] ?? null,
    lastWindowEndsOn: ordered.at(-1)?.[0] ?? null,
    positiveDays: values.filter((value) => value > 0).length,
    negativeDays: values.filter((value) => value < 0).length,
    neutralDays: values.filter((value) => value === 0).length,
    averageAbsoluteDeltaBps: round(
      values.length ? average(values.map(Math.abs)) : 0,
      2
    ),
    maximumAbsoluteDeltaBps: values.length
      ? Math.max(...values.map(Math.abs))
      : 0,
    standardDeviationBps: round(standardDeviation, 2),
    directionChanges,
    cumulativeProposedDeltaBps: values.reduce(
      (sum, value) => sum + value,
      0
    ),
    dataReady: ordered.length >= targetDays
  };
}

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function wikimediaUserAgent() {
  return (
    process.env.ATTENTION_USER_AGENT ??
    `FamePlays/0.1 (${process.env.PUBLIC_SITE_URL ?? 'http://localhost:5174'}; contact: ${
      process.env.RIGHTS_CONTACT_EMAIL ?? 'not-configured'
    })`
  );
}

async function fetchWikimediaPageviews(source: AttentionSourceRow) {
  const project = source.metadata.project;
  const articleTitle = source.metadata.articleTitle;
  if (!project || !articleTitle) {
    throw new MarketError(
      'La fuente Wikimedia no tiene project y articleTitle.',
      'ATTENTION_SOURCE_INVALID'
    );
  }

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (ATTENTION_FETCH_DAYS - 1));
  const access = source.metadata.access ?? 'all-access';
  const agent = source.metadata.agent ?? 'user';
  const path = [
    project,
    access,
    agent,
    encodeURIComponent(articleTitle),
    'daily',
    compactDate(start),
    compactDate(end)
  ].join('/');
  const response = await fetch(`${WIKIMEDIA_API}/${path}`, {
    headers: {
      accept: 'application/json',
      'user-agent': wikimediaUserAgent()
    },
    signal: AbortSignal.timeout(12_000)
  });
  const body = (await response.json().catch(() => ({}))) as {
    items?: WikimediaItem[];
    detail?: string;
  };
  if (!response.ok) {
    throw new MarketError(
      body.detail ?? 'Wikimedia no pudo completar la solicitud.',
      'WIKIMEDIA_API_ERROR',
      502
    );
  }

  return (body.items ?? []).map((item) => ({
    date: `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}-${item.timestamp.slice(6, 8)}`,
    value: Number(item.views),
    metadata: {
      project: item.project,
      article: item.article,
      access: item.access,
      agent: item.agent,
      granularity: item.granularity
    }
  }));
}

async function saveSourceFailure(sourceId: string, error: unknown) {
  await getPool().query(
    `
      UPDATE attention_sources
      SET last_error = $2
      WHERE id = $1
    `,
    [
      sourceId,
      (error instanceof Error ? error.message : 'Error desconocido').slice(
        0,
        1000
      )
    ]
  );
}

export async function syncWikimediaSource(source: AttentionSourceRow) {
  const observations = await fetchWikimediaPageviews(source);
  const calculations = calculateAttentionSignals(observations);
  const latestCalculation = calculations.at(-1);
  if (!latestCalculation) {
    throw new MarketError(
      'Wikimedia no devolvio 28 dias validos.',
      'ATTENTION_HISTORY_INCOMPLETE',
      502
    );
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const observation of observations) {
      await client.query(
        `
          INSERT INTO attention_observations (
            source_id, metric_name, observed_at, metric_value, metadata
          ) VALUES ($1, 'pageviews', $2, $3, $4)
          ON CONFLICT (source_id, metric_name, observed_at)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            metadata = EXCLUDED.metadata,
            captured_at = NOW()
        `,
        [
          source.id,
          observation.date,
          observation.value,
          observation.metadata
        ]
      );
    }

    let latestSignalId = '';
    for (const calculation of calculations) {
      const signal = await client.query<{ id: string }>(
        `
          INSERT INTO attention_signals (
            artist_id, window_ends_on, algorithm_version, normalized_score,
            proposed_delta_bps, applied_delta_bps, confidence, source_count,
            mode, breakdown
          ) VALUES ($1, $2, $3, $4, $5, 0, $6, 1, 'shadow', $7)
          ON CONFLICT (artist_id, window_ends_on, algorithm_version)
          DO UPDATE SET
            normalized_score = EXCLUDED.normalized_score,
            proposed_delta_bps = EXCLUDED.proposed_delta_bps,
            confidence = EXCLUDED.confidence,
            breakdown = EXCLUDED.breakdown
          RETURNING id
        `,
        [
          source.artist_id,
          calculation.windowEndsOn,
          ATTENTION_ALGORITHM_VERSION,
          calculation.normalizedScore,
          calculation.proposedDeltaBps,
          calculation.confidence,
          {
            provider: source.provider,
            sourceId: source.id,
            sourceUrl: source.source_url,
            externalId: source.external_id,
            metric: 'pageviews',
            recentDays: 7,
            baselineDays: 21,
            recentAverage: calculation.recentAverage,
            baselineAverage: calculation.baselineAverage,
            growthLog: calculation.growthLog,
            observationCount: calculation.observationCount,
            deadZone: ATTENTION_DEAD_ZONE,
            maximumSingleSourceBps: ATTENTION_MAX_SINGLE_SOURCE_BPS,
            historicalReconstruction:
              calculation.windowEndsOn !== latestCalculation.windowEndsOn
          }
        ]
      );
      if (calculation.windowEndsOn === latestCalculation.windowEndsOn) {
        latestSignalId = String(signal.rows[0]!.id);
      }
    }

    await client.query(
      `
        UPDATE attention_sources
        SET last_synced_at = NOW(), last_error = NULL
        WHERE id = $1
      `,
      [source.id]
    );
    await client.query('COMMIT');
    return {
      ok: true as const,
      sourceId: source.id,
      artistId: source.artist_id,
      artistName: source.artist_name,
      observations: observations.length,
      signals: calculations.length,
      signalId: latestSignalId,
      ...latestCalculation,
      mode: 'shadow' as const
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncAttentionSources(artistId?: string) {
  const result = await getPool().query<AttentionSourceRow>(
    `
      SELECT source.*, artist.name AS artist_name
      FROM attention_sources source
      JOIN artists artist ON artist.id = source.artist_id
      WHERE source.provider = 'wikimedia'
        AND source.enabled = TRUE
        AND ($1::uuid IS NULL OR source.artist_id = $1::uuid)
      ORDER BY artist.name
    `,
    [artistId ?? null]
  );
  const outcomes = [];
  for (const source of result.rows) {
    try {
      outcomes.push(await syncWikimediaSource(source));
    } catch (error) {
      await saveSourceFailure(source.id, error).catch(() => undefined);
      outcomes.push({
        ok: false as const,
        sourceId: source.id,
        artistId: source.artist_id,
        artistName: source.artist_name,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
  return outcomes;
}

export async function registerWikimediaSource(
  artistId: string,
  input: { project: string; articleTitle: string; enabled?: boolean }
) {
  const artist = await getPool().query('SELECT id FROM artists WHERE id = $1', [
    artistId
  ]);
  if (!artist.rowCount) {
    throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
  }
  const externalId = `${input.project}:${input.articleTitle}`;
  const sourceUrl = `https://${input.project}/wiki/${encodeURIComponent(
    input.articleTitle
  )}`;
  const result = await getPool().query(
    `
      INSERT INTO attention_sources (
        artist_id, provider, external_id, source_url, weight_bps,
        enabled, metadata
      ) VALUES ($1, 'wikimedia', $2, $3, 10000, $4, $5)
      ON CONFLICT (artist_id, provider, external_id)
      DO UPDATE SET
        source_url = EXCLUDED.source_url,
        enabled = EXCLUDED.enabled,
        metadata = EXCLUDED.metadata
      RETURNING *
    `,
    [
      artistId,
      externalId,
      sourceUrl,
      input.enabled ?? true,
      {
        project: input.project,
        articleTitle: input.articleTitle,
        access: 'all-access',
        agent: 'user'
      }
    ]
  );
  return result.rows[0];
}

export async function getAttentionOverview(artistId?: string) {
  const result = await getPool().query<{
    artist_id: string;
    artist_name: string;
    artist_slug: string;
    source_id: string;
    provider: string;
    external_id: string;
    source_url: string;
    enabled: boolean;
    last_synced_at: Date | null;
    last_error: string | null;
    window_ends_on: string | null;
    normalized_score: string | null;
    proposed_delta_bps: number | null;
    applied_delta_bps: number | null;
    confidence: string | null;
    mode: string | null;
    breakdown: Record<string, unknown> | null;
    signal_created_at: Date | null;
  }>(
    `
      SELECT
        artist.id AS artist_id,
        artist.name AS artist_name,
        artist.slug AS artist_slug,
        source.id AS source_id,
        source.provider,
        source.external_id,
        source.source_url,
        source.enabled,
        source.last_synced_at,
        source.last_error,
        signal.window_ends_on,
        signal.normalized_score,
        signal.proposed_delta_bps,
        signal.applied_delta_bps,
        signal.confidence,
        signal.mode,
        signal.breakdown,
        signal.created_at AS signal_created_at
      FROM attention_sources source
      JOIN artists artist ON artist.id = source.artist_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM attention_signals
        WHERE artist_id = artist.id
        ORDER BY window_ends_on DESC, created_at DESC
        LIMIT 1
      ) signal ON TRUE
      WHERE ($1::uuid IS NULL OR artist.id = $1::uuid)
      ORDER BY artist.name, source.provider
    `,
    [artistId ?? null]
  );

  return result.rows.map((row) => ({
    artistId: row.artist_id,
    artistName: row.artist_name,
    artistSlug: row.artist_slug,
    source: {
      id: row.source_id,
      provider: row.provider,
      externalId: row.external_id,
      url: row.source_url,
      enabled: row.enabled,
      lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
      lastError: row.last_error
    },
    signal: row.window_ends_on
      ? {
          windowEndsOn: dateOnly(row.window_ends_on),
          normalizedScore: Number(row.normalized_score),
          proposedDeltaBps: Number(row.proposed_delta_bps),
          appliedDeltaBps: Number(row.applied_delta_bps),
          confidence: Number(row.confidence),
          mode: row.mode,
          breakdown: row.breakdown ?? {},
          createdAt: row.signal_created_at?.toISOString() ?? null
        }
      : null
  }));
}

export async function getAttentionEvaluation(artistId?: string) {
  const [sources, signals] = await Promise.all([
    getPool().query<{
      artist_id: string;
      artist_name: string;
      source_id: string;
      provider: string;
      enabled: boolean;
      last_synced_at: Date | null;
      last_error: string | null;
    }>(
      `
        SELECT
          artist.id AS artist_id,
          artist.name AS artist_name,
          source.id AS source_id,
          source.provider,
          source.enabled,
          source.last_synced_at,
          source.last_error
        FROM attention_sources source
        JOIN artists artist ON artist.id = source.artist_id
        WHERE source.enabled = TRUE
          AND ($1::uuid IS NULL OR artist.id = $1::uuid)
        ORDER BY artist.name, source.provider
      `,
      [artistId ?? null]
    ),
    getPool().query<{
      artist_id: string;
      window_ends_on: string | Date;
      proposed_delta_bps: number;
    }>(
      `
        SELECT artist_id, window_ends_on, proposed_delta_bps
        FROM attention_signals
        WHERE algorithm_version = $1
          AND ($2::uuid IS NULL OR artist_id = $2::uuid)
        ORDER BY artist_id, window_ends_on
      `,
      [ATTENTION_ALGORITHM_VERSION, artistId ?? null]
    )
  ]);

  const samplesByArtist = new Map<
    string,
    Array<{ date: string; proposedDeltaBps: number }>
  >();
  for (const signal of signals.rows) {
    const samples = samplesByArtist.get(signal.artist_id) ?? [];
    samples.push({
      date: dateOnly(signal.window_ends_on),
      proposedDeltaBps: Number(signal.proposed_delta_bps)
    });
    samplesByArtist.set(signal.artist_id, samples);
  }

  const now = Date.now();
  const evaluations = sources.rows.map((source) => {
    const statistics = evaluateAttentionHistory(
      samplesByArtist.get(source.artist_id) ?? []
    );
    const syncAgeHours = source.last_synced_at
      ? Math.max(
          0,
          (now - new Date(source.last_synced_at).getTime()) / 3_600_000
        )
      : null;
    const sourceHealthy =
      !source.last_error && syncAgeHours !== null && syncAgeHours <= 48;
    const blockers = [];
    if (!statistics.dataReady) {
      blockers.push(
        `Faltan ${Math.max(
          0,
          ATTENTION_SHADOW_TARGET_DAYS - statistics.observedDays
        )} ventanas diarias.`
      );
    }
    if (source.last_error) blockers.push(source.last_error);
    if (syncAgeHours === null) blockers.push('La fuente nunca se ha sincronizado.');
    else if (syncAgeHours > 48) blockers.push('La fuente lleva mas de 48 horas sin actualizarse.');
    if (statistics.dataReady && sourceHealthy) {
      blockers.push('Falta revision humana de estabilidad antes de activar precios.');
    }

    return {
      artistId: source.artist_id,
      artistName: source.artist_name,
      sourceId: source.source_id,
      provider: source.provider,
      sourceHealthy,
      syncAgeHours: syncAgeHours === null ? null : round(syncAgeHours, 1),
      evaluationReady: statistics.dataReady && sourceHealthy,
      activationReady: false,
      blockers,
      statistics
    };
  });

  return {
    algorithmVersion: ATTENTION_ALGORITHM_VERSION,
    mode: attentionMode(),
    targetDays: ATTENTION_SHADOW_TARGET_DAYS,
    evaluationReady:
      evaluations.length > 0 &&
      evaluations.every((evaluation) => evaluation.evaluationReady),
    activationReady: false,
    humanReviewRequired: true,
    evaluations
  };
}

export async function getArtistAttentionBySlug(slug: string) {
  const artist = await getPool().query<{ id: string }>(
    'SELECT id FROM artists WHERE slug = $1',
    [slug]
  );
  if (!artist.rowCount) {
    throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
  }
  return getAttentionOverview(artist.rows[0]!.id);
}
