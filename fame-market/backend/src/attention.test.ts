import { describe, expect, it } from 'vitest';
import {
  ATTENTION_MAX_SINGLE_SOURCE_BPS,
  calculateAttentionSignal,
  calculateAttentionSignals,
  evaluateAttentionHistory
} from './attention.js';

function observations(first21: number, last7: number) {
  return Array.from({ length: 28 }, (_, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, '0')}`,
    value: index < 21 ? first21 : last7
  }));
}

describe('calculateAttentionSignal', () => {
  it('returns no signal until 28 valid daily observations exist', () => {
    expect(calculateAttentionSignal(observations(100, 200).slice(1))).toBeNull();
  });

  it('keeps stable attention inside the neutral zone', () => {
    const signal = calculateAttentionSignal(observations(1000, 1030));
    expect(signal?.normalizedScore).toBe(0);
    expect(signal?.proposedDeltaBps).toBe(0);
  });

  it('proposes a capped positive shadow adjustment for rising attention', () => {
    const signal = calculateAttentionSignal(observations(1000, 3000));
    expect(signal?.normalizedScore).toBeGreaterThan(0);
    expect(signal?.proposedDeltaBps).toBeGreaterThan(0);
    expect(signal?.proposedDeltaBps).toBeLessThanOrEqual(
      ATTENTION_MAX_SINGLE_SOURCE_BPS
    );
  });

  it('proposes a capped negative shadow adjustment for falling attention', () => {
    const signal = calculateAttentionSignal(observations(3000, 1000));
    expect(signal?.normalizedScore).toBeLessThan(0);
    expect(signal?.proposedDeltaBps).toBeLessThan(0);
    expect(signal?.proposedDeltaBps).toBeGreaterThanOrEqual(
      -ATTENTION_MAX_SINGLE_SOURCE_BPS
    );
  });

  it('deduplicates observations by date before calculating', () => {
    const data = observations(1000, 3000);
    data.push({ date: '2026-05-28', value: 3000 });
    const signal = calculateAttentionSignal(data);
    expect(signal?.observationCount).toBe(28);
  });

  it('uses the latest 28 valid days when the provider returns extra history', () => {
    const old = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-04-${String(index + 20).padStart(2, '0')}`,
      value: 50
    }));
    const signal = calculateAttentionSignal([
      ...old,
      ...observations(1000, 3000)
    ]);
    expect(signal?.baselineAverage).toBe(1000);
    expect(signal?.recentAverage).toBe(3000);
    expect(signal?.windowEndsOn).toBe('2026-05-28');
  });

  it('builds several consecutive historical shadow windows', () => {
    const data = Array.from({ length: 35 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 4, index + 1)).toISOString().slice(0, 10),
      value: index < 28 ? 1000 : 2000
    }));
    const signals = calculateAttentionSignals(data, 30);
    expect(signals).toHaveLength(8);
    expect(signals[0]?.windowEndsOn).toBe('2026-05-28');
    expect(signals.at(-1)?.windowEndsOn).toBe('2026-06-04');
  });

  it('skips windows with missing calendar days', () => {
    const data = Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 4, index + 1)).toISOString().slice(0, 10),
      value: 1000
    })).filter((item) => item.date !== '2026-05-15');
    expect(calculateAttentionSignals(data)).toHaveLength(0);
  });
});

describe('evaluateAttentionHistory', () => {
  it('reports coverage and stability for 30 daily windows', () => {
    const samples = Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 4, index + 1)).toISOString().slice(0, 10),
      proposedDeltaBps: index < 10 ? -2 : index < 20 ? 0 : 3
    }));
    const result = evaluateAttentionHistory(samples);
    expect(result.dataReady).toBe(true);
    expect(result.coveragePercent).toBe(100);
    expect(result.positiveDays).toBe(10);
    expect(result.negativeDays).toBe(10);
    expect(result.neutralDays).toBe(10);
    expect(result.directionChanges).toBe(1);
    expect(result.maximumAbsoluteDeltaBps).toBe(3);
  });
});
