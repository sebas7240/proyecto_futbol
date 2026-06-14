import type { PoolClient } from 'pg';
import { getPool } from './database.js';
import { MarketError } from './market.js';

type ReviewStatus = 'pending' | 'approved' | 'flagged';
type EntityStatus = 'active' | 'frozen';

export async function applySeasonBadges(
  client: PoolClient,
  seasonId: string
) {
  await client.query(
    `
      UPDATE rankings
      SET badges = ARRAY[]::text[]
      WHERE season_id = $1
    `,
    [seasonId]
  );

  await client.query(
    `
      WITH rookie AS (
        SELECT ranking.id
        FROM rankings ranking
        JOIN seasons season ON season.id = ranking.season_id
        WHERE ranking.season_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM wallets older_wallet
            JOIN seasons older_season ON older_season.id = older_wallet.season_id
            WHERE older_wallet.user_id = ranking.user_id
              AND older_season.starts_at < season.starts_at
          )
        ORDER BY ranking.rank
        LIMIT 1
      )
      UPDATE rankings
      SET badges = array_append(badges, 'rookie')
      WHERE id = (SELECT id FROM rookie)
    `,
    [seasonId]
  );

  await client.query(
    `
      WITH first_buys AS (
        SELECT DISTINCT ON (trade.artist_id)
          wallet.user_id,
          trade.artist_id
        FROM trades trade
        JOIN wallets wallet ON wallet.id = trade.wallet_id
        JOIN artists artist ON artist.id = trade.artist_id
        WHERE wallet.season_id = $1
          AND trade.side = 'buy'
          AND artist.current_price > artist.opening_price
        ORDER BY trade.artist_id, trade.created_at, trade.id
      ),
      discoverers AS (
        SELECT ranking.id, ranking.rank, COUNT(*)::integer AS discoveries
        FROM first_buys
        JOIN rankings ranking
          ON ranking.season_id = $1
          AND ranking.user_id = first_buys.user_id
        GROUP BY ranking.id, ranking.rank
        ORDER BY discoveries DESC, ranking.rank
        LIMIT 1
      )
      UPDATE rankings
      SET badges = array_append(badges, 'early_discoverer')
      WHERE id = (SELECT id FROM discoverers)
    `,
    [seasonId]
  );
}

export async function generateSeasonFraudReview(
  client: PoolClient,
  seasonId: string
) {
  await client.query('DELETE FROM fraud_alerts WHERE season_id = $1', [
    seasonId
  ]);
  await client.query(
    `
      UPDATE rankings
      SET review_status = CASE WHEN rank <= 10 THEN 'pending' ELSE 'approved' END,
        review_notes = NULL,
        reviewed_at = CASE WHEN rank <= 10 THEN NULL ELSE NOW() END,
        reviewed_by = CASE WHEN rank <= 10 THEN NULL ELSE 'system' END
      WHERE season_id = $1
    `,
    [seasonId]
  );

  await client.query(
    `
      INSERT INTO fraud_alerts (
        season_id, user_id, code, severity, description, metadata
      )
      SELECT
        season_id,
        user_id,
        'EXCESSIVE_RETURN',
        CASE WHEN return_percent >= 50 THEN 'high' ELSE 'medium' END,
        'Rendimiento semanal inusualmente alto.',
        jsonb_build_object('returnPercent', return_percent)
      FROM rankings
      WHERE season_id = $1 AND return_percent >= 25
    `,
    [seasonId]
  );

  await client.query(
    `
      INSERT INTO fraud_alerts (
        season_id, user_id, code, severity, description, metadata
      )
      SELECT
        season_id,
        user_id,
        'EXCESSIVE_TRADES',
        'high',
        'Supero el maximo permitido de operaciones diarias.',
        jsonb_build_object('tradeCount', trade_count)
      FROM rankings
      WHERE season_id = $1 AND trade_count > 60
    `,
    [seasonId]
  );

  await client.query(
    `
      WITH rapid_activity AS (
        SELECT
          wallet.user_id,
          MAX(bucket.trade_count)::integer AS peak_trades
        FROM (
          SELECT
            trade.wallet_id,
            date_trunc('minute', trade.created_at) AS minute,
            COUNT(*) AS trade_count
          FROM trades trade
          JOIN wallets wallet_scope ON wallet_scope.id = trade.wallet_id
          WHERE wallet_scope.season_id = $1
          GROUP BY trade.wallet_id, date_trunc('minute', trade.created_at)
          HAVING COUNT(*) >= 10
        ) bucket
        JOIN wallets wallet ON wallet.id = bucket.wallet_id
        GROUP BY wallet.user_id
      )
      INSERT INTO fraud_alerts (
        season_id, user_id, code, severity, description, metadata
      )
      SELECT
        $1,
        user_id,
        'RAPID_ACTIVITY',
        'high',
        'Concentro demasiadas operaciones dentro de un minuto.',
        jsonb_build_object('peakTradesPerMinute', peak_trades)
      FROM rapid_activity
    `,
    [seasonId]
  );

  await client.query(
    `
      WITH totals AS (
        SELECT wallet.user_id, COUNT(*)::numeric AS total
        FROM trades trade
        JOIN wallets wallet ON wallet.id = trade.wallet_id
        WHERE wallet.season_id = $1
        GROUP BY wallet.user_id
      ),
      concentrated AS (
        SELECT
          wallet.user_id,
          artist.name AS artist_name,
          COUNT(*)::numeric AS artist_trades,
          totals.total
        FROM trades trade
        JOIN wallets wallet ON wallet.id = trade.wallet_id
        JOIN artists artist ON artist.id = trade.artist_id
        JOIN totals ON totals.user_id = wallet.user_id
        WHERE wallet.season_id = $1 AND totals.total >= 10
        GROUP BY wallet.user_id, artist.name, totals.total
        HAVING COUNT(*)::numeric / totals.total >= 0.9
      )
      INSERT INTO fraud_alerts (
        season_id, user_id, code, severity, description, metadata
      )
      SELECT
        $1,
        user_id,
        'CONCENTRATED_ACTIVITY',
        'medium',
        'El 90% o mas de sus operaciones se concentro en un artista.',
        jsonb_build_object(
          'artist', artist_name,
          'artistTrades', artist_trades,
          'totalTrades', total
        )
      FROM concentrated
    `,
    [seasonId]
  );

  await client.query(
    `
      UPDATE rankings ranking
      SET review_status = 'flagged'
      WHERE ranking.season_id = $1
        AND EXISTS (
          SELECT 1
          FROM fraud_alerts alert
          WHERE alert.season_id = ranking.season_id
            AND alert.user_id = ranking.user_id
            AND alert.status = 'open'
            AND alert.severity = 'high'
        )
    `,
    [seasonId]
  );
}

