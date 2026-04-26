const express = require('express');
const { getDB } = require('../models/database');
const { verifyToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const cloudinary = require('../config/cloudinary');
const router = express.Router();

// Download media from Meta WhatsApp API and upload to Cloudinary
async function downloadAndUploadMedia(mediaId, mimeType) {
  try {
    // Step 1: Get media URL from Meta
    const urlRes = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
    });
    const urlData = await urlRes.json();
    if (!urlData.url) return null;

    // Step 2: Download the media binary
    const mediaRes = await fetch(urlData.url, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
    });
    const buffer = Buffer.from(await mediaRes.arrayBuffer());

    // Step 3: Upload to Cloudinary
    const isAudio = /audio|ogg|opus/i.test(mimeType || '');
    const isVideo = /video/i.test(mimeType || '');
    const resourceType = (isAudio || isVideo) ? 'video' : 'image';
    const ext = isAudio ? 'ogg' : (mimeType || '').split('/')[1] || 'bin';
    const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'financescool_wa_media',
      resource_type: resourceType,
      public_id: `${resourceType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      format: ext === 'ogg' ? 'ogg' : undefined,
    });

    return result.secure_url;
  } catch (err) {
    console.error('Media download/upload error:', err.message);
    return null;
  }
}

const WA_PHONE_ID = process.env.WA_PHONE_ID;
const WA_TOKEN = process.env.WA_TOKEN;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'financescool_webhook_2026';
const GRAPH_URL = 'https://graph.facebook.com/v22.0';

// ─── Helper: send via Meta WhatsApp Business API ───
async function sendWhatsApp(to, type, payload) {
  if (!WA_PHONE_ID || !WA_TOKEN) {
    throw new Error('WhatsApp API no configurada (WA_PHONE_ID / WA_TOKEN)');
  }
  const body = { messaging_product: 'whatsapp', to, type, ...payload };
  const res = await fetch(`${GRAPH_URL}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'WhatsApp API error');
  return data;
}

// ─── Helper: check if 24h window is open ───
function isWindowOpen(lastUserMessageAt) {
  if (!lastUserMessageAt) return false;
  return (Date.now() - new Date(lastUserMessageAt).getTime()) < 24 * 60 * 60 * 1000;
}

