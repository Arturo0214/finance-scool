# Instrucciones para Claude Code — Implementar tracking de atribución en n8n workflow

## Contexto del proyecto

Finance S Cool es un negocio de asesoría fiscal (PPR, deducciones) que usa:
- **Facebook Ads** (Click-to-WhatsApp) para generar leads
- **n8n** (workflow en Railway) como agente de WhatsApp (bot "Sofía")
- **Supabase** como base de datos de conversaciones
- **HubSpot** como CRM
- **Google Calendar** para agendar citas

El workflow está en: `n8n_finance_scool_workflow.json` (raíz del repo)

## Problema a resolver

Hoy el 99.8% de los contactos en HubSpot aparecen como fuente "OFFLINE" porque el workflow no captura de dónde viene cada lead. Necesitamos:

1. Parsear el campo `referral` que Meta envía en webhooks de Click-to-WhatsApp ads
2. Parsear tags `[src:...]` que vienen del landing page (tracking.js)
3. Guardar la fuente en Supabase (`lead_source`, `ad_id`, `ad_campaign`)
4. Pasar la fuente a HubSpot al crear contactos/deals

---

## Archivo a modificar

`n8n_finance_scool_workflow.json`

Este es un JSON exportado de n8n. Contiene nodos con código JavaScript en campos `jsCode`. Los cambios son SOLO en los campos `jsCode` de nodos específicos. No modifiques la estructura de nodos, conexiones ni posiciones.

---

## Cambio 1 — Nodo "Parse WA Data" (id: "n3")

### Ubicación
Nodo con `"id": "n3"` y `"name": "Parse WA Data"`. El campo a modificar es `parameters.jsCode`.

### Qué agregar

Después de la línea donde se extrae `const entry = body.entry[0].changes[0].value;` y `const msg = entry.messages[0];`, agregar la detección de referral de ads y source tags.

### Código actual (fragmento relevante del jsCode de n3)

```javascript
const body = $input.first().json.body;
const entry = body.entry[0].changes[0].value;
const msg = entry.messages[0];
const contact = entry.contacts ? entry.contacts[0] : null;
```

### Código nuevo (reemplazar ese fragmento con)

```javascript
const body = $input.first().json.body;
const entry = body.entry[0].changes[0].value;
const msg = entry.messages[0];
const contact = entry.contacts ? entry.contacts[0] : null;

// ===== TRACKING DE ATRIBUCIÓN =====
// 1) Detectar si viene de un anuncio Click-to-WhatsApp (Meta Referral)
let leadSource = 'whatsapp_directo';
let adId = null;
let adHeadline = null;
let adCampaign = null;
let adSourceType = null;

// Meta envía referral en el mensaje o a nivel entry
const referral = msg.referral || entry.referral || null;
if (referral) {
  adSourceType = referral.source_type || null;    // "ad"
  adId = referral.source_id || null;               // ID del anuncio
  adHeadline = referral.headline || null;           // Título del anuncio
  const sourceUrl = referral.source_url || '';
  leadSource = 'meta_ads';

  // Intentar extraer campaign name del body del referral
  if (referral.body) {
    adCampaign = referral.body;
  }
}
```

Luego, en la sección donde se construye el `message` del texto, DESPUÉS de la línea `message = msg.text.body;`, agregar:

```javascript
// 2) Detectar source tag del landing page [src:...|cmp:...|med:...]
const srcTagMatch = message.match(/\[src:([^\]]+)\]/);
if (srcTagMatch) {
  const parts = srcTagMatch[1].split('|');
  const srcObj = {};
  parts.forEach(p => {
    const [k, v] = p.split(':');
    if (k && v) srcObj[k.trim()] = v.trim();
  });
  if (srcObj.src) leadSource = srcObj.src;
  if (srcObj.cmp) adCampaign = srcObj.cmp;

  // Limpiar el tag del mensaje visible para que Sofía no lo vea
  message = message.replace(/\s*\[src:[^\]]+\]\s*/, ' ').trim();
}
```

Finalmente, en el `return` al final del jsCode de n3, agregar estos campos al objeto json:

```javascript
leadSource,
adId,
adHeadline,
adCampaign,
adSourceType,
```

El return completo debe quedar así (agrega los 5 campos nuevos):

