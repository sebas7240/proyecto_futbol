import type { NextFunction, Request, Response } from 'express';
import { databaseConfigured, getPool } from './database.js';
import { MarketError } from './market.js';
import type { AuthenticatedUser } from './types.js';

export const CURRENT_RULES_VERSION = '2026-06-14';
export const CURRENT_PRIVACY_VERSION = '2026-06-14';

const memoryConsents = new Set<string>();

function consentKey(user: AuthenticatedUser) {
  return [
    user.uid,
    CURRENT_RULES_VERSION,
    CURRENT_PRIVACY_VERSION
  ].join(':');
}

export function consentRequired() {
  return process.env.CONSENT_REQUIRED === 'true';
}

async function ensureUserId(user: AuthenticatedUser) {
  const result = await getPool().query<{ id: string }>(
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

export async function getConsentStatus(user: AuthenticatedUser) {
  if (!databaseConfigured()) {
    const accepted = memoryConsents.has(consentKey(user));
    return {
      required: consentRequired(),
      accepted: !consentRequired() || accepted,
      rulesVersion: CURRENT_RULES_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: accepted ? new Date().toISOString() : null
    };
  }

  const userId = await ensureUserId(user);
  const result = await getPool().query<{ accepted_at: Date }>(
    `
      SELECT accepted_at
      FROM user_consents
      WHERE user_id = $1
        AND rules_version = $2
        AND privacy_version = $3
      LIMIT 1
    `,
    [userId, CURRENT_RULES_VERSION, CURRENT_PRIVACY_VERSION]
  );
  const acceptedAt = result.rows[0]?.accepted_at ?? null;
  return {
    required: consentRequired(),
    accepted: !consentRequired() || Boolean(acceptedAt),
    rulesVersion: CURRENT_RULES_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedAt: acceptedAt ? acceptedAt.toISOString() : null
  };
}

export async function acceptCurrentConsent(user: AuthenticatedUser) {
  if (!databaseConfigured()) {
    memoryConsents.add(consentKey(user));
    return getConsentStatus(user);
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query<{ id: string }>(
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
    const userId = userResult.rows[0]!.id;
    const consentResult = await client.query<{ accepted_at: Date }>(
      `
        INSERT INTO user_consents (
          user_id, rules_version, privacy_version
        ) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, rules_version, privacy_version)
        DO UPDATE SET accepted_at = user_consents.accepted_at
        RETURNING accepted_at
      `,
      [userId, CURRENT_RULES_VERSION, CURRENT_PRIVACY_VERSION]
    );
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, metadata
        ) VALUES (
          $1, 'legal.accepted', 'user', $2,
          jsonb_build_object(
            'rulesVersion', $3::text,
            'privacyVersion', $4::text
          )
        )
      `,
      [
        user.uid,
        userId,
        CURRENT_RULES_VERSION,
        CURRENT_PRIVACY_VERSION
      ]
    );
    await client.query('COMMIT');
    return {
      required: consentRequired(),
      accepted: true,
      rulesVersion: CURRENT_RULES_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: consentResult.rows[0]!.accepted_at.toISOString()
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function requireCurrentConsent(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (!consentRequired()) {
    next();
    return;
  }
  try {
    const status = await getConsentStatus(request.authenticatedUser!);
    if (!status.accepted) {
      throw new MarketError(
        'Acepta las reglas y la politica de privacidad para operar.',
        'CONSENT_REQUIRED',
        403
      );
    }
    next();
  } catch (error) {
    next(error);
  }
}
