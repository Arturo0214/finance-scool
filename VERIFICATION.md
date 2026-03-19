# Migration Verification Checklist

Use this checklist to verify the Supabase migration is complete and working.

## Phase 1: Files Verification

### Core Database Files
- [ ] `/server/models/database.js` - Supabase module (400+ lines)
- [ ] `/server/routes/auth.js` - Async authentication handlers
- [ ] `/server/routes/api.js` - Async API handlers
- [ ] `/server/routes/leads.js` - Async lead handlers
- [ ] `/server/middleware/auth.js` - Updated JWT verification
- [ ] `/.env` - Contains SUPABASE_URL and SUPABASE_SERVICE_KEY

### Setup Files
- [ ] `/server/supabase-schema.sql` - PostgreSQL schema
- [ ] `/server/setup-supabase.js` - Setup script

### Documentation
- [ ] `/QUICK_START.md` - Quick start guide
- [ ] `/SETUP.md` - Complete setup guide
- [ ] `/SUPABASE_MIGRATION.md` - Technical migration guide
- [ ] `/MIGRATION_COMPLETE.md` - Completion report
- [ ] `/CHANGES.md` - Detailed change list
- [ ] `/VERIFICATION.md` - This file

## Phase 2: Database Setup

### Create Tables
- [ ] Copy entire contents of `/server/supabase-schema.sql`
- [ ] Go to https://app.supabase.com/project/jisfqytmoiaikaohyens/sql
- [ ] Click "New Query"
- [ ] Paste the SQL
- [ ] Click "Run"
- [ ] Verify no errors in output

### Verify Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should show:
- [ ] users
- [ ] leads
- [ ] events
- [ ] messages
- [ ] notes

### Verify Indexes
```sql
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
```

Should show indexes on:
- [ ] users_email_idx
- [ ] leads_status_idx
- [ ] leads_created_at_idx
- [ ] leads_assigned_to_idx
- [ ] events_user_id_idx
- [ ] events_lead_id_idx
- [ ] events_start_date_idx
- [ ] messages_sender_id_idx
- [ ] messages_channel_idx
- [ ] messages_created_at_idx
- [ ] notes_lead_id_idx
- [ ] notes_user_id_idx
- [ ] notes_created_at_idx

## Phase 3: Installation & Startup

### Install Dependencies
```bash
npm run setup
```
- [ ] No installation errors
- [ ] server/node_modules created
- [ ] client/node_modules created

### Start Server
```bash
npm run server
```

Expected output:
```
✅ Admin user created
✅ Demo data seeded
🚀 Finance SCool API running at http://localhost:3001
```

Check for:
- [ ] Admin user created successfully
- [ ] Demo data seeded successfully
- [ ] Server listening on port 3001
- [ ] No error messages in console

## Phase 4: Manual API Testing

### Test 1: Health Check
```bash
curl http://localhost:3001/api/stats
```
Should return 401 (unauthorized, as expected)

### Test 2: Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"osvaldosuarezcruz@gmail.com","password":"admin123"}'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Arturo Suárez",
    "email": "osvaldosuarezcruz@gmail.com",
    "role": "superadmin"
  }
}
```

Check:
- [ ] Returns 200 OK
- [ ] Includes token in Set-Cookie header
- [ ] User data is correct

### Test 3: Get Current User
```bash
curl http://localhost:3001/api/auth/me \
  -H "Cookie: token=<TOKEN_FROM_LOGIN>"
```

Expected response:
```json
{
  "user": {
    "id": 1,
    "email": "osvaldosuarezcruz@gmail.com",
    "role": "superadmin"
  }
}
```

Check:
- [ ] Returns 200 OK
- [ ] Returns user object

### Test 4: Get Leads
```bash
curl "http://localhost:3001/api/leads?limit=10" \
  -H "Cookie: token=<TOKEN>"
```

Expected:
```json
{
  "leads": [
    {
      "id": 1,
      "name": "María González",
      "email": "maria@email.com",
      "phone": "5551234567",
      "service": "PPR Prudential",
      "status": "nuevo",
      ...
    }
  ],
  "total": 7,
  "page": 1,
  "totalPages": 1
}
```

Check:
- [ ] Returns 200 OK
- [ ] Returns array of leads
- [ ] 7 demo leads present
- [ ] Pagination info present

### Test 5: Create Lead
```bash
curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "phone": "5551234567",
    "service": "PPR",
    "message": "Test message"
  }'
