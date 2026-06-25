import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Activity,
  Ban,
  CalendarSync,
  CheckCircle2,
  CirclePlay,
  Database,
  FileCheck2,
  Flag,
  HardDrive,
  Inbox,
  LockKeyhole,
  MessageCircle,
  Newspaper,
  Radar,
  RefreshCw,
  Save,
  Snowflake,
  Trophy,
  Trash2,
  Volume2,
  Youtube
} from 'lucide-react';
import { api, setTokenProvider } from './api';
import {
  currentIdToken,
  firebaseReady,
  loginWithGoogle,
  logout,
  subscribeToAuth
} from './auth';
import { EntityAvatar } from './EntityAvatar';
import type {
  ArtistRightsRecord,
  RightsRequestStatus
} from './types';

function ageLabel(seconds: number | null) {
  if (seconds === null) return 'Sin ejecuciones';
  if (seconds < 60) return 'Hace menos de 1 min';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86_400)} d`;
}

function bytesLabel(bytes: number) {
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function AdminPanel() {
  const allowedAdminEmails = (
    import.meta.env.VITE_ADMIN_EMAILS || 'sebas7240@gmail.com'
  )
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [adminSecret, setAdminSecret] = useState(
    () => sessionStorage.getItem('fame-plays-admin-secret') ?? ''
  );
  const adminEmailAllowed =
    !firebaseReady ||
    Boolean(
      firebaseUser?.email &&
        allowedAdminEmails.includes(firebaseUser.email.toLowerCase())
    );
  const canQueryAdmin = Boolean(adminSecret && adminEmailAllowed && authReady);
  const artistsQuery = useQuery({ queryKey: ['artists'], queryFn: api.artists });
  const seasonQuery = useQuery({ queryKey: ['ranking'], queryFn: api.ranking });
  const [handles, setHandles] = useState<Record<string, string>>({
    '10000000-0000-4000-8000-000000000001': '@KarolG',
    '10000000-0000-4000-8000-000000000002': '@BadBunnyPR',
    '10000000-0000-4000-8000-000000000003': '@Shakira'
  });
  const [message, setMessage] = useState('');
  const [busyArtist, setBusyArtist] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [rightsDrafts, setRightsDrafts] = useState<
    Record<string, ArtistRightsRecord>
  >({});
  const [rightsRequestNotes, setRightsRequestNotes] = useState<
    Record<string, string>
  >({});
  const [chatRoom, setChatRoom] = useState('general');
  const [chatReason, setChatReason] = useState('Moderacion manual');
  const [seasonDraft, setSeasonDraft] = useState({
    name: '',
    startsAt: '',
    endsAt: '',
    tradingClosesAt: '',
    participationDays: '7',
    freezeMinutes: '30',
    startingBalance: '10000'
  });
  const securityQuery = useQuery({
    queryKey: ['security-reviews', adminSecret],
    queryFn: () => api.securityReviews(adminSecret),
    enabled: canQueryAdmin,
    retry: false
  });
  const operationsQuery = useQuery({
    queryKey: ['operations', adminSecret],
    queryFn: () => api.operations(adminSecret),
    enabled: canQueryAdmin,
    retry: false,
    refetchInterval: 30_000
  });
  const attentionQuery = useQuery({
    queryKey: ['attention-overview', adminSecret],
    queryFn: () => api.attentionOverview(adminSecret),
    enabled: canQueryAdmin,
    retry: false
  });
  const artistRightsQuery = useQuery({
    queryKey: ['artist-rights', adminSecret],
    queryFn: () => api.artistRights(adminSecret),
    enabled: canQueryAdmin,
    retry: false
  });
  const rightsRequestsQuery = useQuery({
    queryKey: ['rights-requests', adminSecret],
    queryFn: () => api.rightsRequests(adminSecret),
    enabled: canQueryAdmin,
    retry: false
  });
  const chatModerationQuery = useQuery({
    queryKey: ['chat-moderation', adminSecret, chatRoom],
    queryFn: () => api.chatModeration(adminSecret, chatRoom),
    enabled: Boolean(canQueryAdmin && chatRoom),
    retry: false,
    refetchInterval: 15_000
  });
  const prizeProfilesQuery = useQuery({
    queryKey: ['prize-profiles', adminSecret],
    queryFn: () => api.prizeProfiles(adminSecret),
    enabled: canQueryAdmin,
    retry: false
  });
  const seasonStatus =
    seasonQuery.data?.season?.status === 'active'
      ? 'activa'
      : seasonQuery.data?.season?.status === 'frozen'
        ? 'congelada'
        : seasonQuery.data?.season?.status === 'closed'
          ? 'cerrada'
          : seasonQuery.data?.season?.status === 'scheduled'
            ? 'programada'
            : 'ninguna';
  useEffect(() => {
    setTokenProvider(currentIdToken);
    const unsubscribe = subscribeToAuth((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const openAdminLogin = async () => {
    setLoginPending(true);
    setMessage('');
    try {
      await loginWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesion.');
    } finally {
      setLoginPending(false);
    }
  };

  const rememberSecret = (value: string) => {
    setAdminSecret(value);
    sessionStorage.setItem('fame-plays-admin-secret', value);
  };

  const register = async (artistId: string) => {
    const handle = handles[artistId]?.trim();
    if (!handle) {
      setMessage('Escribe el @handle oficial del artista.');
      return;
    }
    setBusyArtist(artistId);
    setMessage('');
    try {
      await api.registerYouTubeChannel(adminSecret, artistId, handle);
      const result = await api.syncYouTube(adminSecret, artistId);
      const videos = result.results.reduce(
        (sum, item) => sum + (item.videos ?? 0),
        0
      );
      setMessage(`Canal registrado. ${videos} videos sincronizados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo registrar.');
    } finally {
      setBusyArtist('');
    }
  };

  const syncAll = async () => {
    setBusyArtist('all');
    setMessage('');
    try {
      const result = await api.syncYouTube(adminSecret);
      const successful = result.results.filter((item) => item.ok).length;
      const videos = result.results.reduce(
        (sum, item) => sum + (item.videos ?? 0),
        0
      );
      setMessage(`${successful} canales actualizados y ${videos} videos revisados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar.');
    } finally {
      setBusyArtist('');
    }
  };

  const syncAttention = async () => {
    setBusyArtist('attention');
    setMessage('');
    try {
      const result = await api.syncAttention(adminSecret);
      const successful = result.results.filter((item) => item.ok).length;
      setMessage(
        `${successful} fuentes de atencion actualizadas en modo sombra.`
      );
      await attentionQuery.refetch();
      await operationsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el indice de atencion.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const syncNews = async () => {
    setBusyArtist('news');
    setMessage('');
    try {
      const result = await api.syncNews(adminSecret);
      const successful = result.results.filter((item) => item.ok).length;
      const stored = result.results.reduce(
        (sum, item) => sum + Number(item.stored ?? 0),
        0
      );
      setMessage(
        `${successful} figuras revisadas y ${stored} titulares guardados en modo ${result.mode}.`
      );
      await operationsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el pulso de noticias.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const runMarketMaker = async () => {
    setBusyArtist('market-maker');
    setMessage('');
    try {
      const result = await api.runMarketMaker(adminSecret);
      const applied = result.results.filter((item) => item.status === 'applied');
      const totalDelta = applied.reduce(
        (sum, item) => sum + Number(item.appliedDeltaBps ?? 0),
        0
      );
      setMessage(
        `Mercado Vivo aplicado en ${applied.length}/${result.results.length} figuras. Movimiento neto: ${(totalDelta / 100).toFixed(2)}%.`
      );
      await operationsQuery.refetch();
      await artistsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo ejecutar el Mercado Vivo.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const runSeasonAction = async (
    action: 'freeze' | 'close' | 'cycle'
  ) => {
    const season = seasonQuery.data?.season;
    if (!season && action !== 'cycle') {
      setMessage('No hay una temporada disponible.');
      return;
    }
    setBusyArtist(`season-${action}`);
    setMessage('');
    try {
      if (action === 'cycle') {
        const result = await api.processSeasonCycle(adminSecret);
        setMessage(
          result.actions.length
            ? `Ciclo procesado: ${result.actions.join(', ')}.`
            : 'La temporada ya estaba al dia.'
        );
      } else {
        await api.adminSeasonAction(adminSecret, season!.id, action);
        setMessage(
          action === 'freeze'
            ? 'Temporada congelada. Ya no acepta operaciones.'
            : 'Temporada cerrada y ranking final guardado.'
        );
      }
      await seasonQuery.refetch();
      await securityQuery.refetch();
      await operationsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo procesar la temporada.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const createManualSeason = async () => {
    setBusyArtist('season-create');
    setMessage('');
    try {
      const result = await api.createSeason(adminSecret, {
        name: seasonDraft.name || undefined,
        startsAt: seasonDraft.startsAt
          ? new Date(seasonDraft.startsAt).toISOString()
          : undefined,
        endsAt: seasonDraft.endsAt
          ? new Date(seasonDraft.endsAt).toISOString()
          : undefined,
        tradingClosesAt: seasonDraft.tradingClosesAt
          ? new Date(seasonDraft.tradingClosesAt).toISOString()
          : undefined,
        participationDays: seasonDraft.participationDays
          ? Number(seasonDraft.participationDays)
          : undefined,
        freezeMinutes: seasonDraft.freezeMinutes
          ? Number(seasonDraft.freezeMinutes)
          : undefined,
        startingBalance: seasonDraft.startingBalance
          ? Number(seasonDraft.startingBalance)
          : undefined
      });
      setMessage(`Temporada creada: ${result.season.name}.`);
      await seasonQuery.refetch();
      await operationsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo crear la temporada.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const processReview = async (
    seasonId: string,
    userId: string,
    status: 'approved' | 'flagged'
  ) => {
    const key = `${seasonId}:${userId}`;
    setBusyArtist(`review-${key}`);
    setMessage('');
    try {
      await api.reviewRanking(
        adminSecret,
        seasonId,
        userId,
        status,
        reviewNotes[key] ?? ''
      );
      setMessage(
        status === 'approved'
          ? 'Resultado aprobado y alertas resueltas.'
          : 'Resultado marcado para investigacion.'
      );
      await securityQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo revisar.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const toggleUser = async (userId: string, frozen: boolean) => {
    setBusyArtist(`user-${userId}`);
    setMessage('');
    try {
      await api.setUserStatus(
        adminSecret,
        userId,
        frozen ? 'active' : 'frozen'
      );
      setMessage(frozen ? 'Cuenta reactivada.' : 'Cuenta congelada.');
      await securityQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo actualizar.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const moderateChat = async (
    action: 'hide-message' | 'mute-user' | 'ban-user' | 'clear-user',
    input: {
      messageId?: string;
      userId?: string;
      userName?: string;
      durationMinutes?: number;
    }
  ) => {
    setBusyArtist(`chat-${action}-${input.messageId ?? input.userId ?? 'room'}`);
    setMessage('');
    try {
      await api.moderateChat(adminSecret, {
        roomId: chatRoom,
        action,
        reason: chatReason.trim() || 'Moderacion manual',
        ...input
      });
      setMessage('Moderacion del chat aplicada.');
      await chatModerationQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo moderar el chat.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const toggleArtist = async (artistId: string, frozen: boolean) => {
    setBusyArtist(`artist-status-${artistId}`);
    setMessage('');
    try {
      await api.setArtistStatus(
        adminSecret,
        artistId,
        frozen ? 'active' : 'frozen'
      );
      setMessage(frozen ? 'Artista reactivado.' : 'Artista congelado.');
      await artistsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo actualizar.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const rightsDraft = (record: ArtistRightsRecord) =>
    rightsDrafts[record.artistId] ?? record;

  const changeRightsDraft = (
    record: ArtistRightsRecord,
    field: keyof ArtistRightsRecord,
    value: string
  ) => {
    setRightsDrafts((current) => ({
      ...current,
      [record.artistId]: {
        ...rightsDraft(record),
        [field]: value
      }
    }));
  };

  const saveArtistRights = async (record: ArtistRightsRecord) => {
    const draft = rightsDraft(record);
    setBusyArtist(`rights-${record.artistId}`);
    setMessage('');
    try {
      await api.updateArtistRights(adminSecret, record.artistId, {
        imageUrl: draft.imageUrl,
        imageUsageStatus: draft.imageUsageStatus,
        imageSourceUrl: draft.imageSourceUrl,
        imageLicense: draft.imageLicense,
        imageAttribution: draft.imageAttribution,
        rightsNotes: draft.rightsNotes
      });
      setMessage(`Registro de derechos actualizado para ${record.artistName}.`);
      setRightsDrafts((current) => {
        const next = { ...current };
        delete next[record.artistId];
        return next;
      });
      await Promise.all([
        artistRightsQuery.refetch(),
        artistsQuery.refetch()
      ]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el registro de derechos.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  const reviewRightsRequest = async (
    requestId: string,
    status: RightsRequestStatus
  ) => {
    setBusyArtist(`rights-request-${requestId}`);
    setMessage('');
    try {
      await api.updateRightsRequest(
        adminSecret,
        requestId,
        status,
        rightsRequestNotes[requestId] ?? ''
      );
      setMessage('Solicitud de derechos actualizada.');
      await rightsRequestsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la solicitud.'
      );
    } finally {
      setBusyArtist('');
    }
  };

  if (!authReady) {
    return (
      <main className="admin-page admin-access">
        <a href="/"><ArrowLeft size={18} /> Volver al mercado</a>
        <section>
          <small>Administracion interna</small>
          <h1>Verificando sesion...</h1>
          <p>Estamos comprobando tu cuenta antes de abrir el panel.</p>
        </section>
      </main>
    );
  }

  if (firebaseReady && !firebaseUser) {
    return (
      <main className="admin-page admin-access">
        <a href="/"><ArrowLeft size={18} /> Volver al mercado</a>
        <section>
          <small>Acceso restringido</small>
          <h1>Entra con tu cuenta administradora</h1>
          <p>
            El panel solo se abre para emails autorizados en Firebase. Luego
            podras ingresar el secreto administrativo.
          </p>
          <button onClick={openAdminLogin} disabled={loginPending}>
            {loginPending ? 'Abriendo Google...' : 'Entrar con Google'}
          </button>
          {message && <p className="admin-message">{message}</p>}
        </section>
      </main>
    );
  }

  if (!adminEmailAllowed) {
    return (
      <main className="admin-page admin-access">
        <a href="/"><ArrowLeft size={18} /> Volver al mercado</a>
        <section>
          <small>Acceso restringido</small>
          <h1>Cuenta no habilitada</h1>
          <p>
            {firebaseUser?.email ?? 'Esta cuenta'} no tiene permisos para
            administrar Fame Plays.
          </p>
          <button onClick={() => logout()}>Cerrar sesion</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/"><ArrowLeft size={18} /> Volver al mercado</a>
        <div>
          <small>Administracion interna</small>
          <h1>Control de Fame Plays</h1>
        </div>
        <button
          onClick={syncAll}
          disabled={!adminSecret || Boolean(busyArtist) || !adminEmailAllowed}
        >
          <RefreshCw size={17} /> Sincronizar todos
        </button>
      </header>

      <section className="admin-secret">
        {firebaseUser?.email && (
          <p>
            Sesion admin: <strong>{firebaseUser.email}</strong>{' '}
            <button type="button" onClick={() => logout()}>salir</button>
          </p>
        )}
        <label>
          Secreto de administrador
          <input
            type="password"
            value={adminSecret}
            onChange={(event) => rememberSecret(event.target.value)}
            placeholder="ADMIN_SECRET"
          />
        </label>
        <p>Se guarda solamente durante esta sesion del navegador.</p>
      </section>

      <div className="admin-section-title">
        <small>Estado operativo</small>
        <h2>Monitoreo y recuperacion</h2>
      </div>

      <section className="operations-grid">
        <article>
          <Database size={20} />
          <span>
            <small>PostgreSQL</small>
            <strong>
              {operationsQuery.data
                ? bytesLabel(operationsQuery.data.database.databaseBytes)
                : 'Esperando acceso'}
            </strong>
          </span>
          <i className={operationsQuery.data ? 'is-healthy' : ''} />
        </article>
        <article>
          <HardDrive size={20} />
          <span>
            <small>Ultimo backup</small>
            <strong>
              {ageLabel(
                operationsQuery.data?.database.lastBackupAgeSeconds ?? null
              )}
            </strong>
          </span>
          <i
            className={
              operationsQuery.data?.jobs['database-backup']?.status ===
              'success'
                ? 'is-healthy'
                : ''
            }
          />
        </article>
        <article>
          <Youtube size={20} />
          <span>
            <small>Sincronizacion YouTube</small>
            <strong>
              {ageLabel(
                operationsQuery.data?.database.lastYouTubeSyncAgeSeconds ?? null
              )}
            </strong>
          </span>
          <i
            className={
              operationsQuery.data?.jobs['youtube-sync']?.status === 'success'
                ? 'is-healthy'
                : ''
            }
          />
        </article>
        <article>
          <Radar size={20} />
          <span>
            <small>Indice de atencion</small>
            <strong>
              {ageLabel(
                operationsQuery.data?.database
                  .lastAttentionSyncAgeSeconds ?? null
              )}
            </strong>
          </span>
          <i
            className={
              operationsQuery.data?.jobs['attention-sync']?.status ===
              'success'
                ? 'is-healthy'
                : ''
            }
          />
        </article>
        <article>
          <Activity size={20} />
          <span>
            <small>Ciclo de temporada</small>
            <strong>
              {ageLabel(
                operationsQuery.data?.database.lastSeasonCycleAgeSeconds ?? null
              )}
            </strong>
          </span>
          <i
            className={
              operationsQuery.data?.jobs['season-cycle']?.status === 'success'
                ? 'is-healthy'
                : ''
            }
          />
        </article>
        <article>
          <Activity size={20} />
          <span>
            <small>Mercado Vivo</small>
            <strong>
              {ageLabel(
                operationsQuery.data?.database.lastMarketMakerAgeSeconds ?? null
              )}
            </strong>
          </span>
          <i
            className={
              operationsQuery.data?.jobs['market-maker']?.status === 'success'
                ? 'is-healthy'
                : ''
            }
          />
        </article>
      </section>

      <div className="admin-section-title attention-heading">
        <div>
          <small>Modo sombra</small>
          <h2>Indice Automatico de Atencion</h2>
        </div>
        <button
          onClick={syncAttention}
          disabled={!adminSecret || Boolean(busyArtist)}
        >
          <Radar size={17} />
          {busyArtist === 'attention' ? 'Calculando...' : 'Sincronizar indice'}
        </button>
      </div>

      <section className="attention-grid">
        {!adminSecret ? (
          <p>Ingresa el secreto para consultar las senales.</p>
        ) : attentionQuery.isLoading ? (
          <p>Calculando el estado de las fuentes...</p>
        ) : attentionQuery.data?.sources.length ? (
          attentionQuery.data.sources.map((item) => {
            const delta = item.signal?.proposedDeltaBps ?? 0;
            const evaluation =
              attentionQuery.data.evaluation.evaluations.find(
                (candidate) => candidate.artistId === item.artistId
              );
            return (
              <article key={item.source.id}>
                <div className="attention-card__header">
                  <span>
                    <strong>{item.artistName}</strong>
                    <small>{item.source.provider}</small>
                  </span>
                  <b
                    className={
                      delta > 0
                        ? 'is-positive'
                        : delta < 0
                          ? 'is-negative'
                          : ''
                    }
                  >
                    {delta > 0 ? '+' : ''}
                    {(delta / 100).toFixed(2)}%
                  </b>
                </div>
                {item.signal ? (
                  <>
                    <dl>
                      <div>
                        <dt>7 dias</dt>
                        <dd>
                          {Math.round(
                            item.signal.breakdown.recentAverage ?? 0
                          ).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt>21 dias previos</dt>
                        <dd>
                          {Math.round(
                            item.signal.breakdown.baselineAverage ?? 0
                          ).toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                    <small>
                      Ventana hasta {item.signal.windowEndsOn} · Sin impacto
                      aplicado
                    </small>
                    {evaluation && (
                      <div className="attention-progress">
                        <span>
                          <i
                            style={{
                              width: `${evaluation.statistics.coveragePercent}%`
                            }}
                          />
                        </span>
                        <small>
                          {evaluation.statistics.observedDays}/
                          {evaluation.statistics.targetDays} ventanas · maximo{' '}
                          {(
                            evaluation.statistics.maximumAbsoluteDeltaBps / 100
                          ).toFixed(2)}
                          %
                        </small>
                      </div>
                    )}
                  </>
                ) : (
                  <small>
                    {item.source.lastError ?? 'Pendiente de sincronizacion.'}
                  </small>
                )}
              </article>
            );
          })
        ) : (
          <p>No hay fuentes de atencion configuradas.</p>
        )}
      </section>

      <div className="admin-section-title attention-heading">
        <div>
          <small>Noticias externas controladas</small>
          <h2>Pulso de noticias</h2>
        </div>
        <button
          onClick={syncNews}
          disabled={!adminSecret || Boolean(busyArtist)}
        >
          <Newspaper size={17} />
          {busyArtist === 'news' ? 'Consultando...' : 'Sincronizar noticias'}
        </button>
      </div>

      <div className="admin-section-title attention-heading">
        <div>
          <small>Ticks automaticos</small>
          <h2>Mercado Vivo</h2>
        </div>
        <button
          onClick={runMarketMaker}
          disabled={!adminSecret || Boolean(busyArtist)}
        >
          <Activity size={17} />
          {busyArtist === 'market-maker' ? 'Moviendo...' : 'Ejecutar ahora'}
        </button>
      </div>

      <section className="admin-season">
        <div>
          <small>Temporada actual</small>
          <h2>{seasonQuery.data?.season?.name ?? 'Sin temporada'}</h2>
          <p>
            Estado: <strong>{seasonStatus}</strong>
          </p>
        </div>
        <div className="admin-season__actions">
          <button
            onClick={() => runSeasonAction('freeze')}
            disabled={
              !adminSecret ||
              Boolean(busyArtist) ||
              seasonQuery.data?.season?.status !== 'active'
            }
          >
            <Snowflake size={17} /> Congelar
          </button>
          <button
            onClick={() => runSeasonAction('close')}
            disabled={
              !adminSecret ||
              Boolean(busyArtist) ||
              seasonQuery.data?.season?.status !== 'frozen'
            }
          >
            <LockKeyhole size={17} /> Cerrar
          </button>
          <button
            onClick={() => runSeasonAction('cycle')}
            disabled={!adminSecret || Boolean(busyArtist)}
          >
            <CalendarSync size={17} /> Procesar ciclo
          </button>
        </div>
        <form
          className="admin-season-form"
          onSubmit={(event) => {
            event.preventDefault();
            createManualSeason();
          }}
        >
          <label>
            Nombre
            <input
              value={seasonDraft.name}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Temporada semanal"
            />
          </label>
          <label>
            Apertura
            <input
              type="datetime-local"
              value={seasonDraft.startsAt}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  startsAt: event.target.value
                }))
              }
            />
          </label>
          <label>
            Final
            <input
              type="datetime-local"
              value={seasonDraft.endsAt}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  endsAt: event.target.value
                }))
              }
            />
          </label>
          <label>
            Cierre trading
            <input
              type="datetime-local"
              value={seasonDraft.tradingClosesAt}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  tradingClosesAt: event.target.value
                }))
              }
            />
          </label>
          <label>
            Dias
            <input
              type="number"
              min="1"
              max="365"
              value={seasonDraft.participationDays}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  participationDays: event.target.value
                }))
              }
            />
          </label>
          <label>
            Congelar antes
            <input
              type="number"
              min="0"
              max="10080"
              value={seasonDraft.freezeMinutes}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  freezeMinutes: event.target.value
                }))
              }
            />
          </label>
          <label>
            FameCoins iniciales
            <input
              type="number"
              min="100"
              max="1000000"
              value={seasonDraft.startingBalance}
              onChange={(event) =>
                setSeasonDraft((current) => ({
                  ...current,
                  startingBalance: event.target.value
                }))
              }
            />
          </label>
          <button
            type="submit"
            disabled={!adminSecret || Boolean(busyArtist)}
          >
            <Trophy size={17} />
            {busyArtist === 'season-create' ? 'Creando...' : 'Crear temporada'}
          </button>
        </form>
      </section>

      <div className="admin-section-title">
        <small>Premiacion USDT Solana</small>
        <h2>Wallets registradas</h2>
      </div>

      <section className="prize-wallets">
        {!adminSecret ? (
          <p>Ingresa el secreto para ver wallets de premiacion.</p>
        ) : prizeProfilesQuery.isLoading ? (
          <p>Cargando wallets...</p>
        ) : prizeProfilesQuery.data?.length ? (
          prizeProfilesQuery.data.map((profile) => (
            <article className="prize-wallet-card" key={profile.userId}>
              <header>
                <span>
                  <strong>{profile.displayName}</strong>
                  <small>{profile.email ?? 'sin email publico'}</small>
                </span>
                <b>
                  {profile.rank ? `#${profile.rank}` : 'Sin ranking final'}
                </b>
              </header>
              <code>{profile.solanaWalletAddress}</code>
              {profile.prizeContactNotes && <p>{profile.prizeContactNotes}</p>}
              <small>
                {profile.seasonName ?? 'Temporada no cerrada'} ·{' '}
                {profile.finalValue
                  ? `${profile.finalValue.toFixed(2)} FC`
                  : 'sin valor final'}
              </small>
            </article>
          ))
        ) : (
          <p>No hay wallets registradas todavia.</p>
        )}
      </section>

      <div className="admin-section-title">
        <small>Integridad competitiva</small>
        <h2>Revision antifraude</h2>
      </div>

      <section className="security-reviews">
        {!adminSecret ? (
          <p>Ingresa el secreto para consultar la cola.</p>
        ) : securityQuery.isLoading ? (
          <p>Analizando resultados...</p>
        ) : securityQuery.data?.length ? (
          securityQuery.data.map((review) => {
            const key = `${review.seasonId}:${review.userId}`;
            return (
              <article className="security-review" key={key}>
                <div className="security-review__summary">
                  <span>
                    <small>{review.seasonName}</small>
                    <strong>
                      #{review.rank} {review.displayName}
                    </strong>
                  </span>
                  <span>
                    <strong>{review.returnPercent.toFixed(2)}%</strong>
                    <small>{review.tradeCount} operaciones</small>
                  </span>
                  <span
                    className={`review-pill review-pill--${review.reviewStatus}`}
                  >
                    {review.reviewStatus === 'flagged'
                      ? 'Alerta'
                      : 'Pendiente'}
                  </span>
                </div>
                <div className="security-alerts">
                  {review.alerts.length ? (
                    review.alerts.map((alert) => (
                      <span
                        className={`security-alert security-alert--${alert.severity}`}
                        key={alert.id}
                      >
                        <Flag size={14} /> {alert.description}
                      </span>
                    ))
                  ) : (
                    <span className="security-alert">
                      Top semanal pendiente de validacion manual.
                    </span>
                  )}
                </div>
                <input
                  value={reviewNotes[key] ?? review.reviewNotes ?? ''}
                  onChange={(event) =>
                    setReviewNotes((current) => ({
                      ...current,
                      [key]: event.target.value
                    }))
                  }
                  placeholder="Nota interna de revision"
                  maxLength={500}
                />
                <div className="security-review__actions">
                  <button
                    onClick={() =>
                      processReview(review.seasonId, review.userId, 'approved')
                    }
                    disabled={Boolean(busyArtist)}
                  >
                    <CheckCircle2 size={16} /> Aprobar
                  </button>
                  <button
                    onClick={() =>
                      processReview(review.seasonId, review.userId, 'flagged')
                    }
                    disabled={Boolean(busyArtist)}
                  >
                    <Flag size={16} /> Marcar
                  </button>
                  <button
                    className="danger-action"
                    onClick={() =>
                      toggleUser(
                        review.userId,
                        review.userStatus === 'frozen'
                      )
                    }
                    disabled={Boolean(busyArtist)}
                  >
                    <Ban size={16} />{' '}
                    {review.userStatus === 'frozen'
                      ? 'Reactivar'
                      : 'Congelar cuenta'}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <p>No hay resultados pendientes de revision.</p>
        )}
      </section>

      <div className="admin-section-title">
        <small>Comunidad en vivo</small>
        <h2>Moderacion de chat</h2>
      </div>

      <section className="chat-moderation">
        <div className="chat-moderation__controls">
          <label>
            Sala
            <select
              value={chatRoom}
              onChange={(event) => setChatRoom(event.target.value)}
            >
              <option value="general">General</option>
              {(artistsQuery.data ?? []).map((artist) => (
                <option value={`entity:${artist.slug}`} key={artist.id}>
                  {artist.symbol} - {artist.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo
            <input
              value={chatReason}
              maxLength={240}
              onChange={(event) => setChatReason(event.target.value)}
            />
          </label>
          <button
            onClick={() => chatModerationQuery.refetch()}
            disabled={!adminSecret || chatModerationQuery.isFetching}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        {!adminSecret ? (
          <p>Ingresa el secreto para controlar el chat.</p>
        ) : chatModerationQuery.isLoading ? (
          <p>Cargando sala...</p>
        ) : chatModerationQuery.isError ? (
          <p>
            No se pudo conectar la moderacion. Revisa CHAT_WORKER_ADMIN_URL y
            CHAT_ADMIN_SECRET.
          </p>
        ) : (
          <div className="chat-moderation__grid">
            <div>
              <h3>
                <MessageCircle size={17} /> Mensajes recientes
              </h3>
              <div className="chat-moderation__messages">
                {chatModerationQuery.data?.recentMessages.length ? (
                  chatModerationQuery.data.recentMessages.map((chatMessage) => (
                    <article
                      className={`chat-moderation-card chat-moderation-card--${chatMessage.status}`}
                      key={chatMessage.id}
                    >
                      <header>
                        <span>
                          <strong>{chatMessage.name}</strong>
                          <small>
                            {chatMessage.userId} · {chatMessage.type === 'voice'
                              ? `nota ${Math.round(chatMessage.durationMs / 1000)}s`
                              : 'texto'}
                          </small>
                        </span>
                        <b>{chatMessage.reportCount} reportes</b>
                      </header>
                      <p>
                        {chatMessage.type === 'voice'
                          ? 'Nota de voz'
                          : chatMessage.body || 'Mensaje vacio'}
                      </p>
                      <div className="chat-moderation-card__actions">
                        <button
                          onClick={() =>
                            moderateChat('hide-message', {
                              messageId: chatMessage.id
                            })
                          }
                          disabled={Boolean(busyArtist)}
                        >
                          <Trash2 size={15} /> Ocultar
                        </button>
                        <button
                          onClick={() =>
                            moderateChat('mute-user', {
                              userId: chatMessage.userId,
                              userName: chatMessage.name,
                              durationMinutes: 15
                            })
                          }
                          disabled={Boolean(busyArtist)}
                        >
                          <Volume2 size={15} /> Silenciar
                        </button>
                        <button
                          className="danger-action"
                          onClick={() =>
                            moderateChat('ban-user', {
                              userId: chatMessage.userId,
                              userName: chatMessage.name,
                              durationMinutes: 1440
                            })
                          }
                          disabled={Boolean(busyArtist)}
                        >
                          <Ban size={15} /> Bloquear
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p>No hay mensajes recientes en esta sala.</p>
                )}
              </div>
            </div>

            <div>
              <h3>
                <Flag size={17} /> Acciones activas
              </h3>
              <div className="chat-moderation__actions-list">
                {chatModerationQuery.data?.actions.filter((action) => action.active)
                  .length ? (
                  chatModerationQuery.data.actions
                    .filter((action) => action.active)
                    .map((action) => (
                      <article className="chat-action-card" key={action.id}>
                        <span>
                          <strong>{action.name || action.userId}</strong>
                          <small>
                            {action.action === 'ban' ? 'Bloqueado' : 'Silenciado'}
                            {action.expiresAt
                              ? ` hasta ${new Date(action.expiresAt).toLocaleTimeString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}`
                              : ''}
                          </small>
                        </span>
                        <p>{action.reason}</p>
                        <button
                          onClick={() =>
                            moderateChat('clear-user', {
                              userId: action.userId,
                              userName: action.name
                            })
                          }
                          disabled={Boolean(busyArtist)}
                        >
                          Reactivar
                        </button>
                      </article>
                    ))
                ) : (
                  <p>No hay usuarios castigados en esta sala.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="admin-section-title">
        <small>Nombre, imagen y marcas</small>
        <h2>Solicitudes de derechos</h2>
      </div>

      <section className="rights-request-list">
        {!adminSecret ? (
          <p>Ingresa el secreto para consultar la bandeja.</p>
        ) : rightsRequestsQuery.isLoading ? (
          <p>Cargando solicitudes...</p>
        ) : rightsRequestsQuery.data?.length ? (
          rightsRequestsQuery.data.map((request) => (
            <article className="rights-request-card" key={request.id}>
              <header>
                <Inbox size={18} />
                <span>
                  <strong>{request.subject}</strong>
                  <small>
                    {request.requesterName} · {request.requesterEmail}
                  </small>
                </span>
                <b className={`review-pill review-pill--${request.status}`}>
                  {request.status}
                </b>
              </header>
              <p>{request.message}</p>
              {request.evidenceUrl && (
                <a
                  href={request.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver evidencia
                </a>
              )}
              <textarea
                rows={3}
                maxLength={1500}
                placeholder="Nota interna de seguimiento"
                value={
                  rightsRequestNotes[request.id] ??
                  request.adminNotes ??
                  ''
                }
                onChange={(event) =>
                  setRightsRequestNotes((current) => ({
                    ...current,
                    [request.id]: event.target.value
                  }))
                }
              />
              <div className="rights-request-card__actions">
                <button
                  onClick={() =>
                    reviewRightsRequest(request.id, 'reviewing')
                  }
                  disabled={Boolean(busyArtist)}
                >
                  Revisando
                </button>
                <button
                  onClick={() =>
                    reviewRightsRequest(request.id, 'resolved')
                  }
                  disabled={Boolean(busyArtist)}
                >
                  Resolver
                </button>
                <button
                  className="danger-action"
                  onClick={() =>
                    reviewRightsRequest(request.id, 'rejected')
                  }
                  disabled={Boolean(busyArtist)}
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))
        ) : (
          <p>No hay solicitudes de derechos.</p>
        )}
      </section>

      <div className="admin-section-title">
        <small>Publicacion controlada</small>
        <h2>Licencias de imagen</h2>
      </div>

      <section className="artist-rights-list">
        {!adminSecret ? (
          <p>Ingresa el secreto para revisar las licencias.</p>
        ) : artistRightsQuery.isLoading ? (
          <p>Cargando registros...</p>
        ) : artistRightsQuery.data?.length ? (
          artistRightsQuery.data.map((record) => {
            const draft = rightsDraft(record);
            return (
              <article className="artist-rights-card" key={record.artistId}>
                <header>
                  <EntityAvatar
                    name={record.artistName}
                    symbol={record.artistSymbol}
                    imageUrl={draft.imageUrl}
                    imageUsageStatus={draft.imageUsageStatus}
                  />
                  <span>
                    <strong>{record.artistName}</strong>
                    <small>
                      {record.artistSymbol} ·{' '}
                      {record.rightsReviewedAt
                        ? `revisado ${new Date(
                            record.rightsReviewedAt
                          ).toLocaleDateString('es-CO')}`
                        : 'sin revision'}
                    </small>
                  </span>
                  <FileCheck2 size={19} />
                </header>
                <div className="artist-rights-card__fields">
                  <label>
                    Estado de uso
                    <select
                      value={draft.imageUsageStatus}
                      onChange={(event) =>
                        changeRightsDraft(
                          record,
                          'imageUsageStatus',
                          event.target.value
                        )
                      }
                    >
                      <option value="none">Sin imagen</option>
                      <option value="unverified">No verificada</option>
                      <option value="owned">Contenido propio</option>
                      <option value="licensed">Licencia comprobada</option>
                      <option value="provider_authorized">
                        Autorizada por proveedor
                      </option>
                    </select>
                  </label>
                  <label>
                    URL de imagen
                    <input
                      type="url"
                      value={draft.imageUrl}
                      onChange={(event) =>
                        changeRightsDraft(
                          record,
                          'imageUrl',
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label>
                    Fuente verificable
                    <input
                      type="url"
                      value={draft.imageSourceUrl}
                      onChange={(event) =>
                        changeRightsDraft(
                          record,
                          'imageSourceUrl',
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label>
                    Licencia o permiso
                    <input
                      value={draft.imageLicense}
                      onChange={(event) =>
                        changeRightsDraft(
                          record,
                          'imageLicense',
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label>
                    Atribucion
                    <input
                      value={draft.imageAttribution}
                      onChange={(event) =>
                        changeRightsDraft(
                          record,
                          'imageAttribution',
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label className="artist-rights-card__notes">
                    Nota interna
                    <textarea
                      rows={3}
                      value={draft.rightsNotes}
                      onChange={(event) =>
                        changeRightsDraft(
                          record,
                          'rightsNotes',
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
                <button
                  onClick={() => saveArtistRights(record)}
                  disabled={!adminSecret || Boolean(busyArtist)}
                >
                  <Save size={17} />
                  {busyArtist === `rights-${record.artistId}`
                    ? 'Guardando...'
                    : 'Guardar registro'}
                </button>
              </article>
            );
          })
        ) : (
          <p>No hay figuras para revisar.</p>
        )}
      </section>

      <div className="admin-section-title">
        <small>Datos publicos</small>
        <h2>Canales oficiales de YouTube</h2>
      </div>

      <section className="admin-artists">
        {(artistsQuery.data ?? []).map((artist) => (
          <article className="admin-artist" key={artist.id}>
            <EntityAvatar
              name={artist.name}
              symbol={artist.symbol}
              imageUrl={artist.imageUrl}
              imageUsageStatus={artist.imageUsageStatus}
              imageAttribution={artist.imageAttribution}
            />
            <div>
              <strong>{artist.name}</strong>
              <small>{artist.symbol} · {artist.country}</small>
            </div>
            <label>
              <Youtube size={18} />
              <input
                value={handles[artist.id] ?? ''}
                onChange={(event) =>
                  setHandles((current) => ({
                    ...current,
                    [artist.id]: event.target.value
                  }))
                }
                placeholder="@handle-oficial"
              />
            </label>
            <div className="admin-artist__actions">
              <button
                title="Guardar canal y sincronizar"
                onClick={() => register(artist.id)}
                disabled={!adminSecret || Boolean(busyArtist)}
              >
                <Save size={18} />
                {busyArtist === artist.id ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                title={
                  artist.status === 'frozen'
                    ? 'Reactivar artista'
                    : 'Congelar artista'
                }
                aria-label={
                  artist.status === 'frozen'
                    ? `Reactivar ${artist.name}`
                    : `Congelar ${artist.name}`
                }
                onClick={() =>
                  toggleArtist(artist.id, artist.status === 'frozen')
                }
                disabled={!adminSecret || Boolean(busyArtist)}
              >
                {artist.status === 'frozen' ? (
                  <CirclePlay size={18} />
                ) : (
                  <Snowflake size={18} />
                )}
              </button>
            </div>
          </article>
        ))}
      </section>

      {message && <p className="admin-message">{message}</p>}
    </main>
  );
}