// ═══════════════════════════════════════
// PUBLIC: Meta Webhook verification (GET)
// ═══════════════════════════════════════
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ═══════════════════════════════════════
// PUBLIC: Incoming message webhook (POST)
// ═══════════════════════════════════════
router.post('/webhook', async (req, res) => {
  try {
    res.sendStatus(200); // ACK immediately per Meta requirements
    const db = getDB();

    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    if (!changes) return;

    // ── Handle incoming messages (extract media if present) ──
    const messages = changes.messages;
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        const waId = msg.from;
        const msgType = msg.type; // text, image, audio, video, document, sticker
        const hasMedia = ['image', 'audio', 'video', 'document', 'sticker'].includes(msgType);
        let mediaUrl = null;
        let mimeType = null;
        let filename = null;

        // Download & upload media to Cloudinary if present
        if (hasMedia && msg[msgType]) {
          const mediaObj = msg[msgType];
          const mediaId = mediaObj.id;
          mimeType = mediaObj.mime_type || null;
          filename = mediaObj.filename || null;
          if (mediaId) {
            mediaUrl = await downloadAndUploadMedia(mediaId, mimeType);
          }
        }

        // Build message entry
        const body = msg.text?.body
          || msg.image?.caption
          || msg.video?.caption
          || msg.document?.caption
          || (msgType === 'audio' ? '[Audio]' : '')
          || (msgType === 'sticker' ? '[Sticker]' : '')
          || `[${msgType}]`;

        const newMsg = {
          role: 'user',
          body,
          type: msgType,
          timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
          wa_msg_id: msg.id,
        };
        if (mediaUrl) newMsg.mediaUrl = mediaUrl;
        if (mimeType) newMsg.mimetype = mimeType;
        if (filename) newMsg.filename = filename;

        // Save to whatsapp_leads if exists
        const { data: lead } = await db.from('whatsapp_leads').select('historial_chat, contact_name').eq('wa_id', waId).maybeSingle();
        if (lead) {
          const historial = JSON.parse(lead.historial_chat || '[]');
          // Avoid duplicate: check if wa_msg_id already exists
          if (!historial.some(m => m.wa_msg_id === msg.id)) {
            historial.push(newMsg);
            const contactName = changes.contacts?.[0]?.profile?.name || lead.contact_name;
            const preview = body.slice(0, 80);
            await db.from('whatsapp_leads').update({
              historial_chat: JSON.stringify(historial),
              last_message_at: newMsg.timestamp,
              last_message_preview: preview,
              contact_name: contactName,
              unread_count: (lead.unread_count || 0) + 1,
            }).eq('wa_id', waId);
          }
        } else if (hasMedia && mediaUrl) {
          // If lead is in fsc_conversations, update with media info
          const { data: fsc } = await db.from('fsc_conversations').select('id, conversation_history').eq('whatsapp_number', waId).maybeSingle();
          if (fsc) {
            let history = [];
            try { history = typeof fsc.conversation_history === 'string' ? JSON.parse(fsc.conversation_history) : (fsc.conversation_history || []); } catch {}
            // Append media entry
            history.push({
              role: 'user',
              content: body,
              type: msgType,
              mediaUrl,
              mimetype: mimeType,
              filename,
              timestamp: newMsg.timestamp,
              wa_msg_id: msg.id,
            });
            await db.from('fsc_conversations').update({
              conversation_history: JSON.stringify(history),
              updated_at: newMsg.timestamp,
            }).eq('whatsapp_number', waId);
          }
        }
      }
    }

    // ── Handle status updates (sent, delivered, read, failed) ──
    const statuses = changes.statuses;
    if (statuses && statuses.length > 0) {
      for (const s of statuses) {
        const waId = s.recipient_id;
        const { data: lead } = await db.from('whatsapp_leads').select('historial_chat').eq('wa_id', waId).maybeSingle();
        if (lead) {
          const historial = JSON.parse(lead.historial_chat || '[]');
          const idx = historial.findIndex(m => m.wa_msg_id === s.id);
          if (idx >= 0) {
            historial[idx].status = s.status;
            await db.from('whatsapp_leads').update({ historial_chat: JSON.stringify(historial) }).eq('wa_id', waId);
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

// ─── GET /available-slots — public (called by n8n) ───
// Queries Google Calendar FreeBusy API for Ingrid's real availability.
// Query params: duration=15|30 (default 30), days=7
const { getCalendarClient } = require('../config/google-calendar');

async function getGoogleTokens() {
  try {
    const { getDB } = require('../models/database');
    const { data, error } = await getDB()
      .from('google_calendar_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (data && !error) {
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expiry_date: data.expiry_date ? new Date(data.expiry_date).getTime() : null,
      };
    }
  } catch (e) { /* table might not exist */ }
  return global._googleCalTokens || null;
}

// Horarios de Ingrid (America/Mexico_City)
// Lunes a Viernes: 9:00–19:00, Sábado: 10:00–13:00, Domingo: cerrado
const TZ = 'America/Mexico_City';
const SCHEDULE = {
  0: null,                        // Domingo — cerrado
  1: { start: '09:00', end: '19:00' }, // Lunes
  2: { start: '09:00', end: '19:00' }, // Martes
  3: { start: '09:00', end: '19:00' }, // Miércoles
  4: { start: '09:00', end: '19:00' }, // Jueves
  5: { start: '09:00', end: '19:00' }, // Viernes
  6: { start: '10:00', end: '13:00' }, // Sábado
};

// Convierte "HH:MM" + fecha YYYY-MM-DD a timestamp UTC asumiendo America/Mexico_City
function mxToUTC(dateStr, timeStr) {
  // Crear fecha interpretada como Mexico City y convertir a UTC
  // Mexico City CST = UTC-6, CDT = UTC-5 (segundo domingo marzo - primer domingo nov)
  const dt = new Date(`${dateStr}T${timeStr}:00.000Z`);
  // Sumar 6h para CST base, luego verificar DST
  const jan = new Date(`${dateStr.slice(0, 4)}-01-15T12:00:00.000Z`);
  const jul = new Date(`${dateStr.slice(0, 4)}-07-15T12:00:00.000Z`);
  // México abolió DST en 2022, zona horaria fija CST = UTC-6
  return new Date(dt.getTime() + 6 * 60 * 60 * 1000);
}

router.get('/available-slots', async (req, res) => {
  try {
    const duration = parseInt(req.query.duration) || 30;
    const daysAhead = parseInt(req.query.days) || 7;

    const tokens = await getGoogleTokens();
    if (!tokens) {
      return res.status(502).json({ error: 'Google Calendar no está conectado' });
    }

    const calendar = getCalendarClient(tokens);

    // Rango: mañana hasta N días (+ buffer para fines de semana)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead + 4);

    // Consultar eventos ocupados en Google Calendar (FreeBusy)
    const freeBusyResp = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        timeZone: TZ,
        items: [{ id: 'primary' }],
      },
    });
    const busySlots = (freeBusyResp.data.calendars?.primary?.busy || []).map(b => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }));

    const dayMap = new Map();
    const slotMs = duration * 60 * 1000;

    for (let d = 0; d < daysAhead + 4 && dayMap.size < daysAhead; d++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + d);
      const dayOfWeek = day.getUTCDay();
      const schedule = SCHEDULE[dayOfWeek];
      if (!schedule) continue;

      const dateStr = day.toISOString().slice(0, 10);
      const utcStart = mxToUTC(dateStr, schedule.start).getTime();
      const utcEnd = mxToUTC(dateStr, schedule.end).getTime();

      const available = [];
      let cursor = utcStart;

      while (cursor + slotMs <= utcEnd) {
        const slotEnd = cursor + slotMs;

        // Verificar que NO se empalme con ningún evento existente
        const isBusy = busySlots.some(b => cursor < b.end && slotEnd > b.start);

        if (!isBusy) {
          const mxTime = new Date(cursor - 6 * 60 * 60 * 1000);
          const hh = String(mxTime.getUTCHours()).padStart(2, '0');
          const mm = String(mxTime.getUTCMinutes()).padStart(2, '0');
          available.push(`${hh}:${mm}`);
        }

        cursor += slotMs;
      }

      if (available.length > 0) {
        const label = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-MX', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ,
        });
        dayMap.set(dateStr, { date: dateStr, label, available });
      }
    }

    const slots = [...dayMap.values()];
    res.json({ duration, slots, source: 'google_calendar' });
  } catch (err) {
    console.error('Available slots error:', err);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// ═══════════════════════════════════════
// PROTECTED ROUTES (admin only)
// ═══════════════════════════════════════
router.use(verifyToken);

router.use((req, res, next) => {
  if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
});

// ─── GET /leads (merges whatsapp_leads + fsc_conversations) ───
router.get('/leads', async (req, res) => {
  try {
    const db = getDB();
    const { estado, search, assigned_to, page = 1, limit = 50 } = req.query;

    // 1. Get whatsapp_leads (sin historial_chat para que la lista cargue rápido)
    let query = db.from('whatsapp_leads')
      .select('id, wa_id, contact_name, estado, origin, assigned_to, last_message_at, unread_count, blocked, modo_humano, created_at, last_message_preview');
    if (estado && estado !== 'todos') query = query.eq('estado', estado);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (search) query = query.or(`contact_name.ilike.%${search}%,wa_id.ilike.%${search}%,historial_chat.ilike.%${search}%`);
    query = query.order('last_message_at', { ascending: false });
    const { data: waLeads, error: waError } = await query;
    // Si last_message_preview no existe como columna, hacer fallback sin historial
    if (waError && waError.message && waError.message.includes('last_message_preview')) {
      query = db.from('whatsapp_leads')
        .select('id, wa_id, contact_name, estado, origin, assigned_to, last_message_at, unread_count, blocked, modo_humano, created_at');
      if (estado && estado !== 'todos') query = query.eq('estado', estado);
      if (assigned_to) query = query.eq('assigned_to', assigned_to);
      if (search) query = query.or(`contact_name.ilike.%${search}%,wa_id.ilike.%${search}%`);
      query = query.order('last_message_at', { ascending: false });
    }
    const waLeadsFinal = waError ? (await query).data : waLeads;

    // 2. Get fsc_conversations (Sofía bot) — sin conversation_history para rendimiento
    let fscQuery = db.from('fsc_conversations')
      .select('id, whatsapp_number, nombre_lead, lead_status, filtro_actual, prioridad, modo_humano, created_at, updated_at');
    if (search) fscQuery = fscQuery.or(`nombre_lead.ilike.%${search}%,whatsapp_number.ilike.%${search}%,conversation_history.ilike.%${search}%`);
    fscQuery = fscQuery.order('updated_at', { ascending: false });
    const { data: fscLeads } = await fscQuery;

    // 3. Map fsc_conversations to whatsapp_leads format (sin historial para la lista)
    const fscMapped = (fscLeads || []).map(f => ({
      id: 'fsc_' + f.id,
      wa_id: f.whatsapp_number,
      contact_name: f.nombre_lead || f.whatsapp_number,
      estado: f.lead_status || 'nuevo',
      origin: 'sofia_bot',
      assigned_to: null,
      last_message_at: f.updated_at,
      unread_count: 0,
      blocked: false,
      modo_humano: f.modo_humano || false,
      created_at: f.created_at,
      filtro_actual: f.filtro_actual || 0,
      prioridad: f.prioridad || null,
      _source: 'fsc'
    }));

    // 4. Merge: deduplicate by wa_id (prefer whatsapp_leads if exists in both)
    const waIds = new Set((waLeadsFinal || []).map(l => l.wa_id));
    const merged = [...(waLeadsFinal || []), ...fscMapped.filter(f => !waIds.has(f.wa_id))];

    // 5. Filter by estado if needed (for fsc entries)
    let filtered = merged;
    if (estado && estado !== 'todos') {
      filtered = merged.filter(l => l.estado === estado);
    }

    // 6. Sort by last_message_at desc
    filtered.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));

    // 7. Paginate
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginated = filtered.slice(offset, offset + parseInt(limit));

    // 8. Build previews — para leads FSC, traer conversation_history solo de los paginados
    const fscIds = paginated.filter(l => l._source === 'fsc').map(l => l.id.replace('fsc_', ''));
    let fscPreviews = {};
    if (fscIds.length > 0) {
      const { data: fscHist } = await db.from('fsc_conversations')
        .select('id, conversation_history')
        .in('id', fscIds);
      for (const f of (fscHist || [])) {
        try {
          const hist = typeof f.conversation_history === 'string' ? JSON.parse(f.conversation_history) : (f.conversation_history || []);
          if (hist.length > 0) {
            const last = hist[hist.length - 1];
            const text = (last.content || last.body || '').slice(0, 80);
            fscPreviews[f.id] = last.role === 'assistant' ? 'Sofía: ' + text : text;
          }
        } catch {}
      }
    }

    const leadsWithPreview = paginated.map(l => {
      const { historial_chat, last_message_preview, _source, ...rest } = l;
      let preview = last_message_preview || '';
      if (!preview && _source === 'fsc') {
        const fscId = l.id.replace('fsc_', '');
        preview = fscPreviews[fscId] || '';
      }
      return { ...rest, lastMessage: preview, filtro_actual: l.filtro_actual || 0 };
    });

    res.json({ leads: leadsWithPreview, total: filtered.length, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('WA leads error:', err);
    res.status(500).json({ error: 'Error al obtener leads de WhatsApp' });
  }
});

// ─── GET /leads/:waId (checks whatsapp_leads then fsc_conversations) ───
router.get('/leads/:waId', async (req, res) => {
  try {
    const db = getDB();
    const waId = req.params.waId;

    // Try whatsapp_leads first
    const { data: lead } = await db.from('whatsapp_leads').select('*').eq('wa_id', waId).maybeSingle();
    if (lead) {
      lead.historial_chat = JSON.parse(lead.historial_chat || '[]');
      if (lead.unread_count > 0) {
        await db.from('whatsapp_leads').update({ unread_count: 0 }).eq('wa_id', waId);
      }
      return res.json(lead);
    }

    // Fallback to fsc_conversations
    const { data: fsc } = await db.from('fsc_conversations').select('*').eq('whatsapp_number', waId).maybeSingle();
    if (fsc) {
      let history = [];
      try { history = typeof fsc.conversation_history === 'string' ? JSON.parse(fsc.conversation_history) : (fsc.conversation_history || []); } catch {}
      // Convert fsc format {role:'user'|'assistant', content} to WA format {role:'user'|'admin', body, sender}
      const baseTime = new Date(fsc.created_at || Date.now()).getTime();
      const converted = history.map((m, i) => ({
        role: m.role === 'assistant' ? 'admin' : 'user',
        body: m.content || m.body || '',
        type: m.type || 'text',
        timestamp: m.timestamp || new Date(baseTime + i * 5000).toISOString(),
        sender: m.role === 'assistant' ? 'Sofía' : undefined,
        status: m.role === 'assistant' ? 'delivered' : undefined,
        mediaUrl: m.mediaUrl || undefined,
        mimetype: m.mimetype || undefined,
        filename: m.filename || undefined,
        wa_msg_id: m.wa_msg_id || undefined,
      }));
      return res.json({
        id: 'fsc_' + fsc.id,
        wa_id: fsc.whatsapp_number,
        contact_name: fsc.nombre_lead || fsc.whatsapp_number,
        estado: fsc.lead_status || 'nuevo',
        origin: 'sofia_bot',
        historial_chat: converted,
        last_message_at: fsc.updated_at,
        created_at: fsc.created_at,
        unread_count: 0,
        blocked: false,
        modo_humano: fsc.modo_humano || false,
        _source: 'fsc',
        _fsc_data: { nombre: fsc.nombre_lead, declara_impuestos: fsc.declara_impuestos, regimen: fsc.regimen_fiscal, edad: fsc.edad, ingreso: fsc.rango_ingreso, situacion_laboral: fsc.situacion_laboral, objetivo: fsc.objetivo, prioridad: fsc.prioridad, fecha_cita: fsc.fecha_cita, hora_cita: fsc.hora_cita, consultor_asignado: fsc.consultor_asignado }
      });
    }

    res.status(404).json({ error: 'Lead no encontrado' });
  } catch (err) {
    console.error('WA lead error:', err);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

// ─── GET /leads/:waId/window-status ───
router.get('/leads/:waId/window-status', async (req, res) => {
  try {
    const db = getDB();
    const waId = req.params.waId;
    const { data: lead } = await db.from('whatsapp_leads').select('last_message_at').eq('wa_id', waId).maybeSingle();
    if (lead) return res.json({ windowOpen: isWindowOpen(lead.last_message_at), lastMessageAt: lead.last_message_at });
    // Fallback: fsc_conversations - always assume window open (messages come from n8n webhook)
    const { data: fsc } = await db.from('fsc_conversations').select('updated_at').eq('whatsapp_number', waId).maybeSingle();
    if (fsc) return res.json({ windowOpen: isWindowOpen(fsc.updated_at), lastMessageAt: fsc.updated_at });
    res.status(404).json({ error: 'Lead no encontrado' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// ─── POST /send (supports whatsapp_leads + fsc_conversations) ───
router.post('/send', async (req, res) => {
  try {
    const db = getDB();
    const { wa_id, message } = req.body;
    if (!wa_id || !message) return res.status(400).json({ error: 'wa_id y message requeridos' });
    const now = new Date().toISOString();

    // Try whatsapp_leads first
    const { data: lead } = await db.from('whatsapp_leads').select('*').eq('wa_id', wa_id).maybeSingle();
    if (lead) {
      const historial = JSON.parse(lead.historial_chat || '[]');
      const windowOpen = isWindowOpen(lead.last_message_at);
      if (windowOpen) {
        const result = await sendWhatsApp(wa_id, 'text', { text: { body: message } });
        const newMsg = { role: 'admin', body: message, type: 'text', timestamp: now, status: 'sent', wa_msg_id: result.messages?.[0]?.id, sender: req.user.name };
        historial.push(newMsg);
        const updates = { historial_chat: JSON.stringify(historial), last_message_preview: 'Tú: ' + message.slice(0, 80) };
        if (!lead.assigned_to) updates.assigned_to = req.user.name;
        await db.from('whatsapp_leads').update(updates).eq('wa_id', wa_id);
        return res.json({ success: true, sent: true, message: newMsg });
      } else {
        const newMsg = { role: 'admin', body: message, type: 'text', timestamp: now, status: 'pending', sender: req.user.name };
        historial.push(newMsg);
        const updates = { historial_chat: JSON.stringify(historial), mensaje_pendiente: message, last_message_preview: 'Tú: ' + message.slice(0, 80) };
        if (!lead.assigned_to) updates.assigned_to = req.user.name;
        await db.from('whatsapp_leads').update(updates).eq('wa_id', wa_id);
        return res.json({ success: true, sent: false, queued: true, message: newMsg, note: 'Ventana de 24h expirada.' });
      }
    }

    // Fallback: fsc_conversations lead - send via WA API and save to conversation_history
    const { data: fsc } = await db.from('fsc_conversations').select('*').eq('whatsapp_number', wa_id).maybeSingle();
    if (fsc) {
      // Send the message via WhatsApp
      const result = await sendWhatsApp(wa_id, 'text', { text: { body: message } });
      // Append to conversation_history
      let history = [];
      try { history = typeof fsc.conversation_history === 'string' ? JSON.parse(fsc.conversation_history) : (fsc.conversation_history || []); } catch {}
      history.push({ role: 'assistant', content: `[HUMANO - ${req.user.name}]: ${message}` });
      await db.from('fsc_conversations').update({ conversation_history: JSON.stringify(history), updated_at: now }).eq('whatsapp_number', wa_id);
      const newMsg = { role: 'admin', body: message, type: 'text', timestamp: now, status: 'sent', wa_msg_id: result.messages?.[0]?.id, sender: req.user.name };
      return res.json({ success: true, sent: true, message: newMsg });
    }

    res.status(404).json({ error: 'Lead no encontrado' });
  } catch (err) {
    console.error('WA send error:', err);
    res.status(500).json({ error: err.message || 'Error al enviar mensaje' });
  }
});

// ─── POST /send-template ───
router.post('/send-template', async (req, res) => {
  try {
    const db = getDB();
    const { wa_id, template_name, language = 'es_MX', components } = req.body;
    if (!wa_id || !template_name) return res.status(400).json({ error: 'wa_id y template_name requeridos' });

    const result = await sendWhatsApp(wa_id, 'template', {
      template: { name: template_name, language: { code: language }, ...(components ? { components } : {}) },
    });

    const { data: lead } = await db.from('whatsapp_leads').select('historial_chat').eq('wa_id', wa_id).maybeSingle();
    if (lead) {
      const historial = JSON.parse(lead.historial_chat || '[]');
      historial.push({ role: 'admin', body: `[Plantilla: ${template_name}]`, type: 'template', timestamp: new Date().toISOString(), status: 'sent', wa_msg_id: result.messages?.[0]?.id, sender: req.user.name });
      await db.from('whatsapp_leads').update({ historial_chat: JSON.stringify(historial) }).eq('wa_id', wa_id);
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error('WA template error:', err);
    res.status(500).json({ error: err.message || 'Error al enviar plantilla' });
  }
});

// ─── PATCH /leads/:waId/estado ───
router.patch('/leads/:waId/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ error: 'estado requerido' });
    await getDB().from('whatsapp_leads').update({ estado }).eq('wa_id', req.params.waId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// ─── PATCH /leads/:waId/modo-humano ───
router.patch('/leads/:waId/modo-humano', async (req, res) => {
  try {
    const db = getDB();
    const waId = req.params.waId;

    // Try whatsapp_leads first
    const { data: lead } = await db.from('whatsapp_leads').select('modo_humano').eq('wa_id', waId).maybeSingle();
    if (lead) {
      const newVal = !lead.modo_humano;
      await db.from('whatsapp_leads').update({ modo_humano: newVal }).eq('wa_id', waId);
      return res.json({ success: true, modo_humano: newVal });
    }

    // Fallback to fsc_conversations
    const { data: fsc } = await db.from('fsc_conversations').select('modo_humano').eq('whatsapp_number', waId).maybeSingle();
    if (fsc) {
      const newVal = !fsc.modo_humano;
      await db.from('fsc_conversations').update({ modo_humano: newVal }).eq('whatsapp_number', waId);
      return res.json({ success: true, modo_humano: newVal });
    }

    res.status(404).json({ error: 'Lead no encontrado' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// ─── PATCH /leads/:waId/claim ───
router.patch('/leads/:waId/claim', async (req, res) => {
  try {
    await getDB().from('whatsapp_leads').update({ assigned_to: req.user.name }).eq('wa_id', req.params.waId);
    res.json({ success: true, assigned_to: req.user.name });
  } catch (err) {
    res.status(500).json({ error: 'Error al reclamar lead' });
  }
});

// ─── PATCH /leads/:waId/block ───
router.patch('/leads/:waId/block', async (req, res) => {
  try {
    const db = getDB();
    const { data: lead } = await db.from('whatsapp_leads').select('blocked').eq('wa_id', req.params.waId).maybeSingle();
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    const newVal = !lead.blocked;
    await db.from('whatsapp_leads').update({ blocked: newVal }).eq('wa_id', req.params.waId);
    res.json({ success: true, blocked: newVal });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// ─── GET /stats ───
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    const counts = await Promise.all([
      db.from('whatsapp_leads').select('id', { count: 'exact', head: true }),
      db.from('whatsapp_leads').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo'),
      db.from('whatsapp_leads').select('id', { count: 'exact', head: true }).eq('estado', 'contactado'),
      db.from('whatsapp_leads').select('id', { count: 'exact', head: true }).eq('estado', 'en_proceso'),
      db.from('whatsapp_leads').select('id', { count: 'exact', head: true }).eq('estado', 'convertido'),
      db.from('whatsapp_leads').select('id', { count: 'exact', head: true }).gt('unread_count', 0),
    ]);
    res.json({
      total: counts[0].count || 0,
      nuevo: counts[1].count || 0,
      contactado: counts[2].count || 0,
      enProceso: counts[3].count || 0,
      convertido: counts[4].count || 0,
      unread: counts[5].count || 0,
    });
  } catch (err) {
    res.json({ total: 0, nuevo: 0, contactado: 0, enProceso: 0, convertido: 0, unread: 0 });
  }
});

// ═══════════════════════════════════════
// AUTOMATIZACIÓN: Seguimiento de leads en calificación
// Envía mensajes escalonados para que los leads avancen hacia cita_agendada
// ═══════════════════════════════════════

const WA_PHONE_ID_FSC = '991785554028931';
const WA_TOKEN_FSC = 'EAAXOU1ELZAK0BRPk2qu8TR5qx00Qe9Mi3wGJ7JT1AlZAOzXvl60LnIXFsjFBmuHSDZAIzxnTn7UyXn0ygFDvoNmdor4snZBsDmhhjrhDdYPInLyWMPQNT2dzylydcgZBLpcByNVldVsiZCifKfZCU2T0Uh2ncFrEV6ZB8dDngAmEJktKkTNjizi7AKByFMil2RqAeAZDZD';

// Helper: build WhatsApp template message payload
function buildTemplatePayload(phone, templateName, params = []) {
  const components = params.length > 0 ? [{
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: String(p) }))
  }] : [];

  return {
    messaging_product: 'whatsapp',
    to: phone.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components
    }
  };
}

// Helper: send WhatsApp message (text or template)
async function sendWAMessage(phone, payload) {
  const resp = await fetch(`https://graph.facebook.com/v22.0/${WA_PHONE_ID_FSC}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WA_TOKEN_FSC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  return { ok: resp.ok, messageId: data.messages?.[0]?.id, error: data.error?.message };
}

function buildFollowUpMessage(lead, hoursInactive) {
  const nombre = (lead.nombre_lead || '').split(' ')[0] || '';
  const saludo = nombre ? `Hola ${nombre}` : 'Hola';
  const filtro = lead.filtro_actual || 1;

  // PRIORIDAD MÁXIMA: Filtro 5-6 — estaban a punto de agendar
  if (filtro >= 5) {
    return `${saludo}, soy Sofía de Finance S Cool 😊\n\nVi que estábamos a punto de agendar tu cita con nuestra asesora. ¿Quieres que la programemos ahora?\n\nLa asesoría es sin costo y sin compromiso.`;
  }

  // Filtro 3-4 — ya avanzados, empujar a cita
  if (filtro >= 3) {
    if (hoursInactive < 48) {
      return `${saludo}, soy Sofía de Finance S Cool 😊\n\nNos quedamos a medias en la plática. Me faltan un par de preguntas rápidas para poder orientarte mejor sobre tus deducciones fiscales.\n\n¿Continuamos?`;
    }
    return `${saludo}, soy Sofía de Finance S Cool 👋\n\nPasaron unos días desde que platicamos. Todavía puedo ayudarte a entender cómo pagar menos impuestos legalmente.\n\n¿Quieres que retomemos donde nos quedamos?`;
  }

  // Filtro 1-2 — apenas empezaron
  if (hoursInactive < 24) {
    return `${saludo}, soy Sofía de Finance S Cool 😊\n\nHace rato me escribiste y me encantaría ayudarte. ¿Tienes un minuto para que te explique cómo podemos ayudarte a pagar menos impuestos?`;
  }
  if (hoursInactive < 72) {
    return `${saludo}, soy Sofía de Finance S Cool 👋\n\nVi que nos contactaste hace poco. Muchas personas como tú están aprovechando deducciones fiscales que no conocían.\n\n¿Te gustaría saber si aplicas? Es rápido y sin compromiso.`;
  }
  return `${saludo}, soy Sofía de Finance S Cool 🙂\n\nTe escribo porque hace unos días mostraste interés en optimizar tus impuestos. Tenemos asesorías gratuitas de 15-30 minutos donde te explicamos exactamente cómo reducir lo que pagas al SAT.\n\n¿Te interesa agendar una? No tiene costo ni compromiso.\n\n_Si ya no deseas recibir mensajes, escribe STOP._`;
}

router.post('/follow-up', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const maxPerRun = parseInt(req.body.max) || 30;
    const dryRun = req.body.dryRun === true;
    const minHoursInactive = parseInt(req.body.minHours) || 6;

    // Obtener leads en calificación que no han respondido en X horas
    const cutoff = new Date(Date.now() - minHoursInactive * 60 * 60 * 1000).toISOString();
    const { data: leads, error } = await db
      .from('fsc_conversations')
      .select('id, whatsapp_number, nombre_lead, lead_status, filtro_actual, prioridad, updated_at, conversation_history, modo_humano')
      .eq('lead_status', 'en_calificacion')
      .lt('updated_at', cutoff)
      .order('filtro_actual', { ascending: false }) // Priorizar los más avanzados
      .limit(maxPerRun * 2); // Traer extras por si filtramos algunos

    if (error) throw new Error(error.message);
    if (!leads || leads.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No hay leads para seguimiento' });
    }

    const results = [];
    let sent = 0;

    for (const lead of leads) {
      if (sent >= maxPerRun) break;
      if (lead.modo_humano) continue; // No interrumpir modo humano

      const phone = lead.whatsapp_number;
      if (!phone) continue;

      // Calcular horas de inactividad
      const hoursInactive = (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60);

      // Verificar que no le hayamos mandado follow-up recientemente
      let history = [];
      try {
        history = typeof lead.conversation_history === 'string'
          ? JSON.parse(lead.conversation_history)
          : (lead.conversation_history || []);
      } catch { history = []; }

      // Contar follow-ups consecutivos sin respuesta del usuario
      let consecutiveFollowUps = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user') break;
        if (history[i].isFollowUp) consecutiveFollowUps++;
      }
      if (consecutiveFollowUps >= 3) continue; // Máximo 3 follow-ups sin respuesta

      const message = buildFollowUpMessage(lead, hoursInactive);

      if (dryRun) {
        results.push({ phone, nombre: lead.nombre_lead, filtro: lead.filtro_actual, hoursInactive: Math.round(hoursInactive), message: message.slice(0, 80) + '...', status: 'dry_run' });
        sent++;
        continue;
      }

      // Enviar mensaje por WhatsApp
      try {
        const waResp = await fetch(`https://graph.facebook.com/v22.0/${WA_PHONE_ID_FSC}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${WA_TOKEN_FSC}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone.replace(/\D/g, ''),
            type: 'text',
            text: { body: message },
          }),
        });

        const waData = await waResp.json();
        const success = waResp.ok && waData.messages?.[0]?.id;

        if (success) {
          // Guardar en historial
          history.push({
            role: 'assistant',
            content: message,
            timestamp: new Date().toISOString(),
            isFollowUp: true,
            followUpTier: lead.filtro_actual >= 8 ? 'hot' : lead.filtro_actual >= 5 ? 'warm' : 'cold',
          });

          await db.from('fsc_conversations').update({
            conversation_history: JSON.stringify(history),
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id);

          results.push({ phone, nombre: lead.nombre_lead, filtro: lead.filtro_actual, status: 'sent' });
          sent++;
        } else {
          results.push({ phone, nombre: lead.nombre_lead, filtro: lead.filtro_actual, status: 'failed', error: waData.error?.message || 'Unknown' });
        }
      } catch (sendErr) {
        results.push({ phone, nombre: lead.nombre_lead, filtro: lead.filtro_actual, status: 'error', error: sendErr.message });
      }
    }

    res.json({
      success: true,
      sent,
      total: leads.length,
      results,
      breakdown: {
        hot: results.filter(r => r.filtro >= 5).length,
        warm: results.filter(r => r.filtro >= 3 && r.filtro < 5).length,
        cold: results.filter(r => r.filtro < 3).length,
      },
    });
  } catch (err) {
    console.error('Follow-up error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /follow-up/preview — ver qué leads recibirían seguimiento (dry run)
router.get('/follow-up/preview', verifyToken, async (req, res) => {
  // Simula el follow-up sin enviar
  req.body = { dryRun: true, max: 50, minHours: parseInt(req.query.minHours) || 6 };
  // Reutilizar la lógica del POST
  const db = getDB();
  const cutoff = new Date(Date.now() - (req.body.minHours) * 60 * 60 * 1000).toISOString();
  const { data: leads } = await db
    .from('fsc_conversations')
    .select('whatsapp_number, nombre_lead, filtro_actual, updated_at, modo_humano')
    .eq('lead_status', 'en_calificacion')
    .lt('updated_at', cutoff)
    .order('filtro_actual', { ascending: false })
    .limit(50);

  const preview = (leads || []).filter(l => !l.modo_humano && l.whatsapp_number).map(l => {
    const hours = Math.round((Date.now() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60));
    return { nombre: l.nombre_lead, filtro: l.filtro_actual, hoursInactive: hours, phone: l.whatsapp_number };
  });

  res.json({
    total: preview.length,
    hot: preview.filter(p => p.filtro >= 5).length,
    warm: preview.filter(p => p.filtro >= 3 && p.filtro < 5).length,
    cold: preview.filter(p => p.filtro < 3).length,
    leads: preview,
  });
});

// ==================== APPOINTMENT REMINDERS ====================

router.post('/reminders', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: leads, error } = await db
      .from('fsc_conversations')
      .select('id, whatsapp_number, nombre_lead, fecha_cita, hora_cita, conversation_history, modo_humano')
      .eq('lead_status', 'cita_agendada')
      .in('fecha_cita', [today, tomorrow]);

    if (error) throw new Error(error.message);
    if (!leads || leads.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No hay citas próximas para recordar' });
    }

    const results = [];
    let sent = 0;

    for (const lead of leads) {
      if (lead.modo_humano) continue;
      const phone = lead.whatsapp_number;
      if (!phone || !lead.fecha_cita || !lead.hora_cita) continue;

      const nombre = (lead.nombre_lead || '').split(' ')[0] || 'ahí';

      // Calculate hours until appointment
      const [hh, mm] = lead.hora_cita.split(':').map(Number);
      const appointmentTime = new Date(`${lead.fecha_cita}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
      const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determine which reminder to send
      let reminderType = null;
      let message = null;

      if (hoursUntil >= 23 && hoursUntil <= 25) {
        reminderType = '24h';
        message = `Hola ${nombre}, mañana es tu asesoría fiscal:\n\n📅 ${lead.fecha_cita}\n🕐 ${lead.hora_cita}\n\n¿Nos confirmas que asistirás?`;
      } else if (hoursUntil >= 0.5 && hoursUntil <= 1.5) {
        reminderType = '1h';
        message = `⏰ En 1 hora es tu asesoría fiscal.\n\nTip: ten a la mano tu último recibo de nómina.\n¡Te esperamos!`;
      } else if (hoursUntil >= 0 && hoursUntil <= 0.17) {
        reminderType = '10min';
        message = `🟢 ¡Ya estamos listos!\n\nTu asesora ya está conectada.\n📹 Entra por WhatsApp o espera el link de Meet.`;
      }

      if (!reminderType) continue;

      // Parse conversation history
      let history = [];
      try {
        history = typeof lead.conversation_history === 'string'
          ? JSON.parse(lead.conversation_history)
          : (lead.conversation_history || []);
      } catch { history = []; }

      // Check if this reminder was already sent
      const alreadySent = history.some(
        (entry) => entry.isReminder === true && entry.reminderType === reminderType
      );
      if (alreadySent) continue;

      // Send WhatsApp template message
      try {
        const fechaStr = lead.fecha_cita;
        const payload = reminderType === '24h'
          ? buildTemplatePayload(phone, 'fsc_recordatorio_24h', [lead.nombre_lead || 'Hola', fechaStr, lead.hora_cita])
          : reminderType === '1h'
          ? buildTemplatePayload(phone, 'fsc_recordatorio_1h', [lead.nombre_lead || 'Hola'])
          : buildTemplatePayload(phone, 'fsc_recordatorio_10min', [lead.nombre_lead || 'Hola']);

        const { ok, messageId, error: waError } = await sendWAMessage(phone, payload);
        const success = ok && messageId;

        if (success) {
          history.push({
            role: 'assistant',
            content: message,
            timestamp: new Date().toISOString(),
            isReminder: true,
            reminderType,
          });

          await db.from('fsc_conversations').update({
            conversation_history: JSON.stringify(history),
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id);

          results.push({ phone, nombre: lead.nombre_lead, reminderType, status: 'sent' });
          sent++;
        } else {
          results.push({ phone, nombre: lead.nombre_lead, reminderType, status: 'failed', error: waError || 'Unknown' });
        }
      } catch (sendErr) {
        results.push({ phone, nombre: lead.nombre_lead, reminderType, status: 'error', error: sendErr.message });
      }
    }

    res.json({ success: true, sent, total: leads.length, results });
  } catch (err) {
    console.error('Reminders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== NO-SHOW HANDLER ====================

router.post('/no-show', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const now = new Date();

    const { data: leads, error } = await db
      .from('fsc_conversations')
      .select('id, whatsapp_number, nombre_lead, fecha_cita, hora_cita, conversation_history, modo_humano')
      .eq('lead_status', 'cita_agendada');

    if (error) throw new Error(error.message);
    if (!leads || leads.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No hay no-shows detectados' });
    }

    const results = [];
    let sent = 0;

    for (const lead of leads) {
      if (lead.modo_humano) continue;
      const phone = lead.whatsapp_number;
      if (!phone || !lead.fecha_cita || !lead.hora_cita) continue;

      const [hh, mm] = lead.hora_cita.split(':').map(Number);
      const appointmentTime = new Date(`${lead.fecha_cita}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
      const minutesSince = (now.getTime() - appointmentTime.getTime()) / (1000 * 60);

      // Only flag as no-show if appointment was 15+ minutes ago
      if (minutesSince < 15) continue;

      const nombre = (lead.nombre_lead || '').split(' ')[0] || 'ahí';
      const message = `Hola ${nombre}, no pudimos conectarnos hoy. No te preocupes, te puedo reagendar.\n\n¿Qué horario te funciona esta semana?`;

      let history = [];
      try {
        history = typeof lead.conversation_history === 'string'
          ? JSON.parse(lead.conversation_history)
          : (lead.conversation_history || []);
      } catch { history = []; }

      try {
        const payload = buildTemplatePayload(phone, 'fsc_no_show', [lead.nombre_lead || 'Hola']);
        const { ok, messageId, error: waError } = await sendWAMessage(phone, payload);
        const success = ok && messageId;

        if (success) {
          history.push({
            role: 'assistant',
            content: message,
            timestamp: new Date().toISOString(),
            isNoShow: true,
          });

          await db.from('fsc_conversations').update({
            conversation_history: JSON.stringify(history),
            lead_status: 'no_show',
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id);

          results.push({ phone, nombre: lead.nombre_lead, status: 'sent' });
          sent++;
        } else {
          results.push({ phone, nombre: lead.nombre_lead, status: 'failed', error: waError || 'Unknown' });
        }
      } catch (sendErr) {
        results.push({ phone, nombre: lead.nombre_lead, status: 'error', error: sendErr.message });
      }
    }

    res.json({ success: true, sent, total: leads.length, results });
  } catch (err) {
    console.error('No-show error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== POST-CITA NURTURE ====================

router.post('/post-cita', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const now = new Date();

    const { data: leads, error } = await db
      .from('fsc_conversations')
      .select('id, whatsapp_number, nombre_lead, updated_at, conversation_history, modo_humano')
      .eq('lead_status', 'cita_asistida');

    if (error) throw new Error(error.message);
    if (!leads || leads.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No hay leads post-cita para nurture' });
    }

    const results = [];
    let sent = 0;

    for (const lead of leads) {
      if (lead.modo_humano) continue;
      const phone = lead.whatsapp_number;
      if (!phone) continue;

      const nombre = (lead.nombre_lead || '').split(' ')[0] || 'ahí';
      const daysSinceUpdate = (now.getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24);

      let history = [];
      try {
        history = typeof lead.conversation_history === 'string'
          ? JSON.parse(lead.conversation_history)
          : (lead.conversation_history || []);
      } catch { history = []; }

      // Determine which nurture tiers have already been sent
      const sentTiers = new Set(
        history
          .filter((entry) => entry.isNurture === true)
          .map((entry) => entry.nurtureTier)
      );

      let nurtureTier = null;
      let message = null;

      if (!sentTiers.has(1) && daysSinceUpdate >= 1 && daysSinceUpdate < 3) {
        nurtureTier = 1;
        message = `¡Gracias por tu tiempo, ${nombre}! ¿Tienes alguna duda sobre lo que platicamos?`;
      } else if (!sentTiers.has(2) && daysSinceUpdate >= 3 && daysSinceUpdate < 7) {
        nurtureTier = 2;
        message = `Hola ${nombre}, te comparto un dato: profesionistas como tú logran ahorrar en promedio $45,000 al año con una estrategia fiscal bien armada. ¿Te gustaría que agendemos la segunda sesión para armar tu plan?`;
      } else if (!sentTiers.has(3) && daysSinceUpdate >= 7) {
        nurtureTier = 3;
        message = `Hola ${nombre}, esta semana tenemos disponibilidad para tu sesión de plan fiscal personalizado. ¿Te agendo?`;
      }

      if (!nurtureTier) continue;

      try {
        const payload = nurtureTier === 1
          ? buildTemplatePayload(phone, 'fsc_nurture_dia1', [lead.nombre_lead || 'Hola'])
          : buildTemplatePayload(phone, 'fsc_nurture_segunda_cita', [lead.nombre_lead || 'Hola']);

        const { ok, messageId, error: waError } = await sendWAMessage(phone, payload);
        const success = ok && messageId;

        if (success) {
          history.push({
            role: 'assistant',
            content: message,
            timestamp: new Date().toISOString(),
            isNurture: true,
            nurtureTier,
          });

          await db.from('fsc_conversations').update({
            conversation_history: JSON.stringify(history),
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id);

          results.push({ phone, nombre: lead.nombre_lead, nurtureTier, status: 'sent' });
          sent++;
        } else {
          results.push({ phone, nombre: lead.nombre_lead, nurtureTier, status: 'failed', error: waError || 'Unknown' });
        }
      } catch (sendErr) {
        results.push({ phone, nombre: lead.nombre_lead, nurtureTier, status: 'error', error: sendErr.message });
      }
    }

    res.json({ success: true, sent, total: leads.length, results });
  } catch (err) {
    console.error('Post-cita nurture error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
