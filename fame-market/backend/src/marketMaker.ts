import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { databaseConfigured, getPool } from './database.js';

export type LiveMarketState = 'bull' | 'bear' | 'sideways' | 'volatile' | 'viral';
export type VolatilityProfile = 'stable' | 'balanced' | 'volatile' | 'underdog';

interface ArtistMarketRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  volatility_profile: VolatilityProfile;
  risk_level: number;
  current_price: string;
  daily_anchor_price: string;
  status: string;
  holders: string;
  recent_news_bps: string;
}

interface LiveMarketStateRow {
  market_state: LiveMarketState;
  state_started_at: Date;
  state_ends_at: Date;
  hype_score: string;
  trend_bias_bps: number;
  volatility_bps: number;
  last_tick_at: Date | null;
}

export interface StateDecision {
  marketState: LiveMarketState;
  stateEndsAt: Date;
  hypeScore: number;
  trendBiasBps: number;
  volatilityBps: number;
}

export interface MarketMoveInput {
  artistId: string;
  currentPrice: number;
  anchorPrice: number;
  marketState: LiveMarketState;
  volatilityProfile: VolatilityProfile;
  riskLevel: number;
  hypeScore: number;
  trendBiasBps: number;
  volatilityBps: number;
  minutesSinceLastTick: number;
  now?: Date;
  priceBandBps?: number;
}

export interface MarketMove {
  requestedDeltaBps: number;
  appliedDeltaBps: number;
  nextPrice: number;
  halted: boolean;
}

const MARKET_ALGORITHM_VERSION = 'live-market-v2';
const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_PRICE_BAND_BPS = 1_000;
const DEFAULT_MAX_TICK_BPS = 90;

const profileBaseVolatility: Record<VolatilityProfile, number> = {
  stable: 5,
  balanced: 9,
  volatile: 15,
  underdog: 19
};

const profileMaxTick: Record<VolatilityProfile, number> = {
  stable: 16,
  balanced: 28,
  volatile: 52,
  underdog: 64
};

const baseWeights: Record<VolatilityProfile, Record<LiveMarketState, number>> = {
  stable: { bull: 0.24, bear: 0.2, sideways: 0.48, volatile: 0.07, viral: 0.01 },
  balanced: { bull: 0.28, bear: 0.24, sideways: 0.35, volatile: 0.1, viral: 0.03 },
  volatile: { bull: 0.3, bear: 0.26, sideways: 0.23, volatile: 0.15, viral: 0.06 },
  underdog: { bull: 0.31, bear: 0.27, sideways: 0.2, volatile: 0.15, viral: 0.07 }
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function numberEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  return clamp(Number.isFinite(value) ? value : fallback, minimum, maximum);
}

export function marketMakerIntervalMinutes() {
  return numberEnv('MARKET_MAKER_INTERVAL_MINUTES', DEFAULT_INTERVAL_MINUTES, 5, 120);
}

function marketMakerMinTickMinutes() {
  return numberEnv(
    'MARKET_MAKER_MIN_TICK_MINUTES',
    Math.max(5, Math.floor(marketMakerIntervalMinutes() * 0.75)),
    3,
    120
  );
}

function marketMakerPriceBandBps() {
  return numberEnv('MARKET_MAKER_PRICE_BAND_BPS', DEFAULT_PRICE_BAND_BPS, 200, 1_200);
}

function marketMakerMaxTickBps() {
  return numberEnv('MARKET_MAKER_MAX_TICK_BPS', DEFAULT_MAX_TICK_BPS, 10, 150);
}

function marketMakerMeanReversionBps() {
  return numberEnv('MARKET_MAKER_MEAN_REVERSION_BPS', 34, 0, 100);
}

function marketMakerBalanceNoiseBps() {
  return numberEnv('MARKET_MAKER_BALANCE_NOISE_BPS', 22, 0, 70);
}

