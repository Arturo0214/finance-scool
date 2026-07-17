const express = require('express');
const { queryAll, queryOne, runQuery } = require('../models/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { getDB } = require('../models/database');
    const db = getDB();

    // Combine leads from both tables: form submissions (leads) + WhatsApp/Sofía (fsc_conversations)
    const { count: formLeads } = await db.from('leads').select('id', { count: 'exact', head: true });
    const { count: waLeads } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true });
    const totalLeads = (formLeads || 0) + (waLeads || 0);

    // FSC conversation stats
    const { count: fscNew } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', 'nuevo');
    const { count: fscCalif } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', 'en_calificacion');
    const { count: fscCita } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', 'cita_agendada');
    const { count: formNew } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo');

    // Recent leads from fsc_conversations
    const { data: recentFsc } = await db.from('fsc_conversations')
      .select('whatsapp_number, nombre_lead, lead_status, created_at')
      .order('created_at', { ascending: false }).limit(5);
    const recentLeads = (recentFsc || []).map(f => ({
      name: f.nombre_lead, phone: f.whatsapp_number, status: f.lead_status, source: 'whatsapp', created_at: f.created_at
    }));

    // Status breakdown
    const leadsByStatus = [
      { status: 'nuevo', count: (fscNew || 0) + (formNew || 0) },
      { status: 'en_calificacion', count: fscCalif || 0 },
      { status: 'cita_agendada', count: fscCita || 0 },
    ].filter(s => s.count > 0);

    const leadsBySource = [
      { source: 'whatsapp', count: waLeads || 0 },
      { source: 'landing', count: formLeads || 0 },
    ].filter(s => s.count > 0);

    res.json({
      totalLeads,
      newLeads: (fscNew || 0) + (formNew || 0),
      inProgress: fscCalif || 0,
      converted: fscCita || 0,
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

    const { getDB } = require('../models/database');
    const db = getDB();

    // Combine data from leads + fsc_conversations
    const { count: formLeads } = await db.from('leads').select('id', { count: 'exact', head: true });
    const { count: waLeads } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true });
    const { count: fscNew } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', 'nuevo');
    const { count: fscCalif } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', 'en_calificacion');
    const { count: fscCita } = await db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', 'cita_agendada');
    const { count: formNew } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo');

    const totalLeadsCount = (formLeads || 0) + (waLeads || 0);
    const total = totalLeadsCount || 1;
    const newCount = (fscNew || 0) + (formNew || 0);
    const califCount = fscCalif || 0;
    const citaCount = fscCita || 0;

    const conversionRate = (citaCount / total * 100).toFixed(1);
    const contactRate = (califCount / total * 100).toFixed(1);

    const funnel = [
      { stage: 'Nuevos', count: newCount, color: '#D97706' },
      { stage: 'En calificación', count: califCount, color: '#0066CC' },
      { stage: 'Cita agendada', count: citaCount, color: '#059669' },
    ];

    const { data: recentFsc } = await db.from('fsc_conversations')
      .select('whatsapp_number, nombre_lead, lead_status, created_at')
      .order('created_at', { ascending: false }).limit(10);
    const recentLeads = (recentFsc || []).map(f => ({
      name: f.nombre_lead, phone: f.whatsapp_number, status: f.lead_status, source: 'whatsapp', created_at: f.created_at
    }));

    const leadsBySource = [
      { source: 'whatsapp', count: waLeads || 0 },
      { source: 'landing', count: formLeads || 0 },
    ].filter(s => s.count > 0);

    const leadsByStatus = [
      { status: 'nuevo', count: newCount },
      { status: 'en_calificacion', count: califCount },
      { status: 'cita_agendada', count: citaCount },
    ].filter(s => s.count > 0);

    // Fetch HubSpot pipeline data
    let hubspotDeals = [];
    let hubspotStages = {};
    try {
      const hsToken = process.env.HUBSPOT_TOKEN || '';
      if (hsToken) {
        const hsResp = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
          method: 'POST',
          headers: { Authorization: `Bearer ${hsToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: 'pipeline', operator: 'EQ', value: 'default' }] }],
            properties: ['dealname', 'dealstage', 'createdate'],
            limit: 100,
          }),
        });
        if (hsResp.ok) {
          const hsData = await hsResp.json();
          hubspotDeals = hsData.results || [];
          const stageLabels = {
            '1099262896': 'Calificado', '1099262897': 'Cita agendada',
            '1099262898': 'Análisis', '1099262899': 'Propuesta',
            '1099262900': 'Seguimiento', '1099262901': 'Solicitud completada',
            '1099262902': 'Cerrada ganada', '1099262903': 'Cerrada perdida',
          };
          hubspotDeals.forEach(d => {
            const stage = stageLabels[d.properties.dealstage] || d.properties.dealstage;
            hubspotStages[stage] = (hubspotStages[stage] || 0) + 1;
          });
        }
      }
    } catch (e) { console.error('HubSpot fetch error:', e.message); }

    const hubspotPipeline = Object.entries(hubspotStages).map(([stage, count]) => ({ stage, count }));

    res.json({
      totalLeads: totalLeadsCount,
      newLeads: newCount,
      contactados: califCount,
      enProceso: califCount,
      converted: citaCount,
      conversionRate,
      contactRate,
      processRate: contactRate,
      funnel,
      sourcePerformance: leadsBySource.map(s => ({ source: s.source, total: s.count, percentage: (s.count / total * 100).toFixed(1) })),
      leadsBySource,
      leadsByStatus,
      recentLeads,
      hubspotDeals: hubspotDeals.length,
      hubspotPipeline,
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
    const { title, description, start_date, end_date, all_day, color, lead_id, meeting_link } = req.body;
    const r = await runQuery('INSERT INTO events (title,description,start_date,end_date,all_day,color,user_id,lead_id,meeting_link) VALUES (?,?,?,?,?,?,?,?,?)',
      [title, description||'', start_date, end_date||null, all_day?1:0, color||'#C9A84C', req.user.id, lead_id||null, meeting_link||null]);
    const event = await queryOne('SELECT * FROM events WHERE id=?', [r.lastInsertRowid]);
    res.json({ success: true, event });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

router.put('/events/:id', verifyToken, async (req, res) => {
  try {
    const { title, description, start_date, end_date, color, meeting_link } = req.body;
    await runQuery('UPDATE events SET title=?,description=?,start_date=?,end_date=?,color=?,meeting_link=? WHERE id=?',
      [title, description, start_date, end_date, color, meeting_link||null, +req.params.id]);
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
    // Enriquecer con datos del CRM (cartera + última actividad) para administración
    if (['superadmin', 'agencia', 'admin'].includes(req.user.role)) {
      const { getDB } = require('../models/database');
      const db = getDB();
      const [{ data: agents }, { data: clients }, { data: policies }, { data: activity }] = await Promise.all([
        db.from('crm_agents').select('id,user_id,nombre,clave,cuaderno,estatus'),
        db.from('crm_clients').select('id,agent_id,etapa'),
        db.from('crm_policies').select('id,agent_id,prima,estatus'),
        db.from('crm_activity').select('user_id,created_at,action,entity').order('created_at', { ascending: false }).limit(500),
      ]);
      const byAgent = {};
      for (const c of clients || []) {
        (byAgent[c.agent_id] ||= { clientes: 0, polizas: 0, prima_pagada: 0 }).clientes++;
      }
      for (const p of policies || []) {
        const s = (byAgent[p.agent_id] ||= { clientes: 0, polizas: 0, prima_pagada: 0 });
        s.polizas++;
        if (p.estatus === 'pagada') s.prima_pagada += Number(p.prima) || 0;
      }
      const lastByUser = {};
      for (const a of activity || []) {
        if (!lastByUser[a.user_id]) lastByUser[a.user_id] = { fecha: a.created_at, action: a.action, entity: a.entity };
      }
      const agentByUser = {};
      for (const a of agents || []) if (a.user_id) agentByUser[a.user_id] = a;
      for (const u of users) {
        const agent = agentByUser[u.id];
        u.crm = agent ? { agent_id: agent.id, clave: agent.clave, cuaderno: agent.cuaderno, estatus: agent.estatus, ...(byAgent[agent.id] || { clientes: 0, polizas: 0, prima_pagada: 0 }) } : null;
        u.ultima_actividad = lastByUser[u.id] || null;
      }
    }
    res.json(users);
  } catch (err) {
    console.error('Users error:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

/* Reglas compartidas de gestión de usuarios:
   - agencia/superadmin gestionan a cualquiera (solo superadmin toca a superadmin)
   - admin solo gestiona asesores */
async function canManageUser(reqUser, targetId) {
  if (!['superadmin', 'agencia', 'admin'].includes(reqUser.role)) return { error: 'No autorizado', code: 403 };
  const target = await queryOne('SELECT id,name,email,role FROM users WHERE id=?', [targetId]);
  if (!target) return { error: 'Usuario no encontrado', code: 404 };
  const isAgencyReq = ['superadmin', 'agencia'].includes(reqUser.role);
  if (!isAgencyReq && target.role !== 'asesor') return { error: 'Solo puedes gestionar asesores', code: 403 };
  if (target.role === 'superadmin' && reqUser.role !== 'superadmin') return { error: 'Solo un superadmin puede modificar a otro superadmin', code: 403 };
  return { target };
}

function logUserActivity(reqUser, action, target, detail) {
  const { getDB } = require('../models/database');
  getDB().from('crm_activity').insert([{ user_id: reqUser.id, user_name: reqUser.name, user_role: reqUser.role, action, entity: 'usuario', entity_id: String(target.id), detail: detail || target.email }])
    .then(({ error: e }) => { if (e) console.error('activity log:', e.message); });
}

// Editar usuario (nombre, email, rol)
router.put('/users/:id', verifyToken, async (req, res) => {
  try {
    const { target, error, code } = await canManageUser(req.user, req.params.id);
    if (error) return res.status(code).json({ error });
    const isAgencyReq = ['superadmin', 'agencia'].includes(req.user.role);
    const patch = {};
    if (req.body.name) patch.name = req.body.name;
    if (req.body.email && req.body.email !== target.email) {
      const dup = await queryOne('SELECT id FROM users WHERE email=?', [req.body.email]);
      if (dup) return res.status(400).json({ error: 'Ese email ya está registrado' });
      patch.email = req.body.email;
    }
    if (req.body.role && req.body.role !== target.role) {
      const assignable = isAgencyReq ? ['asesor', 'admin', 'agencia'] : ['asesor'];
      if (!assignable.includes(req.body.role)) return res.status(403).json({ error: 'No puedes asignar ese rol' });
      if (target.role === 'superadmin') return res.status(403).json({ error: 'No se puede cambiar el rol de un superadmin' });
      patch.role = req.body.role;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada que actualizar' });
    const { getDB } = require('../models/database');
    const { data, error: dbErr } = await getDB().from('users').update(patch).eq('id', target.id).select('id,name,email,role,created_at');
    if (dbErr) return res.status(500).json({ error: dbErr.message });
    // Si se convirtió en asesor, asegurar su perfil de CRM
    if (patch.role === 'asesor') {
      const db2 = getDB();
      const { data: ag } = await db2.from('crm_agents').select('id').eq('user_id', target.id).maybeSingle();
      if (!ag) await db2.from('crm_agents').insert([{ nombre: patch.name || target.name, email: patch.email || target.email, user_id: target.id, clave: `A${String(target.id).padStart(4, '0')}`, cuaderno: 'NOVEL', fecha_inicio_calculos: new Date().toISOString().slice(0, 10) }]);
    }
    logUserActivity(req.user, 'editar', target, `${target.email} → ${Object.keys(patch).join(', ')}`);
    res.json({ ok: true, user: data[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (no puedes eliminarte a ti mismo)
router.delete('/users/:id', verifyToken, async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    const { target, error, code } = await canManageUser(req.user, req.params.id);
    if (error) return res.status(code).json({ error });
    const { getDB } = require('../models/database');
    const db = getDB();
    // Desvincular perfil de asesor del CRM (el agente y su cartera se conservan)
    await db.from('crm_agents').update({ user_id: null }).eq('user_id', target.id);
    const { error: dbErr } = await db.from('users').delete().eq('id', target.id);
    if (dbErr) return res.status(500).json({ error: dbErr.message });
    logUserActivity(req.user, 'eliminar', target);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Reset de contraseña por administración: agencia/superadmin a cualquiera; admin solo a asesores
router.post('/users/:id/reset-password', verifyToken, async (req, res) => {
  try {
    if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'No autorizado' });
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const target = await queryOne('SELECT id,name,email,role FROM users WHERE id=?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    const isAgencyReq = ['superadmin', 'agencia'].includes(req.user.role);
    if (!isAgencyReq && target.role !== 'asesor') return res.status(403).json({ error: 'Solo puedes resetear contraseñas de asesores' });
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    await runQuery('UPDATE users SET password=? WHERE id=?', [hash, target.id]);
    const { getDB } = require('../models/database');
    getDB().from('crm_activity').insert([{ user_id: req.user.id, user_name: req.user.name, user_role: req.user.role, action: 'reset_password', entity: 'usuario', entity_id: String(target.id), detail: target.email }])
      .then(({ error: e }) => { if (e) console.error('activity log:', e.message); });
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Error al resetear contraseña' });
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
