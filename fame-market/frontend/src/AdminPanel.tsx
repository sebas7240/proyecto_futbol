import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarSync,
  LockKeyhole,
  RefreshCw,
  Save,
  Snowflake,
  Youtube
} from 'lucide-react';
import { api } from './api';

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
            <button
              title="Guardar canal y sincronizar"
              onClick={() => register(artist.id)}
              disabled={!adminSecret || Boolean(busyArtist)}
            >
              <Save size={18} />
              {busyArtist === artist.id ? 'Guardando...' : 'Guardar'}
            </button>
          </article>
        ))}
      </section>

      {message && <p className="admin-message">{message}</p>}
    </main>
  );
}
