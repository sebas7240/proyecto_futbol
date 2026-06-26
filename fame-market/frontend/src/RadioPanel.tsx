import {
  ExternalLink,
  Heart,
  Radio,
  RefreshCw,
  Search,
  Volume2
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';

type RadioCategory = 'deportes' | 'noticias' | 'musica';

interface CuratedStation {
  id: string;
  name: string;
  category: RadioCategory;
  tags: string;
  officialUrl: string;
  query?: string | string[];
}

interface RadioBrowserStation {
  name?: string;
  url_resolved?: string;
  url?: string;
  favicon?: string;
  homepage?: string;
  countrycode?: string;
  lastcheckok?: number;
  clickcount?: number;
  votes?: number;
  bitrate?: number;
}

const radioBrowserServers = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info'
];

const stations: CuratedStation[] = [
  {
    id: 'caracol-radio',
    name: 'Caracol Radio',
    category: 'noticias',
    tags: 'Noticias, deportes y actualidad',
    officialUrl: 'https://caracol.com.co/radio-en-vivo/',
    query: 'Caracol Radio'
  },
  {
    id: 'blu-radio',
    name: 'Blu Radio',
    category: 'noticias',
    tags: 'Noticias, opinion y entrevistas',
    officialUrl: 'https://www.bluradio.com/en-vivo',
    query: 'Blu Radio'
  },
  {
    id: 'w-radio',
    name: 'W Radio',
    category: 'noticias',
    tags: 'Actualidad, opinion y entrevistas',
    officialUrl: 'https://www.wradio.com.co/en-vivo/',
    query: ['W Radio', 'WRadio Colombia', 'W Radio Colombia']
  },
  {
    id: 'la-fm',
    name: 'La FM',
    category: 'noticias',
    tags: 'Noticias, politica y opinion',
    officialUrl: 'https://www.lafm.com.co/',
    query: ['La FM Bogota', 'La FM Colombia']
  },
  {
    id: 'radio-nacional',
    name: 'Radio Nacional',
    category: 'noticias',
    tags: 'Senal publica, cultura y regiones',
    officialUrl:
      'https://www.radionacional.co/en-vivo/en-vivo-radio-nacional-de-colombia',
    query: 'Radio Nacional de Colombia'
  },
  {
    id: 'olimpica-stereo',
    name: 'Olimpica Stereo',
    category: 'musica',
    tags: 'Tropical, vallenato y popular',
    officialUrl: 'https://www.olimpicastereo.com.co/',
    query: 'Olimpica Stereo'
  },
  {
    id: 'tropicana',
    name: 'Tropicana',
    category: 'musica',
    tags: 'Salsa, tropical y humor',
    officialUrl: 'https://www.tropicanafm.com/',
    query: 'Tropicana (Medellín) 98.9 FM'
  },
  {
    id: 'besame',
    name: 'Besame',
    category: 'musica',
    tags: 'Baladas y romantica',
    officialUrl: 'https://www.besame.fm/',
    query: 'Bésame (Medellín) 94.9 FM'
  },
  {
    id: 'los-40',
    name: 'Los 40 Colombia',
    category: 'musica',
    tags: 'Hits, pop y urbano',
    officialUrl: 'https://los40.com.co/',
    query: ['LOS40 Colombia', 'Los 40 Colombia']
  },
  {
    id: 'radioacktiva',
    name: 'Radioacktiva',
    category: 'musica',
    tags: 'Rock y entretenimiento',
    officialUrl: 'https://www.radioacktiva.com/',
    query: 'Radioacktiva'
  },
  {
    id: 'candela',
    name: 'Candela',
    category: 'musica',
    tags: 'Tropical y popular',
    officialUrl: 'https://www.candelaestereo.com/',
    query: ['Candela Cali', 'Candela Estereo Colombia']
  },
  {
    id: 'la-x-medellin',
    name: 'La X Medellin',
    category: 'musica',
    tags: 'Electronica y pop alternativo',
    officialUrl: 'https://www.laxmasmusica.com/',
    query: 'La X Medellin'
  },
  {
    id: 'radio-tiempo-cali',
    name: 'Radio Tiempo Cali',
    category: 'musica',
    tags: 'Romantica y clasicos',
    officialUrl: 'https://radiotiempo.co/',
    query: 'Radio Tiempo Cali'
  },
  {
    id: 'el-sol-medellin',
    name: 'El Sol Medellin',
    category: 'musica',
    tags: 'Salsa y tropical',
    officialUrl: 'https://elsolradio.fm/',
    query: 'El Sol (Medellín) 107.9 FM'
  },
  {
    id: 'mix-medellin',
    name: 'Mix Medellin',
    category: 'musica',
    tags: 'Urbano, merengue y bachata',
    officialUrl: 'https://www.mixradio.co/',
    query: 'Mix (Medellín) 89.9 FM'
  },
  {
    id: 'colombia-salsa-dura',
    name: 'Colombia Salsa Dura',
    category: 'musica',
    tags: 'Salsa clasica y tropical',
    officialUrl: 'https://www.radio-browser.info/',
    query: 'Colombia Salsa Dura'
  },
  {
    id: 'colombia-pop-rock',
    name: 'Colombia Pop Rock',
    category: 'musica',
    tags: 'Pop rock y clasicos',
    officialUrl: 'https://www.radio-browser.info/',
    query: 'Colombia Pop Rock'
  },
  {
    id: 'colombia-urbana',
    name: 'Colombia Urbana',
    category: 'musica',
    tags: 'Urbano, hip hop y pop latino',
    officialUrl: 'https://www.radio-browser.info/',
    query: 'Colombia Urbana'
  },
  {
    id: 'mundo-retro',
    name: 'Mundo Retro',
    category: 'musica',
    tags: 'Rock y pop en espanol',
    officialUrl: 'https://www.radio-browser.info/',
    query: 'Mundo Retro - Rock & Pop en Español'
  },
  {
    id: 'viejoteca',
    name: 'Viejoteca y algo mas',
    category: 'musica',
    tags: 'Cumbia, tropical y clasicos',
    officialUrl: 'https://www.radio-browser.info/',
    query: 'Viejoteca y algo mas'
  },
];

