require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { initDB } = require('./models/database');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const apiRoutes = require('./routes/api');
const whatsappRoutes = require('./routes/whatsapp');
const fscRoutes = require('./routes/fsc');
const googleCalendarRoutes = require('./routes/google-calendar');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Security
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
// CORS: allow Netlify frontend in production, localhost in dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://finance-scool-104.netlify.app',
  'https://financescool.com.mx',
  'https://www.financescool.com.mx',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting for API
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'finance-scool', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/fsc', fscRoutes);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/google', googleCalendarRoutes);
app.use('/api', apiRoutes);

// Serve React build in production
if (isProd) {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Init DB and start — non-fatal: server starts even if DB seed fails
initDB().catch(err => {
  console.warn('⚠️  DB init warning (non-fatal):', err.message);
  console.warn('   Run the SQL in server/supabase-schema.sql in the Supabase SQL Editor.');
});

// ── CRON JOBS ──
const cronFetch = async (endpoint, label) => {
  try {
    const resp = await fetch(`http://localhost:${PORT}/api/whatsapp/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer INTERNAL_CRON' },
      body: JSON.stringify({}),
    });
    const data = await resp.json().catch(() => ({}));
    console.log(`[CRON] ${label}: ${resp.status}`, data.message || '');
  } catch (e) { console.error(`[CRON] ${label} error:`, e.message); }
};

// Recordatorios de cita cada 15 min
cron.schedule('*/15 * * * *', () => cronFetch('reminders', 'Reminders'));

// Detección de no-shows cada 30 min
cron.schedule('*/30 * * * *', () => cronFetch('no-show', 'No-show'));

// Nurture post-cita cada 6 horas
cron.schedule('0 */6 * * *', () => cronFetch('post-cita', 'Post-cita'));

app.listen(PORT, () => {
  console.log(`🚀 Finance SCool API running at http://localhost:${PORT}`);
  console.log('📅 Cron jobs active: reminders(15m), no-show(30m), post-cita(6h)');
});
// Force redeploy 1775865107
