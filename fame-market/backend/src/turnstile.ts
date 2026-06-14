import { randomUUID } from 'node:crypto';
import { MarketError } from './market.js';
import { incrementMetric } from './metrics.js';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  challenge_ts?: string;
  'error-codes'?: string[];
}

export function turnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string,
  expectedAction: string
) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { skipped: true };

  if (!token || token.length > 2048) {
    incrementMetric('turnstile_failure_total');
    throw new MarketError(
      'Completa la verificacion de seguridad antes de operar.',
      'TURNSTILE_REQUIRED',
      403
    );
  }

  let result: SiteverifyResponse;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp,
        idempotency_key: randomUUID()
      }),
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`Siteverify HTTP ${response.status}`);
    result = (await response.json()) as SiteverifyResponse;
  } catch {
    incrementMetric('turnstile_failure_total');
    throw new MarketError(
      'La verificacion de seguridad no esta disponible. Intenta nuevamente.',
      'TURNSTILE_UNAVAILABLE',
      503
    );
  }

  const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  const hostnameAllowed =
    !allowedHostnames.length ||
    (result.hostname &&
      allowedHostnames.includes(result.hostname.toLowerCase()));
  const actionAllowed = result.action === expectedAction;

  if (!result.success || !hostnameAllowed || !actionAllowed) {
    incrementMetric('turnstile_failure_total');
    throw new MarketError(
      'No pudimos validar la verificacion de seguridad. Intenta nuevamente.',
      'TURNSTILE_REJECTED',
      403
    );
  }

  incrementMetric('turnstile_success_total');
  return {
    skipped: false,
    hostname: result.hostname ?? null,
    challengeAt: result.challenge_ts ?? null
  };
}
