import type { PoolClient } from 'pg';
import { getPool } from './database.js';
import { MarketError } from './market.js';
import {
  applySeasonBadges,
  generateSeasonFraudReview
} from './security.js';
import type { AuthenticatedUser } from './types.js';
import {
  publicArtistImage,
  type ImageUsageStatus
} from './rights.js';

type Numeric = string | number;

interface DbSeason {
  id: string;
  name: string;
  starts_at: Date;
  trading_closes_at: Date;
  ends_at: Date;
  starting_balance: Numeric;
  status: 'scheduled' | 'active' | 'frozen' | 'closed';
  frozen_at: Date | null;
  closed_at: Date | null;
  prize_min_users: number;
  prize_top_count: number;
  prize_note: string;
}

interface RankingRow {
  rank: number;
  display_name: string;
  avatar_url: string | null;
  final_value: Numeric;
  return_percent: Numeric;
  trade_count: Numeric;
  review_status: string;
  badges: string[];
}

const number = (value: Numeric | null | undefined) => Number(value ?? 0);
const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function publicSeason(season: DbSeason) {
  return {
    id: season.id,
    name: season.name,
    startsAt: new Date(season.starts_at).toISOString(),
    tradingClosesAt: new Date(season.trading_closes_at).toISOString(),
    endsAt: new Date(season.ends_at).toISOString(),
    startingBalance: number(season.starting_balance),
    status: season.status,
    prizeMinUsers: Number(season.prize_min_users),
    prizeTopCount: Number(season.prize_top_count),
    prizeNote: season.prize_note,
    frozenAt: season.frozen_at
      ? new Date(season.frozen_at).toISOString()
      : null,
    closedAt: season.closed_at
      ? new Date(season.closed_at).toISOString()
      : null
  };
}

function publicRanking(row: RankingRow) {
  return {
    rank: Number(row.rank),
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    portfolioValue: round(number(row.final_value)),
    returnPercent: round(number(row.return_percent), 4),
    tradeCount: number(row.trade_count),
    reviewStatus: row.review_status,
    badges: row.badges ?? []
  };
}

async function seasonById(client: PoolClient, seasonId: string, lock = false) {
  const result = await client.query<DbSeason>(
    `
      SELECT *
      FROM seasons
      WHERE id = $1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [seasonId]
  );
  const season = result.rows[0];
  if (!season) {
    throw new MarketError('Temporada no encontrada.', 'SEASON_NOT_FOUND', 404);
  }
  return season;
}

export async function getCurrentSeason() {
  const result = await getPool().query<DbSeason>(`
    SELECT *
    FROM seasons
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        WHEN 'frozen' THEN 1
        WHEN 'scheduled' THEN 2
        ELSE 3
      END,
      starts_at DESC
    LIMIT 1
  `);
  const season = result.rows[0];
  return season ? publicSeason(season) : null;
}

async function liveRanking(seasonId: string, limit: number) {
  const result = await getPool().query<RankingRow>(
    `
      WITH wallet_values AS (
        SELECT
          wallet.id,
          wallet.user_id,
          wallet.available_balance + COALESCE(position_value.invested, 0)
            AS final_value,
          season.starting_balance,
          COALESCE(trade_value.trade_count, 0)::integer AS trade_count
        FROM wallets wallet
        JOIN seasons season ON season.id = wallet.season_id
        LEFT JOIN LATERAL (
          SELECT SUM(position.quantity * artist.current_price) AS invested
          FROM positions position
          JOIN artists artist ON artist.id = position.artist_id
          WHERE position.wallet_id = wallet.id AND position.quantity > 0
        ) position_value ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::integer AS trade_count
          FROM trades trade
          WHERE trade.wallet_id = wallet.id
        ) trade_value ON TRUE
        WHERE wallet.season_id = $1
      ),
      ranked AS (
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY wallet_values.final_value DESC,
              wallet_values.trade_count DESC,
              app_user.created_at ASC
          )::integer AS rank,
          app_user.display_name,
          app_user.avatar_url,
          wallet_values.final_value,
          (
            (wallet_values.final_value - wallet_values.starting_balance)
            / wallet_values.starting_balance * 100
          ) AS return_percent,
          wallet_values.trade_count,
          'live'::text AS review_status,
          ARRAY[]::text[] AS badges
        FROM wallet_values
        JOIN users app_user ON app_user.id = wallet_values.user_id
      )
      SELECT *
      FROM ranked
      ORDER BY rank
      LIMIT $2
    `,
    [seasonId, limit]
  );
  return result.rows.map(publicRanking);
}

async function finalRanking(seasonId: string, limit: number) {
  const result = await getPool().query<RankingRow>(
    `
      SELECT ranking.rank, app_user.display_name, app_user.avatar_url,
        ranking.final_value, ranking.return_percent, ranking.trade_count,
        ranking.review_status, ranking.badges
      FROM rankings ranking
      JOIN users app_user ON app_user.id = ranking.user_id
      WHERE ranking.season_id = $1
      ORDER BY ranking.rank
      LIMIT $2
    `,
    [seasonId, limit]
  );
  return result.rows.map(publicRanking);
}

export async function getSeasonRanking(limit = 50) {
  const season = await getCurrentSeason();
  if (!season) {
    return {
      season: null,
      rankings: [],
      prizeStatus: null
    };
  }
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const [rankings, prizeStatus] = await Promise.all([
    season.status === 'closed'
      ? finalRanking(season.id, safeLimit)
      : liveRanking(season.id, safeLimit),
    getSeasonPrizeStatus(season)
  ]);
  return { season, rankings, prizeStatus };
}

export async function getSeasonPrizeStatus(season: {
  id: string;
  prizeMinUsers: number;
  prizeTopCount: number;
  prizeNote: string;
}) {
  const result = await getPool().query<{
    registered_users: string;
    season_participants: string;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM users) AS registered_users,
        (
          SELECT COUNT(*)
          FROM wallets
          WHERE season_id = $1
        ) AS season_participants
    `,
    [season.id]
  );
  const row = result.rows[0]!;
  const registeredUsers = Number(row.registered_users);
  const seasonParticipants = Number(row.season_participants);
  const minimumUsers = Math.max(1, Number(season.prizeMinUsers));
  return {
    registeredUsers,
    seasonParticipants,
    minimumUsers,
    remainingUsers: Math.max(0, minimumUsers - registeredUsers),
    topCount: Math.max(1, Number(season.prizeTopCount)),
    eligible: registeredUsers >= minimumUsers,
    note: season.prizeNote,
    generatedAt: new Date().toISOString()
  };
}

