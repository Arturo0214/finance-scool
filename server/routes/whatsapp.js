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

    // Rango: mañana hasta N días (+ buffer para días sin horario)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead + 4);

    // Consultar Google Calendar FreeBusy
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

    // Generar slots disponibles: horario de Ingrid menos eventos ocupados
    const dayMap = new Map();
    const slotMs = duration * 60 * 1000;

    for (let d = 0; d < daysAhead + 4 && dayMap.size < daysAhead; d++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + d);
      const dayOfWeek = day.getUTCDay();
      const schedule = SCHEDULE[dayOfWeek];
      if (!schedule) continue; // día cerrado

      const dateStr = day.toISOString().slice(0, 10);
      const utcStart = mxToUTC(dateStr, schedule.start).getTime();
      const utcEnd = mxToUTC(dateStr, schedule.end).getTime();

      const available = [];
      let cursor = utcStart;

      while (cursor + slotMs <= utcEnd) {
        const slotEnd = cursor + slotMs;

        // Verificar si el slot se sobrelapa con algún evento ocupado
        const isBusy = busySlots.some(b => cursor < b.end && slotEnd > b.start);

        if (!isBusy) {
          // Convertir a hora Mexico City para mostrar
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
    if (search) query = query.or(`contact_name.ilike.%${search}%,wa_id.ilike.%${search}%`);
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
    if (search) fscQuery = fscQuery.or(`nombre_lead.ilike.%${search}%,whatsapp_number.ilike.%${search}%`);
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
      return { ...rest, lastMessage: preview };
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

module.exports = router;
