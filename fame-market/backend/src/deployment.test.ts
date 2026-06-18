import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateDeploymentEnvironment } from './deployment.js';

const names = [
  'DEPLOYMENT_ENV',
  'DATABASE_URL',
  'FRONTEND_ORIGINS',
  'FRONTEND_ORIGIN',
  'ADMIN_SECRET',
  'MONITORING_SECRET',
  'AUTH_MODE',
  'FIREBASE_PROJECT_ID'
] as const;

const original = new Map<string, string | undefined>();

beforeEach(() => {
  for (const name of names) original.set(name, process.env[name]);
  process.env.DEPLOYMENT_ENV = 'staging';
  process.env.DATABASE_URL =
    'postgresql://fame:secret@postgres-staging:5432/fame_market_staging';
  process.env.FRONTEND_ORIGINS = 'https://staging.fameplays.com';
  process.env.ADMIN_SECRET = 'staging-admin-secret';
  process.env.MONITORING_SECRET = 'staging-monitoring-secret';
  process.env.AUTH_MODE = 'firebase';
  process.env.FIREBASE_PROJECT_ID = 'fame-plays-staging';
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
});
