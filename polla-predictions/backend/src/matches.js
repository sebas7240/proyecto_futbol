import { Router } from 'express';
import { matches } from './store.js';
import { requireAdmin } from './adminMiddleware.js';
import { listStoredMatches } from './dataStore.js';
import { syncSportsDbMatches } from './sportsSyncService.js';

export const matchRouter = Router();

matchRouter.get('/', async (req, res) => {
  try {
    const storedMatches = await listStoredMatches();
    res.json(storedMatches.length > 0 ? storedMatches : matches);
  } catch (error) {
    console.error('[Matches] Error loading stored matches:', error);
    res.json(matches);
  }
});

matchRouter.post('/sync/thesportsdb', requireAdmin, async (req, res) => {
  try {
    const settleFinished = req.body?.settleFinished === true;
    const result = await syncSportsDbMatches({ settleFinished });
    res.json(result);
  } catch (error) {
    console.error('[Matches] TheSportsDB sync error:', error);
    res.status(502).json({ error: 'No se pudo sincronizar TheSportsDB.' });
  }
});
