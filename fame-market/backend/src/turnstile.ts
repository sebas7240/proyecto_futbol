import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
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

interface TurnstilePassPayload {
  version: 1;
  userId: string;
  action: string;
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;

function sessionTtlSeconds() {
  const configured = Number(process.env.TURNSTILE_SESSION_TTL_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_SESSION_TTL_SECONDS;
  return Math.max(5 * 60, Math.min(configured, 60 * 60));
}

function sessionSecret() {
  return (
    process.env.TURNSTILE_SESSION_SECRET ||
    process.env.TURNSTILE_SECRET_KEY ||
    ''
  );
}

function signPassPayload(encodedPayload: string) {
  return createHmac('sha256', sessionSecret())
    .update(`fame-plays-turnstile:${encodedPayload}`)
    .digest('base64url');
}

function issueTurnstilePass(userId: string, action: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionTtlSeconds();
  const payload: TurnstilePassPayload = {
    version: 1,
    userId,
    action,
    expiresAt
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    value: `${encodedPayload}.${signPassPayload(encodedPayload)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

function validTurnstilePass(
  pass: string | undefined,
  userId: string,
  expectedAction: string
) {
  if (!pass || pass.length > 4096 || !sessionSecret()) return null;
  const [encodedPayload, signature, extra] = pass.split('.');
  if (!encodedPayload || !signature || extra) return null;

  const expectedSignature = Buffer.from(
    signPassPayload(encodedPayload),
    'base64url'
  );
  const receivedSignature = Buffer.from(signature, 'base64url');
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TurnstilePassPayload;
    if (
      payload.version !== 1 ||
      payload.userId !== userId ||
      payload.action !== expectedAction ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      value: pass,
      expiresAt: new Date(payload.expiresAt * 1000).toISOString()
    };
  } catch {
    return null;
  }
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

export async function verifyTurnstileAccess(
  token: string | undefined,
  pass: string | undefined,
  userId: string,
  remoteIp: string,
  expectedAction: string
) {
  if (!turnstileConfigured()) {
    return { skipped: true, pass: null, expiresAt: null };
  }

  const activePass = validTurnstilePass(pass, userId, expectedAction);
  if (activePass) {
    return {
      skipped: false,
      pass: activePass.value,
      expiresAt: activePass.expiresAt
    };
  }

  await verifyTurnstileToken(token, remoteIp, expectedAction);
  const issuedPass = issueTurnstilePass(userId, expectedAction);
  return {
    skipped: false,
    pass: issuedPass.value,
    expiresAt: issuedPass.expiresAt
  };
}

