const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { oauth2Client, getAuthUrl, getCalendarClient } = require('../config/google-calendar');
const { getDB } = require('../models/database');

// Helper: persist refreshed tokens to Supabase
const saveRefreshedTokens = async (newTokens) => {
  try {
    const db = getDB();
    const update = { updated_at: new Date().toISOString() };
    if (newTokens.access_token) update.access_token = newTokens.access_token;
    if (newTokens.expiry_date) update.expiry_date = new Date(newTokens.expiry_date).toISOString();
    await db.from('google_calendar_tokens').update(update).order('updated_at', { ascending: false }).limit(1);
    console.log('✅ Google token persisted to DB');
  } catch (e) { console.warn('⚠️ Failed to persist refreshed Google token:', e.message); }
};

// Helper: get calendar client with auto-persist
const getCalendar = async () => {
  const tokens = await getStoredTokens();
  if (!tokens) return null;
  return getCalendarClient(tokens, saveRefreshedTokens);
};

// ─── GET /api/google/auth-url ───
// Returns the Google OAuth URL to start the connection flow
router.get('/auth-url', verifyToken, (req, res) => {
  try {
    const frontendOrigin = req.query.origin || req.headers.origin || req.headers.referer;
    const url = getAuthUrl(frontendOrigin);
    res.json({ url });
  } catch (err) {
    console.error('Google auth-url error:', err);
    res.status(500).json({ error: 'Error al generar URL de autenticación' });
  }
});

