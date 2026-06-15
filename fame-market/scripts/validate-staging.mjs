import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');

function parseEnv(contents) {
  const result = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    result.set(
      trimmed.slice(0, separator).trim(),
      trimmed.slice(separator + 1).trim()
    );
  }
  return result;
}

async function load(relativePath) {
  try {
    return parseEnv(await readFile(path.join(root, relativePath), 'utf8'));
  } catch {
    throw new Error(
      `Falta ${relativePath}. Copia el archivo .example correspondiente.`
    );
  }
}

function requireValues(values, names, source) {
  const missing = names.filter((name) => !values.get(name));
  if (missing.length) {
    throw new Error(
      `${source} requiere valores para: ${missing.join(', ')}`
    );
  }
}

const backend = await load('.env.staging');
const frontend = await load('frontend/.env.staging');

requireValues(
  backend,
  [
    'STAGING_FRONTEND_ORIGINS',
    'PUBLIC_SITE_URL',
    'PRODUCTION_FRONTEND_ORIGIN',
    'PRODUCTION_API_BASE',
    'STAGING_POSTGRES_PASSWORD',
    'FIREBASE_PROJECT_ID',
    'ADMIN_SECRET',
    'MONITORING_SECRET',
    'RIGHTS_IP_HASH_SALT'
  ],
  '.env.staging'
);
requireValues(
  frontend,
  [
    'VITE_API_BASE',
    'VITE_PUBLIC_SITE_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_TURNSTILE_SITE_KEY'
  ],
  'frontend/.env.staging'
);

const stagingOrigin = new URL(
  backend.get('STAGING_FRONTEND_ORIGINS').split(',')[0]
);
const publicSiteUrl = new URL(backend.get('PUBLIC_SITE_URL'));
const frontendPublicSiteUrl = new URL(frontend.get('VITE_PUBLIC_SITE_URL'));
const productionOrigin = new URL(backend.get('PRODUCTION_FRONTEND_ORIGIN'));
const productionApiBase = new URL(backend.get('PRODUCTION_API_BASE'));
const apiBase = new URL(frontend.get('VITE_API_BASE'));
if (stagingOrigin.hostname === productionOrigin.hostname) {
  throw new Error('Staging no puede usar el dominio frontend de produccion.');
}
if (apiBase.hostname === productionApiBase.hostname) {
  throw new Error('Staging no puede usar el API de produccion.');
}
if (
  publicSiteUrl.origin !== stagingOrigin.origin ||
  frontendPublicSiteUrl.origin !== stagingOrigin.origin
) {
  throw new Error(
    'PUBLIC_SITE_URL, VITE_PUBLIC_SITE_URL y STAGING_FRONTEND_ORIGINS deben coincidir.'
  );
}
if (frontend.get('VITE_APP_ENV') !== 'staging') {
  throw new Error('VITE_APP_ENV debe ser staging.');
}
if (
  frontend.get('VITE_FIREBASE_PROJECT_ID') !==
  backend.get('FIREBASE_PROJECT_ID')
) {
  throw new Error('Frontend y backend deben usar el mismo proyecto Firebase.');
}

console.log('Configuracion de staging valida y aislada de produccion.');
