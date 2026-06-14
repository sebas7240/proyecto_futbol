import { getLocalDateTime, parseScore } from './matchUtils.js';

const DEFAULT_API_KEY = '123';
const DEFAULT_LEAGUE_IDS = ['4429', '4328', '4335'];
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

function normalizeLeagueIds(rawLeagueIds) {
  const ids = String(rawLeagueIds || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : DEFAULT_LEAGUE_IDS;
}

function normalizeStatus(rawStatus, rawTimestamp) {
  const status = String(rawStatus || '').trim().toUpperCase();
  if (['NS', 'NOT STARTED', 'SCHEDULED', 'TBD'].includes(status)) return 'SCHEDULED';
  if (['1H', 'HT', '2H', 'ET', 'P', 'LIVE', 'IN PLAY', 'IN PROGRESS'].includes(status)) return 'LIVE';
  if (['FT', 'AET', 'PEN', 'MATCH FINISHED', 'FINISHED'].includes(status)) return 'FINISHED';
  if (['PST', 'POSTPONED', 'SUSPENDED'].includes(status)) return 'POSTPONED';
  if (['CANCELLED', 'CANCELED', 'ABD', 'ABANDONED'].includes(status)) return 'CANCELLED';

  const kickoff = rawTimestamp ? new Date(rawTimestamp) : null;
  return kickoff && kickoff.getTime() > Date.now() ? 'SCHEDULED' : 'UNKNOWN';
}

function toInternalMatch(event) {
  const normalizedTimestamp = event.strTimestamp
    ? /(?:z|[+-]\d{2}:\d{2})$/i.test(event.strTimestamp)
      ? event.strTimestamp
      : `${event.strTimestamp}Z`
    : null;
  const local = getLocalDateTime(normalizedTimestamp);
  const rawTimestamp = local?.rawTimestamp || (
    event.dateEvent && event.strTime
      ? new Date(`${event.dateEvent}T${event.strTime}Z`).toISOString()
      : null
  );
  const fallbackLocal = rawTimestamp ? getLocalDateTime(rawTimestamp) : null;
  const status = normalizeStatus(event.strStatus, rawTimestamp);

  return {
    externalId: String(event.idEvent),
    source: 'thesportsdb',
    providerRefs: { thesportsdb: String(event.idEvent) },
    home: event.strHomeTeam || 'Local',
    away: event.strAwayTeam || 'Visitante',
    date: local?.date || fallbackLocal?.date || event.dateEvent || '',
    time: local?.time || fallbackLocal?.time || String(event.strTime || '').slice(0, 5),
    rawTimestamp,
    league: event.strLeague || 'Sin liga',
    leagueCode: event.idLeague ? String(event.idLeague) : '',
    country: event.strCountry || null,
    status,
    homeScore: parseScore(event.intHomeScore),
    awayScore: parseScore(event.intAwayScore),
    homeBadge: event.strHomeTeamBadge || null,
    awayBadge: event.strAwayTeamBadge || null,
    updatedAt: new Date().toISOString()
  };
}

async function fetchEvents(url, label) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'polla-predictions/0.1'
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) throw new Error(`${label} responded ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function fetchSportsDbMatches({ dates }) {
  if (process.env.THESPORTSDB_ENABLED === 'false') {
    return { provider: 'thesportsdb', skipped: true, matches: [] };
  }

  const apiKey = process.env.THESPORTSDB_API_KEY || DEFAULT_API_KEY;
  const leagueIds = normalizeLeagueIds(process.env.THESPORTSDB_LEAGUE_IDS);
  const requests = [
    ...leagueIds.map((leagueId) => ({
      label: `league ${leagueId}`,
      url: `${BASE_URL}/${apiKey}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`
    })),
    ...dates.map((date) => ({
      label: `day ${date}`,
      url: `${BASE_URL}/${apiKey}/eventsday.php?${new URLSearchParams({ d: date, s: 'Soccer' })}`
    }))
  ];

  const settled = await Promise.allSettled(
    requests.map((request) => fetchEvents(request.url, request.label))
  );
  const errors = [];
  const byId = new Map();

  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push(`${requests[index].label}: ${result.reason.message}`);
      return;
    }

    result.value.forEach((event) => {
      const match = toInternalMatch(event);
      if (match.date && dates.includes(match.date)) byId.set(match.externalId, match);
    });
  });

  return {
    provider: 'thesportsdb',
    matches: Array.from(byId.values()),
    errors
  };
}
