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

export interface Season {
  id: string;
  name: string;
  startsAt: string;
  tradingClosesAt: string;
  endsAt: string;
  startingBalance: number;
  status: 'active' | 'frozen' | 'closed';
  frozenAt: string | null;
  closedAt: string | null;
}

export interface RankingEntry {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  portfolioValue: number;
  returnPercent: number;
  tradeCount: number;
  reviewStatus: 'live' | 'pending' | 'approved' | 'flagged';
  badges: RankingBadge[];
}

export type RankingBadge = 'rookie' | 'early_discoverer';

export interface RankingResponse {
  season: Season | null;
  rankings: RankingEntry[];
}

export interface SeasonHistory {
  seasonId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: Season['status'];
  balance: number;
  startingBalance: number;
  portfolioValue: number;
  returnPercent: number;
  rank: number | null;
  tradeCount: number;
  reviewStatus: RankingEntry['reviewStatus'];
  badges: RankingBadge[];
}

export interface SeasonTrade extends Trade {
  artistName: string;
  artistSymbol: string;
  artistImageUrl: string;
}

export interface SecurityAlert {
  id: string;
  code: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  metadata: Record<string, unknown>;
}

export interface SecurityReview {
  seasonId: string;
  seasonName: string;
  userId: string;
  displayName: string;
  rank: number;
  portfolioValue: number;
  returnPercent: number;
  tradeCount: number;
  reviewStatus: 'pending' | 'approved' | 'flagged';
  reviewNotes: string | null;
  badges: RankingBadge[];
  userStatus: 'active' | 'frozen';
  alerts: SecurityAlert[];
}

export interface MaintenanceRun {
  id: string;
  jobName: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  details: Record<string, unknown>;
  errorMessage: string | null;
}

export interface OperationsOverview {
  database: {
    connected: boolean;
    users: number;
    trades: number;
    trades24h: number;
    openFraudAlerts: number;
    databaseBytes: number;
    attentionSources: number;
    attentionShadowSignals: number;
    attentionReadyArtists: number;
    lastBackupAgeSeconds: number | null;
    lastAttentionSyncAgeSeconds: number | null;
    lastYouTubeSyncAgeSeconds: number | null;
    lastSeasonCycleAgeSeconds: number | null;
  };
  jobs: {
    'attention-sync': MaintenanceRun | null;
    'database-backup': MaintenanceRun | null;
    'youtube-sync': MaintenanceRun | null;
    'season-cycle': MaintenanceRun | null;
  };
  generatedAt: string;
}

export interface AttentionSignal {
  windowEndsOn: string;
  normalizedScore: number;
  proposedDeltaBps: number;
  appliedDeltaBps: number;
  confidence: number;
  mode: 'shadow' | 'applied' | 'skipped' | 'halted';
  breakdown: {
    recentAverage?: number;
    baselineAverage?: number;
    recentDays?: number;
    baselineDays?: number;
    metric?: string;
  };
  createdAt: string | null;
}

export interface AttentionSourceOverview {
  artistId: string;
  artistName: string;
  artistSlug: string;
  source: {
    id: string;
    provider: string;
    externalId: string;
    url: string;
    enabled: boolean;
    lastSyncedAt: string | null;
    lastError: string | null;
  };
  signal: AttentionSignal | null;
}

export interface AttentionEvaluationStatistics {
  observedDays: number;
  targetDays: number;
  coveragePercent: number;
  firstWindowEndsOn: string | null;
  lastWindowEndsOn: string | null;
  positiveDays: number;
  negativeDays: number;
  neutralDays: number;
  averageAbsoluteDeltaBps: number;
  maximumAbsoluteDeltaBps: number;
  standardDeviationBps: number;
  directionChanges: number;
  cumulativeProposedDeltaBps: number;
  dataReady: boolean;
}

export interface AttentionEvaluationResponse {
  algorithmVersion: string;
  mode: 'shadow';
  targetDays: number;
  evaluationReady: boolean;
  activationReady: false;
  humanReviewRequired: true;
  evaluations: Array<{
    artistId: string;
    artistName: string;
    sourceId: string;
    provider: string;
    sourceHealthy: boolean;
    syncAgeHours: number | null;
    evaluationReady: boolean;
    activationReady: false;
    blockers: string[];
    statistics: AttentionEvaluationStatistics;
  }>;
}

export interface ConsentStatus {
  required: boolean;
  accepted: boolean;
  rulesVersion: string;
  privacyVersion: string;
  acceptedAt: string | null;
}
