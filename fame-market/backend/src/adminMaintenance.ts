import type { PoolClient } from 'pg';
import { getPool } from './database.js';
import { MarketError } from './market.js';

export type AdminResetAction =
  | 'season-activity'
  | 'season-full'
  | 'season-history'
  | 'news-pulse';

export interface AdminResetSummary {
  action: AdminResetAction;
  seasonId: string | null;
  deleted: Record<string, number>;
  updated: Record<string, number>;
  generatedAt: string;
}

async function activeSeason(client: PoolClient) {
  const result = await client.query<{
    id: string;
    starting_balance: string;
    status: string;
  }>(
    `
      SELECT id, starting_balance, status
      FROM seasons
      WHERE status IN ('active', 'frozen', 'scheduled')
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'frozen' THEN 1
          ELSE 2
        END,
        starts_at DESC
      LIMIT 1
      FOR UPDATE
    `
  );
  return result.rows[0] ?? null;
}

async function deleteCount(
  client: PoolClient,
  query: string,
  values: unknown[] = []
) {
  const result = await client.query(query, values);
  return result.rowCount ?? 0;
}

async function resetSeasonActivity(
  client: PoolClient,
  action: AdminResetAction,
  actor: string
): Promise<AdminResetSummary> {
  const season = await activeSeason(client);
  if (!season) {
    throw new MarketError(
      'No hay una temporada activa, congelada o programada para resetear.',
      'NO_RESETTABLE_SEASON',
      404
    );
  }

  const deleted: Record<string, number> = {};
  const updated: Record<string, number> = {};

  deleted.ledgerEntries = await deleteCount(
    client,
    `
      DELETE FROM ledger_entries entry
      WHERE entry.wallet_id IN (
        SELECT id FROM wallets WHERE season_id = $1
      )
      OR entry.trade_id IN (
        SELECT trade.id
        FROM trades trade
        JOIN wallets wallet ON wallet.id = trade.wallet_id
        WHERE wallet.season_id = $1
      )
    `,
    [season.id]
  );
  deleted.tradeQuotes = await deleteCount(
    client,
    `
      DELETE FROM trade_quotes quote
      USING wallets wallet
      WHERE quote.wallet_id = wallet.id
        AND wallet.season_id = $1
    `,
    [season.id]
  );
  deleted.trades = await deleteCount(
    client,
    `
      DELETE FROM trades trade
      USING wallets wallet
      WHERE trade.wallet_id = wallet.id
        AND wallet.season_id = $1
    `,
    [season.id]
  );
  deleted.positions = await deleteCount(
    client,
    `
      DELETE FROM positions position
      USING wallets wallet
      WHERE position.wallet_id = wallet.id
        AND wallet.season_id = $1
    `,
    [season.id]
  );
  deleted.rankings = await deleteCount(
    client,
    'DELETE FROM rankings WHERE season_id = $1',
    [season.id]
  );
  deleted.fraudAlerts = await deleteCount(
    client,
    'DELETE FROM fraud_alerts WHERE season_id = $1',
    [season.id]
  );

  const walletUpdate = await client.query(
    `
      UPDATE wallets
      SET available_balance = $2,
        version = version + 1
      WHERE season_id = $1
    `,
    [season.id, season.starting_balance]
  );
  updated.wallets = walletUpdate.rowCount ?? 0;

  if (action === 'season-full') {
    deleted.priceTicks = await deleteCount(
      client,
      'DELETE FROM price_ticks WHERE season_id = $1',
      [season.id]
    );
    const artistUpdate = await client.query(
      `
        UPDATE artists
        SET current_price = opening_price,
          daily_anchor_price = opening_price,
          version = version + 1
        WHERE status = 'active'
      `
    );
    updated.artists = artistUpdate.rowCount ?? 0;
    await client.query(
      `
        INSERT INTO price_ticks (artist_id, season_id, price, source_type)
        SELECT id, $1, current_price, 'season'
        FROM artists
        WHERE status = 'active'
      `,
      [season.id]
    );
  }

  await client.query(
    `
      INSERT INTO audit_logs (
        actor_id, action, entity_type, entity_id, metadata
      ) VALUES ($1, $2, 'season', $3, $4)
    `,
    [
      actor,
      `admin.reset.${action}`,
      season.id,
      { deleted, updated, seasonStatus: season.status }
    ]
  );

  return {
    action,
    seasonId: season.id,
    deleted,
    updated,
    generatedAt: new Date().toISOString()
  };
}

