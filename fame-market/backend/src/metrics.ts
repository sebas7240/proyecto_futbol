const startedAt = Date.now();

const counters = new Map<string, number>([
  ['http_requests_total', 0],
  ['http_errors_total', 0],
  ['trade_quotes_total', 0],
  ['trades_executed_total', 0],
  ['turnstile_success_total', 0],
  ['turnstile_failure_total', 0],
  ['maintenance_success_total', 0],
  ['maintenance_failure_total', 0]
]);

export function incrementMetric(name: string, value = 1) {
  counters.set(name, (counters.get(name) ?? 0) + value);
}

export function runtimeMetrics() {
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters)
  };
}

function metric(name: string, help: string, type: 'counter' | 'gauge', value: number) {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
    `${name} ${Number.isFinite(value) ? value : 0}`
  ].join('\n');
}

export function prometheusMetrics(database: {
  connected: boolean;
  users: number;
  trades: number;
  trades24h: number;
  openFraudAlerts: number;
  databaseBytes: number;
  attentionSources: number;
  attentionShadowSignals: number;
  attentionReadyArtists: number;
  lastBackupAgeSeconds: number | null;
  lastAttentionSyncAgeSeconds: number | null;
  lastYouTubeSyncAgeSeconds: number | null;
  lastSeasonCycleAgeSeconds: number | null;
}) {
  const runtime = runtimeMetrics();
  const lines = [
    metric('fame_market_up', 'Fame Market API process is running.', 'gauge', 1),
    metric(
      'fame_market_uptime_seconds',
      'API process uptime in seconds.',
      'gauge',
      runtime.uptimeSeconds
    ),
    metric(
      'fame_market_database_up',
      'PostgreSQL connectivity status.',
      'gauge',
      database.connected ? 1 : 0
    ),
    metric('fame_market_users', 'Registered users.', 'gauge', database.users),
    metric('fame_market_trades_total', 'Persisted trades.', 'gauge', database.trades),
    metric(
      'fame_market_trades_24h',
      'Trades executed during the last 24 hours.',
      'gauge',
      database.trades24h
    ),
    metric(
      'fame_market_open_fraud_alerts',
      'Open fraud review alerts.',
      'gauge',
      database.openFraudAlerts
    ),
    metric(
      'fame_market_database_bytes',
      'PostgreSQL database size in bytes.',
      'gauge',
      database.databaseBytes
    ),
    metric(
      'fame_market_attention_sources',
      'Enabled external attention sources.',
      'gauge',
      database.attentionSources
    ),
    metric(
      'fame_market_attention_shadow_signals',
      'Persisted attention signals running in shadow mode.',
      'gauge',
      database.attentionShadowSignals
    ),
    metric(
      'fame_market_attention_ready_artists',
      'Artists with at least 30 shadow windows.',
      'gauge',
      database.attentionReadyArtists
    ),
    metric(
      'fame_market_last_backup_age_seconds',
      'Age of the last successful backup.',
      'gauge',
      database.lastBackupAgeSeconds ?? -1
    ),
    metric(
      'fame_market_last_youtube_sync_age_seconds',
      'Age of the last successful YouTube sync.',
      'gauge',
      database.lastYouTubeSyncAgeSeconds ?? -1
    ),
    metric(
      'fame_market_last_attention_sync_age_seconds',
      'Age of the last successful attention index sync.',
      'gauge',
      database.lastAttentionSyncAgeSeconds ?? -1
    ),
    metric(
      'fame_market_last_season_cycle_age_seconds',
      'Age of the last successful season cycle.',
      'gauge',
      database.lastSeasonCycleAgeSeconds ?? -1
    )
  ];

  for (const [name, value] of Object.entries(runtime.counters)) {
    lines.push(metric(`fame_market_${name}`, name.replaceAll('_', ' '), 'counter', value));
  }
  return `${lines.join('\n')}\n`;
}
