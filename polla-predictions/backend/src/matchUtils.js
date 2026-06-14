import crypto from 'crypto';

export const MATCH_TIMEZONE = process.env.MATCH_TIMEZONE || 'America/Bogota';

const PROVIDER_PRIORITY = {
  'api-football': 30,
  openligadb: 20,
  thesportsdb: 10
};

function dateTimeParts(date, timeZone = MATCH_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`
  };
}

export function formatDateInTimezone(date = new Date(), timeZone = MATCH_TIMEZONE) {
  return dateTimeParts(date, timeZone).date;
}

export function getDateRange(days = 3, timeZone = MATCH_TIMEZONE) {
  const dates = [];
  const cursor = new Date();

  for (let index = 0; index < days; index += 1) {
    dates.push(formatDateInTimezone(cursor, timeZone));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return [...new Set(dates)];
}

export function getLocalDateTime(timestamp, timeZone = MATCH_TIMEZONE) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return {
    ...dateTimeParts(date, timeZone),
    rawTimestamp: date.toISOString()
  };
}

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isWorldCup(match) {
  const league = normalizeText(`${match.league || ''} ${match.leagueCode || ''}`);
  return league.includes('worldcup') ||
    league.includes('mundial') ||
    league.includes('wm2026') ||
    league.includes('fifawc');
}

export function getMatchKey(match) {
  const timestamp = match.rawTimestamp ? new Date(match.rawTimestamp) : null;
  const kickoff = timestamp && !Number.isNaN(timestamp.getTime())
    ? timestamp.toISOString().slice(0, 16)
    : `${match.date || ''}T${match.time || ''}`;

  if (isWorldCup(match)) {
    return `world-cup:${kickoff}`;
  }

  return [
    kickoff,
    normalizeText(match.homeCode || match.home),
    normalizeText(match.awayCode || match.away)
  ].join(':');
}

export function createStableMatchId(match) {
  const digest = crypto.createHash('sha1').update(getMatchKey(match)).digest('hex').slice(0, 16);
  return `fixture-${digest}`;
}

export function mergeProviderMatches(providerMatches) {
  const byKey = new Map();

  providerMatches.flat().filter(Boolean).forEach((match) => {
    const key = getMatchKey(match);
    const existing = byKey.get(key);
    const incomingPriority = PROVIDER_PRIORITY[match.source] || 0;
    const existingPriority = PROVIDER_PRIORITY[existing?.source] || 0;

    if (!existing || incomingPriority > existingPriority) {
      byKey.set(key, {
        ...existing,
        ...match,
        homeBadge: match.homeBadge || existing?.homeBadge || null,
        awayBadge: match.awayBadge || existing?.awayBadge || null,
        providerRefs: {
          ...(existing?.providerRefs || {}),
          ...(match.providerRefs || {})
        }
      });
      return;
    }

    byKey.set(key, {
      ...existing,
      homeBadge: existing.homeBadge || match.homeBadge || null,
      awayBadge: existing.awayBadge || match.awayBadge || null,
      providerRefs: {
        ...(existing.providerRefs || {}),
        ...(match.providerRefs || {})
      }
    });
  });

  return Array.from(byKey.values())
    .map((match) => ({ ...match, id: createStableMatchId(match) }))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function getTemporalStatus(rawTimestamp, finished = false) {
  if (finished) return 'FINISHED';
  const kickoff = rawTimestamp ? new Date(rawTimestamp) : null;
  if (!kickoff || Number.isNaN(kickoff.getTime())) return 'SCHEDULED';

  const elapsed = Date.now() - kickoff.getTime();
  if (elapsed < 0) return 'SCHEDULED';
  if (elapsed <= 4 * 60 * 60 * 1000) return 'LIVE';
  return 'UNKNOWN';
}

export function parseScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  return Number.isInteger(score) ? score : null;
}
