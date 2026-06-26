import type { PoolClient } from 'pg';
import { getPool } from './database.js';
import { MarketError } from './market.js';
import {
  calculateQuote,
  MAX_DAILY_MOVE,
  MAX_POSITION_SHARE,
  QUOTE_LIFETIME_MS,
  roundMoney
} from './pricing.js';
import type {
  AuthenticatedUser,
  MarketDataStore,
  Trade,
  TradeQuote,
  TradeSide
} from './types.js';
import {
  publicArtistImage,
  type ImageUsageStatus
} from './rights.js';
import { contentToVideoSnapshot, listEntityContent } from './content.js';

type Numeric = string | number;

const number = (value: Numeric | null | undefined) => Number(value ?? 0);

interface DbArtist {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  country: string;
  genre: string;
  category: string;
  subcategory: string | null;
  profession: string | null;
  theme_tags: string[] | null;
  volatility_profile: 'stable' | 'balanced' | 'volatile' | 'underdog';
  risk_level: number;
  strategy_notes: string;
  image_url: string | null;
  image_usage_status: ImageUsageStatus;
  image_attribution: string | null;
  status: 'active' | 'frozen';
  current_price: Numeric;
  opening_price: Numeric;
  daily_anchor_price: Numeric;
  liquidity: Numeric;
  version: number;
  holders: Numeric;
}

interface WalletRow {
  id: string;
  user_id: string;
  season_id: string;
  available_balance: Numeric;
  starting_balance: Numeric;
}

const MAX_DAILY_TRADES = 60;
const MIN_TRADE_INTERVAL_MS = 5_000;

export class PostgresMarketStore implements MarketDataStore {
  readonly persistence = 'postgresql' as const;

  async listArtists() {
    const result = await getPool().query<DbArtist>(`
      SELECT artist.*,
        COUNT(position.id) FILTER (WHERE position.quantity > 0) AS holders
      FROM artists artist
      LEFT JOIN positions position ON position.artist_id = artist.id
      GROUP BY artist.id
      ORDER BY artist.current_price DESC
    `);
    return result.rows.map((artist) => this.publicArtist(artist));
  }

  async getArtistBySlug(slug: string) {
    const artistResult = await getPool().query<DbArtist>(
      `
        SELECT artist.*,
          COUNT(position.id) FILTER (WHERE position.quantity > 0) AS holders
        FROM artists artist
        LEFT JOIN positions position ON position.artist_id = artist.id
        WHERE artist.slug = $1
        GROUP BY artist.id
      `,
      [slug]
    );
    const artist = artistResult.rows[0];
    if (!artist) {
      throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
    }

    const [historyResult, contentItems] = await Promise.all([
      getPool().query<{
        time: Date;
        value: Numeric;
        buy_volume: Numeric | null;
        sell_volume: Numeric | null;
        source_type: string;
      }>(
        `
          SELECT
            created_at AS time,
            price AS value,
            buy_volume,
            sell_volume,
            source_type
          FROM price_ticks
          WHERE artist_id = $1
          ORDER BY created_at ASC
          LIMIT 500
        `,
        [artist.id]
      ),
      listEntityContent(artist.id, 8)
    ]);

    return {
      ...this.publicArtist(artist),
      history: historyResult.rows.map((point) => ({
        time: Math.floor(new Date(point.time).getTime() / 1000),
        value: number(point.value),
        volume: number(point.buy_volume ?? 0) + number(point.sell_volume ?? 0),
        sourceType: point.source_type
      })),
      contentItems,
      videos: contentItems.map(contentToVideoSnapshot)
    };
  }

