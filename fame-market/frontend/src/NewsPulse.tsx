import {
  ExternalLink,
  Newspaper,
} from 'lucide-react';
import type { NewsPulse as NewsPulseData } from './types';

interface NewsPulseProps {
  data?: NewsPulseData;
  loading?: boolean;
}

function relativeTime(value: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  );
  if (elapsedMinutes < 60) return `hace ${elapsedMinutes || 1} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export function NewsPulse({ data, loading = false }: NewsPulseProps) {
  return (
    <section className="news-pulse">
      <div className="section-heading section-heading--compact">
        <div>
          <small>Actividad publica reciente</small>
          <h3>Pulso de noticias</h3>
        </div>
      </div>

      {loading ? (
        <p className="news-pulse__empty">Consultando titulares...</p>
      ) : data?.items.length ? (
        <div className="news-list">
          {data.items.slice(0, 5).map((item) => (
            <a
              className="news-row"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              key={item.id}
            >
              <span className="news-row__icon" aria-hidden="true">
                <Newspaper size={17} />
              </span>
              <span className="news-row__body">
                <strong>{item.title}</strong>
                <small>
                  {item.sourceDomain || 'Fuente externa'} / {relativeTime(item.publishedAt)}
                </small>
              </span>
              <ExternalLink className="news-row__external" size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : (
        <p className="news-pulse__empty">
          Estamos ampliando la busqueda a titulares de los ultimos dias. Si no
          aparece nada, esta figura aun no tiene cobertura suficiente en fuentes
          verificadas.
        </p>
      )}

      <p className="news-pulse__note">
        Fame Plays revisa titulares publicos para enriquecer el contexto. Los
        temas sensibles requieren revision antes de afectar el mercado.
      </p>
    </section>
  );
}