function marketMakerOverheatThresholdBps() {
  return numberEnv('MARKET_MAKER_OVERHEAT_THRESHOLD_BPS', 430, 100, 1_100);
}

function marketMakerOverheatCooldownBps() {
  return numberEnv('MARKET_MAKER_OVERHEAT_COOLDOWN_BPS', 58, 0, 120);
}

function seededFloat(seed: string, salt: string) {
  const hash = createHash('sha256').update(`${seed}:${salt}`).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

function seededNoise(seed: string) {
  return (
    seededFloat(seed, 'a') +
    seededFloat(seed, 'b') +
    seededFloat(seed, 'c') -
    1.5
  ) / 1.5;
}

function weightedState(
  weights: Record<LiveMarketState, number>,
  seed: string
): LiveMarketState {
  const entries = Object.entries(weights) as Array<[LiveMarketState, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = seededFloat(seed, 'state') * total;
  for (const [state, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return state;
  }
  return entries[entries.length - 1]![0];
}

function stateDurationHours(
  marketState: LiveMarketState,
  profile: VolatilityProfile,
  seed: string
) {
  const ranges: Record<LiveMarketState, Record<VolatilityProfile, [number, number]>> = {
    bull: {
      stable: [10, 22],
      balanced: [8, 18],
      volatile: [5, 12],
      underdog: [4, 10]
    },
    bear: {
      stable: [8, 18],
      balanced: [6, 14],
      volatile: [4, 10],
      underdog: [3, 9]
    },
    sideways: {
      stable: [8, 20],
      balanced: [5, 14],
      volatile: [3, 9],
      underdog: [2, 7]
    },
    volatile: {
      stable: [3, 7],
      balanced: [2, 6],
      volatile: [2, 5],
      underdog: [1, 4]
    },
    viral: {
      stable: [1, 3],
      balanced: [1, 4],
      volatile: [1, 5],
      underdog: [1, 5]
    }
  };
  const [minimum, maximum] = ranges[marketState][profile];
  return minimum + Math.floor(seededFloat(seed, 'duration') * (maximum - minimum + 1));
}

function targetHype(input: {
  volatilityProfile: VolatilityProfile;
  riskLevel: number;
  holders: number;
  recentNewsBps: number;
  category: string;
}) {
  const profileBoost: Record<VolatilityProfile, number> = {
    stable: -4,
    balanced: 2,
    volatile: 9,
    underdog: 12
  };
  const categoryBoost: Record<string, number> = {
    musica: 4,
    creadores: 6,
    deportes: 5,
    'cine-tv': 3
  };
  return clamp(
    42 +
      input.riskLevel * 6 +
      profileBoost[input.volatilityProfile] +
      (categoryBoost[input.category] ?? 0) +
      Math.min(input.holders, 60) * 0.18 +
      Math.min(Math.abs(input.recentNewsBps), 400) * 0.035,
    18,
    94
  );
}

export function chooseNextMarketState(input: {
  artistId: string;
  previousState?: LiveMarketState | null;
  volatilityProfile: VolatilityProfile;
  riskLevel: number;
  holders?: number;
  recentNewsBps?: number;
  category?: string;
  currentHypeScore?: number | null;
  now?: Date;
}): StateDecision {
  const now = input.now ?? new Date();
  const recentNewsBps = input.recentNewsBps ?? 0;
  const hypeTarget = targetHype({
    volatilityProfile: input.volatilityProfile,
    riskLevel: input.riskLevel,
    holders: input.holders ?? 0,
    recentNewsBps,
    category: input.category ?? ''
  });
  const hypeScore = input.currentHypeScore === null || input.currentHypeScore === undefined
    ? hypeTarget
    : clamp(input.currentHypeScore * 0.72 + hypeTarget * 0.28, 15, 96);
  const weights = { ...baseWeights[input.volatilityProfile] };

  if (recentNewsBps > 40) {
    weights.bull += 0.12;
    weights.viral += 0.05;
    weights.bear = Math.max(0.05, weights.bear - 0.08);
  } else if (recentNewsBps < -40) {
    weights.bear += 0.13;
    weights.volatile += 0.04;
    weights.bull = Math.max(0.05, weights.bull - 0.08);
  }

  if (hypeScore >= 75) {
    weights.viral += 0.04;
    weights.volatile += 0.04;
    weights.sideways = Math.max(0.08, weights.sideways - 0.06);
  } else if (hypeScore <= 35) {
    weights.sideways += 0.08;
    weights.bear += 0.03;
  }

  if (input.previousState === 'bull') weights.bull += 0.05;
  if (input.previousState === 'bear') weights.bear += 0.05;
  if (input.previousState === 'viral') {
    weights.viral = Math.max(0, weights.viral - 0.03);
    weights.volatile += 0.05;
  }

  const stateSeed = `${input.artistId}:${now.toISOString().slice(0, 13)}:${input.previousState ?? 'new'}`;
  const marketState = weightedState(weights, stateSeed);
  const baseVolatility = profileBaseVolatility[input.volatilityProfile];
  const hypeFactor = 0.8 + hypeScore / 130;
  const volatilityBps = Math.round(
    clamp(baseVolatility * hypeFactor, 3, profileMaxTick[input.volatilityProfile])
  );

  const directionalRoll = seededFloat(stateSeed, 'direction');
  const sign =
    marketState === 'bear'
      ? -1
      : marketState === 'bull'
        ? 1
        : marketState === 'viral'
          ? recentNewsBps < -80 || directionalRoll < 0.18
            ? -1
            : 1
          : marketState === 'volatile'
            ? directionalRoll < 0.5
              ? -1
              : 1
            : directionalRoll < 0.48
              ? -1
              : 1;
  const stateMultiplier: Record<LiveMarketState, number> = {
    bull: 1,
    bear: 1,
    sideways: 0.22,
    volatile: 1.15,
    viral: 2.85
  };
  const trendBiasBps = Math.round(
    sign * baseVolatility * stateMultiplier[marketState] * (0.75 + hypeScore / 180)
  );
  const stateEndsAt = new Date(
    now.getTime() +
      stateDurationHours(marketState, input.volatilityProfile, stateSeed) *
        60 *
        60 *
        1000
  );

  return {
    marketState,
    stateEndsAt,
    hypeScore,
    trendBiasBps,
    volatilityBps
  };
}

export function calculateLiveMarketMove(input: MarketMoveInput): MarketMove {
  const now = input.now ?? new Date();
  const intervalFactor = Math.sqrt(
    clamp(input.minutesSinceLastTick / marketMakerIntervalMinutes(), 0.5, 4)
  );
  const tickWindow = Math.floor(now.getTime() / (marketMakerIntervalMinutes() * 60_000));
  const seed = `${input.artistId}:${input.marketState}:${tickWindow}`;
  const hypeFactor = 0.75 + input.hypeScore / 140;
  const stateNoiseMultiplier: Record<LiveMarketState, number> = {
    bull: 0.9,
    bear: 0.9,
    sideways: 0.5,
    volatile: 1.45,
    viral: 1.9
  };
  let requestedDeltaBps = Math.round(
    (input.trendBiasBps +
      seededNoise(seed) *
        input.volatilityBps *
        hypeFactor *
        stateNoiseMultiplier[input.marketState]) *
      intervalFactor
  );
  const maxTick = Math.min(
    marketMakerMaxTickBps(),
    input.marketState === 'viral'
      ? marketMakerMaxTickBps()
      : profileMaxTick[input.volatilityProfile]
  );

  if (requestedDeltaBps === 0) {
    requestedDeltaBps = seededFloat(seed, 'minimum') < 0.5 ? -1 : 1;
  }

  const priceBandBps = input.priceBandBps ?? marketMakerPriceBandBps();
  const lowerBand = input.anchorPrice * (1 - priceBandBps / 10_000);
  const upperBand = input.anchorPrice * (1 + priceBandBps / 10_000);
  const distanceFromAnchorBps =
    input.anchorPrice > 0
      ? ((input.currentPrice / input.anchorPrice) - 1) * 10_000
      : 0;
  const normalizedDistance = clamp(distanceFromAnchorBps / priceBandBps, -1, 1);
  const reversionBps = Math.round(
    -normalizedDistance *
      marketMakerMeanReversionBps() *
      (0.7 + Math.min(input.hypeScore, 100) / 250)
  );
  const balanceNoiseBps = Math.round(
    seededNoise(`${seed}:balance`) * marketMakerBalanceNoiseBps()
  );
  const overheatThreshold = marketMakerOverheatThresholdBps();
  let overheatBps = 0;
  if (distanceFromAnchorBps > overheatThreshold) {
    overheatBps = -Math.round(
      ((distanceFromAnchorBps - overheatThreshold) / Math.max(1, priceBandBps - overheatThreshold)) *
        marketMakerOverheatCooldownBps()
    );
  } else if (distanceFromAnchorBps < -overheatThreshold) {
    overheatBps = Math.round(
      ((Math.abs(distanceFromAnchorBps) - overheatThreshold) /
        Math.max(1, priceBandBps - overheatThreshold)) *
        marketMakerOverheatCooldownBps()
    );
  }

  requestedDeltaBps += reversionBps + balanceNoiseBps + overheatBps;
  if (
    input.marketState === 'viral' &&
    Math.abs(distanceFromAnchorBps) < overheatThreshold &&
    Math.abs(requestedDeltaBps) < 22
  ) {
    const direction = Math.sign(requestedDeltaBps || input.trendBiasBps || 1);
    requestedDeltaBps = direction * 22;
  }
  requestedDeltaBps = clamp(requestedDeltaBps, -maxTick, maxTick);

  const pullbackRoll = seededFloat(seed, 'pullback');
  if (
    distanceFromAnchorBps > overheatThreshold &&
    requestedDeltaBps > 0 &&
    pullbackRoll < 0.58
  ) {
    requestedDeltaBps = -Math.max(2, Math.min(maxTick, Math.abs(reversionBps + overheatBps) || 4));
  }
  if (
    distanceFromAnchorBps < -overheatThreshold &&
    requestedDeltaBps < 0 &&
    pullbackRoll < 0.5
  ) {
    requestedDeltaBps = Math.max(2, Math.min(maxTick, Math.abs(reversionBps + overheatBps) || 4));
  }

  if (input.currentPrice >= upperBand && requestedDeltaBps > 0) {
    requestedDeltaBps = -Math.max(2, Math.min(maxTick, Math.abs(requestedDeltaBps)));
  }
  if (input.currentPrice <= lowerBand && requestedDeltaBps < 0) {
    requestedDeltaBps = Math.max(2, Math.min(maxTick, Math.abs(requestedDeltaBps)));
  }

  const rawNextPrice = input.currentPrice * (1 + requestedDeltaBps / 10_000);
  const nextPrice = clamp(rawNextPrice, lowerBand, upperBand);
  const appliedDeltaBps = Math.round(((nextPrice / input.currentPrice) - 1) * 10_000);

  return {
    requestedDeltaBps,
    appliedDeltaBps,
    nextPrice: Number(nextPrice.toFixed(6)),
    halted: appliedDeltaBps === 0
  };
}

function publicOutcome(
  artist: ArtistMarketRow,
  result: {
    state: LiveMarketState;
    status: 'applied' | 'skipped' | 'halted';
    appliedDeltaBps: number;
    nextPrice?: number;
    reason?: string;
  }
) {
  return {
    artistId: artist.id,
    artistName: artist.name,
    artistSlug: artist.slug,
    state: result.state,
    status: result.status,
    appliedDeltaBps: result.appliedDeltaBps,
    nextPrice: result.nextPrice ?? null,
    reason: result.reason ?? null
  };
}

async function loadActiveSeason(client: PoolClient) {
  const result = await client.query<{ id: string }>(
    `
      SELECT id
      FROM seasons
      WHERE status = 'active'
        AND trading_closes_at > NOW()
      ORDER BY starts_at DESC
      LIMIT 1
    `
  );
  return result.rows[0] ?? null;
}

async function loadArtists() {
  const result = await getPool().query<ArtistMarketRow>(
    `
      SELECT artist.id, artist.slug, artist.name, artist.category,
        artist.volatility_profile, artist.risk_level, artist.current_price,
        artist.daily_anchor_price, artist.status,
        (
          SELECT COUNT(*)::text
          FROM positions position
          WHERE position.artist_id = artist.id
            AND position.quantity > 0
        ) AS holders,
        (
          SELECT COALESCE(SUM(signal.applied_delta_bps), 0)::text
          FROM news_signals signal
          WHERE signal.artist_id = artist.id
            AND signal.window_ends_at >= NOW() - INTERVAL '24 hours'
        ) AS recent_news_bps
      FROM artists artist
      WHERE artist.status = 'active'
      ORDER BY artist.name
    `
  );
  return result.rows;
}

async function upsertState(
  client: PoolClient,
  artist: ArtistMarketRow,
  currentState: LiveMarketStateRow | null,
  now: Date
) {
  const expired =
    !currentState || new Date(currentState.state_ends_at).getTime() <= now.getTime();
  if (!expired) return currentState;

  const decision = chooseNextMarketState({
    artistId: artist.id,
    previousState: currentState?.market_state ?? null,
    volatilityProfile: artist.volatility_profile,
    riskLevel: Number(artist.risk_level),
    holders: Number(artist.holders),
    recentNewsBps: Number(artist.recent_news_bps),
    category: artist.category,
    currentHypeScore: currentState ? Number(currentState.hype_score) : null,
    now
  });
  const result = await client.query<LiveMarketStateRow>(
    `
      INSERT INTO live_market_states (
        artist_id, market_state, state_started_at, state_ends_at,
        hype_score, trend_bias_bps, volatility_bps, metadata, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (artist_id)
      DO UPDATE SET market_state = EXCLUDED.market_state,
        state_started_at = EXCLUDED.state_started_at,
        state_ends_at = EXCLUDED.state_ends_at,
        hype_score = EXCLUDED.hype_score,
        trend_bias_bps = EXCLUDED.trend_bias_bps,
        volatility_bps = EXCLUDED.volatility_bps,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING market_state, state_started_at, state_ends_at, hype_score,
        trend_bias_bps, volatility_bps, last_tick_at
    `,
    [
      artist.id,
      decision.marketState,
      now,
      decision.stateEndsAt,
      decision.hypeScore,
      decision.trendBiasBps,
      decision.volatilityBps,
      {
        algorithmVersion: MARKET_ALGORITHM_VERSION,
        recentNewsBps: Number(artist.recent_news_bps),
        holders: Number(artist.holders)
      }
    ]
  );
  return result.rows[0]!;
}

async function applyArtistMarketTick(
  artist: ArtistMarketRow,
  now: Date
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const season = await loadActiveSeason(client);
    if (!season) {
      await client.query('COMMIT');
      return publicOutcome(artist, {
        state: 'sideways',
        status: 'skipped',
        appliedDeltaBps: 0,
        reason: 'no-active-season'
      });
    }

    const artistLock = await client.query<{
      current_price: string;
      daily_anchor_price: string;
      status: string;
    }>(
      `
        SELECT current_price, daily_anchor_price, status
        FROM artists
        WHERE id = $1
        FOR UPDATE
      `,
      [artist.id]
    );
    const lockedArtist = artistLock.rows[0];
    if (!lockedArtist || lockedArtist.status !== 'active') {
      await client.query('COMMIT');
      return publicOutcome(artist, {
        state: 'sideways',
        status: 'skipped',
        appliedDeltaBps: 0,
        reason: 'artist-inactive'
      });
    }

    const stateResult = await client.query<LiveMarketStateRow>(
      `
        SELECT market_state, state_started_at, state_ends_at, hype_score,
          trend_bias_bps, volatility_bps, last_tick_at
        FROM live_market_states
        WHERE artist_id = $1
        FOR UPDATE
      `,
      [artist.id]
    );
    const state = await upsertState(
      client,
      artist,
      stateResult.rows[0] ?? null,
      now
    );
    const lastTickAt = state.last_tick_at
      ? new Date(state.last_tick_at).getTime()
      : null;
    const minutesSinceLastTick = lastTickAt
      ? (now.getTime() - lastTickAt) / 60_000
      : marketMakerIntervalMinutes();
    if (minutesSinceLastTick < marketMakerMinTickMinutes()) {
      await client.query('COMMIT');
      return publicOutcome(artist, {
        state: state.market_state,
        status: 'skipped',
        appliedDeltaBps: 0,
        reason: 'tick-cooldown'
      });
    }

    const move = calculateLiveMarketMove({
      artistId: artist.id,
      currentPrice: Number(lockedArtist.current_price),
      anchorPrice: Number(lockedArtist.daily_anchor_price),
      marketState: state.market_state,
      volatilityProfile: artist.volatility_profile,
      riskLevel: Number(artist.risk_level),
      hypeScore: Number(state.hype_score),
      trendBiasBps: Number(state.trend_bias_bps),
      volatilityBps: Number(state.volatility_bps),
      minutesSinceLastTick,
      now
    });

    await client.query(
      `
        UPDATE live_market_states
        SET last_tick_at = $2,
          last_delta_bps = $3,
          updated_at = NOW()
        WHERE artist_id = $1
      `,
      [artist.id, now, move.appliedDeltaBps]
    );

    if (move.halted) {
      await client.query('COMMIT');
      return publicOutcome(artist, {
        state: state.market_state,
        status: 'halted',
        appliedDeltaBps: 0,
        reason: 'price-band'
      });
    }

    await client.query(
      `UPDATE artists SET current_price = $2, version = version + 1 WHERE id = $1`,
      [artist.id, move.nextPrice.toFixed(6)]
    );
    await client.query(
      `
        INSERT INTO price_ticks (
          artist_id, season_id, price, source_type, source_reference
        ) VALUES ($1, $2, $3, 'market', $4)
      `,
      [
        artist.id,
        season.id,
        move.nextPrice.toFixed(6),
        `${MARKET_ALGORITHM_VERSION}:${state.market_state}`
      ]
    );
    await client.query('COMMIT');
    return publicOutcome(artist, {
      state: state.market_state,
      status: 'applied',
      appliedDeltaBps: move.appliedDeltaBps,
      nextPrice: move.nextPrice
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function runLiveMarketMaker() {
  if (!databaseConfigured()) return [];
  const lock = await getPool().query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock(hashtext('fame-market-live-market')) AS locked"
  );
  if (!lock.rows[0]?.locked) return [];
  try {
    const now = new Date();
    const artists = await loadArtists();
    const outcomes = [];
    for (const artist of artists) {
      try {
        outcomes.push(await applyArtistMarketTick(artist, now));
      } catch (error) {
        outcomes.push({
          artistId: artist.id,
          artistName: artist.name,
          artistSlug: artist.slug,
          state: 'sideways',
          status: 'failed',
          appliedDeltaBps: 0,
          nextPrice: null,
          reason: error instanceof Error ? error.message.slice(0, 500) : 'unknown-error'
        });
      }
    }
    return outcomes;
  } finally {
    await getPool()
      .query("SELECT pg_advisory_unlock(hashtext('fame-market-live-market'))")
      .catch(() => undefined);
  }
}
