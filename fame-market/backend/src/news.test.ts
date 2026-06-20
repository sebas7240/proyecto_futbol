import { describe, expect, it } from 'vitest';
import { analyzeNewsSentiment, calculateNewsSignal } from './news.js';

describe('news sentiment', () => {
  it('recognizes a conservative positive headline in Spanish', () => {
    const result = analyzeNewsSentiment(
      'Karol G gana premio y lidera un lanzamiento viral'
    );
    expect(result.reviewRequired).toBe(false);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.label).toBe('positive');
  });

  it('routes sensitive allegations to human review without a directional score', () => {
    const result = analyzeNewsSentiment(
      'Artista enfrenta acusacion y demanda tras investigacion'
    );
    expect(result.reviewRequired).toBe(true);
    expect(result.score).toBe(0);
    expect(result.label).toBe('review');
  });
});

describe('news signal', () => {
  const now = new Date('2026-06-19T18:00:00.000Z');

  it('requires at least two independent domains', () => {
    const result = calculateNewsSignal([
      {
        publishedAt: new Date('2026-06-19T17:00:00.000Z'),
        sourceDomain: 'example.com',
        sentimentScore: 1
      },
      {
        publishedAt: new Date('2026-06-19T16:00:00.000Z'),
        sourceDomain: 'example.com',
        sentimentScore: 1
      }
    ], now);
    expect(result.sourceCount).toBe(1);
    expect(result.proposedDeltaBps).toBe(0);
  });

  it('creates a small capped proposal from diverse recent coverage', () => {
    const result = calculateNewsSignal([
      {
        publishedAt: new Date('2026-06-19T17:00:00.000Z'),
        sourceDomain: 'source-one.example',
        sentimentScore: 0.8
      },
      {
        publishedAt: new Date('2026-06-19T16:00:00.000Z'),
        sourceDomain: 'source-two.example',
        sentimentScore: 0.6
      },
      {
        publishedAt: new Date('2026-06-19T15:00:00.000Z'),
        sourceDomain: 'source-three.example',
        sentimentScore: 0.7
      }
    ], now);
    expect(result.proposedDeltaBps).toBeGreaterThan(0);
    expect(result.proposedDeltaBps).toBeLessThanOrEqual(12);
  });

  it('excludes sensitive headlines from automatic direction', () => {
    const result = calculateNewsSignal([
      {
        publishedAt: new Date('2026-06-19T17:00:00.000Z'),
        sourceDomain: 'source-one.example',
        sentimentScore: -1,
        reviewRequired: true
      },
      {
        publishedAt: new Date('2026-06-19T16:00:00.000Z'),
        sourceDomain: 'source-two.example',
        sentimentScore: -1,
        reviewRequired: true
      }
    ], now);
    expect(result.reviewRequiredCount).toBe(2);
    expect(result.articleCount).toBe(0);
    expect(result.proposedDeltaBps).toBe(0);
  });
});
