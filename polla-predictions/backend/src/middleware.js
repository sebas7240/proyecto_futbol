import jwt from 'jsonwebtoken';
import { users } from './store.js';

const secret = process.env.JWT_SECRET || 'polla-secret';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, secret);
    const user = users.find((u) => u.id === payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido.' });
  }
}
