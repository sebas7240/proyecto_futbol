const DEFAULT_API_KEY = '123';
const DEFAULT_LEAGUE_IDS = ['4429', '4328', '4335'];
const DEFAULT_SYNC_DAYS = 3;
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

function normalizeLeagueIds(rawLeagueIds) {
  if (!rawLeagueIds) return DEFAULT_LEAGUE_IDS;

  const ids = rawLeagueIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : DEFAULT_LEAGUE_IDS;
}

function normalizeSyncDays(rawSyncDays) {
  const days = Number(rawSyncDays);
  if (!Number.isInteger(days) || days < 1) return DEFAULT_SYNC_DAYS;
  return Math.min(days, 7);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function toInternalMatch(event) {
  const timestamp = event.strTimestamp || null;
  const date = event.dateEvent || (timestamp ? timestamp.slice(0, 10) : null);
  const time = event.strTime ? event.strTime.slice(0, 5) : '';
  const homeScore = event.intHomeScore !== null && event.intHomeScore !== undefined
    ? Number(event.intHomeScore)
    : null;
  const awayScore = event.intAwayScore !== null && event.intAwayScore !== undefined
    ? Number(event.intAwayScore)
    : null;

  return {
    id: `tsdb-${event.idEvent}`,
    externalId: event.idEvent,
    source: 'thesportsdb',
    home: event.strHomeTeam || 'Local',
    away: event.strAwayTeam || 'Visitante',
    date: date || '',
    time,
    league: event.strLeague || 'Sin liga',
    status: Number.isInteger(homeScore) && Number.isInteger(awayScore) ? 'FINISHED' : 'SCHEDULED',
    homeScore,
    awayScore,
    homeBadge: event.strHomeTeamBadge || null,
    awayBadge: event.strAwayTeamBadge || null,
    rawTimestamp: timestamp,
    updatedAt: new Date().toISOString()
  };
}

async function fetchLeagueEvents({ apiKey, leagueId }) {
  const url = `${BASE_URL}/${apiKey}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'polla-predictions/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`TheSportsDB ${leagueId} responded ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.events) ? payload.events : [];
}

async function fetchDayEvents({ apiKey, date }) {
  const params = new URLSearchParams({
    d: date,
    s: 'Soccer'
  });
  const url = `${BASE_URL}/${apiKey}/eventsday.php?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'polla-predictions/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`TheSportsDB eventsday ${date} responded ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function fetchSportsDbMatches() {
  const apiKey = process.env.THESPORTSDB_API_KEY || DEFAULT_API_KEY;
  const leagueIds = normalizeLeagueIds(process.env.THESPORTSDB_LEAGUE_IDS);
  const syncDays = normalizeSyncDays(process.env.THESPORTSDB_SYNC_DAYS);
  const syncedAt = new Date().toISOString();
  const matchesById = new Map();

  for (const leagueId of leagueIds) {
    const events = await fetchLeagueEvents({ apiKey, leagueId });
    events.forEach((event) => {
      matchesById.set(event.idEvent, {
        ...toInternalMatch(event),
        leagueId,
        syncedAt
      });
    });
  }

  for (let index = 0; index < syncDays; index += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + index);
    const events = await fetchDayEvents({ apiKey, date: formatDate(date) });

    events.forEach((event) => {
      if (!matchesById.has(event.idEvent)) {
        matchesById.set(event.idEvent, {
          ...toInternalMatch(event),
          syncedAt
        });
      }
    });
  }

  const matches = Array.from(matchesById.values());

  return matches.sort((a, b) => {
    const aDate = `${a.date || ''} ${a.time || ''}`.trim();
    const bDate = `${b.date || ''} ${b.time || ''}`.trim();
    return aDate.localeCompare(bDate);
  });
}
