import { Router } from 'express';
import { users } from './store.js';

export const rankingRouter = Router();

rankingRouter.get('/', (req, res) => {
  const ranking = users
    .map((user) => ({
      id: user.id,
      username: user.username,
      points: user.points || 0,
      credits: user.credits || 0
    }))
    .sort((a, b) => b.points - a.points);

  res.json(ranking);
});
