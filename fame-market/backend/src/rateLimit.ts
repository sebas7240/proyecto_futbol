import type { NextFunction, Request, Response } from 'express';
import { databaseConfigured, getPool } from './database.js';

interface RateLimitOptions {
  action: string;
  maxRequests: number;
  windowMs: number;
  key: (request: Request) => string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const memoryWindows = new Map<
  string,
  { count: number; windowStartedAt: number }
>();

export function requestIp(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

export async function consumeRateLimit(
  rateKey: string,
  action: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!databaseConfigured()) {
    const compositeKey = `${action}:${rateKey}`;
    const now = Date.now();
    const existing = memoryWindows.get(compositeKey);
    const current =
      !existing || now - existing.windowStartedAt >= windowMs
        ? { count: 1, windowStartedAt: now }
        : { ...existing, count: existing.count + 1 };
    memoryWindows.set(compositeKey, current);
    return {
      allowed: current.count <= maxRequests,
      remaining: Math.max(0, maxRequests - current.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.windowStartedAt + windowMs - now) / 1000)
      )
    };
  }

  const result = await getPool().query<{
    request_count: number;
    window_started_at: Date;
  }>(
    `
      INSERT INTO action_rate_limits (
        rate_key, action, window_started_at, request_count, updated_at
      ) VALUES ($1, $2, NOW(), 1, NOW())
      ON CONFLICT (rate_key, action)
      DO UPDATE SET
        window_started_at = CASE
          WHEN action_rate_limits.window_started_at
            <= NOW() - ($3::double precision * INTERVAL '1 millisecond')
            THEN NOW()
          ELSE action_rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN action_rate_limits.window_started_at
            <= NOW() - ($3::double precision * INTERVAL '1 millisecond')
            THEN 1
          ELSE action_rate_limits.request_count + 1
        END,
        updated_at = NOW()
      RETURNING request_count, window_started_at
    `,
    [rateKey, action, windowMs]
  );
  const row = result.rows[0]!;
  const resetAt = new Date(row.window_started_at).getTime() + windowMs;
  return {
    allowed: row.request_count <= maxRequests,
    remaining: Math.max(0, maxRequests - row.request_count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt - Date.now()) / 1000)
    )
  };
}

export function rateLimit(options: RateLimitOptions) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const result = await consumeRateLimit(
        options.key(request),
        options.action,
        options.maxRequests,
        options.windowMs
      );
      response.setHeader('X-RateLimit-Limit', options.maxRequests);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      if (!result.allowed) {
        response.setHeader('Retry-After', result.retryAfterSeconds);
        response.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: `Espera ${result.retryAfterSeconds} segundos antes de intentarlo de nuevo.`
          }
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
