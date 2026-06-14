import { matches as demoMatches } from './store.js';
import {
  listStoredMatchesByDate,
  settleExactScorePredictions,
  upsertMatches
} from './dataStore.js';
import { fetchAggregatedMatches } from './matchProviders.js';

function hasFinalScore(match) {
  return match.status === 'FINISHED' &&
    Number.isInteger(match.homeScore) &&
    Number.isInteger(match.awayScore);
}

let activeSync = null;

async function performSync({ settleFinished = false } = {}) {
  const result = await fetchAggregatedMatches();
  await upsertMatches(result.matches);

  const settlements = [];
  if (settleFinished) {
    for (const match of result.matches.filter(hasFinalScore)) {
      const settlement = await settleExactScorePredictions({
        match,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        source: match.source
      });
      settlements.push(settlement);
    }
  }

  const storedByDate = await Promise.all(
    result.dates.map((date) => listStoredMatchesByDate(date))
  );
  const storedMatches = storedByDate.flat();

  result.providers.forEach((provider) => {
    const details = provider.errors.length > 0 ? ` errors=${provider.errors.join('; ')}` : '';
    console.log(`[MatchSync] ${provider.provider} count=${provider.count} skipped=${provider.skipped}${details}`);
  });

  return {
    synced: result.matches.length,
    settled: settlements.filter((settlement) => !settlement.alreadySettled).length,
    settlements,
    providers: result.providers,
    dates: result.dates,
    matches: storedMatches.length > 0 ? storedMatches : demoMatches
  };
}

export function syncSportsDbMatches(options = {}) {
  if (activeSync) return activeSync;

  activeSync = performSync(options).finally(() => {
    activeSync = null;
  });
  return activeSync;
}
