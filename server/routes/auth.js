const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne, runQuery, getDB } = require('../models/database');
const { generateToken, verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email=?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      // Señal de seguridad: intentos fallidos quedan en la bitácora (fuerza bruta)
      getDB().from('crm_activity').insert([{ user_name: String(email || '?').slice(0, 80), user_role: 'desconocido', action: 'login_fallido', entity: 'seguridad', detail: `IP ${req.ip || '?'}` }])
        .then(({ error: e }) => { if (e) console.error('activity log:', e.message); });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = generateToken(user);
    // sameSite lax: requests go through Netlify proxy (same domain), no need for 'none'
    // 'none' causes Safari ITP to restrict/delete the cookie on mobile
    res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 86400000, sameSite: 'lax', path: '/' });
    // Bitácora de sesiones (fire-and-forget)
    getDB().from('crm_activity').insert([{ user_id: user.id, user_name: user.name, user_role: user.role, action: 'login', entity: 'sesion' }])
      .then(({ error: e }) => { if (e) console.error('activity log:', e.message); });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error en login' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
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
    // Un asesor necesita su perfil en el CRM para tener cartera propia
    if (userRole === 'asesor') {
      const db = getDB();
      const { data: existing2 } = await db.from('crm_agents').select('id').eq('user_id', user.id).maybeSingle();
      if (!existing2) {
        await db.from('crm_agents').insert([{ nombre: name, email, user_id: user.id, clave: `A${String(user.id).padStart(4, '0')}`, cuaderno: 'NOVEL', fecha_inicio_calculos: new Date().toISOString().slice(0, 10) }]);
      }
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error en registro' });
  }
});

module.exports = router;
