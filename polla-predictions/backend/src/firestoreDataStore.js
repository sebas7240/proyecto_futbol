import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';

const USERS_COLLECTION = 'polla_users';
const PREDICTIONS_COLLECTION = 'polla_predictions';
const RESULTS_COLLECTION = 'polla_results';
const MATCHES_COLLECTION = 'polla_matches';
const EXACT_SCORE_POINTS = 10;
const OUTCOME_POINTS = 5;

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
  const userRef = db.collection(USERS_COLLECTION).doc(firebaseUser.uid);
  const snapshot = await userRef.get();

  if (snapshot.exists) {
    return { id: snapshot.id, ...snapshot.data() };
  }

  const user = buildUserFromFirebase(firebaseUser);
  await userRef.set(user);
  return user;
}

export async function updateUserWallet(userId, walletAddress) {
  const userRef = db.collection(USERS_COLLECTION).doc(userId);
  const snapshot = await userRef.get();
  if (!snapshot.exists) throw new Error('User not found');

  await userRef.update({
    walletAddress,
    updatedAt: new Date().toISOString()
  });

  const updated = await userRef.get();
  return { id: updated.id, ...updated.data() };
}

export async function listUsers() {
  const snapshot = await db.collection(USERS_COLLECTION).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  const snapshot = await db
    .collection(MATCHES_COLLECTION)
    .orderBy('date', 'asc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getStoredMatchById(matchId) {
  if (!matchId) return null;

  const snapshot = await db.collection(MATCHES_COLLECTION).doc(matchId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function upsertMatches(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  const batch = db.batch();
  matches.forEach((match) => {
    const matchRef = db.collection(MATCHES_COLLECTION).doc(match.id);
    batch.set(matchRef, match, { merge: true });
  });

  await batch.commit();
  return matches;
}

export async function listPredictions(limit = 100) {
  const snapshot = await db
    .collection(PREDICTIONS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function listUserPredictions(userId) {
  const snapshot = await db
    .collection(PREDICTIONS_COLLECTION)
    .where('userId', '==', userId)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function createExactScorePrediction({ firebaseUser, match, outcome, predictedHomeScore, predictedAwayScore, cost }) {
  const userRef = db.collection(USERS_COLLECTION).doc(firebaseUser.uid);
  const predictionRef = db.collection(PREDICTIONS_COLLECTION).doc(`${firebaseUser.uid}_${match.id}`);
  const now = new Date().toISOString();

  return await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const predictionSnapshot = await transaction.get(predictionRef);

    const user = userSnapshot.exists
      ? { id: userSnapshot.id, ...userSnapshot.data() }
      : buildUserFromFirebase(firebaseUser);

    if (predictionSnapshot.exists) {
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
      id: predictionRef.id,
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

    transaction.set(userRef, updatedUser, { merge: true });
    transaction.set(predictionRef, prediction);

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
  const snapshot = await db
    .collection(RESULTS_COLLECTION)
    .orderBy('settledAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function getOutcomeFromScore(homeScore, awayScore) {
  if (homeScore > awayScore) return 'HOME';
  if (awayScore > homeScore) return 'AWAY';
  return 'DRAW';
}

export async function settleExactScorePredictions({ match, homeScore, awayScore, source = 'manual' }) {
  const resultRef = db.collection(RESULTS_COLLECTION).doc(match.id);
  const existingResult = await resultRef.get();

  if (existingResult.exists && existingResult.data()?.settledAt) {
    return {
      alreadySettled: true,
      result: { id: existingResult.id, ...existingResult.data() },
      checked: 0,
      winners: 0,
      losers: 0,
      pointsAwarded: 0
    };
  }

  const now = new Date().toISOString();
  const pendingSnapshot = await db
    .collection(PREDICTIONS_COLLECTION)
    .where('matchId', '==', match.id)
    .where('status', '==', 'PENDING')
    .get();

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

  const batch = db.batch();
  const userPoints = new Map();
  let winners = 0;
  let losers = 0;
  let exactWinners = 0;
  let outcomeWinners = 0;
  let pointsAwarded = 0;

  batch.set(resultRef, result, { merge: true });

  pendingSnapshot.docs.forEach((doc) => {
    const prediction = doc.data();
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
      userPoints.set(prediction.userId, (userPoints.get(prediction.userId) || 0) + predictionPoints);
    } else {
      losers += 1;
    }

    batch.update(doc.ref, {
      status: won ? 'WON' : 'LOST',
      actualHomeScore: homeScore,
      actualAwayScore: awayScore,
      actualOutcome: finalOutcome,
      exactScoreWon,
      outcomeWon,
      pointsAwarded: predictionPoints,
      settledAt: now
    });
  });

  for (const [userId, points] of userPoints.entries()) {
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    batch.set(userRef, {
      points: FieldValue.increment(points),
      updatedAt: now
    }, { merge: true });
  }

  await batch.commit();

  return {
    alreadySettled: false,
    result,
    checked: pendingSnapshot.size,
    winners,
    losers,
    exactWinners,
    outcomeWinners,
    pointsAwarded
  };
}
