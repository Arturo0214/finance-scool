const express = require('express');
const { queryAll, queryOne, runQuery } = require('../models/database');
const { verifyToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const router = express.Router();

/* Alerta INSTANTÁNEA del lead al Telegram del socio (bot @agentefsc_bot),
   con botón "Abrir WhatsApp" de 1 tap. Fire-and-forget: nunca rompe la captura.
   Usa env AGENTE_BOT_TOKEN + AGENTE_CHAT_ID (seteadas en Railway). */
const ING = { empleado: 'Empleado', freelancer: 'Freelancer', empresario: 'Empresario', mixto: 'Mixto' };
const RANGO = { '20k-50k': '$20-50k', '50k-100k': '$50-100k', '100k-200k': '$100-200k', '200k+': '$200k+' };
function alertaTelegramLead(l) {
  try {
    const token = process.env.AGENTE_BOT_TOKEN, chat = process.env.AGENTE_CHAT_ID;
    if (!token || !chat) return;
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dig = String(l.phone || '').replace(/\D/g, '');
    const wa = dig.length === 10 ? '52' + dig : dig;
    const primer = (l.name || '').trim().split(/\s+/)[0] || 'hola';
    const saludo = encodeURIComponent(`Hola ${primer}, soy de Finance S-Cool 👋 Vi que dejaste tus datos sobre tu estrategia fiscal y de retiro. ¿Tienes 2 minutos para platicar?`);
    const perfil = [ING[l.income_type], RANGO[l.approx_income]].filter(Boolean).join(' · ');
    const titulo = l.source === 'chat_web' ? '💬 <b>LEAD DESDE CHAT (Sofia web)</b>' : '🔥 <b>NUEVO LEAD</b>';
    const txt = `${titulo} — ${esc(l.name)}\n📞 ${esc(l.phone)}${l.email ? `\n✉️ ${esc(l.email)}` : ''}${perfil ? `\n💼 ${esc(perfil)}` : ''}\n📋 ${esc(l.service || 'PPR')}${l.declaracion ? ` · declara: ${esc(l.declaracion)}` : ''}${l.message ? `\n🎯 ${esc(l.message)}` : ''}\n\n<b>¡Contáctalo YA!</b> La velocidad de respuesta es el #1 factor de cierre.`;
    const botones = [[{ text: '📱 Abrir WhatsApp', url: `https://wa.me/${wa}?text=${saludo}` }]];
    if (l.email) botones.push([{ text: '✉️ Enviar correo', url: `mailto:${l.email}` }]);
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, parse_mode: 'HTML', disable_web_page_preview: true, text: txt, reply_markup: { inline_keyboard: botones } }),
    }).catch(() => {});
  } catch { /* nunca romper la captura del lead */ }
}

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, service, message, incomeType, approxIncome, declaracion, retiroPlan, source } = req.body;
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
    const allowedIncomeTypes = ['empleado', 'freelancer', 'empresario', 'mixto'];
    const allowedIncomeRanges = ['20k-50k', '50k-100k', '100k-200k', '200k+'];
    const allowedDeclaracion = ['si', 'no', 'no_se'];
    const allowedRetiro = ['si_ppr', 'si_otro', 'no', 'no_se'];
    const cleanIncomeType = allowedIncomeTypes.includes(incomeType) ? incomeType : null;
    const cleanApproxIncome = allowedIncomeRanges.includes(approxIncome) ? approxIncome : null;
    const cleanDeclaracion = allowedDeclaracion.includes(declaracion) ? declaracion : null;
    const cleanRetiroPlan = allowedRetiro.includes(retiroPlan) ? retiroPlan : null;
    const allowedSources = ['cta_landing', 'chat_web'];
    const cleanSource = allowedSources.includes(source) ? source : 'cta_landing';
    const r = await runQuery(
      'INSERT INTO leads (name,email,phone,service,message,source,income_type,approx_income,declaracion,retiro_plan) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [cleanName, cleanEmail, cleanPhone, cleanService, cleanMessage, cleanSource, cleanIncomeType, cleanApproxIncome, cleanDeclaracion, cleanRetiroPlan]
    );
    createNotification({
      type: 'lead',
      message: cleanSource === 'chat_web' ? `💬 Nuevo lead desde el chat Sofia: ${cleanName}` : `🆕 Nuevo lead desde landing: ${cleanName}`,
      data: { name: cleanName, phone: cleanPhone, source: cleanSource },
      link: '/admin/leads',
    });
    // Alerta instantánea a Telegram con botón WhatsApp (no bloquea la respuesta)
    alertaTelegramLead({
      name: cleanName, phone: cleanPhone, email: cleanEmail, service: cleanService,
      income_type: cleanIncomeType, approx_income: cleanApproxIncome, declaracion: cleanDeclaracion,
      message: cleanMessage, source: cleanSource,
    });
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