// ─── GET /api/google/callback ───
// Handles the OAuth callback from Google, stores tokens in Supabase
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'No se recibió código de autorización' });

    // Use the state parameter as the frontend origin (passed during auth-url generation)
    const frontendUrl = state || process.env.FRONTEND_URL || 'http://localhost:5173';

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email from Google to identify the connection
    const oauth2 = require('googleapis').google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Store tokens in Supabase (upsert by google email)
    const { error } = await getDB()
      .from('google_calendar_tokens')
      .upsert({
        google_email: profile.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'google_email' });

    if (error) {
      console.error('Supabase upsert error:', error);
      // Fallback: store in memory if table doesn't exist yet
      global._googleCalTokens = { ...tokens, email: profile.email };
    }

    // Redirect to the SAME frontend origin the user came from (preserves their session)
    res.redirect(`${frontendUrl}/admin/calendar?google=connected&email=${encodeURIComponent(profile.email)}`);
  } catch (err) {
    console.error('Google callback error:', err);
    const frontendUrl = req.query.state || process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin/calendar?google=error`);
  }
});

// ─── GET /api/google/connection-status ───
// Check if Google Calendar is connected
router.get('/connection-status', verifyToken, async (req, res) => {
  try {
    // Try Supabase first
    const { data, error } = await getDB()
      .from('google_calendar_tokens')
      .select('google_email, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data && !error) {
      return res.json({ connected: true, email: data.google_email, lastSync: data.updated_at });
    }

    // Fallback to in-memory
    if (global._googleCalTokens) {
      return res.json({ connected: true, email: global._googleCalTokens.email });
    }

    res.json({ connected: false });
  } catch (err) {
    // Table might not exist yet
    if (global._googleCalTokens) {
      return res.json({ connected: true, email: global._googleCalTokens.email });
    }
    res.json({ connected: false });
  }
});

// ─── Helper: get stored tokens ───
async function getStoredTokens() {
  try {
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

// ─── GET /api/google/events ───
// Fetch events from Google Calendar
router.get('/events', verifyToken, async (req, res) => {
  try {
    const calendar = await getCalendar();
    if (!calendar) return res.status(400).json({ error: 'Google Calendar no está conectado' });
    const { timeMin, timeMax } = req.query;

    const now = new Date();
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      timeMax: timeMax || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = (response.data.items || []).map(e => ({
      id: e.id,
      title: e.summary || '(Sin título)',
      description: e.description || '',
      start_date: e.start?.dateTime || e.start?.date,
      end_date: e.end?.dateTime || e.end?.date,
      all_day: !!e.start?.date,
      color: e.colorId || null,
      source: 'google',
      htmlLink: e.htmlLink,
      conferenceData: e.conferenceData || null,
      meeting_link: e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || '',
    }));

    res.json(events);
  } catch (err) {
    console.error('Google events error:', err);
    res.status(500).json({ error: 'Error al obtener eventos de Google Calendar' });
  }
});

// ─── POST /api/google/events ───
// Create an event in Google Calendar
router.post('/events', verifyToken, async (req, res) => {
  try {
    const calendar = await getCalendar();
    if (!calendar) return res.status(400).json({ error: 'Google Calendar no está conectado' });
    const { title, description, start_date, end_date, time, duration, addMeet, attendeeEmail } = req.body;

    // Duración por defecto: 30 minutos
    const durationMin = duration || 30;
    const startDateTime = time ? `${start_date}T${time}:00` : start_date;
    let endDateTime;
    if (time) {
      const startDate = new Date(`${start_date}T${time}:00`);
      const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);
      const hh = String(endDate.getHours()).padStart(2, '0');
      const mm = String(endDate.getMinutes()).padStart(2, '0');
      endDateTime = `${start_date}T${hh}:${mm}:00`;
    } else {
      endDateTime = end_date || start_date;
    }

    const event = {
      summary: title,
      description: description || '',
      start: time ? { dateTime: startDateTime, timeZone: 'America/Mexico_City' } : { date: start_date },
      end: time ? { dateTime: endDateTime, timeZone: 'America/Mexico_City' } : { date: end_date || start_date },
    };

    // Google Meet automático
    if (addMeet !== false) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    // Agregar asistente (recibirá invitación por email con link de Meet)
    if (attendeeEmail) {
      event.attendees = [{ email: attendeeEmail }];
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1, // Requerido para crear Meet
      sendUpdates: attendeeEmail ? 'all' : 'none', // Enviar invitación si hay asistente
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;

    res.json({ success: true, event: response.data, meetLink });
  } catch (err) {
    console.error('Create Google event error:', err);
    res.status(500).json({ error: 'Error al crear evento en Google Calendar' });
  }
});

// ─── PUT /api/google/events/:eventId ───
// Update an event in Google Calendar
router.put('/events/:eventId', verifyToken, async (req, res) => {
  try {
    const calendar = await getCalendar();
    if (!calendar) return res.status(400).json({ error: 'Google Calendar no está conectado' });
    const { title, description, start_date, end_date, time, addMeet } = req.body;

    const startDateTime = time ? `${start_date}T${time}:00` : start_date;
    const endDateTime = end_date || (time ? `${start_date}T${String(Number(time.split(':')[0]) + 1).padStart(2, '0')}:${time.split(':')[1]}:00` : start_date);

    const event = {
      summary: title,
      description: description || '',
      start: time ? { dateTime: startDateTime, timeZone: 'America/Mexico_City' } : { date: start_date },
      end: time ? { dateTime: endDateTime, timeZone: 'America/Mexico_City' } : { date: end_date || start_date },
    };

    // Agregar Google Meet si se solicita
    if (addMeet) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-edit-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: req.params.eventId,
      resource: event,
      conferenceDataVersion: addMeet ? 1 : 0,
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;

    res.json({ success: true, event: response.data, meetLink });
  } catch (err) {
    console.error('Update Google event error:', err);
    res.status(500).json({ error: 'Error al actualizar evento en Google Calendar' });
  }
});

// ─── DELETE /api/google/events/:eventId ───
// Delete an event from Google Calendar
router.delete('/events/:eventId', verifyToken, async (req, res) => {
  try {
    const calendar = await getCalendar();
    if (!calendar) return res.status(400).json({ error: 'Google Calendar no está conectado' });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: req.params.eventId,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete Google event error:', err);
    res.status(500).json({ error: 'Error al eliminar evento de Google Calendar' });
  }
});

// ─── GET /api/google/meet-participants/:meetCode ───
// Get participants who actually connected to a Google Meet call
// meetCode = the part after meet.google.com/ (e.g. "abc-defg-hij")
router.get('/meet-participants/:meetCode', verifyToken, async (req, res) => {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const { google } = require('googleapis');
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials(tokens);

    const meet = google.meet({ version: 'v2', auth });
    const meetCode = req.params.meetCode;

    // List conference records filtering by space
    const confResp = await meet.conferenceRecords.list({
      filter: `space.meeting_code="${meetCode}"`,
    });

    const records = confResp.data.conferenceRecords || [];
    if (records.length === 0) {
      return res.json({ participants: [], message: 'No se encontraron registros para esta reunión. Puede que aún no haya ocurrido.' });
    }

    // Get participants for each conference record
    const allParticipants = [];
    for (const record of records) {
      const recordName = record.name; // e.g. "conferenceRecords/xxx"
      const partResp = await meet.conferenceRecords.participants.list({
        parent: recordName,
      });
      const participants = partResp.data.participants || [];
      for (const p of participants) {
        allParticipants.push({
          email: p.signedinUser?.user || p.signedinUser?.displayName || p.anonymousUser?.displayName || 'Anónimo',
          displayName: p.signedinUser?.displayName || p.anonymousUser?.displayName || 'Sin nombre',
          joinTime: p.earliestStartTime,
          leaveTime: p.latestEndTime,
        });
      }
    }

    res.json({
      meetCode,
      totalRecords: records.length,
      participants: allParticipants,
    });
  } catch (err) {
    console.error('Meet participants error:', err.message);
    if (err.message?.includes('insufficient authentication scopes') || err.code === 403) {
      return res.status(403).json({
        error: 'Se requiere re-autorizar Google con permisos de Meet. Ve a Calendario > desconecta y vuelve a conectar Google.',
        needsReauth: true,
      });
    }
    res.status(500).json({ error: 'Error al obtener participantes: ' + err.message });
  }
});

// ─── GET /api/google/all-meet-attendance ───
// Get attendance for all upcoming/recent appointments
router.get('/all-meet-attendance', verifyToken, async (req, res) => {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const { google } = require('googleapis');
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials(tokens);

    const meet = google.meet({ version: 'v2', auth });

    // Get recent conference records
    const confResp = await meet.conferenceRecords.list({ pageSize: 25 });
    const records = confResp.data.conferenceRecords || [];

    const results = [];
    for (const record of records) {
      const partResp = await meet.conferenceRecords.participants.list({
        parent: record.name,
      });
      const participants = (partResp.data.participants || []).map(p => ({
        email: p.signedinUser?.user || p.anonymousUser?.displayName || 'Anónimo',
        displayName: p.signedinUser?.displayName || p.anonymousUser?.displayName || '',
        joinTime: p.earliestStartTime,
        leaveTime: p.latestEndTime,
      }));

      results.push({
        meetCode: record.space?.meetingCode || '',
        startTime: record.startTime,
        endTime: record.endTime,
        participants,
      });
    }

    res.json({ meetings: results });
  } catch (err) {
    console.error('All meet attendance error:', err.message);
    if (err.message?.includes('insufficient authentication scopes') || err.code === 403) {
      return res.status(403).json({ error: 'Re-autorizar Google con permisos de Meet', needsReauth: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/google/disconnect ───
// Disconnect Google Calendar
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    await getDB().from('google_calendar_tokens').delete().neq('id', 0);
    global._googleCalTokens = null;
    res.json({ success: true });
  } catch (err) {
    global._googleCalTokens = null;
    res.json({ success: true });
  }
});

// ─── POST /api/google/schedule-meeting ───
// Crear cita de 30 min con Google Meet (llamado por n8n o WhatsApp bot)
// No requiere verifyToken — público para que n8n pueda llamarlo
// Parsear fecha amigable ("Viernes", "mañana", "2026-04-18") a YYYY-MM-DD
function parseFlexibleDate(input) {
  if (!input) return null;
  // Ya es ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const lower = input.toLowerCase().trim();
  const now = new Date();
  const DAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };

  if (lower === 'hoy') return now.toISOString().split('T')[0];
  if (lower === 'mañana' || lower === 'manana') {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split('T')[0];
  }

  // Día de la semana
  for (const [name, dayNum] of Object.entries(DAYS)) {
    if (lower.includes(name)) {
      const current = now.getDay();
      let diff = dayNum - current;
      if (diff <= 0) diff += 7; // próxima semana si ya pasó
      now.setDate(now.getDate() + diff);
      return now.toISOString().split('T')[0];
    }
  }

  // Intentar parsear como fecha
  try {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}

  return null;
}

// Parsear hora amigable ("10:00 AM", "14:00", "2 PM") a HH:MM
function parseFlexibleTime(input) {
  if (!input) return null;
  // Ya es HH:MM
  if (/^\d{1,2}:\d{2}$/.test(input)) return input.padStart(5, '0');

  const match = input.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?/);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const mins = match[2] ? match[2] : '00';
  const ampm = (match[3] || '').toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${mins}`;
}

