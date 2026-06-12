import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { matchRouter } from './matches.js';
import { predictionRouter } from './predictions.js';
import { userRouter } from './users.js';
import { rankingRouter } from './ranking.js';
import { resultRouter } from './results.js';
import { syncSportsDbMatches } from './sportsSyncService.js';

const app = express();
const PORT = process.env.PORT || 4000;
const autoSyncEnabled = process.env.AUTO_SYNC_ENABLED === 'true';
const autoSettleEnabled = process.env.AUTO_SETTLE_SYNCED_RESULTS === 'true';
const autoSyncMinutes = Math.max(Number(process.env.AUTO_SYNC_INTERVAL_MINUTES) || 60, 15);

app.use(cors());
app.use(bodyParser.json());

app.get('/api/status', (req, res) => {
  res.json({ ok: true, service: 'polla-predictions-backend', version: '0.1.0' });
});

app.use('/api/matches', matchRouter);
app.use('/api/predictions', predictionRouter);
app.use('/api/users', userRouter);
app.use('/api/ranking', rankingRouter);
app.use('/api/results', resultRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

if (autoSyncEnabled) {
  const runAutoSync = async () => {
    try {
      const result = await syncSportsDbMatches({ settleFinished: autoSettleEnabled });
      console.log(`[SportsSync] synced=${result.synced} settled=${result.settled}`);
    } catch (error) {
      console.error('[SportsSync] Error:', error);
    }
  };

  runAutoSync();
  const interval = setInterval(runAutoSync, autoSyncMinutes * 60 * 1000);
  interval.unref?.();
}
