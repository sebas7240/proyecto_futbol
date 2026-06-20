import {
  ExternalLink,
  Minus,
  Newspaper,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import type { NewsItem, NewsPulse as NewsPulseData } from './types';

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

function sentiment(item: NewsItem) {
  if (item.sentimentLabel === 'positive') {
    return { label: 'Impulso', className: 'is-positive', Icon: TrendingUp };
  }
  if (item.sentimentLabel === 'negative') {
    return { label: 'Presion', className: 'is-negative', Icon: TrendingDown };
  }
  return { label: 'Neutral', className: 'is-neutral', Icon: Minus };
}

export function NewsPulse({ data, loading = false }: NewsPulseProps) {
  const proposal = data?.signal?.proposedDeltaBps ?? 0;
  const proposalLabel = `${proposal > 0 ? '+' : ''}${(proposal / 100).toFixed(2)}%`;

  return (
    <section className="news-pulse">
      <div className="section-heading section-heading--compact">
        <div>
          <small>Actividad publica reciente</small>
          <h3>Pulso de noticias</h3>
        </div>
        {data?.signal && (
          <span className={`news-signal news-signal--${data.signal.mode}`}>
            {data.signal.mode === 'applied' ? 'Impacto aplicado' : 'En observacion'}{' '}
            {proposalLabel}
          </span>
        )}
      </div>

      {loading ? (
        <p className="news-pulse__empty">Consultando titulares...</p>
      ) : data?.items.length ? (
        <div className="news-list">
          {data.items.slice(0, 5).map((item) => {
            const tone = sentiment(item);
            return (
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
                    {item.sourceDomain || 'Fuente externa'} · {relativeTime(item.publishedAt)}
                  </small>
                </span>
                <span className={`news-tone ${tone.className}`}>
                  <tone.Icon size={13} />
                  {tone.label}
                </span>
                <ExternalLink className="news-row__external" size={15} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      ) : (
        <p className="news-pulse__empty">
          Aun no hay suficientes titulares verificados para calcular este pulso.
        </p>
      )}

      <p className="news-pulse__note">
        La señal combina recencia, diversidad de medios y tono conservador. Los temas
        sensibles requieren revisión y no mueven el precio automáticamente.
      </p>
    </section>
  );
}
