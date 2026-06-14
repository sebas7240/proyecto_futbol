import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  Music2,
  Play,
  Search,
  Star,
  Trophy,
  WalletCards,
  X
} from 'lucide-react';
import { api, setTokenProvider } from './api';
import {
  currentIdToken,
  firebaseReady,
  loginWithGoogle,
  logout,
  subscribeToAuth
} from './auth';
import { ConsentModal } from './ConsentModal';
import { PriceChart } from './PriceChart';
import { RankingPanel } from './RankingPanel';
import { TurnstileWidget } from './TurnstileWidget';
import type { ArtistSummary, Quote } from './types';

type ArtistFilter = 'trending' | 'latin' | 'favorites';

const money = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const compact = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1
});

function Movement({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={positive ? 'movement movement--up' : 'movement movement--down'}>
      {positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function ArtistRow({
  artist,
  active,
  favorite,
  onSelect,
  onToggleFavorite
}: {
  artist: ArtistSummary;
  active: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className={`artist-row ${active ? 'artist-row--active' : ''}`}>
      <button className="artist-row__select" onClick={onSelect}>
        <img src={artist.imageUrl} alt="" />
        <span className="artist-row__identity">
          <strong>{artist.name}</strong>
          <small>{artist.symbol} · {artist.country}</small>
        </span>
        <span className="artist-row__price">
          <strong>{money.format(artist.currentPrice)}</strong>
          <Movement value={artist.changePercent} />
        </span>
      </button>
      <button
        className={`favorite-toggle ${favorite ? 'is-active' : ''}`}
        onClick={onToggleFavorite}
        aria-label={
          favorite
            ? `Quitar ${artist.name} de favoritos`
            : `Agregar ${artist.name} a favoritos`
        }
        title={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function App() {
  const queryClient = useQueryClient();
  const artistsQuery = useQuery({ queryKey: ['artists'], queryFn: api.artists });
  const rankingQuery = useQuery({
    queryKey: ['ranking'],
    queryFn: api.ranking,
    refetchInterval: 60_000
  });
  const [selectedSlug, setSelectedSlug] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState(5);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notice, setNotice] = useState('');
  const [mobileTab, setMobileTab] =
    useState<'market' | 'portfolio' | 'ranking'>(
      window.location.pathname.startsWith('/ranking') ? 'ranking' : 'market'
    );
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [artistFilter, setArtistFilter] =
    useState<ArtistFilter>('trending');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
  const appEnvironment = import.meta.env.VITE_APP_ENV ?? 'development';

  useEffect(() => {
    setTokenProvider(currentIdToken);
    return subscribeToAuth((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['season-history'] });
      queryClient.invalidateQueries({ queryKey: ['consent'] });
    });
  }, [queryClient]);

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', firebaseUser?.uid ?? 'local'],
    queryFn: api.portfolio,
    enabled: authReady && (Boolean(firebaseUser) || !firebaseReady),
    retry: false
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites', firebaseUser?.uid ?? 'local'],
    queryFn: api.favorites,
    enabled: authReady && (Boolean(firebaseUser) || !firebaseReady),
    retry: false
  });

  const tradesQuery = useQuery({
    queryKey: ['trades', firebaseUser?.uid ?? 'local'],
    queryFn: api.trades,
    enabled: authReady && (Boolean(firebaseUser) || !firebaseReady),
    retry: false
  });

  const seasonHistoryQuery = useQuery({
    queryKey: ['season-history', firebaseUser?.uid ?? 'local'],
    queryFn: api.seasonHistory,
    enabled: authReady && (Boolean(firebaseUser) || !firebaseReady),
    retry: false
  });

  const consentQuery = useQuery({
    queryKey: ['consent', firebaseUser?.uid ?? 'local'],
    queryFn: api.consent,
    enabled: authReady && (Boolean(firebaseUser) || !firebaseReady),
    retry: false
  });

  useEffect(() => {
    if (
      firebaseUser &&
      tradesQuery.isSuccess &&
      tradesQuery.data.length === 0 &&
      localStorage.getItem('fame-market:onboarding') !== 'done'
    ) {
      setOnboardingOpen(true);
    }
  }, [firebaseUser, tradesQuery.data, tradesQuery.isSuccess]);

  useEffect(() => {
    if (!selectedSlug && artistsQuery.data?.[0]) {
      setSelectedSlug(artistsQuery.data[0].slug);
    }
  }, [artistsQuery.data, selectedSlug]);

  const artistQuery = useQuery({
    queryKey: ['artist', selectedSlug],
    queryFn: () => api.artist(selectedSlug),
    enabled: Boolean(selectedSlug)
  });

  const quoteMutation = useMutation({
    mutationFn: () =>
      api.quote(
        artistQuery.data!.id,
        side,
        quantity,
        turnstileToken ?? undefined
      ),
    onSuccess: (nextQuote) => {
      setQuote(nextQuote);
      setNotice('');
    },
    onError: (error) => setNotice(error.message),
    onSettled: () => {
      if (turnstileSiteKey) {
        setTurnstileToken(null);
        setTurnstileReset((current) => current + 1);
      }
    }
  });

  const executeMutation = useMutation({
    mutationFn: () => api.execute(quote!.id),
    onSuccess: async () => {
      setQuote(null);
      setNotice('Operacion registrada correctamente.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['artists'] }),
        queryClient.invalidateQueries({ queryKey: ['artist', selectedSlug] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
        queryClient.invalidateQueries({ queryKey: ['trades'] }),
        queryClient.invalidateQueries({ queryKey: ['ranking'] }),
        queryClient.invalidateQueries({ queryKey: ['season-history'] })
      ]);
    },
    onError: (error) => {
      setQuote(null);
      setNotice(error.message);
    }
  });

  const loginMutation = useMutation({
    mutationFn: loginWithGoogle,
    onSuccess: () => {
      setNotice('Sesion iniciada. Tu portafolio se sincronizara.');
    },
    onError: (error) => setNotice(error.message)
  });

  const consentMutation = useMutation({
    mutationFn: api.acceptConsent,
    onSuccess: (consent) => {
      queryClient.setQueryData(
        ['consent', firebaseUser?.uid ?? 'local'],
        consent
      );
      setNotice('Reglas aceptadas. Ya puedes operar.');
    },
    onError: (error) => setNotice(error.message)
  });

  const favoriteMutation = useMutation({
    mutationFn: ({
      artistId,
      favorite
    }: {
      artistId: string;
      favorite: boolean;
    }) => api.setFavorite(artistId, favorite),
    onSuccess: (artistIds) => {
      queryClient.setQueryData(
        ['favorites', firebaseUser?.uid ?? 'local'],
        artistIds
      );
    },
    onError: (error) => setNotice(error.message)
  });

  const selectedPosition = useMemo(
    () =>
      portfolioQuery.data?.positions.find(
        (position) => position.artistId === artistQuery.data?.id
      ),
    [artistQuery.data?.id, portfolioQuery.data?.positions]
  );

  const artists = artistsQuery.data ?? [];
  const artist = artistQuery.data;
  const portfolio = portfolioQuery.data;
  const currentSeason = rankingQuery.data?.season;
  const myCurrentSeason = seasonHistoryQuery.data?.find(
    (season) => season.seasonId === currentSeason?.id
  );
  const favoriteIds = favoritesQuery.data ?? [];
  const consentAccepted =
    !consentQuery.data?.required || Boolean(consentQuery.data.accepted);
  const consentReady =
    !authReady ||
    (firebaseReady && !firebaseUser) ||
    consentQuery.isSuccess;
  const artistTrades = useMemo(
    () =>
      (tradesQuery.data ?? []).filter(
        (trade) => trade.artistId === artist?.id
      ),
    [artist?.id, tradesQuery.data]
  );
  const visibleArtists = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es');
    const favoriteSet = new Set(favoriteIds);
    const latinCountries = new Set([
      'Argentina',
      'Bolivia',
      'Brasil',
      'Chile',
      'Colombia',
      'Costa Rica',
      'Cuba',
      'Ecuador',
      'El Salvador',
      'Guatemala',
      'Honduras',
      'Mexico',
      'Nicaragua',
      'Panama',
      'Paraguay',
      'Peru',
      'Puerto Rico',
      'Republica Dominicana',
      'Uruguay',
      'Venezuela'
    ]);

    return artists.filter((item) => {
      const matchesSearch =
        !query ||
        [item.name, item.symbol, item.country, item.genre].some((value) =>
          value.toLocaleLowerCase('es').includes(query)
        );
      const matchesFilter =
        artistFilter === 'trending' ||
        (artistFilter === 'favorites' && favoriteSet.has(item.id)) ||
        (artistFilter === 'latin' &&
          (item.genre.toLocaleLowerCase('es').includes('latino') ||
            latinCountries.has(item.country)));
      return matchesSearch && matchesFilter;
    });
  }, [artistFilter, artists, favoriteIds, searchTerm]);

  const toggleFavorite = (artistId: string) => {
    if (!authReady || (firebaseReady && !firebaseUser)) {
      setNotice('Inicia sesion para guardar tus artistas favoritos.');
      return;
    }
    favoriteMutation.mutate({
      artistId,
      favorite: !favoriteIds.includes(artistId)
    });
  };

  const finishOnboarding = () => {
    localStorage.setItem('fame-market:onboarding', 'done');
    setOnboardingOpen(false);
  };

  const selectTab = (tab: 'market' | 'portfolio' | 'ranking') => {
    setMobileTab(tab);
    const path = tab === 'ranking' ? '/ranking' : '/';
    if (window.location.pathname !== path) {
      window.history.replaceState({}, '', path);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark"><Music2 size={21} /></span>
          <span>
            <strong>Fame Market</strong>
            <small>
              {currentSeason
                ? `${currentSeason.name} · ${
                    currentSeason.status === 'active'
                      ? 'en curso'
                      : currentSeason.status === 'frozen'
                        ? 'congelada'
                        : 'finalizada'
                  }`
                : 'Mercado musical'}
            </small>
          </span>
          {appEnvironment === 'staging' && (
            <span className="environment-badge">STAGING</span>
          )}
        </div>
        <label className="search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar artista"
            aria-label="Buscar artista"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <div className="topbar__stats">
          <button
            className="topbar-stat-button"
            onClick={() => selectTab('ranking')}
            title="Abrir ranking"
          >
            <small>Tu ranking</small>
            <strong>
              {myCurrentSeason?.rank ? `#${myCurrentSeason.rank}` : '--'}
            </strong>
          </button>
          <span>
            <small>Disponible</small>
            <strong>
              {firebaseReady && !firebaseUser
                ? 'Inicia sesion'
                : `${money.format(portfolio?.balance ?? 0)} FC`}
            </strong>
          </span>
          {firebaseUser ? (
            <button
              className="avatar"
              title="Cerrar sesion"
              onClick={() => logout()}
            >
              {firebaseUser.displayName?.slice(0, 1).toUpperCase() || 'U'}
            </button>
          ) : (
            <button
              className="login-button"
              onClick={() => loginMutation.mutate()}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Abriendo...' : 'Entrar'}
            </button>
          )}
        </div>
      </header>

      {onboardingOpen && (
        <div className="onboarding-backdrop" role="presentation">
          <section
            className="onboarding"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <button
              className="onboarding__close"
              onClick={finishOnboarding}
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X size={19} />
            </button>
            <span className="onboarding__eyebrow">Tu primera jugada</span>
            <h2 id="onboarding-title">Empieza con 10.000 FameCoins</h2>
            <ol>
              <li><strong>1</strong><span>Elige un artista.</span></li>
              <li><strong>2</strong><span>Revisa su tendencia y videos oficiales.</span></li>
              <li><strong>3</strong><span>Cotiza y confirma tu primera compra.</span></li>
            </ol>
            <button className="onboarding__action" onClick={finishOnboarding}>
              Explorar mercado
            </button>
          </section>
        </div>
      )}

      {consentQuery.data?.required && !consentQuery.data.accepted && (
        <ConsentModal
          consent={consentQuery.data}
          pending={consentMutation.isPending}
          onAccept={() => consentMutation.mutate()}
        />
      )}

      {mobileTab === 'ranking' ? (
        <RankingPanel
          season={rankingQuery.data?.season ?? null}
          rankings={rankingQuery.data?.rankings ?? []}
          history={seasonHistoryQuery.data ?? []}
          signedIn={Boolean(firebaseUser) || !firebaseReady}
          loading={rankingQuery.isLoading}
          onBack={() => selectTab('market')}
        />
      ) : (
      <main className={`workspace workspace--${mobileTab}`}>
        <aside className="market-list">
          <div className="section-heading">
            <div>
              <small>Mercado musical</small>
              <h1>Artistas</h1>
            </div>
            <span
              className={`live-label ${
                currentSeason?.status === 'active'
                  ? ''
                  : 'live-label--closed'
              }`}
            >
              <i />
              {currentSeason?.status === 'active'
                ? 'Abierto'
                : currentSeason?.status === 'frozen'
                  ? 'Congelado'
                  : 'Cerrado'}
            </span>
          </div>
          <label className="search market-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Buscar artista"
              aria-label="Buscar artista en el mercado"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <div className="filter-tabs" role="tablist">
            <button
              className={artistFilter === 'trending' ? 'is-active' : ''}
              onClick={() => setArtistFilter('trending')}
              aria-selected={artistFilter === 'trending'}
              role="tab"
            >
              Tendencia
            </button>
            <button
              className={artistFilter === 'latin' ? 'is-active' : ''}
              onClick={() => setArtistFilter('latin')}
              aria-selected={artistFilter === 'latin'}
              role="tab"
            >
              Latinos
            </button>
            <button
              className={artistFilter === 'favorites' ? 'is-active' : ''}
              onClick={() => setArtistFilter('favorites')}
              aria-selected={artistFilter === 'favorites'}
              role="tab"
            >
              Favoritos
            </button>
          </div>
          <div className="artist-list">
            {visibleArtists.map((item) => (
              <ArtistRow
                key={item.id}
                artist={item}
                active={item.slug === selectedSlug}
                favorite={favoriteIds.includes(item.id)}
                onSelect={() => {
                  setSelectedSlug(item.slug);
                  setQuote(null);
                  selectTab('market');
                }}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            ))}
            {!visibleArtists.length && (
              <p className="artist-list__empty">
                {artistFilter === 'favorites'
                  ? 'Aun no guardaste artistas favoritos.'
                  : 'No encontramos artistas con esa busqueda.'}
              </p>
            )}
          </div>
          <p className="disclaimer">
            Precios y monedas ficticios. Este es un juego de popularidad, no una
            inversion. <a href="/reglas">Reglas</a> ·{' '}
            <a href="/privacidad">Privacidad</a>
          </p>
        </aside>

        <section className="artist-detail">
          {artist ? (
            <>
              <div className="artist-hero">
                <img src={artist.imageUrl} alt={artist.name} />
                <div>
                  <span className="symbol">{artist.symbol}</span>
                  <h2>{artist.name}</h2>
                  <p>{artist.genre} · {artist.country} · {compact.format(artist.holders)} jugadores</p>
                </div>
                <div className="hero-price">
                  <small>Precio ficticio</small>
                  <strong>{money.format(artist.currentPrice)} FC</strong>
                  <Movement value={artist.changePercent} />
                </div>
              </div>

              <div className="chart-toolbar">
                <div className="time-ranges">
                  <button>1H</button>
                  <button>24H</button>
                  <button className="is-active">7D</button>
                  <button>Temporada</button>
                </div>
                <span><Clock3 size={15} /> Actualizacion en vivo</span>
              </div>
              <PriceChart
                data={artist.history}
                positive={artist.changePercent >= 0}
                trades={artistTrades}
              />

              <section className="youtube-strip">
                <div className="section-heading section-heading--compact">
                  <div>
                    <small>Senales para tu decision</small>
                    <h3>Ultimos videos oficiales</h3>
                  </div>
                  <span>Datos publicos de YouTube</span>
                </div>
                {artist.videos.map((video) => (
                  <a
                    className="video-row"
                    href={video.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={video.id}
                  >
                    <span className="video-thumb">
                      <img src={video.thumbnailUrl} alt="" />
                      <Play size={18} fill="currentColor" />
                    </span>
                    <span className="video-copy">
                      <strong>{video.title}</strong>
                      <small>
                        {compact.format(video.viewCount)} vistas · {compact.format(video.likeCount)} likes ·{' '}
                        {compact.format(video.commentCount)} comentarios
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </a>
                ))}
              </section>
            </>
          ) : (
            <div className="loading-state">Cargando mercado...</div>
          )}
        </section>

        <aside className="trade-column">
          <section className="order-ticket">
            <div className="section-heading section-heading--compact">
              <div>
                <small>Operacion</small>
                <h3>{artist?.symbol ?? 'Artista'}</h3>
              </div>
              {selectedPosition && <span>{selectedPosition.quantity} tuyas</span>}
            </div>
            <div className="segmented">
              <button
                className={side === 'buy' ? 'is-active' : ''}
                onClick={() => { setSide('buy'); setQuote(null); }}
              >
                Comprar
              </button>
              <button
                className={side === 'sell' ? 'is-active is-sell' : ''}
                onClick={() => { setSide('sell'); setQuote(null); }}
              >
                Vender
              </button>
            </div>
            <label className="quantity-input">
              <span>Cantidad</span>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(event) => {
                  setQuantity(Math.max(1, Number(event.target.value)));
                  setQuote(null);
                }}
              />
              <small>participaciones</small>
            </label>
            {turnstileSiteKey &&
              !quote &&
              (!firebaseReady || Boolean(firebaseUser)) &&
              consentAccepted &&
              currentSeason?.status === 'active' && (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  resetSignal={turnstileReset}
                  onToken={setTurnstileToken}
                  onError={() =>
                    setNotice(
                      'No se pudo cargar la verificacion de seguridad.'
                    )
                  }
                />
              )}
            {quote ? (
              <div className="quote">
                <dl>
                  <div><dt>Precio promedio</dt><dd>{money.format(quote.averagePrice)} FC</dd></div>
                  <div><dt>Comision ficticia</dt><dd>{money.format(quote.fee)} FC</dd></div>
                  <div className="quote__total">
                    <dt>{side === 'buy' ? 'Total' : 'Recibes'}</dt>
                    <dd>{money.format(quote.netAmount)} FC</dd>
                  </div>
                </dl>
                <button
                  className={`primary-action ${side === 'sell' ? 'primary-action--sell' : ''}`}
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                >
                  {executeMutation.isPending ? 'Registrando...' : `Confirmar ${side === 'buy' ? 'compra' : 'venta'}`}
                </button>
                <small className="quote__expiry">La cotizacion vence en 15 segundos.</small>
              </div>
            ) : (
              <button
                className={`primary-action ${side === 'sell' ? 'primary-action--sell' : ''}`}
                onClick={() => quoteMutation.mutate()}
                disabled={
                  !artist ||
                  quoteMutation.isPending ||
                  (firebaseReady && !firebaseUser) ||
                  !consentReady ||
                  !consentAccepted ||
                  currentSeason?.status !== 'active' ||
                  (Boolean(turnstileSiteKey) && !turnstileToken)
                }
              >
                {currentSeason?.status !== 'active'
                  ? 'Mercado temporalmente cerrado'
                  : firebaseReady && !firebaseUser
                  ? 'Inicia sesion para operar'
                  : !consentReady
                    ? 'Cargando acceso...'
                    : !consentAccepted
                      ? 'Acepta las reglas para operar'
                  : quoteMutation.isPending
                    ? 'Calculando...'
                    : turnstileSiteKey && !turnstileToken
                      ? 'Verificando seguridad...'
                    : `Revisar ${side === 'buy' ? 'compra' : 'venta'}`}
              </button>
            )}
            {notice && <p className="notice">{notice}</p>}
          </section>

          <section className="portfolio-summary">
            <div className="section-heading section-heading--compact">
              <div>
                <small>Tu temporada</small>
                <h3>Portafolio</h3>
              </div>
              <BriefcaseBusiness size={19} />
            </div>
            <strong className="portfolio-value">{money.format(portfolio?.portfolioValue ?? 0)} FC</strong>
            <Movement value={portfolio?.returnPercent ?? 0} />
            <dl className="portfolio-metrics">
              <div><dt>Disponible</dt><dd>{money.format(portfolio?.balance ?? 0)}</dd></div>
              <div><dt>En artistas</dt><dd>{money.format(portfolio?.investedValue ?? 0)}</dd></div>
            </dl>
            <div className="positions">
              {portfolio?.positions.length ? (
                portfolio.positions.map((position) => (
                  <div className="position-row" key={position.artistId}>
                    <img src={position.artist.imageUrl} alt="" />
                    <span>
                      <strong>{position.artist.symbol}</strong>
                      <small>{position.quantity} · entrada {money.format(position.averageCost)}</small>
                    </span>
                    <strong className={position.unrealizedPnl >= 0 ? 'profit' : 'loss'}>
                      {position.unrealizedPnl >= 0 ? '+' : ''}{money.format(position.unrealizedPnl)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="empty-copy">Tu primera posicion aparecera aqui.</p>
              )}
            </div>
          </section>
        </aside>
      </main>
      )}

      <nav className="mobile-nav" aria-label="Navegacion principal">
        <button className={mobileTab === 'market' ? 'is-active' : ''} onClick={() => selectTab('market')}>
          <BarChart3 size={20} /> Mercado
        </button>
        <button className={mobileTab === 'portfolio' ? 'is-active' : ''} onClick={() => selectTab('portfolio')}>
          <WalletCards size={20} /> Portafolio
        </button>
        <button
          className={mobileTab === 'ranking' ? 'is-active' : ''}
          onClick={() => selectTab('ranking')}
        >
          <Trophy size={20} /> Ranking
        </button>
      </nav>
    </div>
  );
}

export default App;
