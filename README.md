# Finance SCool - PPR y Estrategias Fiscales

## Stack Tecnológico
- **Frontend:** React 19 + Vite + React Router + Lucide Icons
- **Backend:** Express.js + sql.js (SQLite) + JWT Auth + bcrypt
- **Diseño:** Navy/Gold/White premium theme con Inter + Playfair Display

## Instalación Rápida

```bash
# 1. Instalar dependencias del servidor
npm install

# 2. Instalar dependencias del cliente
cd client && npm install && cd ..

# 3. Configurar variables de entorno
cp .env.example .env  # Editar con tus datos

# 4. Desarrollo (servidor + cliente simultáneamente)
npm run dev

# 5. Build para producción
npm run build
NODE_ENV=production npm start
```

## URLs
- **Landing Page:** http://localhost:5173 (dev) / http://localhost:3001 (prod)
- **Admin Panel:** http://localhost:5173/admin (dev)
- **Login:** http://localhost:5173/admin/login

## Credenciales por defecto
- **Email:** osvaldosuarezcruz@gmail.com
- **Password:** admin123

## Estructura del Proyecto
```
financescool/
├── server/                 # Backend API
│   ├── index.js           # Express server
│   ├── models/database.js # SQLite + sql.js
│   ├── middleware/auth.js  # JWT authentication
│   ├── routes/
│   │   ├── auth.js        # Login/Register/Logout
│   │   ├── leads.js       # CRUD leads
│   │   └── api.js         # Stats, Events, Messages, Users
│   └── data/              # SQLite database file
├── client/                 # React Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx    # Landing page completa
│   │   │   ├── Login.jsx      # Pantalla de login
│   │   │   └── AdminPanel.jsx # Panel de administración
│   │   ├── hooks/useAuth.jsx  # Auth context
│   │   ├── utils/api.js       # API client
│   │   └── index.css          # Global styles
│   └── index.html             # SEO meta tags + Schema.org
├── .env                    # Variables de entorno
└── package.json
```

## Funcionalidades

### Landing Page
- Hero con proyección de retiro animada
- Simulador PPR interactivo (calcula capital, devolución fiscal, pensión)
- Secciones: Problemas, Servicios, Cómo Funciona, Testimonios, FAQ
- Formulario de contacto → crea lead automáticamente
- WhatsApp flotante
- SEO optimizado (Schema.org, Open Graph, meta tags)

### Admin Panel
- **Dashboard:** Stats, gráficas, leads recientes
- **Leads:** CRUD completo con filtros, búsqueda, notas
- **Calendario:** Vista mensual con eventos
- **Chat Interno:** Mensajería del equipo
- **WhatsApp:** Templates de mensajes para follow-up
- **HubSpot:** Embed configurcable
- **Workflow AI:** Estructura para agente de Meta Business

### Workflow AI (Meta Business Agent)
Pipeline automatizado:
1. Lead entra por Meta Ads (Facebook/Instagram)
2. Agente IA califica via Messenger/WhatsApp
3. Auto-clasificación: Hot / Warm / Cold
4. Hot → notificación + booking calendario
5. Warm → secuencia nurture educativa
6. Cold → retargeting

## Configuración para Producción
1. Cambiar JWT_SECRET en .env
2. Configurar WHATSAPP_NUMBER real
3. Configurar HubSpot Portal ID
4. Configurar Meta Business API token
5. Servir detrás de nginx con SSL
