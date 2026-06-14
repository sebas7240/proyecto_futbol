import type { Artist, PricePoint } from './types.js';

const nowSeconds = Math.floor(Date.now() / 1000);

function history(base: number, drift: number, phase: number): PricePoint[] {
  return Array.from({ length: 72 }, (_, index) => {
    const time = nowSeconds - (71 - index) * 60 * 60;
    const wave = Math.sin((index + phase) / 6) * 2.1;
    const trend = index * drift;
    return { time, value: Number((base + trend + wave).toFixed(2)) };
  });
}

export const artists: Artist[] = [
  {
    id: 'artist-karol-g',
    slug: 'karol-g',
    symbol: 'KAROL',
    name: 'Karol G',
    country: 'Colombia',
    genre: 'Urbano latino',
    imageUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
    currentPrice: 118.42,
    openingPrice: 112.6,
    dailyAnchorPrice: 118.42,
    liquidity: 2200,
    version: 1,
    status: 'active',
    holders: 824,
    history: history(102, 0.22, 1),
    videos: [
      {
        id: 'demo-karol-1',
        title: 'Nuevo lanzamiento oficial',
        thumbnailUrl:
          'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80',
        publishedAt: '2026-06-12T18:00:00.000Z',
        viewCount: 4281000,
        likeCount: 312000,
        commentCount: 18400,
        youtubeUrl: 'https://www.youtube.com/'
      }
    ]
  },
  {
    id: 'artist-bad-bunny',
    slug: 'bad-bunny',
    symbol: 'BENITO',
    name: 'Bad Bunny',
    country: 'Puerto Rico',
    genre: 'Trap latino',
    imageUrl:
      'https://images.unsplash.com/photo-1521337581100-8ca9a73a5f79?auto=format&fit=crop&w=900&q=80',
    currentPrice: 104.75,
    openingPrice: 106.2,
    dailyAnchorPrice: 104.75,
    liquidity: 2600,
    version: 1,
    status: 'active',
    holders: 1018,
    history: history(109, -0.06, 8),
    videos: [
      {
        id: 'demo-benito-1',
        title: 'Presentacion en vivo',
        thumbnailUrl:
          'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
        publishedAt: '2026-06-10T23:00:00.000Z',
        viewCount: 6920000,
        likeCount: 488000,
        commentCount: 26300,
        youtubeUrl: 'https://www.youtube.com/'
      }
    ]
  },
  {
    id: 'artist-shakira',
    slug: 'shakira',
    symbol: 'SHAKI',
    name: 'Shakira',
    country: 'Colombia',
    genre: 'Pop latino',
    imageUrl:
      'https://images.unsplash.com/photo-1516575334481-f85287c2c82d?auto=format&fit=crop&w=900&q=80',
    currentPrice: 127.18,
    openingPrice: 119.9,
    dailyAnchorPrice: 127.18,
    liquidity: 2400,
    version: 1,
    status: 'active',
    holders: 936,
    history: history(111, 0.23, 13),
    videos: [
      {
        id: 'demo-shakira-1',
        title: 'Sesion oficial de estudio',
        thumbnailUrl:
          'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=800&q=80',
        publishedAt: '2026-06-08T16:00:00.000Z',
        viewCount: 3850000,
        likeCount: 276000,
        commentCount: 15700,
        youtubeUrl: 'https://www.youtube.com/'
      }
    ]
  }
];
