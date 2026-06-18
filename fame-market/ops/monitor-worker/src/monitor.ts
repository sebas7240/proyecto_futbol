const STATE_KEY = 'fame-plays-health';

type HealthState = 'healthy' | 'degraded';
type AlertEvent = 'down' | 'recovered' | null;

export interface EndpointCheck {
  name: 'live' | 'ready' | 'maintenance';
  ok: boolean;
  status: number;
  latencyMs: number;
  error: string | null;
}

export interface MonitorState {
  state: HealthState;
  consecutiveFailures: number;
  checkedAt: string;
  alertState: HealthState;
  checks: EndpointCheck[];
}

export function evaluateState(
  previous: MonitorState | null,
  checks: EndpointCheck[],
  failureThreshold: number,
  checkedAt = new Date().toISOString()
): { state: MonitorState; event: AlertEvent } {
  const healthy = checks.every((check) => check.ok);
  const consecutiveFailures = healthy
    ? 0
    : (previous?.consecutiveFailures ?? 0) + 1;
  const alertState = previous?.alertState ?? 'healthy';
  let nextAlertState = alertState;
  let event: AlertEvent = null;

  if (!healthy && consecutiveFailures >= failureThreshold) {
    nextAlertState = 'degraded';
    if (alertState !== 'degraded') event = 'down';
  } else if (healthy) {
    nextAlertState = 'healthy';
    if (alertState === 'degraded') event = 'recovered';
  }

  return {
    state: {
      state: healthy ? 'healthy' : 'degraded',
      consecutiveFailures,
      checkedAt,
      alertState: nextAlertState,
      checks
    },
    event
  };
}

async function checkEndpoint(
  apiBaseUrl: string,
  name: 'live' | 'ready'
): Promise<EndpointCheck> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${apiBaseUrl}/health/${name}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000)
    });
    return {
      name,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 180) : 'Fetch failed'
    };
  }
}

export function metricValue(metrics: string, name: string) {
  const line = metrics
    .split('\n')
    .find((candidate) => candidate.startsWith(`${name} `));
  if (!line) return null;
  const value = Number(line.slice(name.length + 1).trim());
  return Number.isFinite(value) ? value : null;
}

async function checkMaintenance(env: Env): Promise<EndpointCheck> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${env.API_BASE_URL}/metrics`, {
      headers: {
        accept: 'text/plain',
        'x-monitoring-secret': env.MONITORING_SECRET
      },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) {
      return {
        name: 'maintenance',
        ok: false,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        error: `HTTP ${response.status}`
      };
    }

    const metrics = await response.text();
    const problems: string[] = [];
    if (metricValue(metrics, 'fame_market_database_up') !== 1) {
      problems.push('PostgreSQL no disponible');
    }

    if (env.CHECK_BACKUPS === 'true') {
      const age = metricValue(
        metrics,
        'fame_market_last_backup_age_seconds'
      );
      const maximum = Math.max(
        60,
        Number(env.BACKUP_MAX_AGE_SECONDS) || 129_600
      );
      if (age === null || age < 0) {
        problems.push('sin backup exitoso');
      } else if (age > maximum) {
        problems.push(`backup atrasado (${Math.floor(age / 3600)}h)`);
      }
    }

    if (env.CHECK_YOUTUBE_SYNC === 'true') {
      const age = metricValue(
        metrics,
        'fame_market_last_youtube_sync_age_seconds'
      );
      const maximum = Math.max(
        60,
        Number(env.YOUTUBE_MAX_AGE_SECONDS) || 7_200
      );
      if (age === null || age < 0) {
        problems.push('sin sincronizacion exitosa de YouTube');
      } else if (age > maximum) {
        problems.push(`YouTube atrasado (${Math.floor(age / 3600)}h)`);
      }
    }

    return {
      name: 'maintenance',
      ok: problems.length === 0,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      error: problems.length ? problems.join('; ') : null
    };
  } catch (error) {
    return {
      name: 'maintenance',
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 180) : 'Fetch failed'
    };
  }
}

function alertText(
  environment: string,
  event: Exclude<AlertEvent, null>,
  state: MonitorState
) {
  const icon = event === 'down' ? 'ALERTA' : 'RECUPERADO';
  const details = state.checks
    .map(
      (check) =>
        `${check.name}: ${check.ok ? 'OK' : check.error ?? 'ERROR'} ` +
        `(${check.latencyMs}ms)`
    )
    .join('\n');
  return [
    `[${icon}] Fame Plays ${environment}`,
    event === 'down'
      ? `La API fallo ${state.consecutiveFailures} veces consecutivas.`
      : 'La API volvio a responder correctamente.',
    details,
    `Hora UTC: ${state.checkedAt}`
  ].join('\n');
}

async function sendTelegram(env: Env, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(8_000)
    }
  );
  if (!response.ok) {
    throw new Error(`Telegram notification failed with HTTP ${response.status}`);
  }
}

export async function readMonitorState(env: Env) {
  return env.MONITOR_STATE.get<MonitorState>(STATE_KEY, 'json');
}

export async function runMonitor(env: Env) {
  const previous = await readMonitorState(env);
  const checks = await Promise.all([
    checkEndpoint(env.API_BASE_URL, 'live'),
    checkEndpoint(env.API_BASE_URL, 'ready'),
    checkMaintenance(env)
  ]);
  const threshold = Math.max(1, Number(env.FAILURE_THRESHOLD) || 2);
  const result = evaluateState(previous, checks, threshold);

  if (result.event) {
    await sendTelegram(
      env,
      alertText(env.ENVIRONMENT, result.event, result.state)
    );
  }
  await env.MONITOR_STATE.put(STATE_KEY, JSON.stringify(result.state));
  console.log(
    JSON.stringify({
      event: 'health_check',
      environment: env.ENVIRONMENT,
      state: result.state.state,
      alert: result.event,
      checks: result.state.checks
    })
  );
  return result.state;
}
