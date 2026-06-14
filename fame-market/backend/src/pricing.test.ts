import { describe, expect, it } from 'vitest';
import { calculateQuote } from './pricing.js';

describe('calculateQuote', () => {
  it('moves buy quotes upward and includes the fee', () => {
    const quote = calculateQuote(100, 100, 2000, 'buy', 10);
    expect(quote.newPrice).toBeGreaterThan(100);
    expect(quote.netAmount).toBeGreaterThan(quote.grossAmount);
  });

  it('moves sell quotes downward and subtracts the fee', () => {
    const quote = calculateQuote(100, 100, 2000, 'sell', 10);
    expect(quote.newPrice).toBeLessThan(100);
    expect(quote.netAmount).toBeLessThan(quote.grossAmount);
  });
});
