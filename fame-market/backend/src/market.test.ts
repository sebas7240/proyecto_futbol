import { describe, expect, it } from 'vitest';
import { MarketStore } from './market.js';

const user = {
  uid: 'test-user',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null
};

describe('MarketStore', () => {
  it('quotes and executes a purchase while keeping the ledger consistent', () => {
    const market = new MarketStore();
    const artist = market.listArtists()[0]!;
    const before = market.getWallet(user);
    const quote = market.createQuote(user, artist.id, 'buy', 5);
    const trade = market.executeQuote(user, quote.id, 'purchase-0001');
    const after = market.getWallet(user);

    expect(trade.side).toBe('buy');
    expect(after.balance).toBeLessThan(before.balance);
    expect(after.positions[0]?.quantity).toBe(5);
    expect(after.portfolioValue).toBeGreaterThan(0);
  });

  it('returns the same operation when the idempotency key is repeated', () => {
    const market = new MarketStore();
    const artist = market.listArtists()[0]!;
    const quote = market.createQuote(user, artist.id, 'buy', 3);
    const first = market.executeQuote(user, quote.id, 'purchase-0002');
    const second = market.executeQuote(user, quote.id, 'purchase-0002');

    expect(second.id).toBe(first.id);
    expect(market.getWallet(user).positions[0]?.quantity).toBe(3);
  });

  it('stores a user favorite without affecting another user', () => {
    const market = new MarketStore();
    const artist = market.listArtists()[0]!;
    const otherUser = { ...user, uid: 'other-user' };

    expect(market.setFavorite(user, artist.id, true)).toEqual([artist.id]);
    expect(market.listFavorites(user)).toEqual([artist.id]);
    expect(market.listFavorites(otherUser)).toEqual([]);
    expect(market.setFavorite(user, artist.id, false)).toEqual([]);
  });
});
