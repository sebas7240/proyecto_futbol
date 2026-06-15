import { randomUUID } from 'node:crypto';
import {
  calculateQuote,
  MAX_DAILY_MOVE,
  MAX_POSITION_SHARE,
  QUOTE_LIFETIME_MS,
  roundMoney,
  STARTING_BALANCE
} from './pricing.js';
import { artists as seededArtists } from './seed.js';
import type {
  Artist,
  AuthenticatedUser,
  MarketDataStore,
  Position,
  Trade,
  TradeQuote,
  TradeSide,
  Wallet
} from './types.js';

export class MarketError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export class MarketStore implements MarketDataStore {
  readonly persistence = 'memory' as const;
  private readonly artists = new Map<string, Artist>();
  private readonly wallets = new Map<string, Wallet>();
  private readonly quotes = new Map<string, TradeQuote>();
  private readonly trades: Trade[] = [];
  private readonly executions = new Map<string, Trade>();
  private readonly favorites = new Map<string, Set<string>>();

  constructor(artistSeed: Artist[] = seededArtists) {
    for (const artist of structuredClone(artistSeed)) {
      const latest = artist.history.at(-1);
      if (latest) latest.value = artist.currentPrice;
      this.artists.set(artist.id, artist);
    }
  }

  listArtists() {
    return [...this.artists.values()].map((artist) => this.publicArtist(artist));
  }

  getArtistBySlug(slug: string) {
    const artist = [...this.artists.values()].find((candidate) => candidate.slug === slug);
    if (!artist) throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
    return this.publicArtist(artist, true);
  }

  getWallet(user: AuthenticatedUser) {
    const userId = user.uid;
    const wallet = this.ensureWallet(userId);
    const positions = wallet.positions
      .filter((position) => position.quantity > 0)
      .map((position) => {
        const artist = this.requireArtist(position.artistId);
        const marketValue = roundMoney(position.quantity * artist.currentPrice);
        const unrealizedPnl = roundMoney(
          (artist.currentPrice - position.averageCost) * position.quantity
        );
        return {
          ...position,
          artist: this.publicArtist(artist),
          marketValue,
          unrealizedPnl
        };
      });
    const investedValue = roundMoney(
      positions.reduce((sum, position) => sum + position.marketValue, 0)
    );
    const portfolioValue = roundMoney(wallet.balance + investedValue);

    return {
      userId,
      balance: roundMoney(wallet.balance),
      startingBalance: wallet.startingBalance,
      investedValue,
      portfolioValue,
      returnPercent: roundMoney(
        ((portfolioValue - wallet.startingBalance) / wallet.startingBalance) * 100
      ),
      positions
    };
  }

  listTrades(user: AuthenticatedUser) {
    const userId = user.uid;
    return this.trades.filter((trade) => trade.userId === userId).slice().reverse();
  }

  listFavorites(user: AuthenticatedUser) {
    return [...(this.favorites.get(user.uid) ?? new Set<string>())];
  }

  setFavorite(user: AuthenticatedUser, artistId: string, favorite: boolean) {
    this.requireArtist(artistId);
    const favorites = this.favorites.get(user.uid) ?? new Set<string>();
    if (favorite) favorites.add(artistId);
    else favorites.delete(artistId);
    this.favorites.set(user.uid, favorites);
    return [...favorites];
  }

  createQuote(
    user: AuthenticatedUser,
    artistId: string,
    side: TradeSide,
    quantity: number
  ) {
    const userId = user.uid;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new MarketError(
        'La cantidad debe ser un entero entre 1 y 500.',
        'INVALID_QUANTITY'
      );
    }

    const artist = this.requireArtist(artistId);
    if (artist.status !== 'active') {
      throw new MarketError('Este artista esta congelado.', 'ARTIST_FROZEN');
    }

    const wallet = this.ensureWallet(userId);
    const position = this.findPosition(wallet, artistId);
    if (side === 'sell' && (!position || position.quantity < quantity)) {
      throw new MarketError(
        'No tienes suficientes participaciones para esta venta.',
        'INSUFFICIENT_POSITION'
      );
    }

    const calculated = calculateQuote(
      artist.currentPrice,
      artist.dailyAnchorPrice,
      artist.liquidity,
      side,
      quantity
    );
    if (Math.abs(calculated.dailyReturn) > MAX_DAILY_MOVE) {
      throw new MarketError(
        'La operacion supera el limite diario de movimiento del artista.',
        'DAILY_LIMIT'
      );
    }

    if (side === 'buy' && wallet.balance < calculated.netAmount) {
      throw new MarketError('No tienes FameCoins suficientes.', 'INSUFFICIENT_BALANCE');
    }

    if (side === 'buy') {
      const portfolio = this.getWallet(user);
      const resultingQuantity = (position?.quantity ?? 0) + quantity;
      const resultingWeight =
        (resultingQuantity * calculated.newPrice) / portfolio.portfolioValue;
      if (resultingWeight > MAX_POSITION_SHARE) {
        throw new MarketError(
          'Una posicion no puede superar el 20% de tu portafolio.',
          'POSITION_LIMIT'
        );
      }
    }

