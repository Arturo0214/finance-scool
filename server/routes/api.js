const express = require('express');
const { queryAll, queryOne, runQuery } = require('../models/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.get('/stats', verifyToken, async (req, res) => {
  try {
    const totalLeads = await queryOne('SELECT COUNT(*) as c FROM leads');
    const newLeads = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status='nuevo'");
    const inProgress = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status IN ('en_proceso','contactado')");
    const converted = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status='convertido'");
    const leadsBySource = await queryAll('SELECT source,COUNT(*) as count FROM leads GROUP BY source');
    const leadsByStatus = await queryAll('SELECT status,COUNT(*) as count FROM leads GROUP BY status');
    const recentLeads = await queryAll('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5');

    res.json({
      totalLeads: totalLeads?.c || 0,
      newLeads: newLeads?.c || 0,
      inProgress: inProgress?.c || 0,
      converted: converted?.c || 0,
      todayEvents: 0,
      weekLeads: 0,
      leadsBySource,
      leadsByStatus,
      recentLeads,
      monthlyLeads: []
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Agency-only analytics endpoint
router.get('/agency-stats', verifyToken, async (req, res) => {
  try {
    if (!['superadmin', 'agencia'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado — solo agencia' });
    }

    const totalLeads = await queryOne('SELECT COUNT(*) as c FROM leads');
    const newLeads = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status='nuevo'");
    const contactados = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status='contactado'");
    const enProceso = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status='en_proceso'");
    const converted = await queryOne("SELECT COUNT(*) as c FROM leads WHERE status='convertido'");
    const leadsBySource = await queryAll('SELECT source,COUNT(*) as count FROM leads GROUP BY source');
    const leadsByStatus = await queryAll('SELECT status,COUNT(*) as count FROM leads GROUP BY status');
    const recentLeads = await queryAll('SELECT * FROM leads ORDER BY created_at DESC LIMIT 10');

    // Calculate conversion rates
    const total = totalLeads?.c || 1;
    const conversionRate = ((converted?.c || 0) / total * 100).toFixed(1);
    const contactRate = ((contactados?.c || 0) / total * 100).toFixed(1);
    const processRate = ((enProceso?.c || 0) / total * 100).toFixed(1);

    // Funnel data
    const funnel = [
      { stage: 'Nuevos', count: newLeads?.c || 0, color: '#D97706' },
      { stage: 'Contactados', count: contactados?.c || 0, color: '#0066CC' },
      { stage: 'En Proceso', count: enProceso?.c || 0, color: '#EA580C' },
      { stage: 'Convertidos', count: converted?.c || 0, color: '#059669' },
    ];

    // Source performance with conversion data
    const sourcePerformance = (leadsBySource || []).map(s => ({
      source: s.source || 'Directo',
      total: s.count || 0,
      percentage: ((s.count || 0) / total * 100).toFixed(1),
    }));

    res.json({
      totalLeads: totalLeads?.c || 0,
      newLeads: newLeads?.c || 0,
      contactados: contactados?.c || 0,
      enProceso: enProceso?.c || 0,
      converted: converted?.c || 0,
      conversionRate,
      contactRate,
      processRate,
      funnel,
      sourcePerformance,
      leadsBySource,
      leadsByStatus,
      recentLeads,
    });
  } catch (err) {
    console.error('Agency stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas de agencia' });
  }
});

router.get('/events', verifyToken, async (req, res) => {
  try {
    const events = await queryAll('SELECT * FROM events ORDER BY start_date ASC');
    res.json(events);
  } catch (err) {
    console.error('Events error:', err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

router.post('/events', verifyToken, async (req, res) => {
  try {
    const { title, description, start_date, end_date, all_day, color, lead_id } = req.body;
    const r = await runQuery('INSERT INTO events (title,description,start_date,end_date,all_day,color,user_id,lead_id) VALUES (?,?,?,?,?,?,?,?)',
      [title, description||'', start_date, end_date||null, all_day?1:0, color||'#C9A84C', req.user.id, lead_id||null]);
    const event = await queryOne('SELECT * FROM events WHERE id=?', [r.lastInsertRowid]);
    res.json({ success: true, event });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

router.put('/events/:id', verifyToken, async (req, res) => {
  try {
    const { title, description, start_date, end_date, color } = req.body;
    await runQuery('UPDATE events SET title=?,description=?,start_date=?,end_date=?,color=? WHERE id=?',
      [title, description, start_date, end_date, color, +req.params.id]);
    const event = await queryOne('SELECT * FROM events WHERE id=?', [+req.params.id]);
    res.json({ success: true, event });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});

router.delete('/events/:id', verifyToken, async (req, res) => {
  try {
    await runQuery('DELETE FROM events WHERE id=?', [+req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

router.get('/messages', verifyToken, async (req, res) => {
  try {
    const { channel='general', limit=50 } = req.query;
    const msgs = await queryAll('SELECT m.*,u.name as sender_name FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.channel=? ORDER BY m.created_at DESC LIMIT ?', [channel, +limit]);
    res.json(msgs.reverse());
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

router.post('/messages', verifyToken, async (req, res) => {
  try {
    const { content, channel='general' } = req.body;
    if (!content) return res.status(400).json({ error: 'Mensaje vacío' });
    const r = await runQuery('INSERT INTO messages (sender_id,content,channel) VALUES (?,?,?)', [req.user.id, content, channel]);
    const msg = await queryOne('SELECT m.*,u.name as sender_name FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.id=?', [r.lastInsertRowid]);
    res.json({ success: true, message: msg });
  } catch (err) {
    console.error('Create message error:', err);
    res.status(500).json({ error: 'Error al crear mensaje' });
  }
});

router.get('/users', verifyToken, async (req, res) => {
  try {
    const users = await queryAll('SELECT id,name,email,role,created_at FROM users');
    res.json(users);
  } catch (err) {
    console.error('Users error:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Visit analytics
router.get('/visits/stats', verifyToken, async (req, res) => {
  try {
    // Try to get visit data; table may not exist yet
    const totalVisits = await queryOne('SELECT COUNT(*) as c FROM visits').catch(() => ({ c: 0 }));
    const todayVisits = await queryOne("SELECT COUNT(*) as c FROM visits WHERE DATE(created_at) = DATE('now')").catch(() => ({ c: 0 }));
    const uniqueVisitors = await queryOne('SELECT COUNT(DISTINCT ip) as c FROM visits').catch(() => ({ c: 0 }));
    const pageViews = await queryAll('SELECT page, COUNT(*) as views FROM visits GROUP BY page ORDER BY views DESC LIMIT 10').catch(() => []);
    const sourceData = await queryAll('SELECT source, COUNT(*) as count FROM visits GROUP BY source ORDER BY count DESC').catch(() => []);
    const dailyVisits = await queryAll("SELECT DATE(created_at) as date, COUNT(*) as count FROM visits GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30").catch(() => []);

    res.json({
      totalVisits: totalVisits?.c || 0,
      todayVisits: todayVisits?.c || 0,
      uniqueVisitors: uniqueVisitors?.c || 0,
      bounceRate: 0,
      avgSessionDuration: '0:00',
      pageViews: pageViews || [],
      sourceData: sourceData || [],
      dailyVisits: dailyVisits || [],
    });
  } catch (err) {
    console.error('Visit stats error:', err);
    res.json({ totalVisits: 0, todayVisits: 0, uniqueVisitors: 0, bounceRate: 0, avgSessionDuration: '0:00', pageViews: [], sourceData: [], dailyVisits: [] });
  }
});

// Track page visit (no auth — called from landing page)
router.post('/visits/track', async (req, res) => {
  try {
    const { page, source, referrer } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    await runQuery('INSERT INTO visits (page, source, referrer, ip, user_agent) VALUES (?,?,?,?,?)',
      [page || '/', source || 'direct', referrer || '', ip, userAgent]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// Appointments / Citas
router.get('/appointments', verifyToken, async (req, res) => {
  try {
    const appointments = await queryAll('SELECT a.*, l.name as lead_name, l.phone as lead_phone, u.name as advisor_name FROM appointments a LEFT JOIN leads l ON a.lead_id = l.id LEFT JOIN users u ON a.user_id = u.id ORDER BY a.date DESC').catch(() => []);
    res.json(appointments || []);
  } catch (err) {
    console.error('Appointments error:', err);
    res.json([]);
  }
});

router.post('/appointments', verifyToken, async (req, res) => {
  try {
    const { lead_id, date, time, type, notes } = req.body;
    if (!date) return res.status(400).json({ error: 'Fecha requerida' });
    const r = await runQuery('INSERT INTO appointments (lead_id, user_id, date, time, type, notes, status) VALUES (?,?,?,?,?,?,?)',
      [lead_id || null, req.user.id, date, time || '', type || 'consulta', notes || '', 'programada']);
    const appointment = await queryOne('SELECT * FROM appointments WHERE id=?', [r.lastInsertRowid]);
    res.json({ success: true, appointment });
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Error al crear cita' });
  }
});

router.put('/appointments/:id', verifyToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    await runQuery('UPDATE appointments SET status=?, notes=? WHERE id=?', [status || 'programada', notes || '', +req.params.id]);
    const appointment = await queryOne('SELECT * FROM appointments WHERE id=?', [+req.params.id]);
    res.json({ success: true, appointment });
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

module.exports = router;
