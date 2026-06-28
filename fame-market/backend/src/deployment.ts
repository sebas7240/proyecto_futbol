const allowedEnvironments = ['development', 'staging', 'production'] as const;

export type DeploymentEnvironment = (typeof allowedEnvironments)[number];

export function deploymentEnvironment(): DeploymentEnvironment {
  const value = process.env.DEPLOYMENT_ENV ?? 'development';
  if (allowedEnvironments.includes(value as DeploymentEnvironment)) {
    return value as DeploymentEnvironment;
  }
  throw new Error(`DEPLOYMENT_ENV no valido: ${value}`);
}

function hostname(origin: string) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isPrivateIpv4(host: string) {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const a = parts[0]!;
  const b = parts[1]!;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isInternalDatabaseHost(host: string) {
  const value = host.trim().toLowerCase();
  if (!value) return false;
  if (
    value === 'localhost' ||
    value === 'postgres' ||
    value === 'postgres-staging' ||
    value === 'db' ||
    value.endsWith('.local') ||
    value.endsWith('.internal')
  ) {
    return true;
  }
  if (isPrivateIpv4(value)) return true;
  if (value === '::1' || value.startsWith('fd') || value.startsWith('fe80:')) {
    return true;
  }
  return !value.includes('.') && !value.includes(':');
}

export function databaseRequiresSsl(databaseUrl: string) {
  try {
    const host = new URL(databaseUrl).hostname;
    return !isInternalDatabaseHost(host);
  } catch {
    return true;
  }
}

export function validateDeploymentEnvironment() {
  const environment = deploymentEnvironment();
  if (environment === 'development') return environment;

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const origins = (
    process.env.FRONTEND_ORIGINS ??
    process.env.FRONTEND_ORIGIN ??
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!databaseUrl) {
    throw new Error(`${environment} requiere DATABASE_URL.`);
  }
  if (databaseRequiresSsl(databaseUrl) && process.env.DATABASE_SSL !== 'true') {
    throw new Error(
      `${environment} requiere DATABASE_SSL=true cuando DATABASE_URL apunta a un host externo.`
    );
  }
  if (
    !process.env.MONITORING_SECRET ||
    process.env.MONITORING_SECRET === 'change-monitoring-secret'
  ) {
    throw new Error(`${environment} requiere un MONITORING_SECRET seguro.`);
  }
  if (!process.env.CHAT_ADMIN_SECRET) {
    throw new Error(`${environment} requiere CHAT_ADMIN_SECRET para moderacion.`);
  }
  if (
    !process.env.PRESENCE_HASH_SALT ||
    ['change-me', 'development-only'].includes(process.env.PRESENCE_HASH_SALT)
  ) {
    throw new Error(`${environment} requiere un PRESENCE_HASH_SALT seguro.`);
  }
  if (process.env.AUTH_MODE !== 'firebase' || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error(`${environment} requiere Firebase Auth configurado.`);
  }
  if (process.env.ALLOW_DEV_AUTH === 'true') {
    throw new Error(`${environment} no permite ALLOW_DEV_AUTH=true.`);
  }

  if (environment === 'staging') {
    const databaseName = new URL(databaseUrl).pathname.toLowerCase();
    if (!databaseName.includes('staging')) {
      throw new Error(
        'Staging debe usar una base cuyo nombre incluya "staging".'
      );
    }
    const productionHosts = new Set(['fameplays.com', 'www.fameplays.com']);
    if (origins.some((origin) => productionHosts.has(hostname(origin)))) {
      throw new Error(
        'Staging no puede autorizar el dominio frontend de produccion.'
      );
    }
  }

  return environment;
}
