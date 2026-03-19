# 🚀 Finance SCool — Guía de Deploy

## Arquitectura

```
┌─────────────────────────────┐     ┌────────────────────────────┐
│   Frontend (Netlify)        │────▶│   Backend (Railway)        │
│   React 19 + Vite           │     │   Express + Node.js        │
│   financescool.netlify.app  │     │   financescool.railway.app │
└─────────────────────────────┘     └──────────┬─────────────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  Supabase         │
                                    │  (PostgreSQL)     │
                                    │  jisfqytmoiai...  │
                                    └──────────────────┘
```

> **Nota:** Railway también puede servir el frontend (todo en uno). Pero si quieres separar frontend en Netlify para mejor rendimiento (CDN global), sigue esta guía completa.

---

## Paso 1: Subir a GitHub

Si aún no tienes el repo en GitHub:

```bash
cd financescool
git init
git add .
git commit -m "Finance SCool - ready for deploy"

# Crear repo en GitHub (necesitas gh CLI)
gh repo create finance-scool --private --source=. --push

# O manualmente:
git remote add origin https://github.com/TU-USUARIO/finance-scool.git
git push -u origin main
```

---

## Paso 2: Deploy Backend en Railway

### Opción A: Railway CLI

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init

# Deploy
railway up

# Configurar variables de entorno
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=financescool_jwt_s3cr3t_pr0duction_2026
railway variables set ADMIN_EMAIL=osvaldosuarezcruz@gmail.com
railway variables set ADMIN_PASSWORD=admin123
railway variables set SUPABASE_URL=https://jisfqytmoiaikaohyens.supabase.co
railway variables set SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
railway variables set SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

### Opción B: Dashboard de Railway (más fácil)

1. Ve a [railway.app](https://railway.app) → **"New Project"** → **"Deploy from GitHub Repo"**
2. Selecciona tu repo `finance-scool`
3. Railway detectará el `railway.json` automáticamente
4. En **Variables**, agrega todas las del `.env` más:
   - `NODE_ENV=production`
   - `CLIENT_URL=https://TU-SITIO.netlify.app` (agregar después del paso 3)
5. Genera un dominio público en **Settings → Networking → Generate Domain**
6. **Guarda la URL** (ej: `finance-scool-production.up.railway.app`)

### Verificar que funciona:
```
https://TU-URL-RAILWAY.up.railway.app/api/health
```
Debe responder: `{"status":"ok","service":"finance-scool",...}`

---

## Paso 3: Deploy Frontend en Netlify

### Antes: actualiza `netlify.toml`

Edita `netlify.toml` y reemplaza `YOUR_RAILWAY_URL` con la URL real de Railway:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://finance-scool-production.up.railway.app/api/:splat"
  status = 200
  force = true
```

### Opción A: Netlify CLI

```bash
npm install -g netlify-cli
netlify login

cd client
netlify init
# Selecciona: Create & configure a new site
# Team: tu equipo
# Site name: financescool (o el que quieras)

npm run build
netlify deploy --prod --dir=dist
```

### Opción B: Dashboard de Netlify

1. Ve a [netlify.com](https://netlify.com) → **"Add new site"** → **"Import from Git"**
2. Conecta tu repo y configura:
   - **Base directory**: `client`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `client/dist`
3. Netlify te dará una URL como: `financescool.netlify.app`

---

## Paso 4: Conectar Frontend ↔ Backend

Una vez que tengas la URL de Netlify, agrega la variable `CLIENT_URL` en Railway:

```bash
railway variables set CLIENT_URL=https://financescool.netlify.app
```

O desde el dashboard de Railway → Variables → Add:
- `CLIENT_URL` = `https://financescool.netlify.app`

Esto permite que el backend acepte requests desde el frontend en Netlify.

---

## Paso 5 (Alternativa): Todo-en-uno en Railway

Si prefieres NO usar Netlify y servir todo desde Railway:

1. El servidor ya sirve el frontend en producción (`NODE_ENV=production`)
2. Solo necesitas que el build esté en `client/dist`
3. El `railway.json` ya incluye el build del cliente
4. Accede directamente a la URL de Railway — será tu sitio completo

---

## Paso 6 (Opcional): Dominio personalizado

### En Netlify:
- **Site settings → Domain management → Add custom domain**
- Ej: `financescool.com` o `finance.propulsa.com`

### En Railway:
- **Settings → Networking → Custom Domain**
- Ej: `api.financescool.com`

---

## Variables de entorno (resumen)

| Variable | Valor | Dónde |
|----------|-------|-------|
| `PORT` | `3001` | Railway |
| `NODE_ENV` | `production` | Railway |
| `JWT_SECRET` | `financescool_jwt_s3cr3t_pr0duction_2026` | Railway |
| `ADMIN_EMAIL` | `osvaldosuarezcruz@gmail.com` | Railway |
| `ADMIN_PASSWORD` | `admin123` | Railway |
| `SUPABASE_URL` | `https://jisfqytmoiaikaohyens.supabase.co` | Railway |
| `SUPABASE_ANON_KEY` | `eyJ...brBM` | Railway |
| `SUPABASE_SERVICE_KEY` | `eyJ...JUUE` | Railway |
| `CLIENT_URL` | `https://financescool.netlify.app` | Railway |

⚠️ **Importante**: Cambia `ADMIN_PASSWORD` y `JWT_SECRET` a valores más seguros para producción.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| CORS error | Agrega `CLIENT_URL` con la URL de Netlify en Railway |
| 404 en rutas del frontend | Verifica que `netlify.toml` tenga el redirect `/*` → `/index.html` |
| API no responde | Verifica `/api/health` en la URL de Railway |
| Login no funciona | Verifica `JWT_SECRET` y `ADMIN_EMAIL` en las variables de Railway |
| Supabase error | Verifica `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en Railway |
