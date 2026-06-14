import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  Ban,
  CalendarSync,
  CheckCircle2,
  CirclePlay,
  Database,
  Flag,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  Save,
  Snowflake,
  Youtube
} from 'lucide-react';
import { api } from './api';

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
  const artistsQuery = useQuery({ queryKey: ['artists'], queryFn: api.artists });
  const seasonQuery = useQuery({ queryKey: ['ranking'], queryFn: api.ranking });
  const [adminSecret, setAdminSecret] = useState(
    () => sessionStorage.getItem('fame-admin-secret') ?? ''
  );
  const [handles, setHandles] = useState<Record<string, string>>({
    '10000000-0000-4000-8000-000000000001': '@KarolG',
    '10000000-0000-4000-8000-000000000002': '@BadBunnyPR',
    '10000000-0000-4000-8000-000000000003': '@Shakira'
  });
  const [message, setMessage] = useState('');
  const [busyArtist, setBusyArtist] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const securityQuery = useQuery({
    queryKey: ['security-reviews', adminSecret],
    queryFn: () => api.securityReviews(adminSecret),
    enabled: Boolean(adminSecret),
    retry: false
  });
  const operationsQuery = useQuery({
    queryKey: ['operations', adminSecret],
    queryFn: () => api.operations(adminSecret),
    enabled: Boolean(adminSecret),
    retry: false,
    refetchInterval: 30_000
  });
  const seasonStatus =
    seasonQuery.data?.season?.status === 'active'
      ? 'activa'
      : seasonQuery.data?.season?.status === 'frozen'
        ? 'congelada'
        : seasonQuery.data?.season?.status === 'closed'
          ? 'cerrada'
          : 'ninguna';

  const rememberSecret = (value: string) => {
    setAdminSecret(value);
    sessionStorage.setItem('fame-admin-secret', value);
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

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/"><ArrowLeft size={18} /> Volver al mercado</a>
        <div>
          <small>Administracion interna</small>
          <h1>Control de Fame Market</h1>
        </div>
        <button onClick={syncAll} disabled={!adminSecret || Boolean(busyArtist)}>
          <RefreshCw size={17} /> Sincronizar todos
        </button>
      </header>

      <section className="admin-secret">
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
      </section>

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
        <small>Datos publicos</small>
        <h2>Canales oficiales de YouTube</h2>
      </div>

      <section className="admin-artists">
        {(artistsQuery.data ?? []).map((artist) => (
          <article className="admin-artist" key={artist.id}>
            <img src={artist.imageUrl} alt="" />
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
