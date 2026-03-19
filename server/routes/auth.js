const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne, runQuery } = require('../models/database');
const { generateToken, verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email=?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV==='production', maxAge: 86400000, sameSite: 'lax' });
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error en login' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/register', verifyToken, async (req, res) => {
  try {
    if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'No autorizado' });
    const { name, email, password, role } = req.body;
    // admin (Finance SCool) can only create asesores; agency/superadmin can create any role
    const isAgency = ['superadmin', 'agencia'].includes(req.user.role);
    const agencyRoles = ['asesor', 'agencia', 'admin'];
    const adminRoles = ['asesor'];
    const allowedRoles = isAgency ? agencyRoles : adminRoles;
    const userRole = allowedRoles.includes(role) ? role : 'asesor';
    const existing = await queryOne('SELECT id FROM users WHERE email=?', [email]);
    if (existing)
      return res.status(400).json({ error: 'Email ya registrado' });
    const hash = bcrypt.hashSync(password, 10);
    const r = await runQuery('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)', [name, email, hash, userRole]);
    const user = await queryOne('SELECT id,name,email,role FROM users WHERE id=?', [r.lastInsertRowid]);
    res.json({ success: true, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error en registro' });
  }
});

module.exports = router;
