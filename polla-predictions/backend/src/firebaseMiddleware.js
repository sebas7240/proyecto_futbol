import { firebaseAuth } from './firebaseAdmin.js';

export async function firebaseAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado.' });
  }

  const token = authHeader.slice(7);

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token Firebase inválido.' });
  }
}
