import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { authMode, requireAdmin, requireAuth } from './auth.js';
import {
  attentionMode,
  getArtistAttentionBySlug,
  getAttentionEvaluation,
  getAttentionOverview,
  registerWikimediaSource,
  syncAttentionSources
} from './attention.js';
import {
  acceptCurrentConsent,
  consentRequired,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RULES_VERSION,
  getConsentStatus,
  requireCurrentConsent
} from './consent.js';
import {
  checkDatabase,
  databaseConfigured,
  getPool,
  runMigrations
} from './database.js';
import {
  deploymentEnvironment,
  validateDeploymentEnvironment
} from './deployment.js';
import { MarketError, MarketStore } from './market.js';
import { incrementMetric } from './metrics.js';
import {
  getOperationalOverview,
  operationsMetrics,
  readinessStatus,
  runMonitoredJob
} from './operations.js';
import { PostgresMarketStore } from './postgresMarket.js';
import { rateLimit, requestIp } from './rateLimit.js';
import {
  listSecurityReviews,
  reviewRanking,
  setArtistStatus,
  setUserStatus
} from './security.js';
import {
  closeSeason,
  createNextSeason,
  freezeSeason,
  getCurrentSeason,
  getSeasonRanking,
  getUserSeasonHistory,
  getUserSeasonTrades,
  processSeasonCycle
} from './seasons.js';
import type { MarketDataStore } from './types.js';
import {
  turnstileConfigured,
  verifyTurnstileToken
} from './turnstile.js';
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

const userRateKey = (request: express.Request) =>
  request.authenticatedUser?.uid ?? requestIp(request);
const adminRateLimit = rateLimit({
  action: 'admin',
  maxRequests: 30,
  windowMs: 60_000,
  key: requestIp
});
const quoteRateLimit = rateLimit({
  action: 'trade-quote',
  maxRequests: 30,
  windowMs: 60_000,
  key: userRateKey
});
const executionRateLimit = rateLimit({
  action: 'trade-execution',
  maxRequests: 20,
  windowMs: 60_000,
  key: userRateKey
});
const monitoringSecret =
  process.env.MONITORING_SECRET || process.env.ADMIN_SECRET;

app.disable('x-powered-by');
app.use(
  pinoHttp({
    redact: [
      'req.headers.authorization',
      'req.headers.x-admin-secret',
      'req.headers.x-monitoring-secret'
    ]
  })
);
app.use((_request, response, next) => {
  incrementMetric('http_requests_total');
  response.on('finish', () => {
    if (response.statusCode >= 500) incrementMetric('http_errors_total');
  });
  next();
});
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

app.get('/api/health/live', (_request, response) => {
  response.json({
    ok: true,
    service: 'fame-market-backend',
    now: new Date().toISOString()
  });
});

app.get('/api/health/ready', async (_request, response) => {
  const readiness = await readinessStatus();
  response.status(readiness.ready ? 200 : 503).json(readiness);
});

app.get('/api/metrics', async (request, response) => {
  if (
    !monitoringSecret ||
    request.header('x-monitoring-secret') !== monitoringSecret
  ) {
    response.status(403).type('text/plain').send('Forbidden\n');
    return;
  }
  response.type('text/plain; version=0.0.4').send(await operationsMetrics());
});

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
    environment: deploymentEnvironment(),
    databaseConnected: Boolean(database),
    authMode,
    attentionIndex: {
      configured: databaseConfigured(),
      enabled: process.env.ATTENTION_SYNC_ENABLED === 'true',
      mode: attentionMode()
    },
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    turnstileConfigured: turnstileConfigured(),
    consentRequired: consentRequired(),
    now: new Date().toISOString()
  });
});

