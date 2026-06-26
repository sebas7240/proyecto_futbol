import { describe, expect, it } from 'vitest';
import { MarketStore } from './market.js';
import type { Artist } from './types.js';

const user = {
  uid: 'test-user',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null
};

function testArtist(id: string, symbol: string): Artist {
  return {
    id,
    slug: id,
    symbol,
    name: symbol,
    country: 'Colombia',
    genre: 'Prueba',
    category: 'musica',
    subcategory: 'Prueba',
    profession: 'Artista',
    themeTags: [],
    volatilityProfile: 'balanced',
    riskLevel: 2,
    strategyNotes: '',
    imageUrl: '',
    imageUsageStatus: 'none',
    imageAttribution: '',
    currentPrice: 100,
    openingPrice: 100,
    dailyAnchorPrice: 100,
    liquidity: 1_000_000,
    version: 1,
    status: 'active',
    holders: 0,
    history: [{ time: 1, value: 100 }],
    videos: []
  };
}

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

  it('revalidates the 20% position limit when executing a stale quote', () => {
    const market = new MarketStore([
      testArtist('artist-a', 'AAA'),
      testArtist('artist-b', 'BBB')
    ]);
    const buyA = market.createQuote(user, 'artist-a', 'buy', 18);
    market.executeQuote(user, buyA.id, 'buy-a-18');
    const buyB = market.createQuote(user, 'artist-b', 'buy', 18);
    market.executeQuote(user, buyB.id, 'buy-b-18');

    const staleQuoteA = market.createQuote(user, 'artist-a', 'buy', 1);
    const internalMarket = market as unknown as {
      artists: Map<string, Artist>;
    };
    const artistB = internalMarket.artists.get('artist-b')!;
    artistB.currentPrice = 1;
    artistB.version += 1;

    expect(() =>
      market.executeQuote(user, staleQuoteA.id, 'buy-a-stale')
    ).toThrow('Una posicion no puede superar el 20%');
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
