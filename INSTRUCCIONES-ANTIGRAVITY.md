# 🚀 Finance SCool — Instrucciones de Deploy (Antigravity)

## Info del Proyecto
- **Nombre**: Finance SCool — PPR y Estrategias Fiscales con IA
- **GitHub**: https://github.com/Arturo0214/finance-scool
- **Stack**: React 19 + Vite (frontend), Express + Node.js (backend), Supabase PostgreSQL (database)
- **Puerto local**: 3001

## Estructura
```
financescool/
├── package.json          ← Root: scripts dev/build/start/setup
├── railway.json          ← Config Railway (auto-detected)
├── netlify.toml          ← Config Netlify (⚠️ actualizar URL Railway!)
├── .env                  ← Variables locales (NO subir a GitHub)
├── .env.example          ← Template de referencia
├── server/
│   ├── index.js          ← Express API puerto 3001, sirve frontend en prod
│   ├── middleware/auth.js ← JWT auth middleware
│   ├── models/database.js ← Supabase connection + schemas
│   ├── routes/
│   │   ├── auth.js       ← Login/register
│   │   ├── leads.js      ← Lead management
│   │   └── api.js        ← General API (team, events, messages)
│   ├── setup-supabase.js ← DB initialization script
│   └── supabase-schema.sql ← Schema SQL para Supabase
└── client/
    ├── package.json      ← React 19 + Vite 8
    ├── vite.config.js    ← Proxy /api → localhost:3001
    ├── index.html
    └── src/
        ├── App.jsx, main.jsx
        ├── pages/Landing.jsx, Login.jsx, AdminPanel.jsx
        ├── components/Logo.jsx
        ├── hooks/useAuth.jsx
        └── utils/api.js
```

## Paso 1: Push a GitHub
```bash
cd "Finance SCool/financescool"   # Ajusta esta ruta según donde tengas la carpeta
./push-to-github.sh
```

## Paso 2: Deploy Backend en Railway
1. Conectar repo `Arturo0214/finance-scool` en Railway
2. Railway detecta `railway.json` automáticamente:
   - Build: `npm install && cd client && npm install && npm run build`
   - Start: `npm start` (en producción Express sirve el frontend)
   - Healthcheck: `/api/health`
3. Agregar variables de entorno:

```
PORT=3001
NODE_ENV=production
JWT_SECRET=financescool_jwt_s3cr3t_pr0duction_2026
ADMIN_EMAIL=osvaldosuarezcruz@gmail.com
ADMIN_PASSWORD=admin123
SUPABASE_URL=https://jisfqytmoiaikaohyens.supabase.co
SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
CLIENT_URL=<URL de Netlify, agregar después del paso 3>
```

4. Generar dominio público: Settings → Networking → Generate Domain
5. Verificar: `GET /api/health` → `{"status":"ok","service":"finance-scool"}`

## Paso 3: Deploy Frontend en Netlify (OPCIONAL)
> Railway ya sirve el frontend en producción. Solo usar Netlify si se quiere CDN separado.

1. **ANTES**: Editar `netlify.toml` → reemplazar `YOUR_RAILWAY_URL` con la URL real de Railway
2. Conectar repo en Netlify:
   - Base directory: `client`
   - Build command: `npm install && npm run build`
   - Publish directory: `client/dist`
3. Agregar `CLIENT_URL=https://tu-sitio.netlify.app` en Railway

## Datos de Conexión
| Servicio | URL |
|----------|-----|
| Supabase | https://jisfqytmoiaikaohyens.supabase.co |
| GitHub | https://github.com/Arturo0214/finance-scool |

## Notas
- El servidor sirve el frontend en producción (todo-en-uno en Railway)
- Endpoint de salud: `GET /api/health`
- CORS ya configurado para aceptar `CLIENT_URL` desde Railway
- Cambiar `ADMIN_PASSWORD` y `JWT_SECRET` para producción real