export async function getUserSeasonHistory(user: AuthenticatedUser) {
  const result = await getPool().query<{
    season_id: string;
    name: string;
    starts_at: Date;
    ends_at: Date;
    status: DbSeason['status'];
    available_balance: Numeric;
    starting_balance: Numeric;
    portfolio_value: Numeric;
    return_percent: Numeric;
    rank: number | null;
    trade_count: Numeric;
    review_status: string | null;
    badges: string[] | null;
  }>(
    `
      WITH wallet_values AS (
        SELECT
          wallet.id AS wallet_id,
          wallet.user_id,
          wallet.season_id,
          wallet.available_balance
            + COALESCE(position_value.invested, 0) AS portfolio_value
        FROM wallets wallet
        LEFT JOIN LATERAL (
          SELECT SUM(position.quantity * artist.current_price) AS invested
          FROM positions position
          JOIN artists artist ON artist.id = position.artist_id
          WHERE position.wallet_id = wallet.id AND position.quantity > 0
        ) position_value ON TRUE
      ),
      live_ranks AS (
        SELECT
          wallet_values.user_id,
          wallet_values.season_id,
          ROW_NUMBER() OVER (
            PARTITION BY wallet_values.season_id
            ORDER BY wallet_values.portfolio_value DESC,
              app_user.created_at ASC
          )::integer AS rank
        FROM wallet_values
        JOIN users app_user ON app_user.id = wallet_values.user_id
      )
      SELECT
        season.id AS season_id,
        season.name,
        season.starts_at,
        season.ends_at,
        season.status,
        wallet.available_balance,
        season.starting_balance,
        CASE
          WHEN season.status = 'closed'
            THEN COALESCE(ranking.final_value, wallet.available_balance)
          ELSE wallet_values.portfolio_value
        END AS portfolio_value,
        CASE
          WHEN season.status = 'closed'
            THEN COALESCE(
              ranking.return_percent,
              (wallet.available_balance - season.starting_balance)
                / season.starting_balance * 100
            )
          ELSE (wallet_values.portfolio_value - season.starting_balance)
            / season.starting_balance * 100
        END AS return_percent,
        COALESCE(ranking.rank, live_ranks.rank) AS rank,
        COALESCE(trade_value.trade_count, 0)::integer AS trade_count,
        ranking.review_status,
        ranking.badges
      FROM users app_user
      JOIN wallets wallet ON wallet.user_id = app_user.id
      JOIN seasons season ON season.id = wallet.season_id
      JOIN wallet_values ON wallet_values.wallet_id = wallet.id
      LEFT JOIN rankings ranking
        ON ranking.season_id = season.id AND ranking.user_id = app_user.id
      LEFT JOIN live_ranks
        ON live_ranks.season_id = season.id
        AND live_ranks.user_id = app_user.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS trade_count
        FROM trades trade
        WHERE trade.wallet_id = wallet.id
      ) trade_value ON TRUE
      WHERE app_user.firebase_uid = $1
      ORDER BY season.starts_at DESC
    `,
    [user.uid]
  );
  return result.rows.map((row) => ({
    seasonId: row.season_id,
    name: row.name,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    status: row.status,
    balance: number(row.available_balance),
    startingBalance: number(row.starting_balance),
    portfolioValue: round(number(row.portfolio_value)),
    returnPercent: round(number(row.return_percent), 4),
    rank: row.rank === null ? null : Number(row.rank),
    tradeCount: number(row.trade_count),
    reviewStatus: row.review_status ?? (row.status === 'closed' ? 'pending' : 'live'),
    badges: row.badges ?? []
  }));
}