```

Expected:
```json
{
  "success": true,
  "id": 8
}
```

Check:
- [ ] Returns 200 OK
- [ ] Returns success and new ID
- [ ] No authentication required (public endpoint)

### Test 6: Get Stats
```bash
curl http://localhost:3001/api/stats \
  -H "Cookie: token=<TOKEN>"
```

Expected:
```json
{
  "totalLeads": 8,
  "newLeads": 6,
  "inProgress": 2,
  "converted": 1,
  "leadsBySource": [...],
  "leadsByStatus": [...],
  "recentLeads": [...]
}
```

Check:
- [ ] Returns 200 OK
- [ ] All fields present
- [ ] Counts are correct (8 leads now: 7 demo + 1 test)

### Test 7: Create Event
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<TOKEN>" \
  -d '{
    "title": "Test Event",
    "description": "Test description",
    "start_date": "'$(date -Iseconds)'",
    "color": "#FF0000"
  }'
```

Check:
- [ ] Returns 200 OK
- [ ] Event is created
- [ ] Has ID and timestamps

### Test 8: Get Messages
```bash
curl "http://localhost:3001/api/messages?channel=general" \
  -H "Cookie: token=<TOKEN>"
```

Expected:
```json
[
  {
    "id": 1,
    "sender_id": 1,
    "sender_name": "Arturo Suárez",
    "content": "¡Bienvenidos al chat del equipo Finance SCool!",
    "channel": "general",
    ...
  },
  {
    "id": 2,
    "sender_id": 1,
    "sender_name": "Arturo Suárez",
    "content": "Recordatorio: webinar de educación financiera este jueves",
    "channel": "general",
    ...
  }
]
```

Check:
- [ ] Returns 200 OK
- [ ] Returns 2 demo messages
- [ ] Includes sender names from JOIN

### Test 9: Post Message
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<TOKEN>" \
  -d '{
    "content": "Test message",
    "channel": "general"
  }'
```

Check:
- [ ] Returns 200 OK
- [ ] Message created with sender_name

### Test 10: Get Users
```bash
curl http://localhost:3001/api/users \
  -H "Cookie: token=<TOKEN>"
```

Expected:
```json
[
  {
    "id": 1,
    "name": "Arturo Suárez",
    "email": "osvaldosuarezcruz@gmail.com",
    "role": "superadmin",
    "created_at": "..."
  }
]
```

Check:
- [ ] Returns 200 OK
- [ ] Admin user present

## Phase 5: Error Handling Tests

### Test 1: Invalid Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bad@example.com","password":"wrong"}'
```

Should return: 401 Credenciales incorrectas
- [ ] Returns 401
- [ ] Error message correct

### Test 2: Missing Authentication
```bash
curl http://localhost:3001/api/stats
```

Should return: 401 No autorizado
- [ ] Returns 401
- [ ] Error message correct

### Test 3: Invalid Token
```bash
curl http://localhost:3001/api/stats \
  -H "Cookie: token=invalid_token"
```

Should return: 401 Token inválido
- [ ] Returns 401
- [ ] Error message correct

### Test 4: Empty Message
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<TOKEN>" \
  -d '{"content":""}'
