import { fetchApiFootballMatches } from './apiFootball.js';
import { MATCH_TIMEZONE, getDateRange, mergeProviderMatches } from './matchUtils.js';
import { fetchOpenLigaDbMatches } from './openLigaDb.js';
import { fetchSportsDbMatches } from './sportsDb.js';

function normalizeSyncDays(rawValue) {
  const days = Number(rawValue);
  if (!Number.isInteger(days) || days < 1) return 3;
  return Math.min(days, 7);
}

export async function fetchAggregatedMatches() {
  const days = normalizeSyncDays(process.env.MATCH_SYNC_DAYS || process.env.THESPORTSDB_SYNC_DAYS);
  const dates = getDateRange(days, MATCH_TIMEZONE);
  const context = { dates, timeZone: MATCH_TIMEZONE };
  const settled = await Promise.allSettled([
    fetchApiFootballMatches(context),
    fetchOpenLigaDbMatches(context),
    fetchSportsDbMatches(context)
  ]);

  const reports = settled.map((result, index) => {
    const provider = ['api-football', 'openligadb', 'thesportsdb'][index];
    if (result.status === 'fulfilled') return result.value;
    return { provider, matches: [], errors: [result.reason.message] };
  });
  const matches = mergeProviderMatches(reports.map((report) => report.matches || []));
  const availableProviders = reports.filter((report) => report.skipped !== true);
  const everyProviderFailed = availableProviders.length > 0 &&
    availableProviders.every((report) => (report.matches?.length || 0) === 0 && (report.errors?.length || 0) > 0);

  if (matches.length === 0 && everyProviderFailed) {
    throw new Error(reports.flatMap((report) => report.errors || []).join(' | '));
  }

  return {
    dates,
    matches,
    providers: reports.map((report) => ({
      provider: report.provider,
      count: report.matches?.length || 0,
      skipped: report.skipped === true,
      errors: report.errors || []
    }))
  };
}
