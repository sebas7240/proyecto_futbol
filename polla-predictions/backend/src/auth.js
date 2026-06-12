import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users } from './store.js';

const secret = process.env.JWT_SECRET || 'polla-secret';
export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, username, password, walletAddress } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Faltan datos de registro.' });
  }

  const existing = users.find((u) => u.email === email || u.username === username);
  if (existing) {
    return res.status(409).json({ error: 'Email o usuario ya registrado.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    username,
    walletAddress: walletAddress || null,
    passwordHash: hashed,
    credits: 100,
    points: 0
  };
  users.push(user);

  const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });
  res.status(201).json({ user: { id: user.id, email: user.email, username: user.username, walletAddress: user.walletAddress }, token });
});

authRouter.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  const user = users.find((u) => u.email === email || u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });
  res.json({ user: { id: user.id, email: user.email, username: user.username, walletAddress: user.walletAddress }, token });
});