    const quote: TradeQuote = {
      id: randomUUID(),
      userId,
      artistId,
      side,
      quantity,
      averagePrice: calculated.averagePrice,
      grossAmount: calculated.grossAmount,
      fee: calculated.fee,
      netAmount: calculated.netAmount,
      newPrice: calculated.newPrice,
      artistVersion: artist.version,
      expiresAt: new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString()
    };
    this.quotes.set(quote.id, quote);
    return quote;
  }

  executeQuote(
    user: AuthenticatedUser,
    quoteId: string,
    idempotencyKey: string
  ) {
    const userId = user.uid;
    const previous = this.executions.get(`${userId}:${idempotencyKey}`);
    if (previous) return previous;

    const quote = this.quotes.get(quoteId);
    if (!quote || quote.userId !== userId) {
      throw new MarketError('Cotizacion no encontrada.', 'QUOTE_NOT_FOUND', 404);
    }
    if (Date.parse(quote.expiresAt) < Date.now()) {
      throw new MarketError('La cotizacion vencio. Solicita una nueva.', 'QUOTE_EXPIRED');
    }

    const artist = this.requireArtist(quote.artistId);
    if (artist.version !== quote.artistVersion) {
      throw new MarketError(
        'El precio cambio. Revisa una nueva cotizacion.',
        'PRICE_CHANGED',
        409
      );
    }

    const wallet = this.ensureWallet(userId);
    let position = this.findPosition(wallet, quote.artistId);
    if (!position) {
      position = { artistId: quote.artistId, quantity: 0, averageCost: 0, realizedPnl: 0 };
      wallet.positions.push(position);
    }

    let realizedPnl = 0;
    if (quote.side === 'buy') {
      if (wallet.balance < quote.netAmount) {
        throw new MarketError('No tienes FameCoins suficientes.', 'INSUFFICIENT_BALANCE');
      }
      const previousCost = position.quantity * position.averageCost;
      wallet.balance = roundMoney(wallet.balance - quote.netAmount);
      position.quantity += quote.quantity;
      position.averageCost = roundMoney(
        (previousCost + quote.grossAmount) / position.quantity
      );
    } else {
      if (position.quantity < quote.quantity) {
        throw new MarketError(
          'No tienes suficientes participaciones para esta venta.',
          'INSUFFICIENT_POSITION'
        );
      }
      wallet.balance = roundMoney(wallet.balance + quote.netAmount);
      realizedPnl = roundMoney(
        quote.netAmount - position.averageCost * quote.quantity
      );
      position.quantity -= quote.quantity;
      position.realizedPnl = roundMoney(position.realizedPnl + realizedPnl);
      if (position.quantity === 0) position.averageCost = 0;
    }

    artist.currentPrice = quote.newPrice;
    artist.version += 1;
    artist.history.push({
      time: Math.floor(Date.now() / 1000),
      value: artist.currentPrice
    });

    const trade: Trade = {
      id: randomUUID(),
      userId,
      artistId: artist.id,
      side: quote.side,
      quantity: quote.quantity,
      averagePrice: quote.averagePrice,
      grossAmount: quote.grossAmount,
      fee: quote.fee,
      realizedPnl,
      createdAt: new Date().toISOString()
    };
    this.trades.push(trade);
    this.executions.set(`${userId}:${idempotencyKey}`, trade);
    this.quotes.delete(quoteId);
    return trade;
  }

  private ensureWallet(userId: string) {
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      wallet = {
        userId,
        balance: STARTING_BALANCE,
        startingBalance: STARTING_BALANCE,
        positions: []
      };
      this.wallets.set(userId, wallet);
    }
    return wallet;
  }

  private findPosition(wallet: Wallet, artistId: string): Position | undefined {
    return wallet.positions.find((position) => position.artistId === artistId);
  }

  private requireArtist(artistId: string) {
    const artist = this.artists.get(artistId);
    if (!artist) throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
    return artist;
  }

  private publicArtist(artist: Artist, includeDetails = false) {
    const changePercent = roundMoney(
      ((artist.currentPrice - artist.openingPrice) / artist.openingPrice) * 100
    );
    const base = {
      id: artist.id,
      slug: artist.slug,
      symbol: artist.symbol,
      name: artist.name,
      country: artist.country,
      genre: artist.genre,
      category: artist.category,
      subcategory: artist.subcategory,
      profession: artist.profession,
      themeTags: artist.themeTags,
      imageUrl: artist.imageUrl,
      imageUsageStatus: artist.imageUsageStatus,
      imageAttribution: artist.imageAttribution,
      currentPrice: artist.currentPrice,
      changePercent,
      holders: artist.holders,
      status: artist.status
    };
    const contentItems = artist.videos.map((video) => ({
      id: video.id,
      provider: 'youtube',
      contentType: 'video',
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      durationSeconds: null,
      sourceUrl: video.youtubeUrl,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      capturedAt: video.capturedAt ?? null
    }));
    return includeDetails
      ? { ...base, history: artist.history, videos: artist.videos, contentItems }
      : base;
  }
}
