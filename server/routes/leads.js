const express = require('express');
const { queryAll, queryOne, runQuery } = require('../models/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Nombre y teléfono requeridos' });
    const cleanName = String(name).replace(/[<>"'&]/g, '').trim().slice(0, 100);
    const cleanPhone = String(phone).replace(/[^\d+\-() ]/g, '').slice(0, 20);
    const cleanEmail = email ? String(email).trim().toLowerCase().slice(0, 100) : null;
    const cleanMessage = message ? String(message).replace(/[<>"'&]/g, '').trim().slice(0, 500) : '';
    if (cleanName.length < 2 || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'\-]+$/.test(cleanName)) {
      return res.status(400).json({ error: 'Nombre no válido' });
    }
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({ error: 'Teléfono no válido' });
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Correo no válido' });
    }
    const allowedServices = ['PPR', 'consulta', 'fiscal', 'retiro'];
    const cleanService = allowedServices.includes(service) ? service : 'PPR';
    const r = await runQuery('INSERT INTO leads (name,email,phone,service,message,source) VALUES (?,?,?,?,?,?)',
      [cleanName, cleanEmail, cleanPhone, cleanService, cleanMessage, 'landing']);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, search, page=1, limit=20 } = req.query;
    let q = 'SELECT * FROM leads WHERE 1=1';
    let cq = 'SELECT COUNT(*) as c FROM leads WHERE 1=1';
    const p = [];
    if (status && status !== 'todos') { q += ' AND status=?'; cq += ' AND status=?'; p.push(status); }
    if (search) {
      const cleanSearch = String(search).replace(/[%_]/g, '').slice(0, 50);
      q += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      cq += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      p.push(`%${cleanSearch}%`,`%${cleanSearch}%`,`%${cleanSearch}%`);
    }
    const countResult = await queryOne(cq, p);
    const total = countResult?.c || 0;
    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const pFull = [...p, +limit, (+page-1)*(+limit)];
    const leads = await queryAll(q, pFull);
    res.json({ leads, total, page:+page, totalPages: Math.ceil(total/+limit) });
  } catch (err) {
    console.error('Get leads error:', err);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const lead = await queryOne('SELECT * FROM leads WHERE id=?', [+req.params.id]);
    if (!lead) return res.status(404).json({ error: 'No encontrado' });
    const notes = await queryAll('SELECT n.*,u.name as author FROM notes n JOIN users u ON n.user_id=u.id WHERE n.lead_id=? ORDER BY n.created_at DESC', [+req.params.id]);
    res.json({ lead, notes });
  } catch (err) {
    console.error('Get lead error:', err);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { status, assigned_to, note } = req.body;
    if (status) await runQuery('UPDATE leads SET status=?,updated_at=now() WHERE id=?', [status, +req.params.id]);
    if (assigned_to !== undefined) await runQuery('UPDATE leads SET assigned_to=?,updated_at=now() WHERE id=?', [assigned_to, +req.params.id]);
    if (note) await runQuery('INSERT INTO notes (lead_id,user_id,content) VALUES (?,?,?)', [+req.params.id, req.user.id, note]);
    const lead = await queryOne('SELECT * FROM leads WHERE id=?', [+req.params.id]);
    res.json({ success: true, lead });
  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await runQuery('DELETE FROM leads WHERE id=?', [+req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete lead error:', err);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

module.exports = router;
