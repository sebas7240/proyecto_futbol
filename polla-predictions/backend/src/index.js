import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { authRouter } from './auth.js';
import { matchRouter } from './matches.js';
import { predictionRouter } from './predictions.js';
import { userRouter } from './users.js';
import { rankingRouter } from './ranking.js';
import { resultRouter } from './results.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

app.get('/api/status', (req, res) => {
  res.json({ ok: true, service: 'polla-predictions-backend', version: '0.1.0' });
});

app.use('/api/auth', authRouter);
app.use('/api/matches', matchRouter);
app.use('/api/predictions', predictionRouter);
app.use('/api/users', userRouter);
app.use('/api/ranking', rankingRouter);
app.use('/api/results', resultRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
