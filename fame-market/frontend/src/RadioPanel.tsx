import { ExternalLink, Radio, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';

interface Station {
  id: string;
  name: string;
  category: string;
  description: string;
  streamUrl?: string;
  officialUrl: string;
}

const stations: Station[] = [
  {
    id: 'radio-nacional',
    name: 'Radio Nacional',
    category: 'Cultura / noticias',
    description: 'Senal publica de RTVC con regiones, cultura, noticias y deportes.',
    streamUrl:
      'https://streaming.rtvc.gov.co/Radio_Radionacional/Radionacional.stream/playlist.m3u8',
    officialUrl:
      'https://www.radionacional.co/en-vivo/en-vivo-radio-nacional-de-colombia'
  },
  {
    id: 'exploremos',
    name: 'Exploremos',
    category: 'Educativa',
    description: 'Canal educativo publico de RTVC para contenidos de aprendizaje.',
    officialUrl: 'https://www.radionacional.co/en-vivo/exploremos'
  },
  {
    id: 'la-fm',
    name: 'La FM',
    category: 'Noticias',
    description: 'Noticias, entrevistas, opinion y actualidad nacional.',
    officialUrl: 'https://www.lafm.com.co/'
  },
  {
    id: 'antena-2',
    name: 'Antena 2',
    category: 'Deportes',
    description: 'Cobertura deportiva, futbol, ciclismo y eventos en vivo.',
    officialUrl: 'https://www.antena2.com/'
  }
];

export function RadioPanel() {
  const playableStations = stations.filter((station) => station.streamUrl);
  const [selectedId, setSelectedId] = useState(
    playableStations[0]?.id ?? stations[0]!.id
  );
  const selected = useMemo(
    () => stations.find((station) => station.id === selectedId) ?? stations[0]!,
    [selectedId]
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState('Lista');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selected.streamUrl) return undefined;
    setStatus('Lista');
    let hls: Hls | null = null;
    let cancelled = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();

    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = selected.streamUrl;
    } else {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setStatus('Abre la senal oficial');
            return;
          }
          hls = new Hls({ lowLatencyMode: true, maxBufferLength: 12 });
          hls.loadSource(selected.streamUrl!);
          hls.attachMedia(audio);
        })
        .catch(() => setStatus('Abre la senal oficial'));
    }

    const onPlay = () => setStatus('En vivo');
    const onPause = () => setStatus('Pausada');
    const onError = () => setStatus('Abre la senal oficial');
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      cancelled = true;
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      hls?.destroy();
    };
  }, [selected]);

  return (
    <section className="radio-panel">
      <div className="section-heading section-heading--compact">
        <div>
          <small>Radio colombiana</small>
          <h3>En vivo</h3>
        </div>
        <span><Radio size={15} /> {status}</span>
      </div>

      <div className="radio-stations" role="list">
        {stations.map((station) => (
          <button
            className={station.id === selected.id ? 'is-active' : ''}
            key={station.id}
            onClick={() => setSelectedId(station.id)}
            type="button"
          >
            <strong>{station.name}</strong>
            <small>{station.category}</small>
          </button>
        ))}
      </div>

      <div className="radio-now">
        <Volume2 size={18} />
        <span>
          <strong>{selected.name}</strong>
          <small>{selected.description}</small>
        </span>
      </div>

      {selected.streamUrl ? (
        <audio ref={audioRef} controls preload="none" />
      ) : (
        <p>
          Esta emisora se abre desde su senal oficial para evitar usar fuentes
          no verificadas.
        </p>
      )}

      <a href={selected.officialUrl} target="_blank" rel="noreferrer">
        Abrir sitio oficial <ExternalLink size={14} />
      </a>
    </section>
  );
}