```

Should return: 400 Mensaje vacío
- [ ] Returns 400
- [ ] Error message correct

## Phase 6: Data Integrity Tests

### Test 1: Lead Count
```sql
SELECT COUNT(*) FROM leads;
```
Should be: 8 (7 demo + 1 test)
- [ ] Count is correct

### Test 2: Event Count
```sql
SELECT COUNT(*) FROM events;
```
Should be: 5 (4 demo + 1 test)
- [ ] Count is correct

### Test 3: Message Count
```sql
SELECT COUNT(*) FROM messages;
```
Should be: 3 (2 demo + 1 test)
- [ ] Count is correct

### Test 4: User Count
```sql
SELECT COUNT(*) FROM users;
```
Should be: 1 (1 admin)
- [ ] Count is correct

### Test 5: Foreign Keys
Verify no orphaned records:
```sql
-- Check leads with invalid assigned_to
SELECT * FROM leads WHERE assigned_to IS NOT NULL 
AND assigned_to NOT IN (SELECT id FROM users);
```
Should return: 0 rows
- [ ] No orphaned records

## Phase 7: Client Testing

### Start Client
```bash
npm run client
```

Expected:
- [ ] Client starts at http://localhost:5173
- [ ] No console errors

### Test Login
1. Go to http://localhost:5173
2. Enter email: osvaldosuarezcruz@gmail.com
3. Enter password: admin123
4. Click login

Check:
- [ ] Login succeeds
- [ ] Redirected to dashboard
- [ ] No errors in browser console

### Test Dashboard
1. View dashboard at /
2. Check stats load

Check:
- [ ] Stats display: total leads, new leads, converted, etc
- [ ] No API errors in browser console
- [ ] Numbers match API response

### Test Leads Page
1. Go to /leads
2. Verify 7 demo leads load

Check:
- [ ] All 7 leads displayed
- [ ] Can search by name
- [ ] Can filter by status
- [ ] Pagination works

### Test Lead Detail
1. Click on a lead
2. View lead details

Check:
- [ ] Lead details displayed
- [ ] Notes section present
- [ ] Can add note

### Test Events Page
1. Go to /calendar
2. View events

Check:
- [ ] 4 demo events displayed
- [ ] Calendar loads without errors
- [ ] Can create event

### Test Messages Page
1. Go to /messages
2. View chat

Check:
- [ ] 2 demo messages displayed
- [ ] Can send message
- [ ] New message appears

## Phase 8: Performance Tests

### Test 1: Response Time
Test endpoint response times:

```bash
time curl http://localhost:3001/api/leads -H "Cookie: token=<TOKEN>"
```

Expected: < 200ms
- [ ] First request < 2 seconds (may include cold start)
- [ ] Subsequent requests < 200ms

### Test 2: Multiple Concurrent Requests
```bash
for i in {1..10}; do
  curl http://localhost:3001/api/leads -H "Cookie: token=<TOKEN>" &
done
wait
```

Check:
- [ ] All requests complete
- [ ] No connection errors
- [ ] No timeout errors

### Test 3: Large Dataset
```bash
# Create multiple leads
for i in {1..50}; do
  curl -X POST http://localhost:3001/api/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"Lead '$i'","phone":"555123456"}'
done
```

Then test pagination:
```bash
curl "http://localhost:3001/api/leads?page=1&limit=20" -H "Cookie: token=<TOKEN>"
curl "http://localhost:3001/api/leads?page=2&limit=20" -H "Cookie: token=<TOKEN>"
curl "http://localhost:3001/api/leads?page=3&limit=20" -H "Cookie: token=<TOKEN>"
```

Check:
- [ ] All pages load correctly
- [ ] Pagination counts correct
- [ ] Response times acceptable

## Phase 9: Final Checklist

### Code Quality
- [ ] No console errors on startup
- [ ] All async/await properly handled
- [ ] Error handling in all routes
- [ ] No SQL injection vulnerabilities
- [ ] Environment variables properly loaded

### Database
- [ ] All 5 tables created
- [ ] All indexes created
- [ ] Admin user created
- [ ] Demo data seeded
- [ ] Foreign keys working

### API
- [ ] All 17 endpoints working
- [ ] 100% backward compatible
- [ ] Error responses correct
- [ ] Authentication working
- [ ] CORS configured

### Documentation
- [ ] QUICK_START.md complete
- [ ] SETUP.md complete
- [ ] SUPABASE_MIGRATION.md complete
- [ ] MIGRATION_COMPLETE.md complete
- [ ] CHANGES.md complete

### Performance
- [ ] Response times < 500ms
- [ ] Concurrent requests handled
- [ ] Pagination working
- [ ] No connection pools exceeded

## Summary

- Total tests: 30+
- Phases: 9
- Critical tests: 10
- Must pass: All checkmarks

**Status**: Ready for production once all checklist items are verified ✅

---

**Last Updated**: March 17, 2026
**Migration Version**: 1.0.0
**Status**: READY FOR VERIFICATION
