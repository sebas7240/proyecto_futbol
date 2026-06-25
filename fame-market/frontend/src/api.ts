import type {
  ArtistDetails,
  ArtistSummary,
  AttentionEvaluationResponse,
  AttentionSourceOverview,
  CategoryOverview,
  ChatModerationOverview,
  ConsentStatus,
  EntityCategory,
  EntitySource,
  NewsPulse,
  ExternalEvent,
  ExternalEventDirection,
  ExternalEventReviewStatus,
  ExternalEventType,
  ExternalEventVisibilityStatus,
  Portfolio,
  PublicAttentionStatus,
  Quote,
  RankingResponse,
  OperationsOverview,
  PrizeProfile,
  SecurityReview,
  Season,
  SeasonHistory,
  SeasonTrade,
  Trade,
  ArtistRightsRecord,
  ImageUsageStatus,
  RightsRequest,
  RightsRequestStatus,
  RightsRequestType,
  UserProfile
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4020/api';
let tokenProvider: (() => Promise<string | null>) | null = null;

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function setTokenProvider(provider: () => Promise<string | null>) {
  tokenProvider = provider;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenProvider ? await tokenProvider() : null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token
        ? { authorization: `Bearer ${token}` }
        : { 'x-user-id': 'fame-plays-local-demo' }),
      ...options?.headers
    }
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || 'No se pudo completar la operacion.',
      body?.error?.code || 'REQUEST_FAILED',
      response.status
    );
  }
  return body;
}

