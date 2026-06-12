import { Router } from 'express';
import { matches } from './store.js';

export const matchRouter = Router();

matchRouter.get('/', (req, res) => {
  res.json(matches);
});
