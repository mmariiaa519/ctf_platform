const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'marsec-dev-secret';

const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Acceso denegado' });
    next();
  });
};

module.exports = { requireAuth, requireAdmin };