router.post('/schedule-meeting', async (req, res) => {
  try {
    const calendar = await getCalendar();
    if (!calendar) return res.status(400).json({ error: 'Google Calendar no está conectado' });
    const {
      clientName, clientEmail, clientPhone, date, time, duration, notes,
      declara_impuestos, regimen, edad, ingreso, situacion_laboral, objetivo, prioridad,
    } = req.body;

    const parsedDate = parseFlexibleDate(date);
    const parsedTime = parseFlexibleTime(time);

    if (!parsedDate || !parsedTime) return res.status(400).json({ error: `No se pudo interpretar fecha/hora: date="${date}" time="${time}"` });

    // Dedup: check if an appointment already exists for this phone in the next 7 days
    if (clientPhone) {
      try {
        const db = getDB();
        const today = new Date().toISOString().split('T')[0];
        const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: existing } = await db.from('fsc_appointments')
          .select('event_id,date,time')
          .eq('client_phone', clientPhone)
          .gte('date', today)
          .lte('date', weekLater)
          .limit(1);
        if (existing && existing.length > 0) {
          console.log(`⚠️ Cita duplicada evitada para ${clientPhone} — ya tiene cita el ${existing[0].date} ${existing[0].time}`);
          return res.json({
            success: true,
            meetLink: null,
            eventId: existing[0].event_id,
            duplicate: true,
            message: `Ya existe una cita para este lead el ${existing[0].date} a las ${existing[0].time}`,
          });
        }
      } catch (dedupErr) {
        console.warn('⚠️ Dedup check failed, proceeding:', dedupErr.message);
      }
    }

    const durationMin = duration || 30;
    const startDateTime = `${parsedDate}T${parsedTime}:00`;
    const startDate = new Date(`${parsedDate}T${parsedTime}:00`);
    const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);
    const hh = String(endDate.getHours()).padStart(2, '0');
    const mm = String(endDate.getMinutes()).padStart(2, '0');
    const endDateTime = `${parsedDate}T${hh}:${mm}:00`;

    // Build description with client info + collected data
    const descLines = [
      clientName ? `Cliente: ${clientName}` : '',
      clientPhone ? `WhatsApp: https://wa.me/${clientPhone.replace(/\D/g, '')}` : '',
      clientPhone ? `Teléfono: ${clientPhone}` : '',
      notes ? `Notas: ${notes}` : '',
    ];

    // Add collected lead data if available
    const dataLines = [
      declara_impuestos != null ? `Declara impuestos: ${declara_impuestos}` : '',
      regimen ? `Régimen fiscal: ${regimen}` : '',
      edad ? `Edad: ${edad}` : '',
      ingreso ? `Ingreso mensual: ${ingreso}` : '',
      situacion_laboral ? `Sit. laboral: ${situacion_laboral}` : '',
      objetivo ? `Objetivo: ${objetivo}` : '',
      prioridad ? `Prioridad: ${prioridad}` : '',
    ].filter(Boolean);

    if (dataLines.length > 0) {
      descLines.push('', '🏷️ Datos recopilados', ...dataLines);
    }

    const event = {
      summary: `📞 Check-up Financiero: ${clientName || 'Lead'}`,
      description: descLines.filter(Boolean).join('\n'),
      start: { dateTime: startDateTime, timeZone: 'America/Mexico_City' },
      end: { dateTime: endDateTime, timeZone: 'America/Mexico_City' },
      conferenceData: {
        createRequest: {
          requestId: `fsc-meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
    };

    // Solo agregar attendee si es un email válido (contiene @ y .)
    const isValidEmail = clientEmail && clientEmail.includes('@') && clientEmail.includes('.');
    if (isValidEmail) {
      event.attendees = [{ email: clientEmail }];
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: isValidEmail ? 'all' : 'none',
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;

    // Formatear fecha para mensaje
    const fechaLegible = new Date(`${parsedDate}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Enviar link de Meet al lead por WhatsApp (fire-and-forget)
    const WA_PHONE_ID = '991785554028931';
    const WA_TOKEN = process.env.WA_TOKEN || 'EAAXOU1ELZAK0BRPk2qu8TR5qx00Qe9Mi3wGJ7JT1AlZAOzXvl60LnIXFsjFBmuHSDZAIzxnTn7UyXn0ygFDvoNmdor4snZBsDmhhjrhDdYPInLyWMPQNT2dzylydcgZBLpcByNVldVsiZCifKfZCU2T0Uh2ncFrEV6ZB8dDngAmEJktKkTNjizi7AKByFMil2RqAeAZDZD';
    if (clientPhone && meetLink) {
      const nombre = (clientName || '').split(' ')[0] || 'Hola';
      const waMsg = `¡${nombre}, tu cita está confirmada! 🎉\n\n📅 *${fechaLegible}*\n🕐 *${parsedTime} hrs*\n⏱️ Duración: ${durationMin} minutos\n👩‍💼 Consultora: Ingrid Escobar\n📹 *Link de reunión:* ${meetLink}\n\nPor favor conéctate puntual. ¡Nos vemos ahí! 💪`;
      try {
        await fetch(`https://graph.facebook.com/v22.0/${WA_PHONE_ID}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: clientPhone.replace(/\D/g, ''), type: 'text', text: { body: waMsg } }),
        });
        console.log(`✅ Meet link enviado a ${clientPhone}`);
      } catch (waErr) {
        console.warn(`⚠️ No se pudo enviar Meet link a ${clientPhone}:`, waErr.message);
      }
    }

    // Guardar cita en Supabase para recordatorios
    try {
      const db = getDB();
      await db.from('fsc_appointments').upsert({
        client_phone: clientPhone || '',
        client_name: clientName || '',
        client_email: clientEmail || '',
        event_id: response.data.id,
        meet_link: meetLink || '',
        date: parsedDate,
        time: parsedTime,
        duration: durationMin,
        reminder_morning_sent: false,
        reminder_1h_sent: false,
        created_at: new Date().toISOString(),
      }, { onConflict: 'event_id' });
    } catch (dbErr) {
      console.warn('⚠️ No se pudo guardar cita en Supabase:', dbErr.message);
    }

    res.json({
      success: true,
      meetLink,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      start: response.data.start,
      end: response.data.end,
      parsedDate,
      parsedTime,
      fechaLegible,
      waMessageSent: !!(clientPhone && meetLink),
    });
  } catch (err) {
    console.error('Schedule meeting error:', err);
    res.status(500).json({ error: 'Error al crear la cita con Google Meet: ' + err.message });
  }
});

// ─── Cron: Recordatorios de citas ───
// Se ejecuta cada 30 min para enviar recordatorios
const REMINDER_WA_PHONE_ID = '991785554028931';
const REMINDER_WA_TOKEN = process.env.WA_TOKEN || 'EAAXOU1ELZAK0BRPk2qu8TR5qx00Qe9Mi3wGJ7JT1AlZAOzXvl60LnIXFsjFBmuHSDZAIzxnTn7UyXn0ygFDvoNmdor4snZBsDmhhjrhDdYPInLyWMPQNT2dzylydcgZBLpcByNVldVsiZCifKfZCU2T0Uh2ncFrEV6ZB8dDngAmEJktKkTNjizi7AKByFMil2RqAeAZDZD';

async function sendAppointmentReminders() {
  try {
    const db = getDB();
    const now = new Date();
    const { data: appointments } = await db.from('fsc_appointments').select('*').gte('date', now.toISOString().split('T')[0]);

    if (!appointments || appointments.length === 0) return;

    for (const apt of appointments) {
      const aptDateTime = new Date(`${apt.date}T${apt.time}:00`);
      const hoursUntil = (aptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const nombre = (apt.client_name || '').split(' ')[0] || 'Hola';
      const phone = apt.client_phone?.replace(/\D/g, '');
      if (!phone) continue;

      // Recordatorio de la mañana (entre 8-9 AM del día de la cita, si es hoy)
      const isToday = apt.date === now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      if (isToday && currentHour >= 8 && currentHour < 9 && !apt.reminder_morning_sent) {
        const msg = `¡Buenos días ${nombre}! ☀️\n\nTe recuerdo que hoy tienes tu asesoría financiera a las *${apt.time} hrs* con Ingrid Escobar.\n\n📹 Link: ${apt.meet_link}\n\n¡Te esperamos! 💪`;
        try {
          await fetch(`https://graph.facebook.com/v22.0/${REMINDER_WA_PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${REMINDER_WA_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: msg } }),
          });
          await db.from('fsc_appointments').update({ reminder_morning_sent: true }).eq('event_id', apt.event_id);
          console.log(`✅ Recordatorio mañana enviado a ${phone}`);
        } catch (e) { console.warn('Reminder morning error:', e.message); }
      }

      // Recordatorio 1 hora antes
      if (hoursUntil > 0.5 && hoursUntil <= 1.5 && !apt.reminder_1h_sent) {
        const msg = `¡${nombre}, tu asesoría empieza en 1 hora! ⏰\n\n🕐 *${apt.time} hrs*\n📹 Link: ${apt.meet_link}\n\nConéctate puntual. ¡Nos vemos! 🙌`;
        try {
          await fetch(`https://graph.facebook.com/v22.0/${REMINDER_WA_PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${REMINDER_WA_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: msg } }),
          });
          await db.from('fsc_appointments').update({ reminder_1h_sent: true }).eq('event_id', apt.event_id);
          console.log(`✅ Recordatorio 1h enviado a ${phone}`);
        } catch (e) { console.warn('Reminder 1h error:', e.message); }
      }
    }
  } catch (err) {
    console.error('Reminder cron error:', err.message);
  }
}

// Ejecutar cada 30 minutos
setInterval(sendAppointmentReminders, 30 * 60 * 1000);
// Ejecutar al arrancar después de 10s
setTimeout(sendAppointmentReminders, 10000);

module.exports = router;
