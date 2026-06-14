import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeDatabase,
  getPool,
  runMigrations
} from './database.js';
import { closeSeason, getUserSeasonHistory } from './seasons.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const suite = databaseAvailable ? describe : describe.skip;
const suffix = randomUUID().slice(0, 8);
const seasonId = randomUUID();
const userOneId = randomUUID();
const userTwoId = randomUUID();
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
        INSERT INTO wallets (user_id, season_id, available_balance)
        VALUES ($1, $3, 11250), ($2, $3, 9400)
      `,
      [userOneId, userTwoId, seasonId]
    );
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await getPool().query('DELETE FROM rankings WHERE season_id = $1', [
      seasonId
    ]);
    await getPool().query('DELETE FROM wallets WHERE season_id = $1', [
      seasonId
    ]);
    await getPool().query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
      [userOneId, userTwoId]
    ]);
    await getPool().query('DELETE FROM audit_logs WHERE entity_id = $1', [
      seasonId
    ]);
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
    }>(
      `
        SELECT user_id, rank, final_value, return_percent
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

    expect(firstClose.status).toBe('closed');
    expect(secondClose.status).toBe('closed');
    expect(ranking.rows).toHaveLength(2);
    expect(ranking.rows[0]?.user_id).toBe(userOneId);
    expect(ranking.rows[0]?.rank).toBe(1);
    expect(Number(ranking.rows[0]?.final_value)).toBe(11250);
    expect(Number(ranking.rows[0]?.return_percent)).toBe(12.5);
    expect(ranking.rows[1]?.rank).toBe(2);
    expect(history[0]?.rank).toBe(1);
    expect(history[0]?.portfolioValue).toBe(11250);
  });
});
