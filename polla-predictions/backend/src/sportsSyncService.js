import { matches as demoMatches } from './store.js';
import {
  listStoredMatches,
  settleExactScorePredictions,
  upsertMatches
} from './dataStore.js';
import { fetchSportsDbMatches } from './sportsDb.js';

function hasFinalScore(match) {
  return match.status === 'FINISHED' &&
    Number.isInteger(match.homeScore) &&
    Number.isInteger(match.awayScore);
}

export async function syncSportsDbMatches({ settleFinished = false } = {}) {
  const syncedMatches = await fetchSportsDbMatches();
  await upsertMatches(syncedMatches);

  const settlements = [];
  if (settleFinished) {
    for (const match of syncedMatches.filter(hasFinalScore)) {
      const settlement = await settleExactScorePredictions({
        match,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        source: 'thesportsdb'
      });
      settlements.push(settlement);
    }
  }

  const storedMatches = await listStoredMatches();

  return {
    synced: syncedMatches.length,
    settled: settlements.filter((settlement) => !settlement.alreadySettled).length,
    settlements,
    matches: storedMatches.length > 0 ? storedMatches : demoMatches
  };
}