  async getWallet(user: AuthenticatedUser) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const wallet = await this.ensureUserAndWallet(client, user);
      const result = await this.walletView(client, wallet);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listTrades(user: AuthenticatedUser) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const wallet = await this.ensureUserAndWallet(client, user);
      const result = await client.query<{
        id: string;
        artist_id: string;
        side: TradeSide;
        quantity: number;
        average_price: Numeric;
        gross_amount: Numeric;
        fee: Numeric;
        realized_pnl: Numeric;
        created_at: Date;
      }>(
        `
          SELECT id, artist_id, side, quantity, average_price, gross_amount,
            fee, realized_pnl, created_at
          FROM trades
          WHERE wallet_id = $1
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [wallet.id]
      );
      await client.query('COMMIT');
      return result.rows.map((trade) => this.mapTrade(trade, user.uid));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listFavorites(user: AuthenticatedUser) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const wallet = await this.ensureUserAndWallet(client, user);
      const result = await client.query<{ artist_id: string }>(
        `
          SELECT artist_id
          FROM user_favorites
          WHERE user_id = $1
          ORDER BY created_at DESC
        `,
        [wallet.user_id]
      );
      await client.query('COMMIT');
      return result.rows.map((favorite) => favorite.artist_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async setFavorite(
    user: AuthenticatedUser,
    artistId: string,
    favorite: boolean
  ) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const wallet = await this.ensureUserAndWallet(client, user);
      if (favorite) {
        const artist = await client.query(
          'SELECT 1 FROM artists WHERE id = $1',
          [artistId]
        );
        if (!artist.rowCount) {
          throw new MarketError(
            'Artista no encontrado.',
            'ARTIST_NOT_FOUND',
            404
          );
        }
        await client.query(
          `
            INSERT INTO user_favorites (user_id, artist_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, artist_id) DO NOTHING
          `,
          [wallet.user_id, artistId]
        );
      } else {
        await client.query(
          'DELETE FROM user_favorites WHERE user_id = $1 AND artist_id = $2',
          [wallet.user_id, artistId]
        );
      }
      const result = await client.query<{ artist_id: string }>(
        `
          SELECT artist_id
          FROM user_favorites
          WHERE user_id = $1
          ORDER BY created_at DESC
        `,
        [wallet.user_id]
      );
      await client.query('COMMIT');
      return result.rows.map((item) => item.artist_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createQuote(
    user: AuthenticatedUser,
    artistId: string,
    side: TradeSide,
    quantity: number
  ) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new MarketError(
        'La cantidad debe ser un entero entre 1 y 500.',
        'INVALID_QUANTITY'
      );
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const wallet = await this.ensureUserAndWallet(client, user);
      const artistResult = await client.query<DbArtist>(
        `
          SELECT artist.*, 0 AS holders
          FROM artists artist
          WHERE id = $1
          FOR SHARE
        `,
        [artistId]
      );
      const artist = artistResult.rows[0];
      if (!artist) {
        throw new MarketError('Artista no encontrado.', 'ARTIST_NOT_FOUND', 404);
      }
      if (artist.status !== 'active') {
        throw new MarketError('Este artista esta congelado.', 'ARTIST_FROZEN');
      }

      const positionResult = await client.query<{
        quantity: number;
        average_cost: Numeric;
      }>(
        'SELECT quantity, average_cost FROM positions WHERE wallet_id = $1 AND artist_id = $2',
        [wallet.id, artistId]
      );
      const position = positionResult.rows[0];
      if (side === 'sell' && (!position || position.quantity < quantity)) {
        throw new MarketError(
          'No tienes suficientes participaciones para esta venta.',
          'INSUFFICIENT_POSITION'
        );
      }

      const calculated = calculateQuote(
        number(artist.current_price),
        number(artist.daily_anchor_price),
        number(artist.liquidity),
        side,
        quantity
      );
      if (Math.abs(calculated.dailyReturn) > MAX_DAILY_MOVE) {
        throw new MarketError(
          'La operacion supera el limite diario de movimiento del artista.',
          'DAILY_LIMIT'
        );
      }
      if (side === 'buy' && number(wallet.available_balance) < calculated.netAmount) {
        throw new MarketError('No tienes FameCoins suficientes.', 'INSUFFICIENT_BALANCE');
      }

      if (side === 'buy') {
        await this.assertBuyPositionLimit(client, wallet, {
          currentArtistPrice: number(artist.current_price),
          nextArtistPrice: calculated.newPrice,
          existingQuantity: position?.quantity ?? 0,
          buyQuantity: quantity,
          netAmount: calculated.netAmount
        });
      }

      const expiresAt = new Date(Date.now() + QUOTE_LIFETIME_MS);
      const quoteResult = await client.query<{
        id: string;
        expires_at: Date;
      }>(
        `
          INSERT INTO trade_quotes (
            wallet_id, artist_id, side, quantity, average_price, gross_amount,
            fee, net_amount, new_price, artist_version, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id, expires_at
        `,
        [
          wallet.id,
          artistId,
          side,
          quantity,
          calculated.averagePrice,
          calculated.grossAmount,
          calculated.fee,
          calculated.netAmount,
          calculated.newPrice,
          artist.version,
          expiresAt
        ]
      );
      await client.query('COMMIT');

      const quote: TradeQuote = {
        id: quoteResult.rows[0]!.id,
        userId: user.uid,
        artistId,
        side,
        quantity,
        averagePrice: calculated.averagePrice,
        grossAmount: calculated.grossAmount,
        fee: calculated.fee,
        netAmount: calculated.netAmount,
        newPrice: calculated.newPrice,
        artistVersion: artist.version,
        expiresAt: quoteResult.rows[0]!.expires_at.toISOString()
      };
      return quote;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async executeQuote(
    user: AuthenticatedUser,
    quoteId: string,
    idempotencyKey: string
  ) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const wallet = await this.ensureUserAndWallet(client, user, true);

      const existing = await client.query(
        `
          SELECT id, artist_id, side, quantity, average_price, gross_amount,
            fee, realized_pnl, created_at
          FROM trades
          WHERE wallet_id = $1 AND idempotency_key = $2
        `,
        [wallet.id, idempotencyKey]
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return this.mapTrade(existing.rows[0], user.uid);
      }

      const recentActivity = await client.query<{
        daily_count: number;
        latest_trade_at: Date | null;
      }>(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE created_at >= NOW() - INTERVAL '24 hours'
            )::integer AS daily_count,
            MAX(created_at) AS latest_trade_at
          FROM trades
          WHERE wallet_id = $1
        `,
        [wallet.id]
      );
      const activity = recentActivity.rows[0]!;
      if (Number(activity.daily_count) >= MAX_DAILY_TRADES) {
        throw new MarketError(
          'Alcanzaste el limite de 60 operaciones en 24 horas.',
          'DAILY_TRADE_LIMIT',
          429
        );
      }
      if (
        activity.latest_trade_at &&
        Date.now() - new Date(activity.latest_trade_at).getTime() <
          MIN_TRADE_INTERVAL_MS
      ) {
        throw new MarketError(
          'Espera 5 segundos entre operaciones.',
          'TRADE_COOLDOWN',
          429
        );
      }

      const quoteResult = await client.query<{
        id: string;
        artist_id: string;
        side: TradeSide;
        quantity: number;
        average_price: Numeric;
        gross_amount: Numeric;
        fee: Numeric;
        net_amount: Numeric;
        new_price: Numeric;
        artist_version: number;
        expires_at: Date;
      }>(
        `
          SELECT *
          FROM trade_quotes
          WHERE id = $1 AND wallet_id = $2
          FOR UPDATE
        `,
        [quoteId, wallet.id]
      );
      const quote = quoteResult.rows[0];
      if (!quote) {
        throw new MarketError('Cotizacion no encontrada.', 'QUOTE_NOT_FOUND', 404);
      }
      if (new Date(quote.expires_at).getTime() < Date.now()) {
        throw new MarketError(
          'La cotizacion vencio. Solicita una nueva.',
          'QUOTE_EXPIRED'
        );
      }

      const artistResult = await client.query<DbArtist>(
        `
          SELECT artist.*, 0 AS holders
          FROM artists artist
          WHERE id = $1
          FOR UPDATE
        `,
        [quote.artist_id]
      );
      const artist = artistResult.rows[0];
      if (!artist || artist.version !== quote.artist_version) {
        throw new MarketError(
          'El precio cambio. Revisa una nueva cotizacion.',
          'PRICE_CHANGED',
          409
        );
      }

      const positionResult = await client.query<{
        id: string;
        quantity: number;
        average_cost: Numeric;
        realized_pnl: Numeric;
      }>(
        `
          SELECT id, quantity, average_cost, realized_pnl
          FROM positions
          WHERE wallet_id = $1 AND artist_id = $2
          FOR UPDATE
        `,
        [wallet.id, quote.artist_id]
      );
      const position = positionResult.rows[0];
      let balance = number(wallet.available_balance);
      let realizedPnl = 0;

      if (quote.side === 'buy') {
        if (balance < number(quote.net_amount)) {
          throw new MarketError(
            'No tienes FameCoins suficientes.',
            'INSUFFICIENT_BALANCE'
          );
        }
        await this.assertBuyPositionLimit(client, wallet, {
          currentArtistPrice: number(artist.current_price),
          nextArtistPrice: number(quote.new_price),
          existingQuantity: position?.quantity ?? 0,
          buyQuantity: quote.quantity,
          netAmount: number(quote.net_amount)
        });
        const oldQuantity = position?.quantity ?? 0;
        const oldCost = oldQuantity * number(position?.average_cost);
        const newQuantity = oldQuantity + quote.quantity;
        const averageCost = (oldCost + number(quote.gross_amount)) / newQuantity;
        balance = roundMoney(balance - number(quote.net_amount));

        await client.query(
          `
            INSERT INTO positions (
              wallet_id, artist_id, quantity, average_cost, realized_pnl
            ) VALUES ($1, $2, $3, $4, 0)
            ON CONFLICT (wallet_id, artist_id)
            DO UPDATE SET
              quantity = EXCLUDED.quantity,
              average_cost = EXCLUDED.average_cost,
              updated_at = NOW()
          `,
          [wallet.id, quote.artist_id, newQuantity, averageCost]
        );
      } else {
        if (!position || position.quantity < quote.quantity) {
          throw new MarketError(
            'No tienes suficientes participaciones para esta venta.',
            'INSUFFICIENT_POSITION'
          );
        }
        const newQuantity = position.quantity - quote.quantity;
        realizedPnl = roundMoney(
          number(quote.net_amount) - number(position.average_cost) * quote.quantity
        );
        balance = roundMoney(balance + number(quote.net_amount));
        await client.query(
          `
            UPDATE positions
            SET quantity = $1,
              average_cost = CASE WHEN $1 = 0 THEN 0 ELSE average_cost END,
              realized_pnl = realized_pnl + $2,
              updated_at = NOW()
            WHERE id = $3
          `,
          [newQuantity, realizedPnl, position.id]
        );
      }

      await client.query(
        'UPDATE wallets SET available_balance = $1, version = version + 1 WHERE id = $2',
        [balance, wallet.id]
      );
      await client.query(
        `
          UPDATE artists
          SET current_price = $1, version = version + 1
          WHERE id = $2
        `,
        [quote.new_price, quote.artist_id]
      );

      const tradeResult = await client.query<{
        id: string;
        created_at: Date;
      }>(
        `
          INSERT INTO trades (
            wallet_id, artist_id, side, quantity, average_price, gross_amount,
            fee, realized_pnl, idempotency_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, created_at
        `,
        [
          wallet.id,
          quote.artist_id,
          quote.side,
          quote.quantity,
          quote.average_price,
          quote.gross_amount,
          quote.fee,
          realizedPnl,
          idempotencyKey
        ]
      );
      const tradeId = tradeResult.rows[0]!.id;

      await client.query(
        `
          INSERT INTO ledger_entries (
            wallet_id, trade_id, entry_type, amount, balance_after
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          wallet.id,
          tradeId,
          quote.side,
          quote.side === 'buy'
            ? -number(quote.net_amount)
            : number(quote.net_amount),
          balance
        ]
      );
      await client.query(
        `
          INSERT INTO price_ticks (
            artist_id, season_id, price, buy_volume, sell_volume, source_type
          ) VALUES ($1, $2, $3, $4, $5, 'trade')
        `,
        [
          quote.artist_id,
          wallet.season_id,
          quote.new_price,
          quote.side === 'buy' ? quote.quantity : 0,
          quote.side === 'sell' ? quote.quantity : 0
        ]
      );
      await client.query('DELETE FROM trade_quotes WHERE id = $1', [quote.id]);

      await client.query('COMMIT');
      const trade: Trade = {
        id: tradeId,
        userId: user.uid,
        artistId: quote.artist_id,
        side: quote.side,
        quantity: quote.quantity,
        averagePrice: number(quote.average_price),
        grossAmount: number(quote.gross_amount),
        fee: number(quote.fee),
        realizedPnl,
        createdAt: tradeResult.rows[0]!.created_at.toISOString()
      };
      return trade;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureUserAndWallet(
    client: PoolClient,
    user: AuthenticatedUser,
    lockWallet = false
  ): Promise<WalletRow> {
    const userResult = await client.query<{
      id: string;
      status: 'active' | 'frozen';
    }>(
      `
        INSERT INTO users (
          firebase_uid, email, display_name, avatar_url, last_login_at
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          last_login_at = NOW()
        RETURNING id, status
      `,
      [user.uid, user.email, user.displayName, user.avatarUrl]
    );
    if (userResult.rows[0]!.status !== 'active') {
      throw new MarketError(
        'Tu cuenta esta temporalmente congelada.',
        'USER_FROZEN',
        403
      );
    }
    const seasonResult = await client.query<{
      id: string;
      starting_balance: Numeric;
    }>(
      `
        SELECT id, starting_balance, starts_at, trading_closes_at
        FROM seasons
        WHERE status = 'active'
          AND starts_at <= NOW()
          AND trading_closes_at > NOW()
        ORDER BY starts_at DESC
        LIMIT 1
      `
    );
    const season = seasonResult.rows[0];
    if (!season) {
      throw new MarketError(
        'No hay una temporada activa.',
        'NO_ACTIVE_SEASON',
        503
      );
    }

    await client.query(
      `
        INSERT INTO wallets (user_id, season_id, available_balance)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, season_id) DO NOTHING
      `,
      [userResult.rows[0]!.id, season.id, season.starting_balance]
    );

    const walletResult = await client.query<WalletRow>(
      `
        SELECT wallet.id, wallet.user_id, wallet.season_id,
          wallet.available_balance, season.starting_balance
        FROM wallets wallet
        JOIN seasons season ON season.id = wallet.season_id
        WHERE wallet.user_id = $1 AND wallet.season_id = $2
        ${lockWallet ? 'FOR UPDATE OF wallet' : ''}
      `,
      [userResult.rows[0]!.id, season.id]
    );
    return walletResult.rows[0]!;
  }

  private async assertBuyPositionLimit(
    client: PoolClient,
    wallet: WalletRow,
    input: {
      currentArtistPrice: number;
      nextArtistPrice: number;
      existingQuantity: number;
      buyQuantity: number;
      netAmount: number;
    }
  ) {
    const portfolio = await this.walletView(client, wallet);
    const existingTargetValue =
      input.existingQuantity * input.currentArtistPrice;
    const otherInvestedValue = Math.max(
      0,
      portfolio.investedValue - existingTargetValue
    );
    const postTradeBalance =
      number(wallet.available_balance) - input.netAmount;
    const postTradeTargetValue =
      (input.existingQuantity + input.buyQuantity) * input.nextArtistPrice;
    const postTradePortfolioValue =
      postTradeBalance + otherInvestedValue + postTradeTargetValue;

    if (
      postTradePortfolioValue <= 0 ||
      postTradeTargetValue / postTradePortfolioValue > MAX_POSITION_SHARE
    ) {
      throw new MarketError(
        'Una posicion no puede superar el 20% de tu portafolio.',
        'POSITION_LIMIT'
      );
    }
  }

  private async walletView(client: PoolClient, wallet: WalletRow) {
    const positionsResult = await client.query<{
      artist_id: string;
      quantity: number;
      average_cost: Numeric;
      realized_pnl: Numeric;
      market_value: Numeric;
      unrealized_pnl: Numeric;
      slug: string;
      symbol: string;
      name: string;
      country: string;
      genre: string;
      category: string;
      subcategory: string | null;
      profession: string | null;
      theme_tags: string[] | null;
      volatility_profile: 'stable' | 'balanced' | 'volatile' | 'underdog';
      risk_level: number;
      strategy_notes: string;
      image_url: string | null;
      image_usage_status: ImageUsageStatus;
      image_attribution: string | null;
      current_price: Numeric;
      opening_price: Numeric;
      status: 'active' | 'frozen';
      holders: Numeric;
    }>(
      `
        SELECT position.artist_id, position.quantity, position.average_cost,
          position.realized_pnl,
          position.quantity * artist.current_price AS market_value,
          position.quantity * (artist.current_price - position.average_cost)
            AS unrealized_pnl,
          artist.slug, artist.symbol, artist.name, artist.country, artist.genre,
          artist.category, artist.subcategory, artist.profession,
          artist.theme_tags, artist.volatility_profile, artist.risk_level,
          artist.strategy_notes, artist.image_url, artist.image_usage_status,
          artist.image_attribution,
          artist.current_price, artist.opening_price,
          artist.status,
          (
            SELECT COUNT(*) FROM positions holder
            WHERE holder.artist_id = artist.id AND holder.quantity > 0
          ) AS holders
        FROM positions position
        JOIN artists artist ON artist.id = position.artist_id
        WHERE position.wallet_id = $1 AND position.quantity > 0
        ORDER BY market_value DESC
      `,
      [wallet.id]
    );

    const positions = positionsResult.rows.map((position) => ({
      artistId: position.artist_id,
      quantity: position.quantity,
      averageCost: number(position.average_cost),
      realizedPnl: number(position.realized_pnl),
      marketValue: roundMoney(number(position.market_value)),
      unrealizedPnl: roundMoney(number(position.unrealized_pnl)),
      artist: {
        id: position.artist_id,
        slug: position.slug,
        symbol: position.symbol,
        name: position.name,
        country: position.country,
        genre: position.genre,
        category: position.category,
        subcategory: position.subcategory ?? '',
        profession: position.profession ?? '',
        themeTags: position.theme_tags ?? [],
        volatilityProfile: position.volatility_profile,
        riskLevel: Number(position.risk_level),
        strategyNotes: position.strategy_notes,
        imageUrl: publicArtistImage(
          position.image_url,
          position.image_usage_status
        ),
        imageUsageStatus: position.image_usage_status,
        imageAttribution: position.image_attribution ?? '',
        currentPrice: number(position.current_price),
        changePercent: roundMoney(
          ((number(position.current_price) - number(position.opening_price)) /
            number(position.opening_price)) *
            100
        ),
        holders: number(position.holders),
        status: position.status
      }
    }));
    const investedValue = roundMoney(
      positions.reduce((sum, position) => sum + position.marketValue, 0)
    );
    const balance = number(wallet.available_balance);
    const portfolioValue = roundMoney(balance + investedValue);
    const startingBalance = number(wallet.starting_balance);

    return {
      userId: wallet.user_id,
      balance: roundMoney(balance),
      startingBalance,
      investedValue,
      portfolioValue,
      returnPercent: roundMoney(
        ((portfolioValue - startingBalance) / startingBalance) * 100
      ),
      positions
    };
  }

  private publicArtist(artist: DbArtist) {
    return {
      id: artist.id,
      slug: artist.slug,
      symbol: artist.symbol,
      name: artist.name,
      country: artist.country,
      genre: artist.genre,
      category: artist.category,
      subcategory: artist.subcategory ?? '',
      profession: artist.profession ?? '',
      themeTags: artist.theme_tags ?? [],
      volatilityProfile: artist.volatility_profile,
      riskLevel: Number(artist.risk_level),
      strategyNotes: artist.strategy_notes,
      imageUrl: publicArtistImage(
        artist.image_url,
        artist.image_usage_status
      ),
      imageUsageStatus: artist.image_usage_status,
      imageAttribution: artist.image_attribution ?? '',
      currentPrice: number(artist.current_price),
      changePercent: roundMoney(
        ((number(artist.current_price) - number(artist.opening_price)) /
          number(artist.opening_price)) *
          100
      ),
      holders: number(artist.holders),
      status: artist.status
    };
  }

  private mapTrade(
    trade: {
      id: string;
      artist_id: string;
      side: TradeSide;
      quantity: number;
      average_price: Numeric;
      gross_amount: Numeric;
      fee: Numeric;
      realized_pnl: Numeric;
      created_at: Date;
    },
    userId: string
  ): Trade {
    return {
      id: trade.id,
      userId,
      artistId: trade.artist_id,
      side: trade.side,
      quantity: trade.quantity,
      averagePrice: number(trade.average_price),
      grossAmount: number(trade.gross_amount),
      fee: number(trade.fee),
      realizedPnl: number(trade.realized_pnl),
      createdAt: new Date(trade.created_at).toISOString()
    };
  }
}
