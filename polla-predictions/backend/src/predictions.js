import { Router } from 'express';
import { matches } from './store.js';
import { firebaseAuthMiddleware } from './firebaseMiddleware.js';
import {
  countTodayPredictions,
  createExactScorePrediction,
  listPredictions,
  publicUser
} from './dataStore.js';

export const predictionRouter = Router();

const DAILY_PREDICTION_LIMIT = 5;
const PREDICTION_COST = 20;
const OUTCOMES = ['HOME', 'DRAW', 'AWAY'];

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 30) return null;
  return score;
}

function getOutcomeFromScore(homeScore, awayScore) {
  if (homeScore > awayScore) return 'HOME';
  if (awayScore > homeScore) return 'AWAY';
  return 'DRAW';
}

predictionRouter.get('/', async (req, res) => {
  try {
    const predictions = await listPredictions();
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar las predicciones.' });
  }
});

predictionRouter.post('/', firebaseAuthMiddleware, async (req, res) => {
  const { matchId, outcome, homeScore, awayScore } = req.body;
  const firebaseUser = req.firebaseUser;
  const match = matches.find((item) => item.id === matchId);
  const predictedHomeScore = normalizeScore(homeScore);
  const predictedAwayScore = normalizeScore(awayScore);

  if (!match) {
    return res.status(400).json({ error: 'Partido no valido.' });
  }

  if (match.status !== 'SCHEDULED') {
    return res.status(400).json({ error: 'Este partido ya no acepta predicciones.' });
  }

  if (!OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: 'Ganador seleccionado no valido.' });
  }

  if (predictedHomeScore === null || predictedAwayScore === null) {
    return res.status(400).json({ error: 'Marcador exacto no valido.' });
  }

  if (getOutcomeFromScore(predictedHomeScore, predictedAwayScore) !== outcome) {
    return res.status(400).json({ error: 'El ganador no coincide con el marcador exacto.' });
  }

  try {
    const todayPredictions = await countTodayPredictions(firebaseUser.uid);
    if (todayPredictions >= DAILY_PREDICTION_LIMIT) {
      return res.status(429).json({ error: 'Llegaste al limite diario de predicciones.' });
    }

    const { prediction, user } = await createExactScorePrediction({
      firebaseUser,
      match,
      outcome,
      predictedHomeScore,
      predictedAwayScore,
      cost: PREDICTION_COST
    });

    res.json({ prediction, user: publicUser(user) });
  } catch (error) {
    if (error.code === 'ALREADY_PREDICTED') {
      return res.status(409).json({ error: 'Ya hiciste una prediccion para este partido.' });
    }

    if (error.code === 'INSUFFICIENT_CREDITS') {
      return res.status(400).json({ error: 'No tienes creditos suficientes.' });
    }

    res.status(500).json({ error: 'No se pudo guardar la prediccion.' });
  }
});
