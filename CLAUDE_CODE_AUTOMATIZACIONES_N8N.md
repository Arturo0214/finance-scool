# Instrucciones para Claude Code — Automatizaciones n8n (Recordatorios, Re-engagement, Nurture)

## Contexto

El servidor Express de Finance S Cool (server/routes/whatsapp.js) ya tiene 3 nuevos endpoints implementados:

- `POST /api/whatsapp/reminders` — Envía recordatorios de cita (24h, 1h, 10min antes)
- `POST /api/whatsapp/no-show` — Detecta y re-agenda no-shows
- `POST /api/whatsapp/post-cita` — Nurture post-cita (día 1, 3, 7)

Estos endpoints están listos pero necesitan ser **llamados periódicamente**. Hay 2 opciones:

---

## Opción A: Cron jobs en n8n (RECOMENDADA)

Crear 3 workflows pequeños en n8n que llamen a estos endpoints automáticamente.

### Workflow 1: Recordatorios de Cita

```
Trigger: Schedule — cada 15 minutos (0,15,30,45 * * * *)
→ HTTP Request: POST https://financescool.com.mx/api/whatsapp/reminders
   Headers: Authorization: Bearer [JWT_TOKEN_ADMIN]
   Body: { "dryRun": false }
```

### Workflow 2: Detección de No-Shows

```
Trigger: Schedule — cada 30 minutos (0,30 * * * *)
→ HTTP Request: POST https://financescool.com.mx/api/whatsapp/no-show
   Headers: Authorization: Bearer [JWT_TOKEN_ADMIN]
   Body: {}
```

### Workflow 3: Nurture Post-Cita

```
Trigger: Schedule — cada 6 horas (0 0,6,12,18 * * *)
→ HTTP Request: POST https://financescool.com.mx/api/whatsapp/post-cita
   Headers: Authorization: Bearer [JWT_TOKEN_ADMIN]
   Body: {}
```

Para obtener el JWT token, hacer login en la API:
```
POST /api/auth/login
Body: { "email": "admin_email", "password": "admin_password" }
→ Response: { "token": "eyJ..." }
```

---

## Opción B: Cron interno en el servidor Express

Si prefieres no crear workflows separados en n8n, agregar cron jobs directamente en `server/index.js`.

En server/index.js, agregar al inicio:
```javascript
const cron = require('node-cron');
```

Y después de todas las rutas (al final, antes de app.listen), agregar:
```javascript
// Cron: Recordatorios de cita cada 15 min
cron.schedule('*/15 * * * *', async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch('http://localhost:3001/api/whatsapp/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer INTERNAL_CRON' },
      body: JSON.stringify({}),
    });
    console.log('[CRON] Reminders executed');
  } catch (e) { console.error('[CRON] Reminders error:', e.message); }
});

// Cron: No-shows cada 30 min
cron.schedule('*/30 * * * *', async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch('http://localhost:3001/api/whatsapp/no-show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer INTERNAL_CRON' },
      body: JSON.stringify({}),
    });
    console.log('[CRON] No-show check executed');
  } catch (e) { console.error('[CRON] No-show error:', e.message); }
});

// Cron: Post-cita nurture cada 6 horas
cron.schedule('0 */6 * * *', async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch('http://localhost:3001/api/whatsapp/post-cita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer INTERNAL_CRON' },
      body: JSON.stringify({}),
    });
    console.log('[CRON] Post-cita nurture executed');
  } catch (e) { console.error('[CRON] Post-cita error:', e.message); }
});
```

Para esto necesitas agregar una excepción en el middleware verifyToken para tokens internos, o crear un middleware bypass para cron. La forma más simple:

En server/middleware/auth.js, agregar al inicio de verifyToken:
```javascript
// Bypass para cron jobs internos
if (token === 'INTERNAL_CRON' && req.ip === '127.0.0.1') {
  req.user = { id: 0, role: 'system' };
  return next();
}
```

También instalar node-cron:
```bash
npm install node-cron
```

---

## Cambio adicional: Reducir bot de 8 a 5 pasos