```javascript
return [{
  json: {
    phone: msg.from,
    message: message,
    tipo_respuesta: tipo_respuesta,
    sender_name: contact ? contact.profile.name : "Desconocido",
    message_id: msg.id,
    timestamp: msg.timestamp,
    isMedia,
    mediaId,
    mediaMime,
    mediaFilename,
    message_type: msg.type,
    // NUEVOS — Tracking de atribución
    leadSource,
    adId,
    adHeadline,
    adCampaign,
    adSourceType,
  }
}];
```

---

## Cambio 2 — Nodo "Build Context" (id: "n5")

### Ubicación
Nodo con `"id": "n5"` y `"name": "Build Context"`. Campo `parameters.jsCode`.

### Qué agregar

En este nodo se accede a los datos de "Parse WA Data" (a través de "Download Media" que es un passthrough). Necesitamos pasar los campos de tracking al contexto.

Buscar la línea:
```javascript
const message = $('Download Media').first().json.message;
```

Cerca de ahí, agregar:
```javascript
const leadSource = $('Download Media').first().json.leadSource || 'whatsapp_directo';
const adId = $('Download Media').first().json.adId || null;
const adCampaign = $('Download Media').first().json.adCampaign || null;
const adHeadline = $('Download Media').first().json.adHeadline || null;
```

En el `return` final de este nodo, agregar estos campos al objeto json:
```javascript
leadSource,
adId,
adCampaign,
adHeadline,
```

---

## Cambio 3 — Nodo "Upsert Lead State" (id: "n8")

### Ubicación
Nodo con `"id": "n8"` y `"name": "Upsert Lead State"`. Campo `parameters.jsonBody`.

### Qué agregar

El jsonBody es un template string que construye el body para Supabase. Agregar 3 campos nuevos a la tabla `fsc_conversations`:

Buscar en el jsonBody la línea:
```
consultor_asignado: $json.consultor_asignado || null
```

Después de esa línea (pero antes del cierre `})`), agregar:
```
lead_source: $json.leadSource || 'whatsapp_directo',
ad_id: $json.adId || null,
ad_campaign: $json.adCampaign || null
```

**IMPORTANTE:** Esto requiere que las columnas `lead_source`, `ad_id` y `ad_campaign` existan en la tabla `fsc_conversations` de Supabase. Ver Cambio 6.

---

## Cambio 4 — Nodo "HubSpot Search Contact" → "HubSpot Create Contact" flow

### Ubicación
El nodo `"id": "n18"` busca el contacto en HubSpot. Si no existe, crea uno nuevo. Si existe, usa el ID para crear el deal.

Hay que modificar el nodo que CREA el contacto en HubSpot (si existe) o agregar uno nuevo. Buscar si hay un nodo de tipo `httpRequest` con URL que contenga `crm/v3/objects/contacts` y método POST (que no sea search).

Si NO existe un nodo de creación de contacto (solo busca), la creación se hace en el nodo posterior. En ese caso, al nodo que crea o actualiza, agregar estas propiedades al body:

```javascript
hs_analytics_source: 'PAID_SOCIAL',
hs_analytics_source_data_1: $('Build Context').first().json.adCampaign || 'whatsapp',
hs_analytics_source_data_2: $('Build Context').first().json.adId || '',
```

### Para el nodo "HubSpot Create Deal" (id: "n19")

En el jsonBody del deal, en el campo `description`, agregar al final de la string de descripción:

```
'\\nFuente: ' + ($('Build Context').first().json.leadSource || 'N/A') +
'\\nCampaña: ' + ($('Build Context').first().json.adCampaign || 'N/A') +
'\\nAnuncio: ' + ($('Build Context').first().json.adHeadline || 'N/A')
```

---

## Cambio 5 — Nodo "Notificar Arturo" (id: "n11"), "Notificar Ingrid" (id: "n16"), "Notificar Hugo" (id: "n17")

### Qué agregar

En los 3 nodos de notificación, agregar al texto del mensaje de WhatsApp:

```
'\\n📣 Fuente: ' + ($json.leadSource || 'N/A') +
'\\n🎯 Campaña: ' + ($json.adCampaign || 'N/A')
```

Agregar después de la línea `'• Prioridad: '...` y antes del cierre `} })`.

Esto le permite a Arturo, Ingrid y Hugo saber de qué campaña viene cada lead cuando les llega la notificación de cita agendada.

---

## Cambio 6 — SQL para Supabase (ejecutar manualmente)

Estas columnas deben agregarse a la tabla `fsc_conversations` en Supabase:

