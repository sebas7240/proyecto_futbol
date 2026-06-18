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
  if (!process.env.ADMIN_SECRET || process.env.ADMIN_SECRET === 'change-me') {
    throw new Error(`${environment} requiere un ADMIN_SECRET seguro.`);
  }
  if (
    !process.env.MONITORING_SECRET ||
    process.env.MONITORING_SECRET === 'change-monitoring-secret'
  ) {
    throw new Error(`${environment} requiere un MONITORING_SECRET seguro.`);
  }
  if (process.env.AUTH_MODE !== 'firebase' || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error(`${environment} requiere Firebase Auth configurado.`);
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
