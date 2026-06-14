import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeDatabase,
  getPool,
  runMigrations
} from './database.js';
import { consumeRateLimit } from './rateLimit.js';
import {
  listSecurityReviews,
  reviewRanking,
  setUserStatus
} from './security.js';
import {
  closeSeason,
  getUserSeasonHistory,
  getUserSeasonTrades
} from './seasons.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const suite = databaseAvailable ? describe : describe.skip;
const suffix = randomUUID().slice(0, 8);
const seasonId = randomUUID();
const userOneId = randomUUID();
const userTwoId = randomUUID();
const walletOneId = randomUUID();
const walletTwoId = randomUUID();
const tradeId = randomUUID();
const userOneUid = `season-winner-${suffix}`;
const userTwoUid = `season-second-${suffix}`;

suite('season lifecycle', () => {
  beforeAll(async () => {
    await runMigrations();
    await getPool().query(
      `
        INSERT INTO seasons (
          id, name, starts_at, trading_closes_at, ends_at,
          starting_balance, status, frozen_at
        ) VALUES (
          $1, $2, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day',
          NOW(), 10000, 'frozen', NOW() - INTERVAL '30 minutes'
        )
      `,
      [seasonId, `Temporada de prueba ${suffix}`]
    );
    await getPool().query(
      `
        INSERT INTO users (id, firebase_uid, email, display_name)
        VALUES
          ($1, $2, $3, 'Ganador de prueba'),
          ($4, $5, $6, 'Segundo de prueba')
      `,
      [
        userOneId,
        userOneUid,
        `${userOneUid}@example.com`,
        userTwoId,
        userTwoUid,
        `${userTwoUid}@example.com`
      ]
    );
    await getPool().query(
      `
        INSERT INTO wallets (id, user_id, season_id, available_balance)
        VALUES ($1, $3, $5, 13000), ($2, $4, $5, 9400)
      `,
      [walletOneId, walletTwoId, userOneId, userTwoId, seasonId]
    );
    await getPool().query(
      `
        INSERT INTO trades (
          id, wallet_id, artist_id, side, quantity, average_price,
          gross_amount, fee, realized_pnl, idempotency_key, created_at
        ) VALUES (
          $1, $2, '10000000-0000-4000-8000-000000000001',
          'buy', 2, 114, 228, 0.57, 0, $3,
          NOW() - INTERVAL '7 days'
        )
      `,
      [tradeId, walletOneId, `season-test-${suffix}`]
    );
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await getPool().query('DELETE FROM rankings WHERE season_id = $1', [
      seasonId
    ]);
    await getPool().query('DELETE FROM fraud_alerts WHERE season_id = $1', [
      seasonId
    ]);
    await getPool().query('DELETE FROM trades WHERE id = $1', [tradeId]);
    await getPool().query('DELETE FROM wallets WHERE season_id = $1', [
      seasonId
    ]);
    await getPool().query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
      [userOneId, userTwoId]
    ]);
    await getPool().query('DELETE FROM audit_logs WHERE entity_id = $1', [
      seasonId
    ]);
    await getPool().query(
      "DELETE FROM audit_logs WHERE actor_id = 'vitest' OR entity_id = ANY($1::text[])",
      [[userOneId, userTwoId]]
    );
    await getPool().query('DELETE FROM seasons WHERE id = $1', [seasonId]);
    await closeDatabase();
  });

  it('freezes final values and keeps closing idempotent', async () => {
    const firstClose = await closeSeason(seasonId);
    const secondClose = await closeSeason(seasonId);
    const ranking = await getPool().query<{
      user_id: string;
      rank: number;
      final_value: string;
      return_percent: string;
      review_status: string;
      badges: string[];
    }>(
      `
        SELECT user_id, rank, final_value, return_percent, review_status, badges
        FROM rankings
        WHERE season_id = $1
        ORDER BY rank
      `,
      [seasonId]
    );
    const history = await getUserSeasonHistory({
      uid: userOneUid,
      email: `${userOneUid}@example.com`,
      displayName: 'Ganador de prueba',
      avatarUrl: null
    });
    const trades = await getUserSeasonTrades(
      {
        uid: userOneUid,
        email: `${userOneUid}@example.com`,
        displayName: 'Ganador de prueba',
        avatarUrl: null
      },
      seasonId
    );
    const reviews = await listSecurityReviews();
    const winnerReview = reviews.find(
      (review) => review.seasonId === seasonId && review.userId === userOneId
    );

    expect(firstClose.status).toBe('closed');
    expect(secondClose.status).toBe('closed');
    expect(ranking.rows).toHaveLength(2);
    expect(ranking.rows[0]?.user_id).toBe(userOneId);
    expect(ranking.rows[0]?.rank).toBe(1);
    expect(ranking.rows[0]?.review_status).toBe('pending');
    expect(ranking.rows[0]?.badges).toContain('rookie');
    expect(ranking.rows[0]?.badges).toContain('early_discoverer');
    expect(Number(ranking.rows[0]?.final_value)).toBe(13000);
    expect(Number(ranking.rows[0]?.return_percent)).toBe(30);
    expect(ranking.rows[1]?.rank).toBe(2);
    expect(history[0]?.rank).toBe(1);
    expect(history[0]?.portfolioValue).toBe(13000);
    expect(history[0]?.badges).toContain('rookie');
    expect(trades).toHaveLength(1);
    expect(trades[0]?.artistSymbol).toBe('KAROL');
    expect(trades[0]?.side).toBe('buy');
    expect(winnerReview?.reviewStatus).toBe('pending');
    expect(winnerReview?.alerts[0]?.code).toBe('EXCESSIVE_RETURN');

    await reviewRanking(
      seasonId,
      userOneId,
      'approved',
      'Validado por prueba automatizada.',
      'vitest'
    );
    const approved = await getPool().query<{
      review_status: string;
      review_notes: string | null;
    }>(
      `
        SELECT review_status, review_notes
        FROM rankings
        WHERE season_id = $1 AND user_id = $2
      `,
      [seasonId, userOneId]
    );
    const resolvedAlert = await getPool().query<{ status: string }>(
      `
        SELECT status
        FROM fraud_alerts
        WHERE season_id = $1 AND user_id = $2
      `,
      [seasonId, userOneId]
    );
    expect(approved.rows[0]?.review_status).toBe('approved');
    expect(approved.rows[0]?.review_notes).toContain('Validado');
    expect(resolvedAlert.rows[0]?.status).toBe('resolved');

    await setUserStatus(userOneId, 'frozen', 'vitest');
    const frozenUser = await getPool().query<{ status: string }>(
      'SELECT status FROM users WHERE id = $1',
      [userOneId]
    );
    expect(frozenUser.rows[0]?.status).toBe('frozen');
    await setUserStatus(userOneId, 'active', 'vitest');
  });

  it('applies an atomic request limit', async () => {
    const key = `rate-test-${suffix}`;
    const first = await consumeRateLimit(key, 'integration-test', 1, 60_000);
    const second = await consumeRateLimit(key, 'integration-test', 1, 60_000);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThan(0);

    await getPool().query(
      'DELETE FROM action_rate_limits WHERE rate_key = $1',
      [key]
    );
  });
});
