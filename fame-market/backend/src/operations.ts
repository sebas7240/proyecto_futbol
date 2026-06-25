import { getPool } from './database.js';
import { incrementMetric, prometheusMetrics } from './metrics.js';

type MaintenanceStatus = 'running' | 'success' | 'failed';

interface MaintenanceRow {
  id: string;
  job_name: string;
  status: MaintenanceStatus;
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
  details: Record<string, unknown>;
  error_message: string | null;
}

const monitoredJobs = [
  'attention-sync',
  'news-sync',
  'database-backup',
  'youtube-sync',
  'season-cycle',
  'market-maker'
] as const;

function publicRun(row: MaintenanceRow | undefined) {
  if (!row) return null;
  return {
    id: String(row.id),
    jobName: row.job_name,
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at
      ? new Date(row.completed_at).toISOString()
      : null,
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    details: row.details ?? {},
    errorMessage: row.error_message
  };
}

export async function startMaintenanceRun(
  jobName: string,
  details: Record<string, unknown> = {}
) {
  const result = await getPool().query<{ id: string }>(
    `
      INSERT INTO maintenance_runs (job_name, status, details)
      VALUES ($1, 'running', $2)
      RETURNING id
    `,
    [jobName, details]
  );
  return String(result.rows[0]!.id);
}

export async function finishMaintenanceRun(
  runId: string,
  status: Exclude<MaintenanceStatus, 'running'>,
  details: Record<string, unknown> = {},
  errorMessage: string | null = null
) {
  await getPool().query(
    `
      UPDATE maintenance_runs
      SET status = $2,
        completed_at = NOW(),
        duration_ms = GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::integer
        ),
        details = details || $3::jsonb,
        error_message = $4
      WHERE id = $1
    `,
    [runId, status, details, errorMessage?.slice(0, 2000) ?? null]
  );
  incrementMetric(
    status === 'success'
      ? 'maintenance_success_total'
      : 'maintenance_failure_total'
  );
}

export async function runMonitoredJob<T>(
  jobName: string,
  operation: () => Promise<T>,
  initialDetails: Record<string, unknown> = {},
  successDetails?: (result: T) => Record<string, unknown>
) {
  const runId = await startMaintenanceRun(jobName, initialDetails);
  try {
    const result = await operation();
    await finishMaintenanceRun(
      runId,
      'success',
      successDetails?.(result) ?? {}
    );
    return result;
  } catch (error) {
    await finishMaintenanceRun(
      runId,
      'failed',
      {},
      error instanceof Error ? error.message : 'Error desconocido'
    ).catch(() => undefined);
    throw error;
  }
}

export async function getOperationalOverview() {
  const [counts, jobs, successfulJobs] = await Promise.all([
    getPool().query<{
      users: string;
      trades: string;
      trades_24h: string;
      open_fraud_alerts: string;
      database_bytes: string;
      attention_sources: string;
      attention_shadow_signals: string;
      attention_ready_artists: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM trades) AS trades,
        (
          SELECT COUNT(*)
          FROM trades
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        ) AS trades_24h,
        (
          SELECT COUNT(*)
          FROM fraud_alerts
          WHERE status = 'open'
        ) AS open_fraud_alerts,
        (
          SELECT COUNT(*)
          FROM attention_sources
          WHERE enabled = TRUE
        ) AS attention_sources,
        (
          SELECT COUNT(*)
          FROM attention_signals
          WHERE mode = 'shadow'
        ) AS attention_shadow_signals,
        (
          SELECT COUNT(*)
          FROM (
            SELECT artist_id
            FROM attention_signals
            WHERE algorithm_version = 'wikimedia-7d-vs-21d-v1'
            GROUP BY artist_id
            HAVING COUNT(DISTINCT window_ends_on) >= 30
          ) ready
        ) AS attention_ready_artists,
        pg_database_size(current_database()) AS database_bytes
    `),
    getPool().query<MaintenanceRow>(
      `
        SELECT DISTINCT ON (job_name)
          id, job_name, status, started_at, completed_at,
          duration_ms, details, error_message
        FROM maintenance_runs
        WHERE job_name = ANY($1::text[])
        ORDER BY job_name, started_at DESC
      `,
      [[...monitoredJobs]]
    ),
    getPool().query<{ job_name: string; completed_at: Date }>(
      `
        SELECT job_name, MAX(completed_at) AS completed_at
        FROM maintenance_runs
        WHERE job_name = ANY($1::text[])
          AND status = 'success'
          AND completed_at IS NOT NULL
        GROUP BY job_name
      `,
      [[...monitoredJobs]]
    )
  ]);

  const jobMap = new Map(jobs.rows.map((row) => [row.job_name, row]));
  const successfulJobMap = new Map(
    successfulJobs.rows.map((row) => [row.job_name, row.completed_at])
  );
  const latestJobs = Object.fromEntries(
    monitoredJobs.map((jobName) => [jobName, publicRun(jobMap.get(jobName))])
  );
  const row = counts.rows[0]!;
  const now = Date.now();
  const age = (jobName: string) => {
    const completedAt = successfulJobMap.get(jobName);
    return completedAt
      ? Math.max(0, Math.floor((now - new Date(completedAt).getTime()) / 1000))
      : null;
  };

  return {
    database: {
      connected: true,
      users: Number(row.users),
      trades: Number(row.trades),
      trades24h: Number(row.trades_24h),
      openFraudAlerts: Number(row.open_fraud_alerts),
      databaseBytes: Number(row.database_bytes),
      attentionSources: Number(row.attention_sources),
      attentionShadowSignals: Number(row.attention_shadow_signals),
      attentionReadyArtists: Number(row.attention_ready_artists),
      lastBackupAgeSeconds: age('database-backup'),
      lastAttentionSyncAgeSeconds: age('attention-sync'),
      lastYouTubeSyncAgeSeconds: age('youtube-sync'),
      lastSeasonCycleAgeSeconds: age('season-cycle'),
      lastMarketMakerAgeSeconds: age('market-maker')
    },
    jobs: latestJobs,
    generatedAt: new Date().toISOString()
  };
}

export async function readinessStatus() {
  try {
    const result = await getPool().query<{
      season_count: string;
      migration_count: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM seasons WHERE status IN ('active', 'frozen'))
          AS season_count,
        (SELECT COUNT(*) FROM schema_migrations) AS migration_count
    `);
    const row = result.rows[0]!;
    const seasonReady = Number(row.season_count) === 1;
    return {
      ready: seasonReady,
      database: true,
      season: seasonReady,
      migrations: Number(row.migration_count),
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      ready: false,
      database: false,
      season: false,
      migrations: 0,
      checkedAt: new Date().toISOString()
    };
  }
}

export async function operationsMetrics() {
  try {
    const overview = await getOperationalOverview();
    return prometheusMetrics(overview.database);
  } catch {
    return prometheusMetrics({
      connected: false,
      users: 0,
      trades: 0,
      trades24h: 0,
      openFraudAlerts: 0,
      databaseBytes: 0,
      attentionSources: 0,
      attentionShadowSignals: 0,
      attentionReadyArtists: 0,
      lastBackupAgeSeconds: null,
      lastAttentionSyncAgeSeconds: null,
      lastYouTubeSyncAgeSeconds: null,
      lastSeasonCycleAgeSeconds: null
    });
  }
}
