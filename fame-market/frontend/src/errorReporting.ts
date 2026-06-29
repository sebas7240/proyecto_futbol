type ClientErrorKind = 'error' | 'unhandledrejection' | 'react' | 'manual';

interface ClientErrorInput {
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4020/api';
const maxReportsPerPage = 8;
let installed = false;
let sentReports = 0;
const recentFingerprints = new Set<string>();

function normalizeMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeStack(value: unknown) {
  return value instanceof Error ? value.stack : undefined;
}

export function reportClientError(input: ClientErrorInput) {
  if (!import.meta.env.PROD) return;
  if (!input.message.trim()) return;
  if (sentReports >= maxReportsPerPage) return;

  const fingerprint = `${input.kind}:${input.message}:${input.source ?? ''}`;
  if (recentFingerprints.has(fingerprint)) return;
  recentFingerprints.add(fingerprint);
  sentReports += 1;

  const body = JSON.stringify({
    kind: input.kind,
    message: input.message.slice(0, 1000),
    stack: input.stack?.slice(0, 6000) ?? '',
    source: input.source?.slice(0, 500) ?? '',
    path: `${window.location.pathname}${window.location.search}`.slice(0, 240),
    release: import.meta.env.VITE_APP_ENV ?? 'production',
    metadata: input.metadata ?? {}
  });

  fetch(`${API_BASE}/client-errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: body.length < 28_000
  }).catch(() => undefined);
}

export function installClientErrorReporting() {
  if (installed || !import.meta.env.PROD) return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      kind: 'error',
      message: event.message || normalizeMessage(event.error),
      stack: normalizeStack(event.error),
      source: event.filename,
      metadata: {
        line: event.lineno,
        column: event.colno
      }
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError({
      kind: 'unhandledrejection',
      message: normalizeMessage(event.reason),
      stack: normalizeStack(event.reason)
    });
  });
}
