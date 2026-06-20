import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  Music2,
  Play,
  Search,
  Star,
  Trophy,
  WalletCards,
  X
} from 'lucide-react';
import { api, ApiError, setTokenProvider } from './api';
import {
  currentIdToken,
  firebaseReady,
  loginWithGoogle,
  logout,
  subscribeToAuth
} from './auth';
import { ConsentModal } from './ConsentModal';
import { ChatPanel } from './ChatPanel';
import { EntityAvatar } from './EntityAvatar';
import { NewsPulse } from './NewsPulse';
import { PriceChart } from './PriceChart';
import { RankingPanel } from './RankingPanel';
import { TurnstileWidget } from './TurnstileWidget';
import type {
  ArtistSummary,
  CategoryOverview,
  EntityCategory,
  Quote,
  VolatilityProfile
} from './types';

type ArtistFilter = 'trending' | 'favorites' | `category:${EntityCategory}`;

const money = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const compact = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1
});
const storedInterestsKey = 'fame-plays:interests';
const turnstilePassKey = 'fame-plays:turnstile-pass';

interface TurnstilePassState {
  value: string;
  expiresAt: string;
  userId: string;
}

function readStoredTurnstilePass(): TurnstilePassState | null {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(turnstilePassKey) ?? 'null'
    ) as TurnstilePassState | null;
    if (
      !parsed?.value ||
      !parsed.expiresAt ||
      !parsed.userId ||
      Date.parse(parsed.expiresAt) <= Date.now()
    ) {
      try {
        sessionStorage.removeItem(turnstilePassKey);
      } catch {
        // Storage can be unavailable in restricted embedded browsers.
      }
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(turnstilePassKey);
    } catch {
      // The in-memory flow remains available without session storage.
    }
    return null;
  }
}

