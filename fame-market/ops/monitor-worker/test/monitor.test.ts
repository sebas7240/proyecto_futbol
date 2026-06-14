import { describe, expect, it } from 'vitest';
import {
  evaluateState,
  metricValue,
  type EndpointCheck,
  type MonitorState
} from '../src/monitor';

const healthyChecks: EndpointCheck[] = [
  { name: 'live', ok: true, status: 200, latencyMs: 20, error: null },
  { name: 'ready', ok: true, status: 200, latencyMs: 25, error: null }
];
const failedChecks: EndpointCheck[] = [
  { name: 'live', ok: true, status: 200, latencyMs: 20, error: null },
  { name: 'ready', ok: false, status: 503, latencyMs: 25, error: 'HTTP 503' }
];

describe('monitor state transitions', () => {
  it('reads exact Prometheus metric values', () => {
    const metrics = [
      'fame_market_database_up 1',
      'fame_market_last_backup_age_seconds 7200'
    ].join('\n');
    expect(metricValue(metrics, 'fame_market_database_up')).toBe(1);
    expect(metricValue(metrics, 'fame_market_last_backup_age_seconds')).toBe(
      7200
    );
    expect(metricValue(metrics, 'fame_market_missing')).toBeNull();
  });

  it('alerts only after the configured consecutive failure threshold', () => {
    const first = evaluateState(null, failedChecks, 2);
    expect(first.event).toBeNull();
    expect(first.state.consecutiveFailures).toBe(1);

    const second = evaluateState(first.state, failedChecks, 2);
    expect(second.event).toBe('down');
    expect(second.state.alertState).toBe('degraded');
  });

  it('emits one recovery event and resets failures', () => {
    const previous: MonitorState = {
      state: 'degraded',
      alertState: 'degraded',
      consecutiveFailures: 3,
      checkedAt: new Date(0).toISOString(),
      checks: failedChecks
    };
    const recovered = evaluateState(previous, healthyChecks, 2);
    expect(recovered.event).toBe('recovered');
    expect(recovered.state.consecutiveFailures).toBe(0);
    expect(recovered.state.alertState).toBe('healthy');
  });
});
