import type { NextFunction, Request, Response } from 'express';
import {
  decodeProtectedHeader,
  importX509,
  jwtVerify,
  type JWTPayload
} from 'jose';
import type { AuthenticatedUser } from './types.js';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

export type AuthMode = 'firebase' | 'development';

const FIREBASE_CERTIFICATES_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/' +
  'securetoken@system.gserviceaccount.com';

type VerificationKey = Awaited<ReturnType<typeof importX509>>;

let certificateCache = new Map<string, VerificationKey>();
let certificateCacheExpiresAt = 0;

function configuredAuthMode(): AuthMode {
  const requested = process.env.AUTH_MODE;
  if (requested === 'firebase' || requested === 'development') return requested;
  return process.env.FIREBASE_PROJECT_ID ? 'firebase' : 'development';
}

export const authMode = configuredAuthMode();

async function firebaseKey(kid: string) {
  if (Date.now() >= certificateCacheExpiresAt || !certificateCache.has(kid)) {
    const response = await fetch(FIREBASE_CERTIFICATES_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) {
      throw new Error('No se pudieron obtener las claves publicas de Firebase.');
    }
    const certificates = (await response.json()) as Record<string, string>;
    const nextCache = new Map<string, VerificationKey>();
    for (const [certificateId, certificate] of Object.entries(certificates)) {
      nextCache.set(certificateId, await importX509(certificate, 'RS256'));
    }
    const maxAgeMatch = response.headers
      .get('cache-control')
      ?.match(/max-age=(\d+)/);
    const maxAgeSeconds = Number(maxAgeMatch?.[1] ?? 3600);
    certificateCache = nextCache;
    certificateCacheExpiresAt = Date.now() + maxAgeSeconds * 1000;
  }
  const key = certificateCache.get(kid);
  if (!key) throw new Error('La clave de firma de Firebase no es valida.');
  return key;
}

function payloadUser(payload: JWTPayload): AuthenticatedUser {
  if (
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    payload.sub.length > 128
  ) {
    throw new Error('El identificador del token Firebase no es valido.');
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    displayName:
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.email === 'string'
          ? payload.email.split('@')[0]!
          : `Jugador ${payload.sub.slice(0, 6)}`,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture : null
  };
}

export async function verifyFirebaseIdToken(token: string) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID no esta configurado.');

  const header = decodeProtectedHeader(token);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('El encabezado del token Firebase no es valido.');
  }
  const key = await firebaseKey(header.kid);
  const verified = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });
  return payloadUser(verified.payload);
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (authMode === 'development') {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_AUTH !== 'true') {
      response.status(503).json({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Firebase Auth no esta configurado en produccion.'
        }
      });
      return;
    }
    const uid = request.header('x-user-id')?.trim() || 'demo-user';
    request.authenticatedUser = {
      uid,
      email: `${uid}@local.fame`,
      displayName: request.header('x-user-name')?.trim() || 'Jugador demo',
      avatarUrl: null
    };
    next();
    return;
  }

  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Inicia sesion para continuar.'
      }
    });
    return;
  }

  try {
    request.authenticatedUser = await verifyFirebaseIdToken(
      authorization.slice(7)
    );
    next();
  } catch {
    response.status(401).json({
      error: {
        code: 'INVALID_AUTH_TOKEN',
        message: 'La sesion vencio o no es valida. Inicia sesion nuevamente.'
      }
    });
  }
}

export function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const configuredSecret = process.env.ADMIN_SECRET;
  const suppliedSecret = request.header('x-admin-secret');
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    response.status(403).json({
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'No tienes permisos para esta accion.'
      }
    });
    return;
  }
  next();
}
