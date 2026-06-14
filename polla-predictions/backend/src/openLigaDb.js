import { getLocalDateTime, getTemporalStatus, parseScore } from './matchUtils.js';

const BASE_URL = 'https://api.openligadb.de';
const DEFAULT_LEAGUES = ['wm2026:2026'];
const TEAM_NAMES_ES = {
  ALG: 'Argelia',
  ARG: 'Argentina',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Bélgica',
  BRA: 'Brasil',
  CAN: 'Canadá',
  CIV: 'Costa de Marfil',
  COL: 'Colombia',
  CPV: 'Cabo Verde',
  CRO: 'Croacia',
  CUW: 'Curazao',
  DEN: 'Dinamarca',
  ECU: 'Ecuador',
  EGY: 'Egipto',
  ENG: 'Inglaterra',
  ESP: 'España',
  FRA: 'Francia',
  GER: 'Alemania',
  GHA: 'Ghana',
  HAI: 'Haití',
  HTI: 'Haití',
  IRN: 'Irán',
  ITA: 'Italia',
  JAM: 'Jamaica',
  JOR: 'Jordania',
  JPN: 'Japón',
  KOR: 'Corea del Sur',
  KSA: 'Arabia Saudita',
  MAR: 'Marruecos',
  MEX: 'México',
  NED: 'Países Bajos',
  NLD: 'Países Bajos',
  NOR: 'Noruega',
  NZL: 'Nueva Zelanda',
  PAN: 'Panamá',
  PAR: 'Paraguay',
  POL: 'Polonia',
  POR: 'Portugal',
  QAT: 'Catar',
  SCO: 'Escocia',
  SEN: 'Senegal',
  SRB: 'Serbia',
  SUI: 'Suiza',
  SWE: 'Suecia',
  TUN: 'Túnez',
  TUR: 'Turquía',
  UKR: 'Ucrania',
  URU: 'Uruguay',
  USA: 'Estados Unidos',
  UZB: 'Uzbekistán',
  RSA: 'Sudáfrica'
};

function normalizeLeagueConfigs(rawValue) {
  const values = String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : DEFAULT_LEAGUES;
}

function getFinalResult(results = []) {
  return [...results]
    .sort((a, b) => Number(b.resultOrderID || 0) - Number(a.resultOrderID || 0))
    .find((result) => Number.isInteger(Number(result.pointsTeam1)) && Number.isInteger(Number(result.pointsTeam2)));
}

function getTeamName(team) {
  return TEAM_NAMES_ES[String(team?.shortName || '').toUpperCase()] || team?.teamName;
}

function toInternalMatch(item) {
  const local = getLocalDateTime(item.matchDateTimeUTC || item.matchDateTime);
  if (!local) return null;
  const finalResult = item.matchIsFinished ? getFinalResult(item.matchResults) : null;

  return {
    externalId: String(item.matchID),
    source: 'openligadb',
    providerRefs: { openligadb: String(item.matchID) },
    home: getTeamName(item.team1) || 'Local',
    away: getTeamName(item.team2) || 'Visitante',
    homeCode: item.team1?.shortName || '',
    awayCode: item.team2?.shortName || '',
    date: local.date,
    time: local.time,
    rawTimestamp: local.rawTimestamp,
    league: item.leagueName || 'Sin liga',
    leagueCode: item.leagueShortcut || '',
    status: getTemporalStatus(local.rawTimestamp, item.matchIsFinished === true),
    homeScore: finalResult ? parseScore(finalResult.pointsTeam1) : null,
    awayScore: finalResult ? parseScore(finalResult.pointsTeam2) : null,
    homeBadge: item.team1?.teamIconUrl?.replace(/^http:/, 'https:') || null,
    awayBadge: item.team2?.teamIconUrl?.replace(/^http:/, 'https:') || null,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchOpenLigaDbMatches({ dates }) {
  if (process.env.OPENLIGADB_ENABLED === 'false') {
    return { provider: 'openligadb', skipped: true, matches: [] };
  }

  const wantedDates = new Set(dates);
  const matches = [];
  const errors = [];

  for (const config of normalizeLeagueConfigs(process.env.OPENLIGADB_LEAGUES)) {
    const [shortcut, season] = config.split(':');
    if (!shortcut || !season) continue;

    try {
      const response = await fetch(
        `${BASE_URL}/getmatchdata/${encodeURIComponent(shortcut)}/${encodeURIComponent(season)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) }
      );
      if (!response.ok) throw new Error(`responded ${response.status}`);
      const payload = await response.json();

      (Array.isArray(payload) ? payload : []).forEach((item) => {
        const match = toInternalMatch(item);
        if (match && wantedDates.has(match.date)) matches.push(match);
      });
    } catch (error) {
      errors.push(`${shortcut}:${season}: ${error.message}`);
    }
  }

  return { provider: 'openligadb', matches, errors };
}
