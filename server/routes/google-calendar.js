const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { oauth2Client, getAuthUrl, getCalendarClient } = require('../config/google-calendar');
const { supabase } = require('../models/database');

// ─── GET /api/google/auth-url ───
// Returns the Google OAuth URL to start the connection flow
router.get('/auth-url', verifyToken, (req, res) => {
  try {
    const url = getAuthUrl();
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
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'No se recibió código de autorización' });

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email from Google to identify the connection
    const oauth2 = require('googleapis').google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Store tokens in Supabase (upsert by google email)
    const { error } = await supabase
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

    // Redirect to frontend calendar page with success indicator
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin/calendar?google=connected&email=${encodeURIComponent(profile.email)}`);
  } catch (err) {
    console.error('Google callback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin/calendar?google=error`);
  }
});

// ─── GET /api/google/connection-status ───
// Check if Google Calendar is connected
router.get('/connection-status', verifyToken, async (req, res) => {
  try {
    // Try Supabase first
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { title, description, start_date, end_date, time } = req.body;

    const startDateTime = time ? `${start_date}T${time}:00` : start_date;
    const endDateTime = end_date || (time ? `${start_date}T${String(Number(time.split(':')[0]) + 1).padStart(2, '0')}:${time.split(':')[1]}:00` : start_date);

    const event = {
      summary: title,
      description: description || '',
      start: time ? { dateTime: startDateTime, timeZone: 'America/Mexico_City' } : { date: start_date },
      end: time ? { dateTime: endDateTime, timeZone: 'America/Mexico_City' } : { date: end_date || start_date },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({ success: true, event: response.data });
  } catch (err) {
    console.error('Create Google event error:', err);
    res.status(500).json({ error: 'Error al crear evento en Google Calendar' });
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
    await supabase.from('google_calendar_tokens').delete().neq('id', 0);
    global._googleCalTokens = null;
    res.json({ success: true });
  } catch (err) {
    global._googleCalTokens = null;
    res.json({ success: true });
  }
});

module.exports = router;