export async function listSecurityReviews() {
  const result = await getPool().query<{
    season_id: string;
    season_name: string;
    user_id: string;
    display_name: string;
    rank: number;
    final_value: string;
    return_percent: string;
    trade_count: number;
    review_status: ReviewStatus;
    review_notes: string | null;
    badges: string[];
    user_status: EntityStatus;
    alerts: Array<{
      id: string;
      code: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      status: 'open' | 'resolved' | 'dismissed';
      metadata: Record<string, unknown>;
    }>;
  }>(`
    SELECT
      ranking.season_id,
      season.name AS season_name,
      ranking.user_id,
      app_user.display_name,
      ranking.rank,
      ranking.final_value,
      ranking.return_percent,
      ranking.trade_count,
      ranking.review_status,
      ranking.review_notes,
      ranking.badges,
      app_user.status AS user_status,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', alert.id,
            'code', alert.code,
            'severity', alert.severity,
            'description', alert.description,
            'status', alert.status,
            'metadata', alert.metadata
          )
          ORDER BY alert.created_at
        ) FILTER (WHERE alert.id IS NOT NULL),
        '[]'::jsonb
      ) AS alerts
    FROM rankings ranking
    JOIN seasons season ON season.id = ranking.season_id
    JOIN users app_user ON app_user.id = ranking.user_id
    LEFT JOIN fraud_alerts alert
      ON alert.season_id = ranking.season_id
      AND alert.user_id = ranking.user_id
    WHERE ranking.review_status IN ('pending', 'flagged')
       OR alert.status = 'open'
    GROUP BY ranking.id, season.name, season.starts_at, app_user.id
    ORDER BY season.starts_at DESC, ranking.rank
    LIMIT 200
  `);

  return result.rows.map((row) => ({
    seasonId: row.season_id,
    seasonName: row.season_name,
    userId: row.user_id,
    displayName: row.display_name,
    rank: Number(row.rank),
    portfolioValue: Number(row.final_value),
    returnPercent: Number(row.return_percent),
    tradeCount: Number(row.trade_count),
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes,
    badges: row.badges ?? [],
    userStatus: row.user_status,
    alerts: row.alerts ?? []
  }));
}

export async function reviewRanking(
  seasonId: string,
  userId: string,
  status: Exclude<ReviewStatus, 'pending'>,
  notes: string | null,
  actor = 'admin'
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `
        UPDATE rankings
        SET review_status = $3,
          review_notes = $4,
          reviewed_at = NOW(),
          reviewed_by = $5
        WHERE season_id = $1 AND user_id = $2
        RETURNING id
      `,
      [seasonId, userId, status, notes, actor]
    );
    if (!updated.rowCount) {
      throw new MarketError(
        'Resultado de ranking no encontrado.',
        'RANKING_NOT_FOUND',
        404
      );
    }
    if (status === 'approved') {
      await client.query(
        `
          UPDATE fraud_alerts
          SET status = 'resolved',
            resolved_at = NOW(),
            resolved_by = $3
          WHERE season_id = $1 AND user_id = $2 AND status = 'open'
        `,
        [seasonId, userId, actor]
      );
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES ($1, 'ranking.review', 'user', $2, $3)
      `,
      [actor, userId, { seasonId, status, notes }]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setUserStatus(
  userId: string,
  status: EntityStatus,
  actor = 'admin'
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE users SET status = $2 WHERE id = $1 RETURNING id',
      [userId, status]
    );
    if (!result.rowCount) {
      throw new MarketError('Usuario no encontrado.', 'USER_NOT_FOUND', 404);
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES ($1, 'user.status', 'user', $2, $3)
      `,
      [actor, userId, { status }]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setArtistStatus(
  artistId: string,
  status: EntityStatus,
  actor = 'admin'
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE artists SET status = $2 WHERE id = $1 RETURNING id',
      [artistId, status]
    );
    if (!result.rowCount) {
      throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES ($1, 'artist.status', 'artist', $2, $3)
      `,
      [actor, artistId, { status }]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
