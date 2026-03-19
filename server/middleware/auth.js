const jwt = require('jsonwebtoken');
const { queryOne } = require('../models/database');
const JWT_SECRET = process.env.JWT_SECRET || 'financescool_secret';

function generateToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Store decoded user info directly from JWT token
    // This avoids database call on every request
    req.user = { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role };
    next();
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
}

module.exports = { generateToken, verifyToken, JWT_SECRET };