export async function getUserSeasonTrades(
  user: AuthenticatedUser,
  seasonId: string
) {
  const result = await getPool().query<{
    id: string;
    artist_id: string;
    artist_name: string;
    artist_symbol: string;
    artist_image_url: string | null;
    image_usage_status: ImageUsageStatus;
    side: 'buy' | 'sell';
    quantity: number;
    average_price: Numeric;
    gross_amount: Numeric;
    fee: Numeric;
    realized_pnl: Numeric;
    created_at: Date;
  }>(
    `
      SELECT
        trade.id,
        trade.artist_id,
        artist.name AS artist_name,
        artist.symbol AS artist_symbol,
        artist.image_url AS artist_image_url,
        artist.image_usage_status,
        trade.side,
        trade.quantity,
        trade.average_price,
        trade.gross_amount,
        trade.fee,
        trade.realized_pnl,
        trade.created_at
      FROM users app_user
      JOIN wallets wallet ON wallet.user_id = app_user.id
      JOIN trades trade ON trade.wallet_id = wallet.id
      JOIN artists artist ON artist.id = trade.artist_id
      WHERE app_user.firebase_uid = $1
        AND wallet.season_id = $2
      ORDER BY trade.created_at DESC
      LIMIT 250
    `,
    [user.uid, seasonId]
  );
  return result.rows.map((trade) => ({
    id: trade.id,
    artistId: trade.artist_id,
    artistName: trade.artist_name,
    artistSymbol: trade.artist_symbol,
    artistImageUrl: publicArtistImage(
      trade.artist_image_url,
      trade.image_usage_status
    ),
    artistImageUsageStatus: trade.image_usage_status,
    side: trade.side,
    quantity: Number(trade.quantity),
    averagePrice: number(trade.average_price),
    grossAmount: number(trade.gross_amount),
    fee: number(trade.fee),
    realizedPnl: number(trade.realized_pnl),
    createdAt: new Date(trade.created_at).toISOString()
  }));
}

