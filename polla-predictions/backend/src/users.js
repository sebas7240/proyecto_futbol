import { Router } from 'express';
import { firebaseAuthMiddleware } from './firebaseMiddleware.js';
import { ensureUser, listUsers, publicUser, updateUserWallet } from './dataStore.js';

export const userRouter = Router();

userRouter.get('/', async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users.map(publicUser));
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los usuarios.' });
  }
});

userRouter.get('/me', firebaseAuthMiddleware, async (req, res) => {
  try {
    const user = await ensureUser(req.firebaseUser);
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo cargar el perfil.' });
  }
});

userRouter.put('/me', firebaseAuthMiddleware, async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ error: 'Wallet Solana invalida.' });
  }

  try {
    await ensureUser(req.firebaseUser);
    const user = await updateUserWallet(req.firebaseUser.uid, walletAddress.trim());
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar la wallet.' });
  }
});
