export type TradeSide = 'buy' | 'sell';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface PricePoint {
  time: number;
  value: number;
}

export interface VideoSnapshot {
  id: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  youtubeUrl: string;
}

export interface Artist {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  country: string;
  genre: string;
  imageUrl: string;
  currentPrice: number;
  openingPrice: number;
  dailyAnchorPrice: number;
  liquidity: number;
  version: number;
  status: 'active' | 'frozen';
  holders: number;
  history: PricePoint[];
  videos: VideoSnapshot[];
}

export interface Position {
  artistId: string;
  quantity: number;
  averageCost: number;
  realizedPnl: number;
}

export interface Wallet {
  userId: string;
  balance: number;
  startingBalance: number;
  positions: Position[];
}

export interface Trade {
  id: string;
  userId: string;
  artistId: string;
  side: TradeSide;
  quantity: number;
  averagePrice: number;
  grossAmount: number;
  fee: number;
  realizedPnl: number;
  createdAt: string;
}

export interface TradeQuote {
  id: string;
  userId: string;
  artistId: string;
  side: TradeSide;
  quantity: number;
  averagePrice: number;
  grossAmount: number;
  fee: number;
  netAmount: number;
  newPrice: number;
  artistVersion: number;
  expiresAt: string;
}

export interface ArtistChannel {
  id: string;
  artistId: string;
  youtubeChannelId: string;
  uploadsPlaylistId: string;
  channelTitle: string;
  handle: string | null;
  isPrimary: boolean;
  lastSyncedAt: string | null;
}

export interface MarketDataStore {
  readonly persistence: 'memory' | 'postgresql';
  listArtists(): Promise<unknown> | unknown;
  getArtistBySlug(slug: string): Promise<unknown> | unknown;
  getWallet(user: AuthenticatedUser): Promise<unknown> | unknown;
  listTrades(user: AuthenticatedUser): Promise<unknown> | unknown;
  listFavorites(user: AuthenticatedUser): Promise<string[]> | string[];
  setFavorite(
    user: AuthenticatedUser,
    artistId: string,
    favorite: boolean
  ): Promise<string[]> | string[];
  createQuote(
    user: AuthenticatedUser,
    artistId: string,
    side: TradeSide,
    quantity: number
  ): Promise<TradeQuote> | TradeQuote;
  executeQuote(
    user: AuthenticatedUser,
    quoteId: string,
    idempotencyKey: string
  ): Promise<Trade> | Trade;
}