En el archivo `n8n_finance_scool_workflow.json`, el system prompt del nodo "Claude API" (id: n6) contiene el flujo de 8 pasos del bot Sofía.

El prompt del system está en el campo `jsonBody` del nodo n6. Es un string con escaping doble.

### Nuevo flujo de 5 pasos (reemplazar en el system prompt):

```
FLUJO (seguir en orden estricto):

PASO 1 — SALUDO + NOMBRE (text)
"¡Hola! Soy Sofía de Finance S Cool.
Ayudamos a profesionistas a pagar menos impuestos legalmente y planear su retiro.
¿Cómo te llamas?"
Guardar en nombre. Si dan emoji o texto sin sentido, preguntar de nuevo.

PASO 2 — INGRESO MENSUAL (button) — FILTRO PRINCIPAL
"Gracias [nombre]. Para ver qué opciones aplican para ti:
¿Tu ingreso mensual aproximado está en cuál de estos rangos?"
Botones: [{"id":"ing_bajo","title":"Hasta $30,000"},{"id":"ing_medio","title":"$30,000 - $70,000"},{"id":"ing_alto","title":"Más de $70,000"}]
Si elige "Hasta $30,000", pregunta si está más cerca de $20k o $30k.
<$20k → cita informativa 15min.
$20k+ → cita completa 30min.

PASO 3 — OBJETIVO (button)
Da recomendación breve según ingreso, luego:
"¿Qué te interesa más?"
Botones: [{"id":"obj_fiscal","title":"Reducir impuestos"},{"id":"obj_retiro","title":"Planear mi retiro"},{"id":"obj_ambos","title":"Ambos"}]

PASO 4 — EMAIL (text)
"¡Perfecto! Para enviarte la invitación a la reunión por Google Meet, ¿me compartes tu correo electrónico?"
Guardar en email. Validar que contenga @ y un dominio.

PASO 5 — AGENDAR CITA (filtro_actual=5)
REGLAS ESTRICTAS DE AGENDA:
- El sistema te da un bloque [HORARIOS_DISPONIBLES] con los slots REALES.
- SOLO ofrece horarios que aparezcan en ese bloque.
- Si el lead gana <$20k/mes → cita de 15 minutos. Si gana $20k+/mes → cita de 30 minutos.
```

### Datos que se recopilan después (en la cita, NO en el bot):
- Declaración de impuestos (sí/no)
- Régimen fiscal
- Edad
- Situación laboral

### Cambios necesarios en la metadata del system prompt:
Cambiar `filtro_actual: 1-8` a `filtro_actual: 1-5`

---

## Cambio en Supabase: Agregar lead_status 'no_show' y 'cita_asistida'

El endpoint de no-show ya usa `lead_status = 'no_show'` y el nurture usa `lead_status = 'cita_asistida'`. Estos valores se guardan como texto libre, no requieren cambios en el schema.

Sin embargo, necesitas actualizar manualmente el status de un lead a 'cita_asistida' después de que asista a la cita. Esto se puede hacer desde el admin panel o agregando un botón en la vista de WhatsApp/Funnel que llame:

```
PATCH /api/whatsapp/leads/:waId/status
Body: { "lead_status": "cita_asistida" }
```

---

## Resumen de lo que ya está implementado vs pendiente

| Componente | Estado | Dónde |
|-----------|--------|-------|
| Recordatorios de cita (24h, 1h, 10min) | ✅ Endpoint creado | server/routes/whatsapp.js |
| Detección de no-shows | ✅ Endpoint creado | server/routes/whatsapp.js |
| Nurture post-cita (día 1, 3, 7) | ✅ Endpoint creado | server/routes/whatsapp.js |
| Re-engagement leads fríos | ✅ Ya existía | POST /api/whatsapp/follow-up |
| Cron jobs para ejecutar automáticamente | ⏳ Pendiente | Opción A (n8n) o B (node-cron) |
| Reducir bot a 5 pasos | ⏳ Pendiente | n8n workflow JSON (system prompt) |
| Tracking de atribución en n8n | ⏳ Pendiente | Ver CLAUDE_CODE_N8N_TRACKING.md |
