import { describe, expect, it } from 'vitest';
import {
  calculateLiveMarketMove,
  chooseNextMarketState
} from './marketMaker.js';

describe('live market state', () => {
  it('creates a finite state with memory-friendly parameters', () => {
    const now = new Date('2026-06-24T14:00:00.000Z');
    const decision = chooseNextMarketState({
      artistId: '10000000-0000-4000-8000-000000000002',
      previousState: 'bull',
      volatilityProfile: 'volatile',
      riskLevel: 4,
      holders: 25,
      recentNewsBps: 120,
      category: 'musica',
      now
    });

    expect(['bull', 'bear', 'sideways', 'volatile', 'viral']).toContain(
      decision.marketState
    );
    expect(decision.stateEndsAt.getTime()).toBeGreaterThan(now.getTime());
    expect(decision.hypeScore).toBeGreaterThan(40);
    expect(Math.abs(decision.trendBiasBps)).toBeGreaterThan(0);
    expect(decision.volatilityBps).toBeGreaterThan(0);
  });
});

describe('live market movement', () => {
  const now = new Date('2026-06-24T14:15:00.000Z');

  it('generates a non-zero autonomous tick even without news or trades', () => {
    const move = calculateLiveMarketMove({
      artistId: '10000000-0000-4000-8000-000000000014',
      currentPrice: 100,
      anchorPrice: 100,
      marketState: 'sideways',
      volatilityProfile: 'balanced',
      riskLevel: 3,
      hypeScore: 55,
      trendBiasBps: 1,
      volatilityBps: 8,
      minutesSinceLastTick: 15,
      now
    });

    expect(move.appliedDeltaBps).not.toBe(0);
    expect(move.nextPrice).not.toBe(100);
  });

  it('keeps the price inside the configured band', () => {
    const move = calculateLiveMarketMove({
      artistId: '10000000-0000-4000-8000-000000000012',
      currentPrice: 109.9,
      anchorPrice: 100,
      marketState: 'viral',
      volatilityProfile: 'volatile',
      riskLevel: 4,
      hypeScore: 92,
      trendBiasBps: 80,
      volatilityBps: 40,
      minutesSinceLastTick: 15,
      now,
      priceBandBps: 1000
    });

    expect(move.nextPrice).toBeLessThanOrEqual(110);
  });

  it('moves viral states more aggressively than stable bull states', () => {
    const stable = calculateLiveMarketMove({
      artistId: '10000000-0000-4000-8000-000000000003',
      currentPrice: 100,
      anchorPrice: 100,
      marketState: 'bull',
      volatilityProfile: 'stable',
      riskLevel: 2,
      hypeScore: 45,
      trendBiasBps: 5,
      volatilityBps: 5,
      minutesSinceLastTick: 15,
      now
    });
    const viral = calculateLiveMarketMove({
      artistId: '10000000-0000-4000-8000-000000000012',
      currentPrice: 100,
      anchorPrice: 100,
      marketState: 'viral',
      volatilityProfile: 'volatile',
      riskLevel: 4,
      hypeScore: 90,
      trendBiasBps: 55,
      volatilityBps: 35,
      minutesSinceLastTick: 15,
      now
    });

    expect(Math.abs(viral.appliedDeltaBps)).toBeGreaterThan(
      Math.abs(stable.appliedDeltaBps)
    );
  });
});
