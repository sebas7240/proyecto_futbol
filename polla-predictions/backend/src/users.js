import { Router } from 'express';
import { users } from './store.js';
import { firebaseAuthMiddleware } from './firebaseMiddleware.js';

export const userRouter = Router();

function ensureUser(firebaseUser) {
  let user = users.find((u) => u.id === firebaseUser.uid);
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

userRouter.get('/', (req, res) => {
  res.json(users);
});

userRouter.get('/me', firebaseAuthMiddleware, (req, res) => {
  const firebaseUser = req.firebaseUser;
  const user = ensureUser(firebaseUser);
  res.json({ user: { id: user.id, email: user.email, username: user.username, walletAddress: user.walletAddress, points: user.points, credits: user.credits } });
});

userRouter.put('/me', firebaseAuthMiddleware, (req, res) => {
  const firebaseUser = req.firebaseUser;
  const { walletAddress } = req.body;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ error: 'Wallet Solana inválida.' });
  }

  const user = ensureUser(firebaseUser);
  user.walletAddress = walletAddress.trim();

  res.json({ user: { id: user.id, email: user.email, username: user.username, walletAddress: user.walletAddress, points: user.points, credits: user.credits } });
});
