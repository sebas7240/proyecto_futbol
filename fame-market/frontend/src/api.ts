import type {
  ArtistDetails,
  ArtistSummary,
  Portfolio,
  Quote,
  RankingResponse,
  Season,
  SeasonHistory,
  Trade
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4020/api';
let tokenProvider: (() => Promise<string | null>) | null = null;

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
        : { 'x-user-id': 'fame-local-demo' }),
      ...options?.headers
    }
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || 'No se pudo completar la operacion.');
  }
  return body;
}

export const api = {
  async artists() {
    const body = await request<{ artists: ArtistSummary[] }>('/artists');
    return body.artists;
  },
  async artist(slug: string) {
    const body = await request<{ artist: ArtistDetails }>(`/artists/${slug}`);
    return body.artist;
  },
  async portfolio() {
    const body = await request<{ portfolio: Portfolio }>('/me/portfolio');
    return body.portfolio;
  },
  async favorites() {
    const body = await request<{ artistIds: string[] }>('/me/favorites');
    return body.artistIds;
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
  async setFavorite(artistId: string, favorite: boolean) {
    const body = await request<{ artistIds: string[] }>(
      `/me/favorites/${artistId}`,
      { method: favorite ? 'PUT' : 'DELETE' }
    );
    return body.artistIds;
  },
  async quote(artistId: string, side: 'buy' | 'sell', quantity: number) {
    const body = await request<{ quote: Quote }>('/trades/quote', {
      method: 'POST',
      body: JSON.stringify({ artistId, side, quantity })
    });
    return body.quote;
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
  async processSeasonCycle(adminSecret: string) {
    return request<{ actions: string[]; season: Season | null }>(
      '/admin/seasons/cycle',
      {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: '{}'
      }
    );
  }
};
