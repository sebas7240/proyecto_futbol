import { Router } from 'express';
import { predictions, users, matches } from './store.js';
import { firebaseAuthMiddleware } from './firebaseMiddleware.js';

export const predictionRouter = Router();

const DAILY_PREDICTION_LIMIT = 5;
const PREDICTION_COST = 20;

const MARKET_SELECTIONS = {
  result: ['HOME', 'DRAW', 'AWAY'],
  goals25: ['OVER_25', 'UNDER_25'],
  bothScore: ['YES', 'NO']
};

function isSameDay(isoDate, now = new Date()) {
  const date = new Date(isoDate);
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function ensureUser(firebaseUser) {
  let user = users.find((item) => item.id === firebaseUser.uid);

  if (!user) {
    user = {
      id: firebaseUser.uid,
      email: firebaseUser.email,
      username: firebaseUser.name || (firebaseUser.email ? firebaseUser.email.split('@')[0] : `user-${Date.now()}`),
      walletAddress: null,
      passwordHash: null,
      credits: 100,
      points: 0
    };
    users.push(user);
  }

  return user;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    walletAddress: user.walletAddress,
    credits: user.credits,
    points: user.points
  };
}

predictionRouter.get('/', (req, res) => {
  res.json(predictions);
});

predictionRouter.post('/', firebaseAuthMiddleware, (req, res) => {
  const { matchId, market, selection } = req.body;
  const firebaseUser = req.firebaseUser;
  const userId = firebaseUser.uid;
  const user = ensureUser(firebaseUser);
  const match = matches.find((item) => item.id === matchId);

  if (!match) {
    return res.status(400).json({ error: 'Partido no valido.' });
  }

  if (match.status !== 'SCHEDULED') {
    return res.status(400).json({ error: 'Este partido ya no acepta predicciones.' });
  }

  if (!MARKET_SELECTIONS[market]) {
    return res.status(400).json({ error: 'Mercado no valido.' });
  }

  if (!MARKET_SELECTIONS[market].includes(selection)) {
    return res.status(400).json({ error: 'Seleccion no valida para este mercado.' });
  }

  const alreadyPredicted = predictions.some((prediction) =>
    prediction.userId === userId &&
    prediction.matchId === matchId &&
    prediction.market === market
  );

  if (alreadyPredicted) {
    return res.status(409).json({ error: 'Ya hiciste una prediccion para este mercado.' });
  }

  const todayPredictions = predictions.filter((prediction) =>
    prediction.userId === userId && isSameDay(prediction.createdAt)
  );

  if (todayPredictions.length >= DAILY_PREDICTION_LIMIT) {
    return res.status(429).json({ error: 'Llegaste al limite diario de predicciones.' });
  }

  if ((user.credits || 0) < PREDICTION_COST) {
    return res.status(400).json({ error: 'No tienes creditos suficientes.' });
  }

  const prediction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    matchId,
    market,
    selection,
    cost: PREDICTION_COST,
    createdAt: new Date().toISOString(),
    status: 'PENDING'
  };

  predictions.push(prediction);
  user.credits = (user.credits || 0) - PREDICTION_COST;

  res.json({ prediction, user: publicUser(user) });
});
