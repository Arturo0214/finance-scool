# Quick Start - Finance SCool

Get Finance SCool running in 5 minutes.

## Prerequisites
- Node.js 18+
- Supabase account

## Step 1: Install & Setup (2 minutes)

```bash
npm run setup
```

## Step 2: Create Database Tables (1 minute)

1. Go to https://app.supabase.com
2. Click **SQL Editor**
3. Click **New Query**
4. Copy & paste contents of `server/supabase-schema.sql`
5. Click **Run**

## Step 3: Start Development (2 minutes)

```bash
npm run dev
```

Opens:
- **API**: http://localhost:3001
- **Client**: http://localhost:5173

## Step 4: Login

**Email**: osvaldosuarezcruz@gmail.com
**Password**: admin123

## Done!

You now have:
- ✅ 7 demo leads
- ✅ 4 demo events
- ✅ Sample messages
- ✅ Full API working

## What's Next?

- Create new leads at `/leads`
- Add calendar events at `/calendar`
- Send team messages at `/messages`
- View stats on dashboard `/`
- Add team members at `/settings`

## Troubleshooting

### "Tables not found"
→ You skipped Step 2. Run the SQL in Supabase SQL Editor.

### "Connection refused"
→ Check `.env` has correct Supabase credentials.

### "Port 3001 already in use"
→ Kill process: `lsof -ti:3001 | xargs kill -9`

## Credentials

**Admin Login:**
- Email: osvaldosuarezcruz@gmail.com
- Password: admin123

## Environment

Create `.env` in project root:

```
PORT=3001
JWT_SECRET=financescool_jwt_s3cr3t_pr0duction_2026
ADMIN_EMAIL=osvaldosuarezcruz@gmail.com
ADMIN_PASSWORD=admin123
NODE_ENV=development
SUPABASE_URL=https://jisfqytmoiaikaohyens.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Commands

```bash
npm run dev           # Start everything
npm run server        # Start API only
npm run client        # Start client only
npm run build         # Build for production
npm start             # Run production server
```

## API Examples

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"osvaldosuarezcruz@gmail.com","password":"admin123"}'
```

### Get Leads
```bash
curl http://localhost:3001/api/leads \
  -H "Cookie: token=<your_token>"
```

### Get Stats
```bash
curl http://localhost:3001/api/stats \
  -H "Cookie: token=<your_token>"
```

## File Structure

```
financescool/
├── server/          # Express API
│ ├── models/database.js      # Supabase wrapper
│ ├── routes/         # API endpoints
│ └── index.js        # Server entry
├── client/          # React UI
│ └── src/
├── .env             # Config
└── package.json
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm run setup` |
| "Database error" | Run SQL in Supabase SQL Editor |
| "401 Unauthorized" | Login again, token expired |
| "CORS error" | Check server CORS config |
| "Port in use" | Kill process on port 3001 |

## Next Steps

1. Customize branding/colors
2. Add your actual leads
3. Configure teams
4. Set up automations
5. Deploy to production

See [SETUP.md](./SETUP.md) for full details.