```sql
ALTER TABLE fsc_conversations
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'whatsapp_directo',
ADD COLUMN IF NOT EXISTS ad_id TEXT,
ADD COLUMN IF NOT EXISTS ad_campaign TEXT,
ADD COLUMN IF NOT EXISTS ad_headline TEXT;

-- Índice para filtrar por fuente en queries/dashboard
CREATE INDEX IF NOT EXISTS idx_fsc_lead_source ON fsc_conversations(lead_source);
```

**Cómo ejecutar:** Ve a https://supabase.com/dashboard → tu proyecto (jisfqytmoiaikaohyens) → SQL Editor → pega y ejecuta.

---

## Cambio 7 (OPCIONAL) — Conversions API (CAPI) para cerrar el loop con Meta

Después del nodo "IF Cita Agendada" → rama TRUE, agregar un nuevo nodo HTTP Request para enviar el evento de conversión a Meta:

### Nuevo nodo: "Meta CAPI — Schedule Event"

```
Tipo: httpRequest
Método: POST
URL: https://graph.facebook.com/v19.0/TU_PIXEL_ID/events
Headers:
  Content-Type: application/json

Body (JSON):
{
  "data": [{
    "event_name": "Schedule",
    "event_time": {{ Math.floor(Date.now() / 1000) }},
    "action_source": "system_generated",
    "user_data": {
      "ph": ["{{ require('crypto').createHash('sha256').update($json.phone).digest('hex') }}"],
      "em": ["{{ $json.email_lead ? require('crypto').createHash('sha256').update($json.email_lead.toLowerCase().trim()).digest('hex') : '' }}"]
    },
    "custom_data": {
      "value": 0,
      "currency": "MXN",
      "content_name": "Asesoria Fiscal FSC",
      "lead_source": "{{ $json.leadSource || 'whatsapp' }}"
    }
  }],
  "access_token": "TU_META_ACCESS_TOKEN"
}
```

**NOTA:** Para obtener el access_token de CAPI, ve a Meta Events Manager → Settings → Generate Access Token. Es diferente al token de WhatsApp Business API.

**NOTA 2:** Reemplaza `TU_PIXEL_ID` con el Pixel ID real de Finance SCool.

Este nodo es OPCIONAL pero muy recomendado — le dice a Meta "este lead agendó una cita", lo que permite que Meta optimice las campañas para encontrar más personas que agenden, no solo personas que envíen un mensaje.

---

## Resumen de cambios

| # | Nodo | Tipo de cambio | Impacto |
|---|------|---------------|---------|
| 1 | Parse WA Data (n3) | Parsear referral + src tags | Capturar fuente de cada lead |
| 2 | Build Context (n5) | Pasar campos de tracking | Hacer disponible la fuente downstream |
| 3 | Upsert Lead State (n8) | Guardar lead_source en Supabase | Persistir atribución |
| 4 | HubSpot Create Deal (n19) | Agregar fuente a descripción del deal | Tracking en CRM |
| 5 | Notificar x3 (n11,n16,n17) | Mostrar fuente en notificación | Visibilidad del equipo |
| 6 | Supabase SQL | Agregar columnas | Estructura de datos |
| 7 | Nuevo nodo CAPI (opcional) | Evento Schedule a Meta | Optimización de campaña |

## Validación

Después de aplicar los cambios:

1. Verifica que el JSON sigue siendo válido: `node -e "JSON.parse(require('fs').readFileSync('n8n_finance_scool_workflow.json', 'utf8'))"`
2. Importa el workflow actualizado en n8n (Railway) y actívalo
3. Envía un mensaje de prueba desde un número no-admin al WhatsApp de FSC
4. Verifica en Supabase que el campo `lead_source` se pobló
5. Si fue desde un anuncio Click-to-WhatsApp, verifica que `ad_id` tenga valor

## Notas importantes

- NO modifiques la estructura de nodos, conexiones, posiciones ni IDs
- Los cambios son SOLO en campos `jsCode` y `jsonBody` dentro de `parameters`
- El formato del JSON de n8n usa escaping doble en strings dentro de jsonBody (ej: `\\n` para salto de línea)
- Los API keys ya existentes en el workflow NO deben modificarse
- Mantener compatibilidad con el flujo actual — si `referral` es null, el sistema sigue funcionando igual que antes (leadSource = 'whatsapp_directo')
