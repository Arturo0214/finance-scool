const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { oauth2Client, getAuthUrl, getCalendarClient } = require('../config/google-calendar');
const { getDB } = require('../models/database');

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
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const calendar = getCalendarClient(tokens);
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
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const calendar = getCalendarClient(tokens);
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
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const calendar = getCalendarClient(tokens);
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
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const calendar = getCalendarClient(tokens);
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
router.post('/schedule-meeting', async (req, res) => {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) return res.status(400).json({ error: 'Google Calendar no está conectado' });

    const calendar = getCalendarClient(tokens);
    const { clientName, clientEmail, clientPhone, date, time, duration, notes } = req.body;

    if (!date || !time) return res.status(400).json({ error: 'Fecha y hora son requeridas' });

    const durationMin = duration || 30;
    const startDateTime = `${date}T${time}:00`;
    const startDate = new Date(`${date}T${time}:00`);
    const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);
    const hh = String(endDate.getHours()).padStart(2, '0');
    const mm = String(endDate.getMinutes()).padStart(2, '0');
    const endDateTime = `${date}T${hh}:${mm}:00`;

    const event = {
      summary: `📞 Check-up Financiero: ${clientName || 'Lead'}`,
      description: [
        clientName ? `Cliente: ${clientName}` : '',
        clientPhone ? `WhatsApp: https://wa.me/${clientPhone.replace(/\D/g, '')}` : '',
        clientPhone ? `Teléfono: ${clientPhone}` : '',
        notes ? `Notas: ${notes}` : '',
      ].filter(Boolean).join('\n'),
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

    if (clientEmail) {
      event.attendees = [{ email: clientEmail }];
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: clientEmail ? 'all' : 'none',
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;

    res.json({
      success: true,
      meetLink,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      start: response.data.start,
      end: response.data.end,
    });
  } catch (err) {
    console.error('Schedule meeting error:', err);
    res.status(500).json({ error: 'Error al crear la cita con Google Meet' });
  }
});

module.exports = router;
