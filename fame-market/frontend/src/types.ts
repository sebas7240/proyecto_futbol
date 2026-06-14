export interface ArtistSummary {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  country: string;
  genre: string;
  imageUrl: string;
  currentPrice: number;
  changePercent: number;
  holders: number;
  status: 'active' | 'frozen';
}

export interface PricePoint {
  time: number;
  value: number;
}

export interface ArtistVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  youtubeUrl: string;
}

export interface ArtistDetails extends ArtistSummary {
  history: PricePoint[];
  videos: ArtistVideo[];
}

export interface PortfolioPosition {
  artistId: string;
  quantity: number;
  averageCost: number;
  realizedPnl: number;
  artist: ArtistSummary;
  marketValue: number;
  unrealizedPnl: number;
}

export interface Portfolio {
  userId: string;
  balance: number;
  startingBalance: number;
  investedValue: number;
  portfolioValue: number;
  returnPercent: number;
  positions: PortfolioPosition[];
}

export interface Quote {
  id: string;
  userId: string;
  artistId: string;
  side: 'buy' | 'sell';
  quantity: number;
  averagePrice: number;
  grossAmount: number;
  fee: number;
  netAmount: number;
  newPrice: number;
  expiresAt: string;
}

export interface Trade {
  id: string;
  artistId: string;
  side: 'buy' | 'sell';
  quantity: number;
  averagePrice: number;
  grossAmount: number;
  fee: number;
  realizedPnl: number;
  createdAt: string;
}
