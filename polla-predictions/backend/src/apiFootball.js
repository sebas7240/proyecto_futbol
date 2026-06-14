import { getLocalDateTime, parseScore } from './matchUtils.js';

const BASE_URL = 'https://v3.football.api-sports.io';

function normalizeStatus(shortStatus) {
  if (['NS', 'TBD'].includes(shortStatus)) return 'SCHEDULED';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(shortStatus)) return 'LIVE';
  if (['FT', 'AET', 'PEN'].includes(shortStatus)) return 'FINISHED';
  if (['PST', 'SUSP', 'INT'].includes(shortStatus)) return 'POSTPONED';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(shortStatus)) return 'CANCELLED';
  return 'UNKNOWN';
}

function toInternalMatch(item) {
  const local = getLocalDateTime(item.fixture?.date);
  if (!local) return null;
  const status = normalizeStatus(item.fixture?.status?.short);

  return {
    externalId: String(item.fixture.id),
    source: 'api-football',
    providerRefs: { 'api-football': String(item.fixture.id) },
    home: item.teams?.home?.name || 'Local',
    away: item.teams?.away?.name || 'Visitante',
    date: local.date,
    time: local.time,
    rawTimestamp: local.rawTimestamp,
    league: item.league?.name || 'Sin liga',
    leagueCode: item.league?.id ? String(item.league.id) : '',
    country: item.league?.country || null,
    status,
    homeScore: parseScore(item.goals?.home),
    awayScore: parseScore(item.goals?.away),
    homeBadge: item.teams?.home?.logo || null,
    awayBadge: item.teams?.away?.logo || null,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchApiFootballMatches({ dates, timeZone }) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return { provider: 'api-football', skipped: true, matches: [] };
  }

  const matches = [];
  const errors = [];

  for (const date of dates) {
    try {
      const params = new URLSearchParams({ date, timezone: timeZone });
      const response = await fetch(`${BASE_URL}/fixtures?${params}`, {
        headers: {
          Accept: 'application/json',
          'x-apisports-key': apiKey
        },
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) throw new Error(`responded ${response.status}`);
      const payload = await response.json();
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        throw new Error(payload.errors.join(', '));
      }

      (payload.response || []).forEach((item) => {
        const match = toInternalMatch(item);
        if (match) matches.push(match);
      });
    } catch (error) {
      errors.push(`${date}: ${error.message}`);
    }
  }

  return { provider: 'api-football', matches, errors };
}
