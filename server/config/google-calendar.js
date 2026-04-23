const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/meetings.space.readonly',
];

function getAuthUrl(frontendOrigin) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: frontendOrigin || process.env.FRONTEND_URL || 'http://localhost:5173',
  });
}

function getCalendarClient(tokens, onTokenRefresh) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens);
  // Persist refreshed tokens so they don't expire between calls
  client.on('tokens', (newTokens) => {
    console.log('🔄 Google token refreshed, persisting...');
    if (onTokenRefresh) onTokenRefresh(newTokens);
  });
  return google.calendar({ version: 'v3', auth: client });
}

module.exports = { oauth2Client, getAuthUrl, getCalendarClient, SCOPES };
