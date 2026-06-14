import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { authMode, requireAdmin, requireAuth } from './auth.js';
import {
  checkDatabase,
  databaseConfigured,
  runMigrations
} from './database.js';
import { MarketError, MarketStore } from './market.js';
import { PostgresMarketStore } from './postgresMarket.js';
import {
  closeSeason,
  createNextSeason,
  freezeSeason,
  getCurrentSeason,
  getSeasonRanking,
  getUserSeasonHistory,
  processSeasonCycle
} from './seasons.js';
import type { MarketDataStore } from './types.js';
import {
  pruneYouTubeSnapshots,
  registerArtistChannel,
  syncYouTubeChannels
} from './youtube.js';

const app = express();
const port = Number(process.env.PORT ?? 4020);
const configuredOrigins = (
  process.env.FRONTEND_ORIGINS ??
  process.env.FRONTEND_ORIGIN ??
  'http://localhost:5174'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...new Set([
    ...configuredOrigins,
    'capacitor://localhost',
    'http://localhost'
  ])
];
let market: MarketDataStore;

app.disable('x-powered-by');
app.use(
  pinoHttp({
    redact: ['req.headers.authorization', 'req.headers.x-admin-secret']
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origen no permitido por CORS.'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '32kb' }));

app.get('/api/status', async (_request, response) => {
  let database = null;
  if (databaseConfigured()) {
    try {
      database = await checkDatabase();
    } catch {
      database = null;
    }
  }
  response.json({
    ok: true,
    service: 'fame-market-backend',
    persistence: market.persistence,
    databaseConnected: Boolean(database),
    authMode,
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    now: new Date().toISOString()
  });
});

app.get('/api/seasons/current', async (_request, response, next) => {
  try {
    response.json({ season: await getCurrentSeason() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/rankings/current', async (request, response, next) => {
  try {
    const limit = Number(request.query.limit ?? 50);
    response.json(await getSeasonRanking(Number.isFinite(limit) ? limit : 50));
  } catch (error) {
    next(error);
  }
});

app.get('/api/artists', async (_request, response, next) => {
  try {
    response.json({ artists: await market.listArtists() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/artists/:slug', async (request, response, next) => {
  try {
    response.json({ artist: await market.getArtistBySlug(request.params.slug) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/portfolio', requireAuth, async (request, response, next) => {
  try {
    response.json({
      portfolio: await market.getWallet(request.authenticatedUser!)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/trades', requireAuth, async (request, response, next) => {
  try {
    response.json({
      trades: await market.listTrades(request.authenticatedUser!)
    });
  } catch (error) {
    next(error);
  }
});

app.get(
  '/api/me/season-history',
  requireAuth,
  async (request, response, next) => {
    try {
      response.json({
        seasons: await getUserSeasonHistory(request.authenticatedUser!)
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get('/api/me/favorites', requireAuth, async (request, response, next) => {
  try {
    response.json({
      artistIds: await market.listFavorites(request.authenticatedUser!)
    });
  } catch (error) {
    next(error);
  }
});

app.put(
  '/api/me/favorites/:artistId',
  requireAuth,
  async (request, response, next) => {
    try {
      response.json({
        artistIds: await market.setFavorite(
          request.authenticatedUser!,
          String(request.params.artistId),
          true
        )
      });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  '/api/me/favorites/:artistId',
  requireAuth,
  async (request, response, next) => {
    try {
      response.json({
        artistIds: await market.setFavorite(
          request.authenticatedUser!,
          String(request.params.artistId),
          false
        )
      });
    } catch (error) {
      next(error);
    }
  }
);

const quoteSchema = z.object({
  artistId: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().int().min(1).max(500)
});

app.post('/api/trades/quote', requireAuth, async (request, response, next) => {
  try {
    const input = quoteSchema.parse(request.body);
    response.json({
      quote: await market.createQuote(
        request.authenticatedUser!,
        input.artistId,
        input.side,
        input.quantity
      )
    });
  } catch (error) {
    next(error);
  }
});

const executionSchema = z.object({
  quoteId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(100)
});

const youtubeChannelSchema = z
  .object({
    channelId: z.string().min(1).optional(),
    handle: z.string().min(1).optional(),
    isPrimary: z.boolean().optional()
  })
  .refine((input) => input.channelId || input.handle, {
    message: 'Envia channelId o handle.'
  });

app.post(
  '/api/admin/artists/:artistId/youtube-channel',
  requireAdmin,
  async (request, response, next) => {
    try {
      if (!databaseConfigured()) {
        throw new MarketError(
          'YouTube requiere PostgreSQL.',
          'DATABASE_REQUIRED',
          503
        );
      }
      const input = youtubeChannelSchema.parse(request.body);
      const channel = await registerArtistChannel(
        String(request.params.artistId),
        input
      );
      response.status(201).json({ channel });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/youtube/sync',
  requireAdmin,
  async (request, response, next) => {
    try {
      if (!databaseConfigured()) {
        throw new MarketError(
          'YouTube requiere PostgreSQL.',
          'DATABASE_REQUIRED',
          503
        );
      }
      const input = z
        .object({ artistId: z.string().uuid().optional() })
        .parse(request.body ?? {});
      response.json({ results: await syncYouTubeChannels(input.artistId) });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/seasons/:seasonId/freeze',
  requireAdmin,
  async (request, response, next) => {
    try {
      response.json({
        season: await freezeSeason(String(request.params.seasonId))
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/seasons/:seasonId/close',
  requireAdmin,
  async (request, response, next) => {
    try {
      response.json({
        season: await closeSeason(String(request.params.seasonId))
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/seasons',
  requireAdmin,
  async (_request, response, next) => {
    try {
      response.status(201).json({ season: await createNextSeason() });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/seasons/cycle',
  requireAdmin,
  async (_request, response, next) => {
    try {
      response.json(await processSeasonCycle());
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/trades', requireAuth, async (request, response, next) => {
  try {
    const input = executionSchema.parse(request.body);
    response.status(201).json({
      trade: await market.executeQuote(
        request.authenticatedUser!,
        input.quoteId,
        input.idempotencyKey
      )
    });
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Revisa los datos enviados.' }
      });
      return;
    }
    if (error instanceof MarketError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message }
      });
      return;
    }
    console.error(error);
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrio un error inesperado.' }
    });
  }
);

async function start() {
  if (databaseConfigured()) {
    if (process.env.AUTO_MIGRATE !== 'false') {
      await runMigrations();
    }
    market = new PostgresMarketStore();
  } else {
    market = new MarketStore();
    console.warn(
      '[Database] DATABASE_URL ausente; usando memoria solo para desarrollo.'
    );
  }

  app.listen(port, () => {
    console.log(`Fame Market API listening on http://localhost:${port}`);
  });

  if (
    databaseConfigured() &&
    process.env.YOUTUBE_API_KEY &&
    process.env.YOUTUBE_SYNC_ENABLED === 'true'
  ) {
    const intervalMinutes = Math.max(
      Number(process.env.YOUTUBE_SYNC_INTERVAL_MINUTES ?? 60),
      30
    );
    const sync = async () => {
      const results = await syncYouTubeChannels();
      const removedSnapshots = await pruneYouTubeSnapshots();
      console.log(
        `[YouTube] channels=${results.length} prunedSnapshots=${removedSnapshots}`
      );
    };
    sync().catch((error) => console.error('[YouTube] Initial sync failed', error));
    const timer = setInterval(
      () =>
        sync().catch((error) =>
          console.error('[YouTube] Scheduled sync failed', error)
        ),
      intervalMinutes * 60 * 1000
    );
    timer.unref();
  }

  if (
    databaseConfigured() &&
    process.env.SEASON_AUTOMATION_ENABLED !== 'false'
  ) {
    const intervalMinutes = Math.max(
      Number(process.env.SEASON_CYCLE_INTERVAL_MINUTES ?? 5),
      1
    );
    const cycle = () =>
      processSeasonCycle().catch((error) =>
        console.error('[Season] Automatic cycle failed', error)
      );
    cycle();
    const timer = setInterval(cycle, intervalMinutes * 60 * 1000);
    timer.unref();
  }
}

start().catch((error) => {
  console.error('[Startup] Fame Market could not start', error);
  process.exitCode = 1;
});