async function resetNewsPulse(
  client: PoolClient,
  actor: string
): Promise<AdminResetSummary> {
  const deleted: Record<string, number> = {};
  const updated: Record<string, number> = {};

  deleted.newsSignals = await deleteCount(client, 'DELETE FROM news_signals');
  deleted.gdeltArticles = await deleteCount(
    client,
    `
      DELETE FROM content_items
      WHERE provider = 'gdelt'
        AND content_type = 'article'
    `
  );
  const sourceUpdate = await client.query(
    `
      UPDATE entity_sources
      SET last_synced_at = NULL,
        last_error = NULL
      WHERE provider = 'gdelt'
        AND source_type = 'news_search'
    `
  );
  updated.newsSources = sourceUpdate.rowCount ?? 0;

  await client.query(
    `
      INSERT INTO audit_logs (
        actor_id, action, entity_type, entity_id, metadata
      ) VALUES ($1, 'admin.reset.news-pulse', 'news', NULL, $2)
    `,
    [actor, { deleted, updated }]
  );

  return {
    action: 'news-pulse',
    seasonId: null,
    deleted,
    updated,
    generatedAt: new Date().toISOString()
  };
}

async function resetSeasonHistory(
  client: PoolClient,
  actor: string
): Promise<AdminResetSummary> {
  const seasonResult = await client.query<{ id: string }>(
    `
      SELECT id
      FROM seasons
      WHERE status = 'closed'
      FOR UPDATE
    `
  );
  const seasonIds = seasonResult.rows.map((season) => season.id);
  if (!seasonIds.length) {
    return {
      action: 'season-history',
      seasonId: null,
      deleted: {},
      updated: {},
      generatedAt: new Date().toISOString()
    };
  }

  const deleted: Record<string, number> = {};
  const updated: Record<string, number> = {};

  deleted.ledgerEntries = await deleteCount(
    client,
    `
      DELETE FROM ledger_entries entry
      WHERE entry.wallet_id IN (
        SELECT id FROM wallets WHERE season_id = ANY($1::uuid[])
      )
      OR entry.trade_id IN (
        SELECT trade.id
        FROM trades trade
        JOIN wallets wallet ON wallet.id = trade.wallet_id
        WHERE wallet.season_id = ANY($1::uuid[])
      )
    `,
    [seasonIds]
  );
  deleted.tradeQuotes = await deleteCount(
    client,
    `
      DELETE FROM trade_quotes quote
      USING wallets wallet
      WHERE quote.wallet_id = wallet.id
        AND wallet.season_id = ANY($1::uuid[])
    `,
    [seasonIds]
  );
  deleted.trades = await deleteCount(
    client,
    `
      DELETE FROM trades trade
      USING wallets wallet
      WHERE trade.wallet_id = wallet.id
        AND wallet.season_id = ANY($1::uuid[])
    `,
    [seasonIds]
  );
  deleted.positions = await deleteCount(
    client,
    `
      DELETE FROM positions position
      USING wallets wallet
      WHERE position.wallet_id = wallet.id
        AND wallet.season_id = ANY($1::uuid[])
    `,
    [seasonIds]
  );
  deleted.rankings = await deleteCount(
    client,
    'DELETE FROM rankings WHERE season_id = ANY($1::uuid[])',
    [seasonIds]
  );
  deleted.fraudAlerts = await deleteCount(
    client,
    'DELETE FROM fraud_alerts WHERE season_id = ANY($1::uuid[])',
    [seasonIds]
  );
  deleted.wallets = await deleteCount(
    client,
    'DELETE FROM wallets WHERE season_id = ANY($1::uuid[])',
    [seasonIds]
  );

  await client.query(
    `
      INSERT INTO audit_logs (
        actor_id, action, entity_type, entity_id, metadata
      ) VALUES ($1, 'admin.reset.season-history', 'season', NULL, $2)
    `,
    [actor, { deleted, updated, seasonIds }]
  );

  return {
    action: 'season-history',
    seasonId: null,
    deleted,
    updated,
    generatedAt: new Date().toISOString()
  };
}

export async function runAdminReset(
  action: AdminResetAction,
  actor = 'admin'
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('fame-market-admin-reset'))"
    );
    const summary =
      action === 'news-pulse'
        ? await resetNewsPulse(client, actor)
        : action === 'season-history'
          ? await resetSeasonHistory(client, actor)
          : await resetSeasonActivity(client, action, actor);
    await client.query('COMMIT');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
