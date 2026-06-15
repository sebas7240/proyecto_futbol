import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  Medal,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy
} from 'lucide-react';
import type {
  RankingEntry,
  Season,
  SeasonHistory
} from './types';
import { api } from './api';
import { EntityAvatar } from './EntityAvatar';

const money = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const date = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short'
});

function timeRemaining(season: Season) {
  if (season.status === 'closed') return 'Temporada finalizada';
  if (season.status === 'frozen') return 'Resultados en proceso';
  const milliseconds = Math.max(
    0,
    Date.parse(season.tradingClosesAt) - Date.now()
  );
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
  return days > 0 ? `${days} d ${hours} h para operar` : `${hours} h para operar`;
}

function Avatar({ entry }: { entry: RankingEntry }) {
  const [failed, setFailed] = useState(false);
  return entry.avatarUrl && !failed ? (
    <img src={entry.avatarUrl} alt="" onError={() => setFailed(true)} />
  ) : (
    <span className="ranking-avatar">
      {entry.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Badges({ badges }: { badges: RankingEntry['badges'] }) {
  if (!badges.length) return null;
  return (
    <span className="ranking-badges">
      {badges.includes('rookie') && (
        <span title="Mejor participante en su primera temporada">
          <BadgeCheck size={14} /> Mejor novato
        </span>
      )}
      {badges.includes('early_discoverer') && (
        <span title="Primero en comprar un artista que termino al alza">
          <Sparkles size={14} /> Descubridor
        </span>
      )}
    </span>
  );
}

export function RankingPanel({
  season,
  rankings,
  history,
  signedIn,
  loading,
  onBack
}: {
  season: Season | null;
  rankings: RankingEntry[];
  history: SeasonHistory[];
  signedIn: boolean;
  loading: boolean;
  onBack: () => void;
}) {
  const podium = rankings.slice(0, 3);
  const [expandedSeasonId, setExpandedSeasonId] = useState('');
  const seasonTradesQuery = useQuery({
    queryKey: ['season-trades', expandedSeasonId],
    queryFn: () => api.seasonTrades(expandedSeasonId),
    enabled: Boolean(expandedSeasonId),
    retry: false
  });

  return (
    <main className="ranking-page">
      <header className="ranking-header">
        <button className="ranking-back" onClick={onBack}>
          <ArrowLeft size={18} /> Mercado
        </button>
        <div>
          <small>Competencia semanal</small>
          <h1>Ranking de Fame Market</h1>
          <p>
            El rendimiento parte del mismo capital ficticio para todos los
            jugadores.
          </p>
        </div>
        {season && (
          <div className={`season-status season-status--${season.status}`}>
            <CalendarClock size={18} />
            <span>
              <strong>{season.name}</strong>
              <small>{timeRemaining(season)}</small>
            </span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="ranking-empty">Calculando posiciones...</div>
      ) : rankings.length ? (
        <>
          <section className="podium" aria-label="Podio semanal">
            {podium.map((entry) => (
              <article
                className={`podium-entry podium-entry--${entry.rank}`}
                key={`${entry.rank}-${entry.displayName}`}
              >
                <span className="podium-entry__rank">
                  {entry.rank === 1 ? <Trophy size={21} /> : <Medal size={21} />}
                  #{entry.rank}
                </span>
                <Avatar entry={entry} />
                <strong>{entry.displayName}</strong>
                <Badges badges={entry.badges} />
                <span>{money.format(entry.portfolioValue)} FC</span>
                <small className={entry.returnPercent >= 0 ? 'profit' : 'loss'}>
                  {entry.returnPercent >= 0 ? '+' : ''}
                  {entry.returnPercent.toFixed(2)}%
                </small>
              </article>
            ))}
          </section>

          <section className="leaderboard">
            <div className="leaderboard__heading">
              <div>
                <small>Clasificacion actual</small>
                <h2>Todos los jugadores</h2>
              </div>
              <span>
                {rankings.length}{' '}
                {rankings.length === 1 ? 'participante' : 'participantes'}
              </span>
            </div>
            <div className="leaderboard__labels" aria-hidden="true">
              <span>Posicion</span>
              <span>Portafolio</span>
              <span>Rendimiento</span>
              <span>Operaciones</span>
            </div>
            <div className="leaderboard__rows">
              {rankings.map((entry) => (
                <div
                  className="leaderboard-row"
                  key={`${entry.rank}-${entry.displayName}`}
                >
                  <span className="leaderboard-row__player">
                    <b>#{entry.rank}</b>
                    <Avatar entry={entry} />
                    <span className="leaderboard-row__identity">
                      <strong>{entry.displayName}</strong>
                      <Badges badges={entry.badges} />
                    </span>
                  </span>
                  <strong>{money.format(entry.portfolioValue)} FC</strong>
                  <span
                    className={
                      entry.returnPercent >= 0 ? 'profit' : 'loss'
                    }
                  >
                    {entry.returnPercent >= 0 ? (
                      <TrendingUp size={16} />
                    ) : (
                      <TrendingDown size={16} />
                    )}
                    {entry.returnPercent >= 0 ? '+' : ''}
                    {entry.returnPercent.toFixed(2)}%
                  </span>
                  <span>{entry.tradeCount}</span>
                  {entry.reviewStatus === 'flagged' && (
                    <span className="review-state review-state--flagged">
                      <ShieldAlert size={13} /> En revision
                    </span>
                  )}
                  {entry.reviewStatus === 'pending' && (
                    <span className="review-state">Pendiente de revision</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="ranking-empty">
          El ranking aparecera cuando el primer jugador abra su portafolio.
        </div>
      )}

      <section className="season-history">
        <div className="leaderboard__heading">
          <div>
            <small>Tu recorrido</small>
            <h2>Temporadas</h2>
          </div>
        </div>
        {!signedIn ? (
          <p className="ranking-empty">
            Inicia sesion para consultar tu posicion e historial personal.
          </p>
        ) : history.length ? (
          <div className="history-grid">
            {history.map((item) => (
              <div className="history-item" key={item.seasonId}>
                <button
                  className="history-entry"
                  onClick={() =>
                    setExpandedSeasonId((current) =>
                      current === item.seasonId ? '' : item.seasonId
                    )
                  }
                  aria-expanded={expandedSeasonId === item.seasonId}
                >
                  <span>
                    <small>
                      {date.format(new Date(item.startsAt))} -{' '}
                      {date.format(new Date(item.endsAt))}
                    </small>
                    <strong>{item.name}</strong>
                    <Badges badges={item.badges} />
                  </span>
                  <b>{item.rank ? `#${item.rank}` : 'Sin rango'}</b>
                  <span>
                    <strong>{money.format(item.portfolioValue)} FC</strong>
                    <small className={item.returnPercent >= 0 ? 'profit' : 'loss'}>
                      {item.returnPercent >= 0 ? '+' : ''}
                      {item.returnPercent.toFixed(2)}%
                    </small>
                  </span>
                  <ChevronDown
                    className={
                      expandedSeasonId === item.seasonId ? 'is-open' : ''
                    }
                    size={18}
                  />
                </button>
                {expandedSeasonId === item.seasonId && (
                  <div className="season-trades">
                    {seasonTradesQuery.isLoading ? (
                      <p>Cargando operaciones...</p>
                    ) : seasonTradesQuery.data?.length ? (
                      seasonTradesQuery.data.map((trade) => (
                        <div className="season-trade" key={trade.id}>
                          <EntityAvatar
                            name={trade.artistName}
                            symbol={trade.artistSymbol}
                            imageUrl={trade.artistImageUrl}
                            imageUsageStatus={trade.artistImageUsageStatus}
                            size="small"
                          />
                          <span>
                            <strong>{trade.artistName}</strong>
                            <small>
                              {new Date(trade.createdAt).toLocaleString('es-CO')}
                            </small>
                          </span>
                          <b className={trade.side === 'buy' ? 'profit' : 'loss'}>
                            {trade.side === 'buy' ? 'Compra' : 'Venta'} x
                            {trade.quantity}
                          </b>
                          <span>
                            <strong>{money.format(trade.grossAmount)} FC</strong>
                            <small>
                              {money.format(trade.averagePrice)} por unidad
                            </small>
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>No hubo operaciones en esta temporada.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="ranking-empty">
            Tu primera temporada aparecera al abrir el portafolio.
          </p>
        )}
      </section>
    </main>
  );
}