function readStoredInterests(): EntityCategory[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storedInterestsKey) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function categoryLabel(
  categoryId: EntityCategory,
  categories: CategoryOverview[]
) {
  return categories.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function volatilityLabel(profile: VolatilityProfile) {
  const labels: Record<VolatilityProfile, string> = {
    stable: 'Estable',
    balanced: 'Balanceado',
    volatile: 'Volatil',
    underdog: 'Underdog'
  };
  return labels[profile];
}

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
        <EntityAvatar
          name={artist.name}
          symbol={artist.symbol}
          imageUrl={artist.imageUrl}
          imageUsageStatus={artist.imageUsageStatus}
          imageAttribution={artist.imageAttribution}
        />
        <span className="artist-row__identity">
          <strong>{artist.name}</strong>
          <em>{volatilityLabel(artist.volatilityProfile)} / riesgo {artist.riskLevel}</em>
          <small>{artist.symbol} · {artist.profession || artist.country}</small>
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
  const categoriesQuery = useQuery({
    queryKey: ['market-categories'],
    queryFn: api.marketCategories
  });
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
  const [selectedInterests, setSelectedInterests] =
    useState<EntityCategory[]>(readStoredInterests);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstilePass, setTurnstilePass] =
    useState<TurnstilePassState | null>(readStoredTurnstilePass);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
  const appEnvironment = import.meta.env.VITE_APP_ENV ?? 'development';
  const turnstileUserId = firebaseUser?.uid ?? (!firebaseReady ? 'local-demo' : '');
  const activeTurnstilePass =
    turnstilePass?.userId === turnstileUserId &&
    Date.parse(turnstilePass.expiresAt) > Date.now()
      ? turnstilePass.value
      : undefined;
  const turnstileAccessReady =
    !turnstileSiteKey || Boolean(activeTurnstilePass || turnstileToken);

  function clearTurnstilePass() {
    setTurnstilePass(null);
    try {
      sessionStorage.removeItem(turnstilePassKey);
    } catch {
      // Some embedded browsers restrict session storage.
    }
  }

  function saveTurnstilePass(value: string, expiresAt: string) {
    if (!turnstileUserId) return;
    const nextPass = { value, expiresAt, userId: turnstileUserId };
    setTurnstilePass(nextPass);
    try {
      sessionStorage.setItem(turnstilePassKey, JSON.stringify(nextPass));
    } catch {
      // The in-memory pass still avoids repeated challenges on this page.
    }
  }

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

  useEffect(() => {
    if (!authReady || !turnstilePass) return;
    if (turnstilePass.userId !== turnstileUserId) {
      clearTurnstilePass();
      return;
    }
    const remainingMs = Date.parse(turnstilePass.expiresAt) - Date.now();
    if (remainingMs <= 0) {
      clearTurnstilePass();
      return;
    }
    const timer = window.setTimeout(clearTurnstilePass, remainingMs);
    return () => window.clearTimeout(timer);
  }, [authReady, turnstilePass, turnstileUserId]);

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

  const interestsQuery = useQuery({
    queryKey: ['interests', firebaseUser?.uid ?? 'local'],
    queryFn: api.interests,
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
      localStorage.getItem('fame-plays:onboarding') !== 'done'
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
  const attentionQuery = useQuery({
    queryKey: ['artist-attention', selectedSlug],
    queryFn: () => api.artistAttention(selectedSlug),
    enabled: Boolean(selectedSlug)
  });
  const sourcesQuery = useQuery({
    queryKey: ['entity-sources', selectedSlug],
    queryFn: () => api.entitySources(selectedSlug),
    enabled: Boolean(selectedSlug)
  });
  const externalEventsQuery = useQuery({
    queryKey: ['external-events', selectedSlug],
    queryFn: () => api.externalEvents(selectedSlug),
    enabled: Boolean(selectedSlug)
  });

  const quoteMutation = useMutation({
    mutationFn: () =>
      api.quote(
        artistQuery.data!.id,
        side,
        quantity,
        turnstileToken ?? undefined,
        activeTurnstilePass
      ),
    onSuccess: (result) => {
      setQuote(result.quote);
      if (result.turnstilePass && result.turnstilePassExpiresAt) {
        saveTurnstilePass(
          result.turnstilePass,
          result.turnstilePassExpiresAt
        );
      }
      setTurnstileToken(null);
      setNotice('');
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        ['TURNSTILE_REQUIRED', 'TURNSTILE_REJECTED'].includes(error.code)
      ) {
        clearTurnstilePass();
      }
      if (turnstileSiteKey && turnstileToken) {
        setTurnstileToken(null);
        setTurnstileReset((current) => current + 1);
      }
      setNotice(error.message);
    }
  });
  const newsQuery = useQuery({
    queryKey: ['news-pulse', selectedSlug],
    queryFn: () => api.newsPulse(selectedSlug),
    enabled: Boolean(selectedSlug),
    refetchInterval: 5 * 60 * 1000
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

  const interestsMutation = useMutation({
    mutationFn: api.setInterests,
    onSuccess: (categories) => {
      setSelectedInterests(categories);
      localStorage.setItem(storedInterestsKey, JSON.stringify(categories));
      queryClient.setQueryData(
        ['interests', firebaseUser?.uid ?? 'local'],
        categories
      );
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
  const categories = categoriesQuery.data ?? [];
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
  useEffect(() => {
    if (interestsQuery.isSuccess) {
      setSelectedInterests(interestsQuery.data);
      localStorage.setItem(
        storedInterestsKey,
        JSON.stringify(interestsQuery.data)
      );
    }
  }, [interestsQuery.data, interestsQuery.isSuccess]);

  const visibleArtists = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es');
    const favoriteSet = new Set(favoriteIds);
    const selectedCategory =
      artistFilter.startsWith('category:')
        ? artistFilter.replace('category:', '') as EntityCategory
        : null;
    const interestSet = new Set(selectedInterests);

    return artists.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.name,
          item.symbol,
          item.country,
          item.genre,
          item.category,
          item.subcategory,
          item.profession,
          item.volatilityProfile,
          item.strategyNotes,
          ...item.themeTags
        ].some((value) => value.toLocaleLowerCase('es').includes(query));
      const matchesFilter =
        artistFilter === 'trending' ||
        (artistFilter === 'favorites' && favoriteSet.has(item.id)) ||
        (selectedCategory !== null && item.category === selectedCategory);
      return matchesSearch && matchesFilter;
    }).sort((left, right) => {
      const leftInterest = interestSet.has(left.category) ? 1 : 0;
      const rightInterest = interestSet.has(right.category) ? 1 : 0;
      if (leftInterest !== rightInterest) return rightInterest - leftInterest;
      return right.currentPrice - left.currentPrice;
    });
  }, [artistFilter, artists, favoriteIds, searchTerm, selectedInterests]);

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

  const toggleInterest = (categoryId: EntityCategory) => {
    const next = selectedInterests.includes(categoryId)
      ? selectedInterests.filter((item) => item !== categoryId)
      : [...selectedInterests, categoryId];
    setSelectedInterests(next);
    localStorage.setItem(storedInterestsKey, JSON.stringify(next));
    if (!authReady || (firebaseReady && !firebaseUser)) return;
    interestsMutation.mutate(next);
  };

  const finishOnboarding = () => {
    localStorage.setItem('fame-plays:onboarding', 'done');
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
            <strong>Fame Plays</strong>
            <small>
              {currentSeason
                ? `${currentSeason.name} · ${
                    currentSeason.status === 'active'
                      ? 'en curso'
                      : currentSeason.status === 'frozen'
                        ? 'congelada'
                        : 'finalizada'
                  }`
                : 'Mercado de atencion'}
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
            placeholder="Buscar figura"
            aria-label="Buscar figura"
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
              <li><strong>1</strong><span>Elige una figura.</span></li>
              <li><strong>2</strong><span>Revisa su tendencia y contenido reciente.</span></li>
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
              <small>Mercado de atencion</small>
              <h1>Figuras</h1>
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
              placeholder="Buscar figura"
              aria-label="Buscar figura en el mercado"
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
            {categories.map((category) => (
              <button
                key={category.id}
                className={
                  artistFilter === `category:${category.id}` ? 'is-active' : ''
                }
                onClick={() => setArtistFilter(`category:${category.id}`)}
                aria-selected={artistFilter === `category:${category.id}`}
                role="tab"
              >
                {category.label}
                <span>{category.count}</span>
              </button>
            ))}
            <button
              className={artistFilter === 'favorites' ? 'is-active' : ''}
              onClick={() => setArtistFilter('favorites')}
              aria-selected={artistFilter === 'favorites'}
              role="tab"
            >
              Favoritos
            </button>
          </div>
          <div className="interest-chips" aria-label="Intereses personales">
            <small>Intereses</small>
            {categories.map((category) => (
              <button
                key={category.id}
                className={
                  selectedInterests.includes(category.id) ? 'is-active' : ''
                }
                onClick={() => toggleInterest(category.id)}
                type="button"
              >
                {category.label}
              </button>
            ))}
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
                  ? 'Aun no guardaste figuras favoritas.'
                  : 'No encontramos figuras con esa busqueda.'}
              </p>
            )}
          </div>
          <p className="disclaimer">
            Precios y monedas ficticios. Este es un juego de popularidad, no una
            inversion. <a href="/reglas">Reglas</a> ·{' '}
            <a href="/privacidad">Privacidad</a> ·{' '}
            <a href="/metodologia">Metodologia</a>
            {' | '}<a href="/derechos">Derechos</a>
          </p>
        </aside>

        <section className="artist-detail">
          {artist ? (
            <>
              <div className="artist-hero">
                <EntityAvatar
                  name={artist.name}
                  symbol={artist.symbol}
                  imageUrl={artist.imageUrl}
                  imageUsageStatus={artist.imageUsageStatus}
                  imageAttribution={artist.imageAttribution}
                  size="large"
                />
                <div>
                  <span className="symbol">{artist.symbol}</span>
                  <h2>{artist.name}</h2>
                  <p>
                    {artist.profession || artist.genre} ·{' '}
                    {categoryLabel(artist.category, categories)} ·{' '}
                    {artist.country} · {compact.format(artist.holders)} jugadores
                  </p>
                  <div className="strategy-tags">
                    <span className={`strategy-tag strategy-tag--${artist.volatilityProfile}`}>
                      {volatilityLabel(artist.volatilityProfile)}
                    </span>
                    <span>Riesgo {artist.riskLevel}/5</span>
                  </div>
                </div>
                <div className="hero-price">
                  <small>Precio ficticio</small>
                  <strong>{money.format(artist.currentPrice)} FC</strong>
                  <Movement value={artist.changePercent} />
                </div>
              </div>

              <PriceChart
                data={artist.history}
                positive={artist.changePercent >= 0}
                trades={artistTrades}
              />

              {artist.strategyNotes && (
                <section className="strategy-note">
                  <BriefcaseBusiness size={18} />
                  <div>
                    <small>Lectura estrategica</small>
                    <p>{artist.strategyNotes}</p>
                  </div>
                </section>
              )}

              {attentionQuery.data?.[0]?.signal && (
                <section className="attention-public">
                  <div>
                    <small>Indice independiente de Fame Plays</small>
                    <strong>Observacion de atencion en modo sombra</strong>
                    <p>
                      Wikimedia propone{' '}
                      {attentionQuery.data[0].signal.proposedDeltaBps > 0
                        ? '+'
                        : ''}
                      {(
                        attentionQuery.data[0].signal.proposedDeltaBps / 100
                      ).toFixed(2)}
                      %. Este resultado no modifica el precio durante la
                      evaluacion.
                    </p>
                  </div>
                  <a href="/metodologia">Ver metodologia</a>
                </section>
              )}

              <NewsPulse data={newsQuery.data} loading={newsQuery.isLoading} />

              {Boolean(sourcesQuery.data?.length) && (
                <section className="source-strip">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <small>Transparencia</small>
                      <h3>Fuentes verificadas</h3>
                    </div>
                    <span>No implican afiliacion oficial</span>
                  </div>
                  <div className="source-list">
                    {sourcesQuery.data!.map((source) => (
                      <a
                        className="source-row"
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        key={source.id}
                      >
                        <span>
                          <strong>{source.displayName}</strong>
                          <small>
                            {source.provider} / {source.sourceType} /{' '}
                            {source.usageMode === 'display_only'
                              ? 'solo referencia'
                              : source.usageMode}
                          </small>
                        </span>
                        <b
                          className={
                            source.lastError ? 'is-warning' : 'is-healthy'
                          }
                        >
                          {source.lastError
                            ? 'revisar'
                            : source.lastSyncedAt
                              ? 'activa'
                              : 'pendiente'}
                        </b>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {Boolean(externalEventsQuery.data?.length) && (
                <section className="external-event-strip">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <small>Contexto externo</small>
                      <h3>Eventos revisados</h3>
                    </div>
                    <span>No aplican precio automatico</span>
                  </div>
                  <div className="external-event-list">
                    {externalEventsQuery.data!.map((event) => (
                      <article
                        className={`external-event external-event--${event.impactDirection}`}
                        key={event.id}
                      >
                        <span>
                          <strong>{event.title}</strong>
                          <small>
                            {new Date(event.occurredAt).toLocaleDateString(
                              'es-CO'
                            )}{' '}
                            / {event.eventType} / propuesta{' '}
                            {(event.proposedDeltaBps / 100).toFixed(2)}%
                          </small>
                        </span>
                        {event.sourceUrl && (
                          <a href={event.sourceUrl} target="_blank" rel="noreferrer">
                            Fuente
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="youtube-strip">
                <div className="section-heading section-heading--compact">
                  <div>
                    <small>Senales para tu decision</small>
                    <h3>Contenido reciente</h3>
                  </div>
                  <span>Fuentes publicas; no afectan el precio</span>
                </div>
                {(artist.contentItems ?? artist.videos.map((video) => ({
                  ...video,
                  provider: 'youtube',
                  contentType: 'video',
                  sourceUrl: video.youtubeUrl
                }))).map((item) => {
                  const video = item;
                  return (
                  <a
                    className="video-row"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={item.id}
                  >
                    <span className="video-thumb">
                      <img src={item.thumbnailUrl} alt="" />
                      <Play size={18} fill="currentColor" />
                    </span>
                    <span className="video-copy">
                      <strong>{item.title}</strong>
                      <small>
                        {compact.format(video.viewCount)} vistas · {compact.format(video.likeCount)} likes ·{' '}
                        {compact.format(video.commentCount)} comentarios
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </a>
                  );
                })}
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
                <h3>{artist?.symbol ?? 'Figura'}</h3>
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
              !activeTurnstilePass &&
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
                  !turnstileAccessReady
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
                    : !turnstileAccessReady
                      ? 'Verificando seguridad...'
                    : `Revisar ${side === 'buy' ? 'compra' : 'venta'}`}
              </button>
            )}
            {notice && <p className="notice">{notice}</p>}
          </section>

          <ChatPanel
            roomId={selectedSlug ? `entity:${selectedSlug}` : 'general'}
            roomLabel={artist?.symbol ?? 'General'}
            userId={firebaseUser?.uid}
            displayName={firebaseUser?.displayName}
          />

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
              <div><dt>En figuras</dt><dd>{money.format(portfolio?.investedValue ?? 0)}</dd></div>
            </dl>
            <div className="positions">
              {portfolio?.positions.length ? (
                portfolio.positions.map((position) => (
                  <div className="position-row" key={position.artistId}>
                    <EntityAvatar
                      name={position.artist.name}
                      symbol={position.artist.symbol}
                      imageUrl={position.artist.imageUrl}
                      imageUsageStatus={position.artist.imageUsageStatus}
                      imageAttribution={position.artist.imageAttribution}
                      size="small"
                    />
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

      <footer className="rights-notice">
        <strong>Simulador independiente.</strong>{' '}
        Los nombres identifican figuras publicas con fines informativos. Fame
        Market no esta afiliado, patrocinado ni aprobado por ellas o sus marcas.{' '}
        <a href="/derechos">Derechos y correcciones</a>
      </footer>

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
