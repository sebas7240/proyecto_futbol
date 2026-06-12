export function requireAdmin(req, res, next) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return res.status(503).json({ error: 'ADMIN_SECRET no configurado.' });
  }

  if (req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  next();
}
