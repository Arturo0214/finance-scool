# Finance SCool - Setup Guide

Complete setup instructions for the Finance SCool application.

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Git (optional)

## Installation

### 1. Install Dependencies

```bash
# Install all dependencies (server and client)
npm run setup
```

This runs:
```bash
npm install
cd client && npm install
cd ..
```

### 2. Configure Environment Variables

Create/update `.env` file in the project root:

```env
PORT=3001
JWT_SECRET=financescool_jwt_s3cr3t_pr0duction_2026
ADMIN_EMAIL=osvaldosuarezcruz@gmail.com
ADMIN_PASSWORD=admin123
WHATSAPP_NUMBER=5215512345678
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://jisfqytmoiaikaohyens.supabase.co
SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

### 3. Set Up Supabase Database

#### Option A: Using SQL Editor (Recommended)

1. Go to https://app.supabase.com and log in
2. Select your project (jisfqytmoiaikaohyens)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `server/supabase-schema.sql`
6. Paste into the SQL editor
7. Click **Run**

#### Option B: Using CLI (if you prefer)

```bash
# Using psql (if you have PostgreSQL installed)
psql -h db.jisfqytmoiaikaohyens.supabase.co -U postgres -f server/supabase-schema.sql
```

### 4. Verify Setup

```bash
# Start the development server
npm run server

# You should see:
# ✅ Admin user created
# ✅ Demo data seeded
# 🚀 Finance SCool API running at http://localhost:3001
```

### 5. Start Development Environment

```bash
# Terminal 1: Start both server and client
npm run dev

# Or individually:

# Terminal 1: Server
npm run server

# Terminal 2: Client
npm run client
```

The client will start at `http://localhost:5173`

## Credentials

### Default Admin User
- **Email**: osvaldosuarezcruz@gmail.com
- **Password**: admin123

### Demo Leads
Seven demo leads are automatically seeded:
1. María González - PPR Prudential
2. Carlos Ramírez - Estrategia Fiscal
3. Ana López - PPR + Fiscal
4. Roberto Díaz - PPR Prudential
5. Laura Martínez - Educación Financiera
6. Pedro Sánchez - PPR + Fiscal
7. Sofía Hernández - Estrategia Fiscal

## Project Structure

```
financescool/
├── server/
│   ├── models/
│   │   └── database.js           # Supabase database wrapper
│   ├── routes/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── api.js                # Stats, events, messages, users
│   │   └── leads.js              # Lead management endpoints
│   ├── middleware/
│   │   └── auth.js               # JWT verification
│   ├── index.js                  # Express app setup
│   ├── setup-supabase.js         # Database setup script
│   └── supabase-schema.sql       # Database schema
├── client/
│   ├── src/
│   ├── public/
│   └── vite.config.js
├── .env                          # Environment variables
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register user (admin only)

### Leads
- `GET /api/leads` - List leads (paginated)
- `POST /api/leads` - Create lead (public)
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Messages
- `GET /api/messages` - List messages
- `POST /api/messages` - Send message

### Stats
- `GET /api/stats` - Get dashboard statistics
- `GET /api/users` - List all users

## Development Commands

```bash
# Install dependencies
npm run setup

# Start development (server + client)
npm run dev

# Start only server
npm run server

# Start only client
npm run client

# Build client for production
npm run build

# Start server in production
npm start (NODE_ENV=production)
```

## Database

The application uses **Supabase PostgreSQL**.

### Tables
1. **users** - User accounts with authentication
2. **leads** - Sales leads/contacts
3. **events** - Calendar events
4. **messages** - Team chat messages
5. **notes** - Lead notes/comments

### Features
- All tables have proper indexes for performance
- Foreign key relationships enforce data integrity
- Timestamps track creation and updates automatically
- Default values for common fields

## Testing

### Login Test
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"osvaldosuarezcruz@gmail.com","password":"admin123"}'
```

Response will include `token` - use this for authenticated requests.

### Get Leads Test
```bash
curl http://localhost:3001/api/leads \
  -H "Cookie: token=<token_from_login>"
```

## Troubleshooting

### "Tables not found" Error
**Solution**: Run `server/supabase-schema.sql` in Supabase SQL Editor

### "Connection refused" Error
**Solution**:
- Verify Supabase credentials in `.env`
- Check internet connection
- Ensure Supabase project is active

### Auth Token Expired
**Solution**: Login again to get a new token

### CORS Errors
**Solution**: Check `server/index.js` CORS configuration
- Development: `http://localhost:5173`
- Production: Update `isProd` check

## Performance Tips

1. **Indexes**: Schema includes indexes on frequently queried columns
2. **Pagination**: Use `limit` and `page` params for large datasets
3. **Connection Pool**: Supabase manages connection pooling
4. **Rate Limiting**: 200 requests per 15 minutes per endpoint

## Security Considerations

### .env File
- **Never** commit `.env` to version control
- Use `.gitignore` to exclude it
- Keep `SUPABASE_SERVICE_KEY` secret

### Production
- Change `JWT_SECRET` to a strong random value
- Use strong `ADMIN_PASSWORD`
- Set `NODE_ENV=production`
- Enable HTTPS
- Update CORS `origin` configuration

### Supabase
- Use Row Level Security (RLS) in production
- Restrict Service Key access to server only
- Use Anon Key for client-side requests

## Deployment

### Heroku
```bash
git push heroku main
```

### Vercel (Frontend) + Supabase (Backend)
1. Deploy server to Heroku or Railway
2. Deploy client to Vercel
3. Update client API endpoint in build config

### Environment Variables in Production
Set these in your hosting platform:
```
PORT
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
NODE_ENV=production
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

## Next Steps

1. Customize admin credentials in `.env`
2. Add team members: `/api/auth/register`
3. Customize demo leads or add real data
4. Set up team chat channels
5. Configure calendar events
6. Deploy to production

## Support

For issues:
1. Check the troubleshooting section above
2. Review Supabase logs: https://app.supabase.com/project/[id]/logs
3. Check browser console for client errors
4. Review server logs in terminal

## Documentation

- [Supabase Migration Guide](./SUPABASE_MIGRATION.md)
- [API Documentation](./API.md) (if available)
- [Contributing Guide](./CONTRIBUTING.md) (if available)
