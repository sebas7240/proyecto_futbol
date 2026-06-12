import { db } from './firebaseAdmin.js';

const USERS_COLLECTION = 'polla_users';
const PREDICTIONS_COLLECTION = 'polla_predictions';

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

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
