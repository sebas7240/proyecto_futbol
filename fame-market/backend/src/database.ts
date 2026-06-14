import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurada.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl:
        process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
          : undefined
    });
    pool.on('error', (error) => {
      console.error('[Database] Unexpected pool error', error);
    });
  }
  return pool;
}

export async function checkDatabase() {
  const result = await getPool().query<{ now: Date }>('SELECT NOW() AS now');
  return result.rows[0]?.now;
}

export async function runMigrations() {
  const migrationsDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../migrations'
  );
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const filename of filenames) {
    const applied = await db.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [filename]
    );
    if (applied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        filename
      ]);
      await client.query('COMMIT');
      console.log(`[Database] Applied migration ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function closeDatabase() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
