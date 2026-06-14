import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeDatabase,
  getPool,
  runMigrations
} from './database.js';
import { PostgresMarketStore } from './postgresMarket.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const suite = databaseAvailable ? describe : describe.skip;
const suffix = randomUUID().slice(0, 8);
const firebaseUid = `concurrency-${suffix}`;
let artistId = '';

suite('PostgresMarketStore concurrency', () => {
  beforeAll(async () => {
    await runMigrations();
    const artist = await getPool().query<{ id: string }>(
      `
        INSERT INTO artists (
          slug, symbol, name, country, genre, current_price, opening_price,
          daily_anchor_price, liquidity
        ) VALUES ($1, $2, $3, 'Colombia', 'Prueba', 100, 100, 100, 10000)
        RETURNING id
      `,
      [`test-artist-${suffix}`, `T${suffix.toUpperCase()}`, 'Artista de prueba']
    );
    artistId = artist.rows[0]!.id;
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    const user = await getPool().query<{ id: string }>(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    const userId = user.rows[0]?.id;
    if (userId) {
      const wallets = await getPool().query<{ id: string }>(
        'SELECT id FROM wallets WHERE user_id = $1',
        [userId]
      );
      const walletIds = wallets.rows.map((wallet) => wallet.id);
      if (walletIds.length) {
        await getPool().query(
          'DELETE FROM ledger_entries WHERE wallet_id = ANY($1::uuid[])',
          [walletIds]
        );
        await getPool().query(
          'DELETE FROM trades WHERE wallet_id = ANY($1::uuid[])',
          [walletIds]
        );
        await getPool().query(
          'DELETE FROM trade_quotes WHERE wallet_id = ANY($1::uuid[])',
          [walletIds]
        );
        await getPool().query(
          'DELETE FROM positions WHERE wallet_id = ANY($1::uuid[])',
          [walletIds]
        );
        await getPool().query(
          'DELETE FROM wallets WHERE id = ANY($1::uuid[])',
          [walletIds]
        );
      }
      await getPool().query('DELETE FROM user_favorites WHERE user_id = $1', [
        userId
      ]);
      await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (artistId) {
      await getPool().query('DELETE FROM price_ticks WHERE artist_id = $1', [
        artistId
      ]);
      await getPool().query('DELETE FROM artists WHERE id = $1', [artistId]);
    }
    await closeDatabase();
  });

  it('executes one trade when the same request arrives concurrently', async () => {
    const market = new PostgresMarketStore();
    const user = {
      uid: firebaseUid,
      email: `${firebaseUid}@example.com`,
      displayName: 'Prueba concurrente',
      avatarUrl: null
    };
    const quote = await market.createQuote(user, artistId, 'buy', 1);
    const idempotencyKey = `trade-${randomUUID()}`;

    const [first, second] = await Promise.all([
      market.executeQuote(user, quote.id, idempotencyKey),
      market.executeQuote(user, quote.id, idempotencyKey)
    ]);

    const portfolio = (await market.getWallet(user)) as {
      balance: number;
      positions: Array<{ artistId: string; quantity: number }>;
    };
    const tradeCount = await getPool().query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM trades trade
        JOIN wallets wallet ON wallet.id = trade.wallet_id
        JOIN users app_user ON app_user.id = wallet.user_id
        WHERE app_user.firebase_uid = $1
          AND trade.idempotency_key = $2
      `,
      [firebaseUid, idempotencyKey]
    );

    expect(second.id).toBe(first.id);
    expect(Number(tradeCount.rows[0]!.count)).toBe(1);
    expect(
      portfolio.positions.find((position) => position.artistId === artistId)
        ?.quantity
    ).toBe(1);
    expect(portfolio.balance).toBeGreaterThanOrEqual(0);
  });
});