app.get('/api/legal/versions', (_request, response) => {
  response.json({
    rulesVersion: CURRENT_RULES_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION
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

app.get('/api/artists/:slug/attention', async (request, response, next) => {
  try {
    if (!databaseConfigured()) {
      response.json({ attention: [] });
      return;
    }
    response.json({
      attention: await getArtistAttentionBySlug(String(request.params.slug))
    });
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

app.get('/api/me/consent', requireAuth, async (request, response, next) => {
  try {
    response.json(await getConsentStatus(request.authenticatedUser!));
  } catch (error) {
    next(error);
  }
});

app.post('/api/me/consent', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ accepted: z.literal(true) }).parse(request.body);
    if (!input.accepted) return;
    response.json(await acceptCurrentConsent(request.authenticatedUser!));
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

app.get(
  '/api/me/season-history/:seasonId/trades',
  requireAuth,
  async (request, response, next) => {
    try {
      response.json({
        trades: await getUserSeasonTrades(
          request.authenticatedUser!,
          String(request.params.seasonId)
        )
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
  quantity: z.number().int().min(1).max(500),
  turnstileToken: z.string().max(2048).optional()
});

app.post(
  '/api/trades/quote',
  requireAuth,
  requireCurrentConsent,
  quoteRateLimit,
  async (request, response, next) => {
    try {
      const input = quoteSchema.parse(request.body);
      await verifyTurnstileToken(
        input.turnstileToken,
        requestIp(request),
        'trade_quote'
      );
      response.json({
        quote: await market.createQuote(
          request.authenticatedUser!,
          input.artistId,
          input.side,
          input.quantity
        )
      });
      incrementMetric('trade_quotes_total');
    } catch (error) {
      next(error);
    }
  }
);

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

const wikimediaSourceSchema = z.object({
  project: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+\.wikipedia\.org$/i)
    .max(100),
  articleTitle: z.string().trim().min(1).max(250),
  enabled: z.boolean().optional()
});

app.post(
  '/api/admin/artists/:artistId/attention-sources/wikimedia',
  requireAdmin,
  adminRateLimit,
  async (request, response, next) => {
    try {
      if (!databaseConfigured()) {
        throw new MarketError(
          'El indice de atencion requiere PostgreSQL.',
          'DATABASE_REQUIRED',
          503
        );
      }
      const input = wikimediaSourceSchema.parse(request.body);
      const source = await registerWikimediaSource(
        String(request.params.artistId),
        input
      );
      response.status(201).json({ source });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/admin/attention',
  requireAdmin,
  adminRateLimit,
  async (_request, response, next) => {
    try {
      response.json({
        mode: attentionMode(),
        sources: await getAttentionOverview(),
        evaluation: await getAttentionEvaluation()
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/attention/sync',
  requireAdmin,
  adminRateLimit,
  async (request, response, next) => {
    try {
      if (!databaseConfigured()) {
        throw new MarketError(
          'El indice de atencion requiere PostgreSQL.',
          'DATABASE_REQUIRED',
          503
        );
      }
      const input = z
        .object({ artistId: z.string().uuid().optional() })
        .parse(request.body ?? {});
      const results = await runMonitoredJob(
        'attention-sync',
        () => syncAttentionSources(input.artistId),
        { source: 'admin', artistId: input.artistId ?? null, mode: attentionMode() },
        (outcomes) => ({
          sources: outcomes.length,
          successful: outcomes.filter((outcome) => outcome.ok).length,
          signals: outcomes.reduce(
            (sum, outcome) =>
              sum + (outcome.ok ? Number(outcome.signals ?? 0) : 0),
            0
          ),
          mode: attentionMode()
        })
      );
      response.json({ mode: attentionMode(), results });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/artists/:artistId/youtube-channel',
  requireAdmin,
  adminRateLimit,
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
  adminRateLimit,
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
      const results = await runMonitoredJob(
        'youtube-sync',
        () => syncYouTubeChannels(input.artistId),
        { source: 'admin', artistId: input.artistId ?? null },
        (outcomes) => ({
          channels: outcomes.length,
          successful: outcomes.filter((outcome) => outcome.ok).length,
          videos: outcomes.reduce(
            (sum, outcome) => sum + ('videos' in outcome ? outcome.videos : 0),
            0
          )
        })
      );
      response.json({ results });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/seasons/:seasonId/freeze',
  requireAdmin,
  adminRateLimit,
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
  adminRateLimit,
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
  adminRateLimit,
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
  adminRateLimit,
  async (_request, response, next) => {
    try {
      response.json(
        await runMonitoredJob(
          'season-cycle',
          processSeasonCycle,
          { source: 'admin' },
          (result) => ({ actions: result.actions })
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/admin/operations',
  requireAdmin,
  adminRateLimit,
  async (_request, response, next) => {
    try {
      response.json(await getOperationalOverview());
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/admin/security/reviews',
  requireAdmin,
  adminRateLimit,
  async (_request, response, next) => {
    try {
      response.json({ reviews: await listSecurityReviews() });
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  '/api/admin/rankings/:seasonId/:userId/review',
  requireAdmin,
  adminRateLimit,
  async (request, response, next) => {
    try {
      const input = z
        .object({
          status: z.enum(['approved', 'flagged']),
          notes: z.string().trim().max(500).nullable().optional()
        })
        .parse(request.body);
      await reviewRanking(
        String(request.params.seasonId),
        String(request.params.userId),
        input.status,
        input.notes ?? null
      );
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  '/api/admin/users/:userId/status',
  requireAdmin,
  adminRateLimit,
  async (request, response, next) => {
    try {
      const input = z
        .object({ status: z.enum(['active', 'frozen']) })
        .parse(request.body);
      await setUserStatus(String(request.params.userId), input.status);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  '/api/admin/artists/:artistId/status',
  requireAdmin,
  adminRateLimit,
  async (request, response, next) => {
    try {
      const input = z
        .object({ status: z.enum(['active', 'frozen']) })
        .parse(request.body);
      await setArtistStatus(String(request.params.artistId), input.status);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/trades',
  requireAuth,
  requireCurrentConsent,
  executionRateLimit,
  async (request, response, next) => {
    try {
      const input = executionSchema.parse(request.body);
      response.status(201).json({
        trade: await market.executeQuote(
          request.authenticatedUser!,
          input.quoteId,
          input.idempotencyKey
        )
      });
      incrementMetric('trades_executed_total');
    } catch (error) {
      next(error);
    }
  }
);

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
  validateDeploymentEnvironment();
  if (databaseConfigured()) {
    if (process.env.AUTO_MIGRATE !== 'false') {
      await runMigrations();
    }
    market = new PostgresMarketStore();
    const cleanupTimer = setInterval(
      () =>
        getPool()
          .query(
            "DELETE FROM action_rate_limits WHERE updated_at < NOW() - INTERVAL '2 days'"
          )
          .catch((error) =>
            console.error('[RateLimit] Cleanup failed', error)
          ),
      6 * 60 * 60 * 1000
    );
    cleanupTimer.unref();
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
      const result = await runMonitoredJob(
        'youtube-sync',
        async () => {
          const results = await syncYouTubeChannels();
          const removedSnapshots = await pruneYouTubeSnapshots();
          return { results, removedSnapshots };
        },
        { source: 'scheduler' },
        ({ results, removedSnapshots }) => ({
          channels: results.length,
          successful: results.filter((outcome) => outcome.ok).length,
          videos: results.reduce(
            (sum, outcome) => sum + ('videos' in outcome ? outcome.videos : 0),
            0
          ),
          removedSnapshots
        })
      );
      console.log(
        `[YouTube] channels=${result.results.length} prunedSnapshots=${result.removedSnapshots}`
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
    process.env.ATTENTION_SYNC_ENABLED === 'true'
  ) {
    const intervalMinutes = Math.max(
      Number(process.env.ATTENTION_SYNC_INTERVAL_MINUTES ?? 360),
      60
    );
    const sync = async () => {
      const results = await runMonitoredJob(
        'attention-sync',
        syncAttentionSources,
        { source: 'scheduler', mode: attentionMode() },
        (outcomes) => ({
          sources: outcomes.length,
          successful: outcomes.filter((outcome) => outcome.ok).length,
          signals: outcomes.reduce(
            (sum, outcome) =>
              sum + (outcome.ok ? Number(outcome.signals ?? 0) : 0),
            0
          ),
          mode: attentionMode()
        })
      );
      console.log(
        `[Attention] mode=${attentionMode()} sources=${results.length} successful=${results.filter((outcome) => outcome.ok).length}`
      );
    };
    sync().catch((error) =>
      console.error('[Attention] Initial sync failed', error)
    );
    const timer = setInterval(
      () =>
        sync().catch((error) =>
          console.error('[Attention] Scheduled sync failed', error)
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
      runMonitoredJob(
        'season-cycle',
        processSeasonCycle,
        { source: 'scheduler' },
        (result) => ({ actions: result.actions })
      ).catch((error) =>
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
