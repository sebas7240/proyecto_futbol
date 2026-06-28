import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { databaseConfigured, getPool } from './database.js';
import { requestIp } from './rateLimit.js';

const presenceWindowSeconds = 120;
const staleSessionSeconds = 10 * 60;
const memorySessions = new Map<
  string,
  { userId: string | null; path: string; lastSeenAt: number; createdAt: number }
>();

function hashValue(value: string) {
  const salt = process.env.PRESENCE_HASH_SALT || 'fame-plays-dev-presence';
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function pruneMemorySessions(now = Date.now()) {
  const staleBefore = now - staleSessionSeconds * 1000;
  for (const [sessionId, session] of memorySessions.entries()) {
    if (session.lastSeenAt < staleBefore) {
      memorySessions.delete(sessionId);
    }
  }
}

export function presenceWindow() {
  return presenceWindowSeconds;
}

export async function recordPresenceHeartbeat(input: {
  request: Request;
  sessionId: string;
  path: string;
  userId?: string | null;
}) {
  const path = input.path.slice(0, 180) || '/';
  const userId = input.userId ?? input.request.authenticatedUser?.uid ?? null;

  if (!databaseConfigured()) {
    const now = Date.now();
    pruneMemorySessions(now);
    const existing = memorySessions.get(input.sessionId);
    memorySessions.set(input.sessionId, {
      userId,
      path,
      createdAt: existing?.createdAt ?? now,
      lastSeenAt: now
    });
    return getPresenceOverview();
  }

  const ipHash = hashValue(requestIp(input.request));
  const userAgentHash = hashValue(input.request.header('user-agent') ?? 'unknown');
  await getPool().query(
    `
      INSERT INTO online_sessions (
        session_id, user_id, path, ip_hash, user_agent_hash, last_seen_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (session_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        path = EXCLUDED.path,
        ip_hash = EXCLUDED.ip_hash,
        user_agent_hash = EXCLUDED.user_agent_hash,
        last_seen_at = NOW()
    `,
    [input.sessionId, userId, path, ipHash, userAgentHash]
  );
  await getPool().query(
    `
      DELETE FROM online_sessions
      WHERE last_seen_at < NOW() - ($1::integer * INTERVAL '1 second')
    `,
    [staleSessionSeconds]
  );
  return getPresenceOverview();
}

export async function getPresenceOverview() {
  if (!databaseConfigured()) {
    const now = Date.now();
    pruneMemorySessions(now);
    const onlineUsers = [...memorySessions.values()].filter(
      (session) => session.lastSeenAt >= now - presenceWindowSeconds * 1000
    ).length;
    return {
      onlineUsers,
      windowSeconds: presenceWindowSeconds,
      generatedAt: new Date(now).toISOString()
    };
  }

  const result = await getPool().query<{ online_users: string }>(
    `
      SELECT COUNT(*) AS online_users
      FROM online_sessions
      WHERE last_seen_at >= NOW() - ($1::integer * INTERVAL '1 second')
    `,
    [presenceWindowSeconds]
  );
  return {
    onlineUsers: Number(result.rows[0]?.online_users ?? 0),
    windowSeconds: presenceWindowSeconds,
    generatedAt: new Date().toISOString()
  };
}
