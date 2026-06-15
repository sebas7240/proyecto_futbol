import { databaseConfigured, getPool } from './database.js';
import type { AuthenticatedUser } from './types.js';
import type { PoolClient } from 'pg';

export const entityCategories = [
  { id: 'musica', label: 'Musica' },
  { id: 'creadores', label: 'Creadores' },
  { id: 'cine-tv', label: 'Cine/TV' },
  { id: 'deportes', label: 'Deportes' },
  { id: 'otros', label: 'Otros' }
] as const;

export type EntityCategory = (typeof entityCategories)[number]['id'];

const validCategoryIds = new Set(entityCategories.map((category) => category.id));
const memoryInterests = new Map<string, EntityCategory[]>();

export function cleanCategories(categories: string[]) {
  return [
    ...new Set(
      categories.filter((category): category is EntityCategory =>
        validCategoryIds.has(category as EntityCategory)
      )
    )
  ];
}

async function ensureUserId(
  user: AuthenticatedUser,
  client: PoolClient | ReturnType<typeof getPool> = getPool()
) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO users (
        firebase_uid, email, display_name, avatar_url, last_login_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = NOW()
      RETURNING id
    `,
    [user.uid, user.email, user.displayName, user.avatarUrl]
  );
  return result.rows[0]!.id;
}

export async function listCategoryOverview() {
  if (!databaseConfigured()) {
    return entityCategories.map((category) => ({
      ...category,
      count: category.id === 'musica' ? 3 : 0
    }));
  }

  const result = await getPool().query<{
    category: EntityCategory;
    count: string;
  }>(`
    SELECT category, COUNT(*) AS count
    FROM artists
    GROUP BY category
  `);
  const counts = new Map(
    result.rows.map((row) => [row.category, Number(row.count)])
  );
  return entityCategories.map((category) => ({
    ...category,
    count: counts.get(category.id) ?? 0
  }));
}

export async function getUserInterests(user: AuthenticatedUser) {
  if (!databaseConfigured()) {
    return memoryInterests.get(user.uid) ?? [];
  }
  const userId = await ensureUserId(user);
  const result = await getPool().query<{ category: EntityCategory }>(
    `
      SELECT category
      FROM user_interests
      WHERE user_id = $1
      ORDER BY created_at ASC
    `,
    [userId]
  );
  return result.rows.map((row) => row.category);
}

export async function setUserInterests(
  user: AuthenticatedUser,
  categories: string[]
) {
  const clean = cleanCategories(categories);
  if (!databaseConfigured()) {
    memoryInterests.set(user.uid, clean);
    return clean;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const userId = await ensureUserId(user, client);
    await client.query('DELETE FROM user_interests WHERE user_id = $1', [
      userId
    ]);
    for (const category of clean) {
      await client.query(
        `
          INSERT INTO user_interests (user_id, category)
          VALUES ($1, $2)
          ON CONFLICT (user_id, category) DO NOTHING
        `,
        [userId, category]
      );
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES (
          $1, 'user.interests.update', 'user', $2,
          jsonb_build_object('categories', $3::text[])
        )
      `,
      [user.uid, userId, clean]
    );
    await client.query('COMMIT');
    return clean;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