function streamUrl(station: RadioBrowserStation) {
  const candidate = String(station.url_resolved || station.url || '');
  return candidate.startsWith('https://') ? candidate : '';
}

async function resolveStation(station: CuratedStation) {
  const queries = Array.isArray(station.query)
    ? station.query
    : [station.query ?? station.name];
  for (const rawQuery of queries) {
    const query = encodeURIComponent(rawQuery);
    for (const countryFilter of ['&countrycode=CO', '']) {
      for (const server of radioBrowserServers) {
        const url =
          `${server}/json/stations/search?name=${query}` +
          `${countryFilter}&hidebroken=true&limit=12&order=clickcount&reverse=true`;
        try {
          const response = await fetch(url, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(8_000)
          });
          if (!response.ok) continue;
          const payload = (await response.json()) as RadioBrowserStation[];
          const playable = payload
            .filter((item) => item.lastcheckok === 1 && streamUrl(item))
            .sort(
              (left, right) =>
                Number(right.votes ?? 0) - Number(left.votes ?? 0) ||
                Number(right.clickcount ?? 0) - Number(left.clickcount ?? 0) ||
                Number(right.bitrate ?? 0) - Number(left.bitrate ?? 0)
            );
          if (playable[0]) return playable[0];
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

export function RadioPanel() {
  const [selectedId, setSelectedId] = useState(stations[0]!.id);
  const [category, setCategory] = useState<'todas' | RadioCategory>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('Lista');
  const [resolved, setResolved] = useState<Record<string, RadioBrowserStation | null>>({});
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fame-radio-favorites') || '[]');
    } catch {
      return [];
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredStations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return stations.filter((station) => {
      if (unavailableIds.includes(station.id)) return false;
      const byCategory = category === 'todas' || station.category === category;
      const byQuery =
        !query ||
        `${station.name} ${station.tags} ${station.category}`
          .toLowerCase()
          .includes(query);
      return byCategory && byQuery;
    });
  }, [category, searchTerm, unavailableIds]);
  const selected = useMemo(
    () => stations.find((station) => station.id === selectedId) ?? stations[0]!,
    [selectedId]
  );
  const currentStream = resolved[selected.id] ? streamUrl(resolved[selected.id]!) : '';

  useEffect(() => {
    if (!unavailableIds.includes(selectedId)) return;
    const nextStation = filteredStations.find((station) => station.id !== selectedId);
    if (nextStation) setSelectedId(nextStation.id);
  }, [filteredStations, selectedId, unavailableIds]);

  useEffect(() => {
    let cancelled = false;
    if (selected.id in resolved) return undefined;
    setStatus('Buscando senal');
    resolveStation(selected)
      .then((station) => {
        if (cancelled) return;
        setResolved((current) => ({ ...current, [selected.id]: station }));
        if (station) {
          setStatus('Lista');
          return;
        }
        setStatus('No disponible');
        setUnavailableIds((current) =>
          current.includes(selected.id) ? current : [...current, selected.id]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setResolved((current) => ({ ...current, [selected.id]: null }));
          setStatus('No disponible');
          setUnavailableIds((current) =>
            current.includes(selected.id) ? current : [...current, selected.id]
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolved, selected]);

  useEffect(() => {
    localStorage.setItem('fame-radio-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentStream) return undefined;
    setStatus('Lista');
    let hls: Hls | null = null;
    let cancelled = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();

    if (currentStream.includes('.m3u8')) {
      if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = currentStream;
      } else {
        import('hls.js')
          .then(({ default: Hls }) => {
            if (cancelled) return;
            if (!Hls.isSupported()) {
              setStatus('Sitio oficial');
              return;
            }
            hls = new Hls({ lowLatencyMode: true, maxBufferLength: 12 });
            hls.loadSource(currentStream);
            hls.attachMedia(audio);
          })
          .catch(() => setStatus('Sitio oficial'));
      }
    } else {
      audio.src = currentStream;
    }

    const onPlay = () => setStatus('En vivo');
    const onPause = () => setStatus('Pausada');
    const onError = () => {
      setStatus('No disponible');
      setUnavailableIds((current) =>
        current.includes(selected.id) ? current : [...current, selected.id]
      );
    };
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
  }, [currentStream]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  return (
    <section className="radio-panel">
      <div className="section-heading section-heading--compact">
        <div>
          <small>Radio colombiana</small>
          <h3>En vivo</h3>
        </div>
        <span>
          <Radio size={15} /> {status}
        </span>
      </div>

      <div className="radio-tools">
        <label className="search radio-search">
          <Search size={15} />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar emisora"
          />
        </label>
        <div className="radio-categories" role="tablist">
          {(['todas', 'deportes', 'noticias', 'musica'] as const).map((item) => (
            <button
              className={category === item ? 'is-active' : ''}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item === 'todas' ? 'Todas' : item}
            </button>
          ))}
        </div>
      </div>

      <div className="radio-stations" role="list">
        {filteredStations.map((station) => {
          const stationStream = resolved[station.id]
            ? streamUrl(resolved[station.id]!)
            : '';
          const isFavorite = favorites.includes(station.id);
          return (
            <button
              className={station.id === selected.id ? 'is-active' : ''}
              key={station.id}
              onClick={() => setSelectedId(station.id)}
              type="button"
            >
              <span>
                <strong>{station.name}</strong>
                <small>{station.tags}</small>
              </span>
              <small>{stationStream ? 'stream' : 'verificando'}</small>
              <Heart
                aria-hidden="true"
                className={isFavorite ? 'is-favorite' : ''}
                size={14}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(station.id);
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="radio-now">
        <Volume2 size={18} />
        <span>
          <strong>{selected.name}</strong>
          <small>
            {currentStream
              ? 'Stream HTTPS verificado por Radio Browser.'
              : 'Verificando stream publico para reproducir aqui.'}
          </small>
        </span>
        <button
          type="button"
          title="Volver a buscar stream"
          onClick={() => {
            setResolved((current) => {
              const copy = { ...current };
              delete copy[selected.id];
              return copy;
            });
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {currentStream ? (
        <audio ref={audioRef} controls preload="none" />
      ) : (
        <p>
          Fame Plays solo muestra emisoras que puedan reproducirse dentro de la
          web. Si una senal falla, se oculta automaticamente.
        </p>
      )}

      {currentStream && (
        <a href={selected.officialUrl} target="_blank" rel="noreferrer">
          Abrir sitio oficial <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}
