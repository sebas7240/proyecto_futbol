import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateDeploymentEnvironment } from './deployment.js';

const names = [
  'DEPLOYMENT_ENV',
  'DATABASE_URL',
  'DATABASE_SSL',
  'FRONTEND_ORIGINS',
  'FRONTEND_ORIGIN',
  'MONITORING_SECRET',
  'CHAT_ADMIN_SECRET',
  'PRESENCE_HASH_SALT',
  'AUTH_MODE',
  'FIREBASE_PROJECT_ID',
  'ALLOW_DEV_AUTH'
] as const;

const original = new Map<string, string | undefined>();

beforeEach(() => {
  for (const name of names) original.set(name, process.env[name]);
  process.env.DEPLOYMENT_ENV = 'staging';
  process.env.DATABASE_URL =
    'postgresql://fame:secret@postgres-staging:5432/fame_market_staging';
  process.env.DATABASE_SSL = 'false';
  process.env.FRONTEND_ORIGINS = 'https://staging.fameplays.com';
  process.env.MONITORING_SECRET = 'staging-monitoring-secret';
  process.env.CHAT_ADMIN_SECRET = 'staging-chat-secret';
  process.env.PRESENCE_HASH_SALT = 'staging-presence-salt';
  process.env.AUTH_MODE = 'firebase';
  process.env.FIREBASE_PROJECT_ID = 'fame-plays-staging';
  process.env.ALLOW_DEV_AUTH = 'false';
});

afterEach(() => {
  for (const name of names) {
    const value = original.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('deployment isolation', () => {
  it('accepts an isolated staging configuration', () => {
    expect(validateDeploymentEnvironment()).toBe('staging');
  });

  it('rejects a staging database without an explicit staging name', () => {
    process.env.DATABASE_URL =
      'postgresql://fame:secret@postgres:5432/fame_market';
    expect(() => validateDeploymentEnvironment()).toThrow(/staging/i);
  });

  it('rejects the production frontend origin in staging', () => {
    process.env.FRONTEND_ORIGINS = 'https://fameplays.com';
    expect(() => validateDeploymentEnvironment()).toThrow(/produccion/i);
  });

  it('rejects development auth in non-development deployments', () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    expect(() => validateDeploymentEnvironment()).toThrow(/ALLOW_DEV_AUTH/i);
  });

  it('requires SSL for external database hosts', () => {
    process.env.DATABASE_URL =
      'postgresql://fame:secret@db.example.com:5432/fame_market_staging';
    process.env.DATABASE_SSL = 'false';
    expect(() => validateDeploymentEnvironment()).toThrow(/DATABASE_SSL/i);
  });
});
