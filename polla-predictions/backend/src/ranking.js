import { Router } from 'express';
import { listRanking } from './dataStore.js';

export const rankingRouter = Router();

rankingRouter.get('/', async (req, res) => {
  try {
    const ranking = await listRanking();
    res.json(ranking);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo cargar el ranking.' });
  }
});
