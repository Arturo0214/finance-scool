# Finance SCool - Supabase Migration Guide

This document explains the migration from SQLite (sql.js) to Supabase PostgreSQL database.

## What Changed

### Database Module (`server/models/database.js`)
- Replaced `sql.js` with `@supabase/supabase-js` client
- All database functions are now **async** (return Promises)
- Maintains same API interface: `queryAll()`, `queryOne()`, `runQuery()`
- SQL queries are parsed and executed via Supabase query builder
- PostgreSQL syntax instead of SQLite (e.g., `now()` instead of `datetime('now')`)

### Routes (Async/Await)
Updated all route handlers to use async/await:
- `server/routes/auth.js`
- `server/routes/api.js`
- `server/routes/leads.js`

### Environment Variables
Added to `.env`:
```
SUPABASE_URL=https://jisfqytmoiaikaohyens.supabase.co
SUPABASE_SERVICE_KEY=<service_key>
```

## Setup Instructions

### Step 1: Create Supabase Tables

Copy the contents of `server/supabase-schema.sql` and run it in your **Supabase SQL Editor**:

1. Go to https://app.supabase.com
2. Select your project (jisfqytmoiaikaohyens)
3. Click "SQL Editor" on the left sidebar
4. Click "New Query"
5. Paste the entire content of `server/supabase-schema.sql`
6. Click "Run"

This creates all 5 tables with proper indexes and foreign keys:
- `users`
- `leads`
- `events`
- `messages`
- `notes`

### Step 2: Start the Server

```bash
npm run server
```

The server will:
1. Connect to Supabase using credentials from `.env`
2. Verify tables exist
3. Create admin user (if not exists)
4. Seed demo data (if tables are empty)

## Key Differences from SQLite

### SQL Syntax Changes

| SQLite | PostgreSQL |
|--------|-----------|
| `datetime('now')` | `now()` |
| `date(column)` | `DATE(column)` or cast to date |
| `strftime('%Y-%m', column)` | `to_char(column, 'YYYY-MM')` |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` |

### Query Parsing

The database module parses SQL and converts to Supabase query builder:

```javascript
// This SQLite query:
queryOne('SELECT * FROM users WHERE email=?', [email])

// Is converted to:
supabase.from('users').select('*').eq('email', email)
```

Supported SQL patterns:
- `SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT ... OFFSET ...`
- `INSERT INTO ... (...) VALUES (...)`
- `UPDATE ... SET ... WHERE ...`
- `DELETE FROM ... WHERE ...`
- Simple `JOIN` operations

### Limitations

The query parser handles most common patterns, but complex SQL may need rewriting:
- Complex JOINs with multiple conditions
- Subqueries
- Aggregations (GROUP BY)
- Window functions

For complex queries, use Supabase query builder directly:

```javascript
// Instead of complex SQL, use:
const { data } = await supabase
  .from('leads')
  .select('*, users(name)')
  .eq('status', 'nuevo')
  .order('created_at', { ascending: false });
```

## Environment Variables

```env
PORT=3001
JWT_SECRET=financescool_jwt_s3cr3t_pr0duction_2026
ADMIN_EMAIL=osvaldosuarezcruz@gmail.com
ADMIN_PASSWORD=admin123
NODE_ENV=development

# Supabase (required)
SUPABASE_URL=https://jisfqytmoiaikaohyens.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ WARNING**: Never commit the service key to version control. Use environment variables or secrets management in production.

## Database Connection

### Development
Credentials from `.env` are loaded automatically.

### Production
Use Supabase environment variables or a secrets manager:

```javascript
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
```

## Troubleshooting

### "Tables not found" error
- Verify you ran `server/supabase-schema.sql` in Supabase SQL Editor
- Check the table names match exactly (lowercase)

### Authentication errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
- Ensure you're using the **Service Key**, not the Anon Key
- Service Key is found under Settings > API in Supabase dashboard

### Query parsing errors
- Check SQL syntax matches the patterns shown above
- For unsupported queries, rewrite using Supabase query builder
- See `server/models/database.js` `executeSelect()`, `executeInsert()`, etc.

## API Compatibility

All route endpoints remain unchanged:

```
POST   /api/auth/login           - Login user
POST   /api/auth/logout          - Logout user
GET    /api/auth/me              - Get current user
POST   /api/auth/register        - Register new user

GET    /api/leads                - List leads (paginated)
POST   /api/leads                - Create lead (public)
GET    /api/leads/:id            - Get lead details
PUT    /api/leads/:id            - Update lead status/notes
DELETE /api/leads/:id            - Delete lead

GET    /api/events               - List events
POST   /api/events               - Create event
PUT    /api/events/:id           - Update event
DELETE /api/events/:id           - Delete event

GET    /api/messages             - List messages
POST   /api/messages             - Create message

GET    /api/stats                - Get statistics
GET    /api/users                - List users
```

## Testing

### Manual Testing
```bash
# Start server
npm run server

# In another terminal:
# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"osvaldosuarezcruz@gmail.com","password":"admin123"}'

# Get leads (add token from login response)
curl http://localhost:3001/api/leads \
  -H "Cookie: token=<token>"
```

### Client Testing
The client expects the same API responses, no changes needed.

## Performance Considerations

1. **Cold Starts**: First Supabase request may take 1-2s
2. **Connection Pooling**: Supabase handles connection pooling
3. **Indexes**: Schema includes indexes on frequently queried columns
4. **Rate Limiting**: 200 requests per 15 minutes per route (configured in server)

## Next Steps

1. Run `server/supabase-schema.sql` in Supabase SQL Editor
2. Update `.env` with your Supabase credentials
3. Start the server: `npm run server`
4. Test API endpoints
5. Deploy to production

## Support

For issues:
1. Check Supabase logs: https://app.supabase.com/project/{project}/logs/postgres
2. Verify table structure in Supabase SQL Editor
3. Enable debug logging in server code
4. Check network requests in browser DevTools