export const api = {
  async artists() {
    const body = await request<{ entities: ArtistSummary[] }>('/entities');
    return body.entities;
  },
  async artist(slug: string) {
    const body = await request<{ entity: ArtistDetails }>(`/entities/${slug}`);
    return body.entity;
  },
  async entitySources(slug: string) {
    const body = await request<{ sources: EntitySource[] }>(
      `/entities/${slug}/sources`
    );
    return body.sources;
  },
  async externalEvents(slug: string) {
    const body = await request<{ events: ExternalEvent[] }>(
      `/entities/${slug}/external-events`
    );
    return body.events;
  },
  async marketCategories() {
    const body = await request<{ categories: CategoryOverview[] }>(
      '/market/categories'
    );
    return body.categories;
  },
  async artistAttention(slug: string) {
    const body = await request<{ attention: AttentionSourceOverview[] }>(
      `/artists/${slug}/attention`
    );
    return body.attention;
  },
  async newsPulse(slug: string) {
    return request<NewsPulse>(`/entities/${slug}/news`);
  },
  async publicAttentionStatus() {
    return request<PublicAttentionStatus>('/attention/status');
  },
  async presence() {
    const body = await request<{
      presence: {
        onlineUsers: number;
        windowSeconds: number;
        generatedAt: string;
      };
    }>('/presence');
    return body.presence;
  },
  async presenceHeartbeat(sessionId: string, path: string) {
    const body = await request<{
      presence: {
        onlineUsers: number;
        windowSeconds: number;
        generatedAt: string;
      };
    }>('/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, path })
    });
    return body.presence;
  },
  async portfolio() {
    const body = await request<{ portfolio: Portfolio }>('/me/portfolio');
    return body.portfolio;
  },
  async profile() {
    const body = await request<{ profile: UserProfile }>('/me/profile');
    return body.profile;
  },
  async updatePrizeProfile(input: {
    solanaWalletAddress: string | null;
    prizeContactNotes: string;
  }) {
    const body = await request<{ profile: UserProfile }>('/me/profile/prize', {
      method: 'PUT',
      body: JSON.stringify(input)
    });
    return body.profile;
  },
  async consent() {
    return request<ConsentStatus>('/me/consent');
  },
  async acceptConsent() {
    return request<ConsentStatus>('/me/consent', {
      method: 'POST',
      body: JSON.stringify({ accepted: true })
    });
  },
  async favorites() {
    const body = await request<{ artistIds: string[] }>('/me/favorites');
    return body.artistIds;
  },
  async interests() {
    const body = await request<{ categories: EntityCategory[] }>(
      '/me/interests'
    );
    return body.categories;
  },
  async setInterests(categories: EntityCategory[]) {
    const body = await request<{ categories: EntityCategory[] }>(
      '/me/interests',
      {
        method: 'PUT',
        body: JSON.stringify({ categories })
      }
    );
    return body.categories;
  },
  async trades() {
    const body = await request<{ trades: Trade[] }>('/me/trades');
    return body.trades;
  },
  async ranking() {
    return request<RankingResponse>('/rankings/current?limit=50');
  },
  async seasonHistory() {
    const body = await request<{ seasons: SeasonHistory[] }>(
      '/me/season-history'
    );
    return body.seasons;
  },
  async seasonTrades(seasonId: string) {
    const body = await request<{ trades: SeasonTrade[] }>(
      `/me/season-history/${seasonId}/trades`
    );
    return body.trades;
  },
  async setFavorite(artistId: string, favorite: boolean) {
    const body = await request<{ artistIds: string[] }>(
      `/me/favorites/${artistId}`,
      { method: favorite ? 'PUT' : 'DELETE' }
    );
    return body.artistIds;
  },
  async quote(
    artistId: string,
    side: 'buy' | 'sell',
    quantity: number,
    turnstileToken?: string,
    turnstilePass?: string
  ) {
    return request<{
      quote: Quote;
      turnstilePass: string | null;
      turnstilePassExpiresAt: string | null;
    }>('/trades/quote', {
      method: 'POST',
      body: JSON.stringify({
        artistId,
        side,
        quantity,
        turnstileToken,
        turnstilePass
      })
    });
  },
  async execute(quoteId: string) {
    return request('/trades', {
      method: 'POST',
      body: JSON.stringify({
        quoteId,
        idempotencyKey: crypto.randomUUID()
      })
    });
  },
  async createRightsRequest(input: {
    requesterName: string;
    requesterEmail: string;
    requestType: RightsRequestType;
    subject: string;
    message: string;
    evidenceUrl: string;
    website: string;
  }) {
    const body = await request<{
      request: { id: string; status: RightsRequestStatus; createdAt: string };
    }>('/legal/rights-requests', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return body.request;
  },
  async registerYouTubeChannel(
    adminSecret: string,
    artistId: string,
    handle: string
  ) {
    return request(`/admin/artists/${artistId}/youtube-channel`, {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ handle, isPrimary: true })
    });
  },
  async syncYouTube(adminSecret: string, artistId?: string) {
    return request<{ results: Array<{ ok: boolean; videos?: number; error?: string }> }>(
      '/admin/youtube/sync',
      {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: JSON.stringify({ artistId })
      }
    );
  },
  async attentionOverview(adminSecret: string) {
    return request<{
      mode: 'shadow';
      sources: AttentionSourceOverview[];
      evaluation: AttentionEvaluationResponse;
    }>('/admin/attention', {
      headers: { 'x-admin-secret': adminSecret }
    });
  },
  async syncAttention(adminSecret: string, artistId?: string) {
    return request<{
      mode: 'shadow';
      results: Array<{
        ok: boolean;
        artistName: string;
        proposedDeltaBps?: number;
        error?: string;
      }>;
    }>('/admin/attention/sync', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ artistId })
    });
  },
  async syncNews(adminSecret: string, artistId?: string) {
    return request<{
      mode: 'shadow' | 'applied';
      results: Array<{
        ok: boolean;
        artistName: string;
        stored?: number;
        error?: string;
      }>;
    }>('/admin/news/sync', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ artistId })
    });
  },
  async runMarketMaker(adminSecret: string) {
    return request<{
      results: Array<{
        artistId: string;
        artistName: string;
        artistSlug: string;
        state: string;
        status: 'applied' | 'skipped' | 'halted' | 'failed';
        appliedDeltaBps: number;
        nextPrice: number | null;
        reason: string | null;
      }>;
    }>('/admin/market-maker/run', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: '{}'
    });
  },
  async adminSeasonAction(
    adminSecret: string,
    seasonId: string,
    action: 'freeze' | 'close'
  ) {
    return request<{ season: Season }>(
      `/admin/seasons/${seasonId}/${action}`,
      {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: '{}'
      }
    );
  },
  async createSeason(
    adminSecret: string,
    input: {
      name?: string;
      startsAt?: string;
      tradingClosesAt?: string;
      endsAt?: string;
      participationDays?: number;
      freezeMinutes?: number;
      startingBalance?: number;
    }
  ) {
    return request<{ season: Season }>('/admin/seasons', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify(input)
    });
  },
  async processSeasonCycle(adminSecret: string) {
    return request<{ actions: string[]; season: Season | null }>(
      '/admin/seasons/cycle',
      {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: '{}'
      }
    );
  },
  async securityReviews(adminSecret: string) {
    const body = await request<{ reviews: SecurityReview[] }>(
      '/admin/security/reviews',
      { headers: { 'x-admin-secret': adminSecret } }
    );
    return body.reviews;
  },
  async operations(adminSecret: string) {
    return request<OperationsOverview>('/admin/operations', {
      headers: { 'x-admin-secret': adminSecret }
    });
  },
  async prizeProfiles(adminSecret: string) {
    const body = await request<{ profiles: PrizeProfile[] }>(
      '/admin/prize-profiles',
      { headers: { 'x-admin-secret': adminSecret } }
    );
    return body.profiles;
  },
  async chatModeration(adminSecret: string, roomId: string) {
    return request<ChatModerationOverview>(
      `/admin/chat/moderation?roomId=${encodeURIComponent(roomId)}`,
      { headers: { 'x-admin-secret': adminSecret } }
    );
  },
  async moderateChat(
    adminSecret: string,
    input: {
      roomId: string;
      action: 'hide-message' | 'mute-user' | 'ban-user' | 'clear-user';
      messageId?: string;
      userId?: string;
      userName?: string;
      durationMinutes?: number;
      reason?: string;
    }
  ) {
    return request<ChatModerationOverview>('/admin/chat/moderation', {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify(input)
    });
  },
  async adminExternalEvents(adminSecret: string) {
    const body = await request<{ events: ExternalEvent[] }>(
      '/admin/external-events',
      { headers: { 'x-admin-secret': adminSecret } }
    );
    return body.events;
  },
  async createExternalEvent(
    adminSecret: string,
    artistId: string,
    input: {
      eventType: ExternalEventType;
      title: string;
      description: string;
      sourceUrl: string;
      occurredAt: string;
      impactDirection: ExternalEventDirection;
      proposedDeltaBps: number;
      visibilityStatus: ExternalEventVisibilityStatus;
      reviewStatus: ExternalEventReviewStatus;
      adminNotes: string;
    }
  ) {
    const body = await request<{ event: ExternalEvent }>(
      `/admin/artists/${artistId}/external-events`,
      {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: JSON.stringify(input)
      }
    );
    return body.event;
  },
  async updateExternalEvent(
    adminSecret: string,
    eventId: string,
    input: Partial<{
      eventType: ExternalEventType;
      title: string;
      description: string;
      sourceUrl: string;
      occurredAt: string;
      impactDirection: ExternalEventDirection;
      proposedDeltaBps: number;
      visibilityStatus: ExternalEventVisibilityStatus;
      reviewStatus: ExternalEventReviewStatus;
      adminNotes: string;
    }>
  ) {
    const body = await request<{ event: ExternalEvent }>(
      `/admin/external-events/${eventId}`,
      {
        method: 'PATCH',
        headers: { 'x-admin-secret': adminSecret },
        body: JSON.stringify(input)
      }
    );
    return body.event;
  },
  async reviewRanking(
    adminSecret: string,
    seasonId: string,
    userId: string,
    status: 'approved' | 'flagged',
    notes: string
  ) {
    return request(`/admin/rankings/${seasonId}/${userId}/review`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ status, notes: notes.trim() || null })
    });
  },
  async setUserStatus(
    adminSecret: string,
    userId: string,
    status: 'active' | 'frozen'
  ) {
    return request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ status })
    });
  },
  async setArtistStatus(
    adminSecret: string,
    artistId: string,
    status: 'active' | 'frozen'
  ) {
    return request(`/admin/artists/${artistId}/status`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ status })
    });
  },
  async artistRights(adminSecret: string) {
    const body = await request<{ artists: ArtistRightsRecord[] }>(
      '/admin/rights/artists',
      { headers: { 'x-admin-secret': adminSecret } }
    );
    return body.artists;
  },
  async updateArtistRights(
    adminSecret: string,
    artistId: string,
    input: {
      imageUrl: string;
      imageUsageStatus: ImageUsageStatus;
      imageSourceUrl: string;
      imageLicense: string;
      imageAttribution: string;
      rightsNotes: string;
    }
  ) {
    return request(`/admin/rights/artists/${artistId}`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify(input)
    });
  },
  async rightsRequests(adminSecret: string) {
    const body = await request<{ requests: RightsRequest[] }>(
      '/admin/rights/requests',
      { headers: { 'x-admin-secret': adminSecret } }
    );
    return body.requests;
  },
  async updateRightsRequest(
    adminSecret: string,
    requestId: string,
    status: RightsRequestStatus,
    adminNotes: string
  ) {
    return request(`/admin/rights/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': adminSecret },
      body: JSON.stringify({ status, adminNotes: adminNotes.trim() || null })
    });
  }
};
