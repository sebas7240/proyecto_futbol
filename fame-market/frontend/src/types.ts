export type ImageUsageStatus =
  | 'none'
  | 'unverified'
  | 'owned'
  | 'licensed'
  | 'provider_authorized';

export type EntityCategory =
  | 'musica'
  | 'creadores'
  | 'cine-tv'
  | 'deportes'
  | 'otros';

export type VolatilityProfile =
  | 'stable'
  | 'balanced'
  | 'volatile'
  | 'underdog';

export interface CategoryOverview {
  id: EntityCategory;
  label: string;
  count: number;
}

export interface ArtistSummary {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  country: string;
  genre: string;
  category: EntityCategory;
  subcategory: string;
  profession: string;
  themeTags: string[];
  volatilityProfile: VolatilityProfile;
  riskLevel: number;
  strategyNotes: string;
  imageUrl: string;
  imageUsageStatus: ImageUsageStatus;
  imageAttribution: string;
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

export interface EntityContentItem {
  id: string;
  provider: string;
  contentType: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  sourceUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  capturedAt: string | null;
}

export interface EntitySource {
  id: string;
  provider: string;
  sourceType: string;
  externalId: string;
  sourceUrl: string;
  displayName: string;
  isPrimary: boolean;
  usageMode: string;
  licenseNotes: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type ExternalEventType =
  | 'correction'
  | 'media'
  | 'platform'
  | 'legal'
  | 'manual';

export type ExternalEventDirection = 'positive' | 'negative' | 'neutral';
export type ExternalEventVisibilityStatus = 'draft' | 'public' | 'archived';
export type ExternalEventReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ExternalEvent {
  id: string;
  artistId: string;
  artistName: string;
  artistSlug: string;
  eventType: ExternalEventType;
  title: string;
  description: string;
  sourceUrl: string;
  occurredAt: string;
  impactDirection: ExternalEventDirection;
  proposedDeltaBps: number;
  appliedDeltaBps: number;
  visibilityStatus: ExternalEventVisibilityStatus;
  reviewStatus: ExternalEventReviewStatus;
  createdBy: string;
  reviewedBy: string | null;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export type NewsSentimentLabel = 'positive' | 'negative' | 'neutral' | 'review';

export interface NewsItem {
  id: string;
  title: string;
  sourceUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
  sourceDomain: string;
  language: string;
  sentimentScore: number;
  sentimentLabel: NewsSentimentLabel;
}

export interface NewsSignal {
  windowEndsAt: string;
  articleCount: number;
  sourceCount: number;
  attentionScore: number;
  sentimentScore: number;
  confidence: number;
  proposedDeltaBps: number;
  appliedDeltaBps: number;
  mode: 'shadow' | 'applied' | 'skipped' | 'halted';
  createdAt: string;
}

export interface NewsPulse {
  mode: 'shadow' | 'applied';
  signal: NewsSignal | null;
  items: NewsItem[];
}

export interface ArtistDetails extends ArtistSummary {
  history: PricePoint[];
  videos: ArtistVideo[];
  contentItems: EntityContentItem[];
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
  artistImageUsageStatus: ImageUsageStatus;
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
    lastMarketMakerAgeSeconds?: number | null;
  };
  jobs: {
    'attention-sync': MaintenanceRun | null;
    'news-sync': MaintenanceRun | null;
    'database-backup': MaintenanceRun | null;
    'youtube-sync': MaintenanceRun | null;
    'season-cycle': MaintenanceRun | null;
    'market-maker'?: MaintenanceRun | null;
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

export interface PublicAttentionStatus {
  mode: 'shadow';
  algorithmVersion: string | null;
  targetDays: number;
  activationReady: false;
  humanReviewRequired: true;
  generatedAt: string;
  summary: {
    totalSources: number;
    healthySources: number;
    readySources: number;
    averageCoveragePercent: number;
    lastSyncedAt: string | null;
  };
  sources: Array<{
    artistName: string;
    artistSlug: string;
    provider: string;
    sourceUrl: string;
    enabled: boolean;
    lastSyncedAt: string | null;
    status: 'shadow-ready' | 'collecting-shadow' | 'sync-pending';
    coveragePercent: number;
    observedDays: number;
    targetDays: number;
    latestWindowEndsOn: string | null;
    proposedDeltaBps: number | null;
    appliedDeltaBps: number | null;
  }>;
}

export interface ConsentStatus {
  required: boolean;
  accepted: boolean;
  rulesVersion: string;
  privacyVersion: string;
  acceptedAt: string | null;
}

export type RightsRequestType =
  | 'correction'
  | 'removal'
  | 'trademark'
  | 'image'
  | 'other';

export type RightsRequestStatus =
  | 'open'
  | 'reviewing'
  | 'resolved'
  | 'rejected';

export interface RightsRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requestType: RightsRequestType;
  subject: string;
  message: string;
  evidenceUrl: string | null;
  status: RightsRequestStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ChatModerationMessage {
  id: string;
  userId: string;
  name: string;
  type: 'text' | 'voice';
  body: string;
  audioMimeType: string;
  durationMs: number;
  status: 'visible' | 'hidden';
  reportCount: number;
  createdAt: string;
}

export interface ChatModerationAction {
  id: string;
  userId: string;
  name: string;
  action: 'mute' | 'ban';
  reason: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ChatModerationReport {
  id: string;
  messageId: string;
  userId: string;
  reason: string;
  createdAt: string;
}

export interface ChatModerationOverview {
  roomId: string;
  recentMessages: ChatModerationMessage[];
  actions: ChatModerationAction[];
  reports: ChatModerationReport[];
  generatedAt: string;
}

export interface ArtistRightsRecord {
  artistId: string;
  artistName: string;
  artistSymbol: string;
  imageUrl: string;
  imageUsageStatus: ImageUsageStatus;
  imageSourceUrl: string;
  imageLicense: string;
  imageAttribution: string;
  rightsReviewedAt: string | null;
  rightsNotes: string;
}