export async function freezeSeason(seasonId: string) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const season = await seasonById(client, seasonId, true);
    if (season.status === 'closed') {
      throw new MarketError(
        'La temporada ya esta cerrada.',
        'SEASON_ALREADY_CLOSED',
        409
      );
    }
    if (season.status === 'scheduled') {
      throw new MarketError(
        'La temporada programada aun no se puede congelar.',
        'SEASON_NOT_STARTED',
        409
      );
    }
    if (season.status === 'active') {
      await client.query(
        `
          UPDATE seasons
          SET status = 'frozen', frozen_at = NOW()
          WHERE id = $1
        `,
        [seasonId]
      );
      await client.query(
        `
          DELETE FROM trade_quotes
          WHERE wallet_id IN (
            SELECT id FROM wallets WHERE season_id = $1
          )
        `,
        [seasonId]
      );
      await client.query(
        `
          INSERT INTO audit_logs (
            actor_id, action, entity_type, entity_id
          ) VALUES ('system', 'season.freeze', 'season', $1)
        `,
        [seasonId]
      );
    }
    await client.query('COMMIT');
    return publicSeason(await seasonById(client, seasonId));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeSeason(seasonId: string) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const season = await seasonById(client, seasonId, true);
    if (season.status === 'closed') {
      await client.query('COMMIT');
      return publicSeason(season);
    }
    if (season.status !== 'frozen') {
      throw new MarketError(
        'Congela la temporada antes de cerrarla.',
        'SEASON_NOT_FROZEN',
        409
      );
    }

    await client.query('DELETE FROM rankings WHERE season_id = $1', [
      seasonId
    ]);
    await client.query(
      `
        WITH wallet_values AS (
          SELECT
            wallet.id AS wallet_id,
            wallet.user_id,
            wallet.available_balance + COALESCE(position_value.invested, 0)
              AS final_value,
            season.starting_balance,
            COALESCE(trade_value.trade_count, 0)::integer AS trade_count
          FROM wallets wallet
          JOIN seasons season ON season.id = wallet.season_id
          LEFT JOIN LATERAL (
            SELECT SUM(position.quantity * artist.current_price) AS invested
            FROM positions position
            JOIN artists artist ON artist.id = position.artist_id
            WHERE position.wallet_id = wallet.id AND position.quantity > 0
          ) position_value ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::integer AS trade_count
            FROM trades trade
            WHERE trade.wallet_id = wallet.id
          ) trade_value ON TRUE
          WHERE wallet.season_id = $1
        ),
        ranked AS (
          SELECT
            wallet_values.*,
            ROW_NUMBER() OVER (
              ORDER BY wallet_values.final_value DESC,
                wallet_values.trade_count DESC,
                app_user.created_at ASC
            )::integer AS final_rank
          FROM wallet_values
          JOIN users app_user ON app_user.id = wallet_values.user_id
        )
        INSERT INTO rankings (
          season_id, user_id, final_value, return_percent, rank, trade_count
        )
        SELECT
          $1,
          ranked.user_id,
          ranked.final_value,
          (
            (ranked.final_value - ranked.starting_balance)
            / ranked.starting_balance * 100
          ),
          ranked.final_rank,
          ranked.trade_count
        FROM ranked
      `,
      [seasonId]
    );
    await applySeasonBadges(client, seasonId);
    await generateSeasonFraudReview(client, seasonId);
    await client.query(
      `
        UPDATE seasons
        SET status = 'closed', closed_at = NOW()
        WHERE id = $1
      `,
      [seasonId]
    );
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id
        ) VALUES ('system', 'season.close', 'season', $1)
      `,
      [seasonId]
    );
    await client.query('COMMIT');
    return publicSeason(await seasonById(client, seasonId));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface ManualSeasonInput {
  name?: string;
  startsAt?: string;
  tradingClosesAt?: string;
  endsAt?: string;
  participationDays?: number;
  freezeMinutes?: number;
  startingBalance?: number;
  prizeMinUsers?: number;
  prizeTopCount?: number;
  prizeNote?: string;
}

function resolveManualSeasonInput(input: ManualSeasonInput = {}) {
  const start = input.startsAt ? new Date(input.startsAt) : new Date();
  if (!Number.isFinite(start.getTime())) {
    throw new MarketError('La fecha de apertura no es valida.', 'INVALID_SEASON_DATE');
  }
  const participationDays = Math.max(
    1,
    Math.min(365, Math.floor(input.participationDays ?? Number(process.env.SEASON_LENGTH_DAYS ?? 7)))
  );
  const end = input.endsAt
    ? new Date(input.endsAt)
    : new Date(start.getTime() + participationDays * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(end.getTime()) || end <= start) {
    throw new MarketError(
      'La fecha de cierre debe ser posterior a la apertura.',
      'INVALID_SEASON_DATE'
    );
  }
  const freezeMinutes = Math.max(
    0,
    Math.min(7 * 24 * 60, Math.floor(input.freezeMinutes ?? Number(process.env.SEASON_FREEZE_MINUTES ?? 30)))
  );
  const tradingClose = input.tradingClosesAt
    ? new Date(input.tradingClosesAt)
    : new Date(end.getTime() - freezeMinutes * 60 * 1000);
  if (
    !Number.isFinite(tradingClose.getTime()) ||
    tradingClose < start ||
    tradingClose > end
  ) {
    throw new MarketError(
      'El cierre de operaciones debe quedar entre apertura y final.',
      'INVALID_SEASON_DATE'
    );
  }
  const startingBalance = Math.max(
    100,
    Math.min(1_000_000, Math.round(input.startingBalance ?? Number(process.env.SEASON_STARTING_BALANCE ?? 10_000)))
  );
  const prizeMinUsers = Math.max(
    1,
    Math.min(
      100_000,
      Math.floor(input.prizeMinUsers ?? Number(process.env.SEASON_PRIZE_MIN_USERS ?? 100))
    )
  );
  const prizeTopCount = Math.max(
    1,
    Math.min(
      100,
      Math.floor(input.prizeTopCount ?? Number(process.env.SEASON_PRIZE_TOP_COUNT ?? 3))
    )
  );
  const prizeNote =
    input.prizeNote?.trim().slice(0, 500) ||
    `Premios manuales para el top ${prizeTopCount} cuando Fame Plays llegue a ${prizeMinUsers} usuarios registrados.`;
  return {
    name: input.name?.trim().slice(0, 80) || null,
    start,
    tradingClose,
    end,
    startingBalance,
    prizeMinUsers,
    prizeTopCount,
    prizeNote,
    status:
      start.getTime() > Date.now()
        ? ('scheduled' as const)
        : ('active' as const)
  };
}

async function initializeSeasonMarket(client: PoolClient, seasonId: string) {
  await client.query(
    `
      UPDATE artists
      SET opening_price = current_price,
        daily_anchor_price = current_price
      WHERE status = 'active'
    `
  );
  await client.query(
    `
      INSERT INTO price_ticks (artist_id, season_id, price, source_type)
      SELECT id, $1, current_price, 'season'
      FROM artists
      WHERE status = 'active'
    `,
    [seasonId]
  );
}

export async function createNextSeason(input: ManualSeasonInput = {}) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('fame-market-season-cycle'))"
    );
    const resolved = resolveManualSeasonInput(input);
    const existing = await client.query(
      `
        SELECT 1
        FROM seasons
        WHERE status IN ('active', 'frozen')
          OR (status = 'scheduled' AND $1::text = 'scheduled')
        LIMIT 1
      `,
      [resolved.status]
    );
    if (existing.rowCount) {
      throw new MarketError(
        'Ya existe una temporada activa, congelada o programada.',
        'SEASON_ALREADY_RUNNING',
        409
      );
    }
    const count = await client.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM seasons'
    );
    const seasonNumber = Number(count.rows[0]!.count) + 1;
    const result = await client.query<DbSeason>(
      `
        INSERT INTO seasons (
          name, starts_at, trading_closes_at, ends_at,
          starting_balance, status, prize_min_users, prize_top_count, prize_note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        resolved.name ?? `Temporada Latina ${seasonNumber}`,
        resolved.start,
        resolved.tradingClose,
        resolved.end,
        resolved.startingBalance,
        resolved.status,
        resolved.prizeMinUsers,
        resolved.prizeTopCount,
        resolved.prizeNote
      ]
    );
    const season = result.rows[0]!;
    if (season.status === 'active') {
      await initializeSeasonMarket(client, season.id);
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id
        ) VALUES ('system', 'season.create', 'season', $1)
      `,
      [season.id]
    );
    await client.query('COMMIT');
    return publicSeason(season);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function processSeasonCycle() {
  const actions: string[] = [];
  let current = await getCurrentSeason();
  const now = Date.now();

  if (current?.status === 'scheduled' && Date.parse(current.startsAt) <= now) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('fame-market-season-cycle'))"
      );
      await client.query(
        `
          UPDATE seasons
          SET status = 'active'
          WHERE id = $1 AND status = 'scheduled'
        `,
        [current.id]
      );
      await initializeSeasonMarket(client, current.id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    actions.push('activated');
    current = await getCurrentSeason();
  }
  if (current?.status === 'active' && Date.parse(current.tradingClosesAt) <= now) {
    await freezeSeason(current.id);
    actions.push('frozen');
    current = await getCurrentSeason();
  }
  if (current?.status === 'frozen' && Date.parse(current.endsAt) <= now) {
    await closeSeason(current.id);
    actions.push('closed');
    current = await getCurrentSeason();
  }
  if (!current || current.status === 'closed') {
    await createNextSeason();
    actions.push('created');
  }
  return { actions, season: await getCurrentSeason() };
}
