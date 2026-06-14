import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Save, Youtube } from 'lucide-react';
import { api } from './api';

export function AdminPanel() {
  const artistsQuery = useQuery({ queryKey: ['artists'], queryFn: api.artists });
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

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/"><ArrowLeft size={18} /> Volver al mercado</a>
        <div>
          <small>Administracion interna</small>
          <h1>Canales oficiales de YouTube</h1>
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
