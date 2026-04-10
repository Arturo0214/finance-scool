require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
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

app.listen(PORT, () => {
  console.log(`🚀 Finance SCool API running at http://localhost:${PORT}`);
});
