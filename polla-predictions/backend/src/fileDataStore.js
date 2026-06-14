import fs from 'fs/promises';
import path from 'path';

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = process.env.DATA_FILE || path.join(process.env.DATA_DIR || DEFAULT_DATA_DIR, 'polla-store.json');
const EXACT_SCORE_POINTS = 10;
const OUTCOME_POINTS = 5;

let writeQueue = Promise.resolve();

function emptyStore() {
  return {
    users: {},
    predictions: {},
    results: {},
    matches: {}
  };
}

async function readStore() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    return { ...emptyStore(), ...JSON.parse(content) };
  } catch (error) {
    if (error.code === 'ENOENT') return emptyStore();
    throw error;
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function updateStore(callback) {
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    const result = await callback(store);
    await writeStore(store);
    return result;
  });

  return writeQueue;
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    walletAddress: user.walletAddress || null,
    credits: user.credits || 0,
    points: user.points || 0
  };
}

export function buildUserFromFirebase(firebaseUser) {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || null,
    username: firebaseUser.name || (firebaseUser.email ? firebaseUser.email.split('@')[0] : `user-${Date.now()}`),
    walletAddress: null,
    credits: 100,
    points: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function ensureUser(firebaseUser) {
  return updateStore((store) => {
    if (store.users[firebaseUser.uid]) return store.users[firebaseUser.uid];

    const user = buildUserFromFirebase(firebaseUser);
    store.users[user.id] = user;
    return user;
  });
}

export async function updateUserWallet(userId, walletAddress) {
  return updateStore((store) => {
    const user = store.users[userId];
    if (!user) throw new Error('User not found');

    user.walletAddress = walletAddress;
    user.updatedAt = new Date().toISOString();
    return user;
  });
}

export async function listUsers() {
  const store = await readStore();
  return Object.values(store.users);
}

export async function listRanking() {
  const users = await listUsers();
  return users
    .map((user) => ({
      id: user.id,
      username: user.username,
      points: user.points || 0,
      credits: user.credits || 0
    }))
    .sort((a, b) => b.points - a.points);
}

export async function listStoredMatches(limit = 100) {
  const store = await readStore();
  return Object.values(store.matches)
    .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`))
    .slice(0, limit);
}

export async function listStoredMatchesByDate(date, limit = 500) {
  const store = await readStore();
  return Object.values(store.matches)
    .filter((match) => match.date === date)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
    .slice(0, limit);
}

export async function getStoredMatchById(matchId) {
  if (!matchId) return null;

  const store = await readStore();
  return store.matches[matchId] || null;
}

export async function upsertMatches(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  return updateStore((store) => {
    matches.forEach((match) => {
      store.matches[match.id] = { ...(store.matches[match.id] || {}), ...match };
    });
    return matches;
  });
}

export async function listPredictions(limit = 100) {
  const store = await readStore();
  return Object.values(store.predictions)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
}

export async function listUserPredictions(userId) {
  const predictions = await listPredictions();
  return predictions.filter((prediction) => prediction.userId === userId);
}

export async function createExactScorePrediction({ firebaseUser, match, outcome, predictedHomeScore, predictedAwayScore, cost }) {
  return updateStore((store) => {
    const now = new Date().toISOString();
    const user = store.users[firebaseUser.uid] || buildUserFromFirebase(firebaseUser);
    const predictionId = `${firebaseUser.uid}_${match.id}`;

    if (store.predictions[predictionId]) {
      const error = new Error('Already predicted');
      error.code = 'ALREADY_PREDICTED';
      throw error;
    }

    if ((user.credits || 0) < cost) {
      const error = new Error('Insufficient credits');
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }

    const prediction = {
      id: predictionId,
      userId: firebaseUser.uid,
      matchId: match.id,
      matchHome: match.home,
      matchAway: match.away,
      matchDate: match.date,
      matchTime: match.time,
      league: match.league,
      market: 'exactScore',
      selection: outcome,
      predictedHomeScore,
      predictedAwayScore,
      cost,
      createdAt: now,
      status: 'PENDING',
      pointsAwarded: 0
    };

    const updatedUser = {
      ...user,
      credits: (user.credits || 0) - cost,
      updatedAt: now
    };

    store.users[updatedUser.id] = updatedUser;
    store.predictions[prediction.id] = prediction;

    return {
      prediction,
      user: updatedUser
    };
  });
}

export async function countTodayPredictions(userId) {
  const predictions = await listUserPredictions(userId);
  const now = new Date();

  return predictions.filter((prediction) => {
    const date = new Date(prediction.createdAt);
    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  }).length;
}

export async function listSettledResults(limit = 100) {
  const store = await readStore();
  return Object.values(store.results)
    .sort((a, b) => String(b.settledAt || '').localeCompare(String(a.settledAt || '')))
    .slice(0, limit);
}

function getOutcomeFromScore(homeScore, awayScore) {
  if (homeScore > awayScore) return 'HOME';
  if (awayScore > homeScore) return 'AWAY';
  return 'DRAW';
}

export async function settleExactScorePredictions({ match, homeScore, awayScore, source = 'manual' }) {
  return updateStore((store) => {
    const existingResult = store.results[match.id];

    if (existingResult?.settledAt) {
      return {
        alreadySettled: true,
        result: existingResult,
        checked: 0,
        winners: 0,
        losers: 0,
        pointsAwarded: 0
      };
    }

    const now = new Date().toISOString();
    const finalOutcome = getOutcomeFromScore(homeScore, awayScore);
    const result = {
      id: match.id,
      matchId: match.id,
      home: match.home,
      away: match.away,
      league: match.league,
      date: match.date,
      time: match.time,
      homeScore,
      awayScore,
      outcome: finalOutcome,
      status: 'FINISHED',
      source,
      settledAt: now
    };

    let winners = 0;
    let losers = 0;
    let exactWinners = 0;
    let outcomeWinners = 0;
    let pointsAwarded = 0;

    Object.values(store.predictions)
      .filter((prediction) => prediction.matchId === match.id && prediction.status === 'PENDING')
      .forEach((prediction) => {
        const exactScoreWon = prediction.predictedHomeScore === homeScore &&
          prediction.predictedAwayScore === awayScore;
        const outcomeWon = prediction.selection === finalOutcome;
        const predictionPoints = exactScoreWon
          ? EXACT_SCORE_POINTS
          : outcomeWon
          ? OUTCOME_POINTS
          : 0;
        const won = predictionPoints > 0;

        if (exactScoreWon) {
          exactWinners += 1;
        } else if (outcomeWon) {
          outcomeWinners += 1;
        }

        if (won) {
          winners += 1;
          pointsAwarded += predictionPoints;
          const user = store.users[prediction.userId];
          if (user) {
            user.points = (user.points || 0) + predictionPoints;
            user.updatedAt = now;
          }
        } else {
          losers += 1;
        }

        store.predictions[prediction.id] = {
          ...prediction,
          status: won ? 'WON' : 'LOST',
          actualHomeScore: homeScore,
          actualAwayScore: awayScore,
          actualOutcome: finalOutcome,
          exactScoreWon,
          outcomeWon,
          pointsAwarded: predictionPoints,
          settledAt: now
        };
      });

    store.results[result.id] = result;

    return {
      alreadySettled: false,
      result,
      checked: Object.values(store.predictions).filter((prediction) => prediction.matchId === match.id).length,
      winners,
      losers,
      exactWinners,
      outcomeWinners,
      pointsAwarded
    };
  });
}
