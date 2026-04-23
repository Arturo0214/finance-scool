# Finance S Cool — Auditoría Completa y Plan de Acción

**Fecha:** 22 de abril de 2026
**Preparado para:** Arturo Suárez
**Alcance:** Facebook Ads · Agente WhatsApp (Sofía/n8n) · HubSpot CRM · Flujo de citas

---

## Resumen Ejecutivo

| Métrica | Valor actual | Problema |
|---------|-------------|----------|
| Gasto FB Ads (30 días) | $3,438 USD | — |
| Conversaciones iniciadas | 608 | $5.65 USD c/u |
| Contactos en HubSpot | 1,002 (10 semanas) | 99.8% estancados en "lead" |
| Leads con status asignado | 110 (11%) | 892 nunca fueron trabajados |
| Deals creados | **1** | Conversión del 0.1% |
| Fuente principal | OFFLINE 99.8% | Solo 2 contactos rastreados como PAID_SOCIAL |

**Diagnóstico en una frase:** Generas volumen pero tu embudo pierde al 99.9% de los leads entre la conversación de WhatsApp y la cita agendada. El problema no es la generación — es la calificación, el seguimiento y la retención.

---

## Parte 1 — Facebook Ads (Meta)

### 1.1 Estado actual

- 2 campañas activas, objetivo: "Conversaciones con mensajes iniciadas"
- CPR (costo por resultado): $5.65 USD
- Período analizado: 23 mar – 21 abr 2026
- No hay filtro de ingreso pre-conversación
- Segmentación aparentemente amplia (atrae leads de cualquier nivel de ingreso)

### 1.2 Problemas detectados

**P1: Optimización para volumen, no calidad.**
El objetivo de campaña "mensajes" le dice a Meta: "tráeme a quien sea más probable que envíe un mensaje". Eso no necesariamente es alguien que gane +$35K/mes. Resultado: muchos mensajes de curiosos que abandonan el bot.

**P2: Sin pre-calificación en el anuncio.**
El anuncio no menciona rangos de ingreso ni indicadores que filtren a tu audiencia ideal. Cualquiera se siente invitado a escribir.

**P3: Atribución rota.**
99.8% de tus contactos en HubSpot aparecen como fuente "OFFLINE" en vez de "PAID_SOCIAL". Esto significa que la integración entre FB Ads → WhatsApp → HubSpot no está pasando los parámetros UTM. No puedes medir qué campaña o anuncio genera los mejores leads.

**P4: FUGA GEOGRÁFICA — Llegan leads de Puebla, Oaxaca y otros estados.**
Aunque la campaña está configurada para CDMX, llegan leads de otros estados. Esto se debe a que Meta por defecto usa la opción **"Personas que viven en esta ubicación O ESTUVIERON AQUÍ RECIENTEMENTE"**, lo cual incluye a cualquiera cuyo celular se conectó a una antena en CDMX, viajeros, personas en tránsito, etc. También puede deberse a un radio de segmentación demasiado amplio que se extiende más allá de los límites de la ciudad.

### 1.3 Acciones correctivas

#### Acción 1.3.0 — CORREGIR FUGA GEOGRÁFICA (urgente, inmediato)

Este es el cambio más urgente porque estás pagando por leads que nunca podrán asistir a una cita presencial o que no están en tu mercado.

**Paso a paso en Ads Manager:**

1. Ve a **Ads Manager → Conjuntos de anuncios** (tab "Conjuntos de anuncios")
2. Haz clic en el nombre de cada conjunto de anuncios para editarlo
3. En la sección **"Público"** → **"Ubicaciones"**, haz clic en **Editar**
4. Donde dice el tipo de ubicación, verás un dropdown que por defecto dice:
   - ❌ **"Personas que viven en esta ubicación o que estuvieron aquí recientemente"**
5. Cámbialo a:
   - ✅ **"Personas que VIVEN en esta ubicación"**
6. Esto filtra a viajeros, personas en tránsito, y gente de otros estados que simplemente pasó por CDMX

**Ajustes adicionales de ubicación:**

- **Eliminar radio amplio.** Si tienes "Ciudad de México + 40 km" o similar, reduce a "Ciudad de México" como zona metropolitana sin radio extendido, o usa las delegaciones/alcaldías específicas donde está tu target:
  - Benito Juárez, Miguel Hidalgo, Coyoacán, Cuauhtémoc, Álvaro Obregón, Tlalpan
  - Zona metropolitana: Huixquilucan, Naucalpan, Tlalnepantla (si aplica)
  - **Excluir explícitamente:** Puebla, Oaxaca, Estado de México zonas rurales

- **Agregar exclusiones.** En la misma sección de ubicaciones, puedes agregar zonas a EXCLUIR. Agrega:
  - Puebla (estado)
  - Oaxaca (estado)
  - Cualquier otro estado del que estés recibiendo leads no deseados

**Filtro adicional en el bot (respaldo):**
También puedes agregar una validación en el bot de WhatsApp. En el paso de saludo, agregar: "¿Vives en la Ciudad de México o zona metropolitana?" Si dice que no, redirigir amablemente: "Por el momento nuestras asesorías son para la zona CDMX. Te avisamos cuando abramos en tu ciudad."

**Impacto esperado:** Al eliminar leads de otros estados, tu CPR puede subir temporalmente (menos volumen), pero tu costo por lead CALIFICADO bajará significativamente porque dejas de pagar por gente que nunca iba a convertir.

#### Acción 1.3.1 — Copy que filtre (inmediato, 0 costo)

Cambiar el texto del anuncio para incluir calificadores naturales:

**Antes (genérico):**
> "¿Quieres pagar menos impuestos? Escríbenos y te asesoramos gratis."

**Después (con filtro):**
> "Si ganas más de $35,000 al mes y no estás aprovechando tus deducciones fiscales, podrías estar perdiendo hasta $60,000 al año.
>
> Agenda una asesoría gratuita de 30 minutos con nuestro equipo y descubre cuánto puedes recuperar legalmente."

Esto automáticamente ahuyenta a quienes ganan menos de $35K y atrae a tu target.

#### Acción 1.3.2 — Segmentación de audiencia (inmediato)

Configurar en el Ad Set:

- **Edad:** 28–55 años
- **Intereses:** Inversiones, SAT, declaración anual, ahorro para el retiro, planificación financiera, finanzas personales, PPR
- **Comportamiento:** Compradores frecuentes, viajeros frecuentes (proxy de ingreso alto)
- **Ubicación:** Zonas metropolitanas (CDMX, Monterrey, Guadalajara, Querétaro, Puebla)
- **Excluir:** Estudiantes, desempleados

#### Acción 1.3.3 — Probar objetivo "Leads" con formulario nativo (semana 2)

Crear una campaña paralela con objetivo "Generación de clientes potenciales" usando un formulario de Meta que pregunte:

1. Nombre
2. ¿Cuál es tu ingreso mensual aproximado? (opciones: Menos de $30K / $30K-$70K / Más de $70K)
3. WhatsApp

Solo enviar al bot de WhatsApp a quienes seleccionen $30K+ o $70K+. Esto filtra ANTES de gastar en conversación.

#### Acción 1.3.4 — Arreglar atribución (semana 1)

En el workflow de n8n, al crear el contacto en HubSpot, agregar una propiedad personalizada `utm_source=facebook_ads` y `utm_campaign=[nombre_campaña]`. Esto requiere pasar el ad_id o campaign_id desde el click original a través del webhook de WhatsApp. Opciones:

- Usar parámetros de referencia en el link de WhatsApp del anuncio: `https://wa.me/5215583352096?text=Hola%20vi%20su%20anuncio%20[CAMPAIGN_ID]`
- Parsear el mensaje inicial del lead para detectar si viene de un anuncio (Meta agrega metadata al webhook de Click-to-WhatsApp)

#### Acción 1.3.5 — Creativos A/B (semana 2-3)

Probar al menos 3 variaciones:

| Variante | Enfoque | Gancho |
|----------|---------|--------|
| A | Dolor fiscal | "¿Pagaste de más al SAT este año? Así recuperas hasta $60K legalmente" |
| B | Aspiracional/retiro | "Tu yo de 60 años te va a agradecer. PPR: el secreto fiscal que pocos conocen" |
| C | Social proof | "Ya ayudamos a +200 profesionistas a optimizar sus impuestos. ¿Eres el siguiente?" |

---

## Parte 2 — Agente WhatsApp (Sofía / n8n)

### 2.1 Estado actual del flujo

El bot tiene **8 pasos** antes de llegar a la cita:

```
PASO 1 → Saludo (button)
PASO 1.5 → Nombre (text)
PASO 2 → ¿Declara impuestos? (button)
PASO 3 → Régimen fiscal (list - 6 opciones)
PASO 4 → Edad (text)
PASO 5 → Ingreso mensual (button)
PASO 6 → Situación laboral (button)
PASO 7 → Objetivo (button)
PASO 7.5 → Email (text)
PASO 8 → Agendar cita
```

### 2.2 Problemas detectados

**P1: Flujo demasiado largo — 82% de abandono.**
De 608 conversaciones, solo ~110 tienen un lead status. Cada paso adicional pierde ~20-30% de los leads. Con 8+ pasos, es matemáticamente imposible retener más del 15-20%.

**P2: El filtro de ingreso llega en el paso 5.**
Para cuando sabes si alguien gana +$35K, ya invertiste 5 interacciones. Si no califica, perdiste tiempo y dinero.

**P3: Preguntas redundantes.**
Régimen fiscal (paso 3) y situación laboral (paso 6) son prácticamente lo mismo para el lead promedio. Edad (paso 4) no aporta a la calificación si ya sabes el ingreso.

**P4: Sin re-engagement.**
Cuando un lead deja de responder (lo cual pasa en el 82% de los casos), no hay ningún follow-up automático.

**P5: El modelo Claude Haiku puede ser insuficiente.**
Con max_tokens de 800, el bot tiene poco espacio para generar respuestas personalizadas con metadata. Considerar subir a 1024 o usar Sonnet para leads que ya mostraron interés alto.

### 2.3 Nuevo flujo propuesto (5 pasos)

```
PASO 1 → Saludo + Nombre
  "¡Hola! Soy Sofía de Finance S Cool.
   Ayudamos a profesionistas a pagar menos impuestos legalmente.
   ¿Cómo te llamas?"

PASO 2 → Ingreso (FILTRO PRINCIPAL)
  "Gracias [nombre]. Para ver qué opciones aplican para ti:
   ¿Tu ingreso mensual está en cuál de estos rangos?"
  Botones: [Hasta $30K] [$30K-$70K] [Más de $70K]

  → Si <$20K: Cita informativa 15 min, saltar a paso 4
  → Si $20K-$30K: Cita 30 min
  → Si $30K+: Cita 30 min (alta prioridad)

PASO 3 → Interés/Objetivo
  "¿Qué te interesa más?"
  Botones: [Reducir impuestos] [Planear mi retiro] [Ambos]

PASO 4 → Email + Agendar
  "¡Perfecto! Para enviarte la invitación por Google Meet,
   ¿me compartes tu correo electrónico?"
  (Después de recibir email, ofrecer horarios disponibles)

PASO 5 → Confirmación
  "¡Listo! Tu asesoría queda confirmada:
   📅 [fecha] a las [hora]
   📧 Te llegará la invitación a [email]
   📹 Link: [meet_link]
   ¡Nos vemos!"
```

**Datos extra (régimen, edad, etc.)** se recopilan durante la asesoría real, no en el bot.

### 2.4 Re-engagement automático (nuevo nodo en n8n)

Implementar un cron job o scheduled trigger en n8n que:

1. Cada 2 horas revise en Supabase leads con `lead_status = 'en_calificacion'` y `updated_at < NOW() - INTERVAL '2 hours'`
2. Envíe un mensaje por WhatsApp:

**Mensaje 1 (2 horas después del abandono):**
> "Hola [nombre], se nos quedó pendiente lo de tu asesoría fiscal. Son solo 2 preguntas más y te agendamos. ¿Seguimos?"
> Botones: [Sí, continuemos] [Agendar directo]

**Mensaje 2 (24 horas después, si no responde al primero):**
> "Hola [nombre], los horarios de esta semana se están llenando. ¿Te reservo uno para tu asesoría gratuita?"
> Botones: [Sí, agendar] [La próxima semana]

**Mensaje 3 (72 horas, último intento):**
> "Hola [nombre], solo quería confirmarte que tu lugar para la asesoría fiscal sigue disponible. Si cambias de opinión, solo escríbenos. ¡Éxito!"

Después del mensaje 3, marcar como `lead_status = 'frío'` y no contactar más por bot.

**Estimación de recuperación:** 10-15% de abandonos regresan con esta secuencia = **50-80 leads más por mes** con cero gasto adicional en ads.

---

## Parte 3 — Asistencia a Primera Cita

### 3.1 Estado actual

El workflow crea un evento en Google Calendar y notifica a Arturo, Ingrid y Hugo por WhatsApp. Pero **no envía ningún recordatorio al lead**. El lead recibe la confirmación de cita y luego silencio hasta el momento de la reunión.

### 3.2 Secuencia de recordatorios (implementar en n8n)

#### Recordatorio 1 — 24 horas antes

```
📋 Recordatorio de tu asesoría fiscal

Hola [nombre], mañana es tu asesoría con Finance S Cool:

📅 [fecha]
🕐 [hora]
📹 [meet_link]

¿Nos confirmas que asistirás?
```
Botones: [Sí, ahí estaré] [Necesito reprogramar]

Si selecciona "Necesito reprogramar" → mostrar horarios disponibles y reagendar automáticamente.

#### Recordatorio 2 — 1 hora antes

```
⏰ En 1 hora es tu asesoría fiscal

Hola [nombre], en una hora nos conectamos:
📹 [meet_link]

Tip: ten a la mano tu último recibo de nómina o tu constancia de situación fiscal.
¡Te esperamos!
```

#### Recordatorio 3 — 10 minutos antes

```
🟢 ¡Ya estamos listos!

Tu asesora Ingrid ya está conectada.
Entra aquí: [meet_link]
```

### 3.3 Manejo de no-shows

Si el lead no se conecta dentro de los primeros 10 minutos de la cita:

**Mensaje inmediato:**
> "Hola [nombre], no pudimos conectarnos hoy. No te preocupes, te puedo reagendar para mañana o esta semana. ¿Qué horario te funciona?"
> Botones: [Mañana a la misma hora] [Ver otros horarios]

**Mensaje 24 horas después (si no responde):**
> "Hola [nombre], te separamos un nuevo espacio esta semana para tu asesoría. ¿Te agendo?"

**Tasa de rescate esperada con recordatorios:** Del estándar de la industria, los recordatorios por WhatsApp logran que **70-80% de citas agendadas se cumplan**, vs. ~40-50% sin recordatorios.

---

## Parte 4 — Nurture Post-Cita y Segunda Cita

### 4.1 Estado actual

No existe ningún flujo posterior a la primera cita. Una vez que el lead asiste (o no), el sistema no hace nada más.

### 4.2 Secuencia post-primera cita

#### Día 0 (inmediatamente después de la cita):

```
¡Gracias por tu tiempo, [nombre]!

Fue un gusto platicar contigo. Como te comentamos, estas son tus opciones:

📊 [Resumen personalizado basado en los datos de la cita]

¿Tienes alguna duda? Escríbenos aquí mismo.
```

#### Día 1 — Follow-up de valor:

```
Hola [nombre], te comparto algo que le puede servir a alguien
con tu perfil fiscal:

💡 [Tip personalizado según régimen/objetivo del lead]

Si quieres que profundicemos en tu caso, podemos agendar
una segunda sesión para armar tu plan fiscal completo.
```
Botones: [Sí, agendar segunda cita] [Tengo una duda]

#### Día 3 — Social proof:

```
Hola [nombre], te comparto el caso de un profesionista
similar a ti que logró ahorrar $45,000 en impuestos
este año con una estrategia de deducciones.

¿Te gustaría ver cómo aplicar algo similar en tu caso?
```
Botones: [Sí, me interesa] [Más adelante]

#### Día 7 — Cierre suave:

```
Hola [nombre], esta semana tenemos disponibilidad
para sesiones de plan fiscal personalizado.

Es donde armamos la estrategia completa para que
optimices tus impuestos este año.

¿Te agendo?
```
Botones: [Sí, agendar] [No por ahora]

#### Día 14 — Último contacto:

```
Hola [nombre], solo quería recordarte que seguimos
disponibles cuando quieras avanzar con tu plan fiscal.

Te deseo mucho éxito y aquí estamos. 🤝
```

Después de día 14, mover a lista de nurture mensual (un mensaje de valor al mes).

---

## Parte 5 — HubSpot CRM

### 5.1 Estado actual

- 1,002 contactos, 99.8% en etapa "lead"
- Solo 1 deal creado (Hugo Serrano, $20,000)
- 89% sin lead_status asignado
- Sin pipeline funcional
- Sin automatizaciones

### 5.2 Pipeline recomendado

Crear pipeline con estas etapas (en HubSpot > Deals > Pipeline):

```
1. Nuevo Lead (automático al entrar por bot)
   ↓
2. Calificado por Bot (ingreso confirmado +$35K)
   ↓
3. Cita Agendada (bot completó agenda)
   ↓
4. Cita Asistida (confirmado por asesora)
   ↓
5. Propuesta Enviada (post-cita, plan fiscal presentado)
   ↓
6. Segunda Cita Agendada
   ↓
7. Cierre Ganado ✅ / Cierre Perdido ❌
```

### 5.3 Automatizaciones para n8n → HubSpot

El workflow de n8n ya crea contactos y deals. Modificar para que:

- Al completar paso 2 del bot (ingreso confirmado): mover deal a "Calificado por Bot"
- Al agendar cita: mover deal a "Cita Agendada"
- Post-cita (manual por asesora o trigger): mover a "Cita Asistida"
- Al agendar segunda cita: mover a "Segunda Cita Agendada"

### 5.4 Propiedades personalizadas a crear en HubSpot

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `rango_ingreso` | Dropdown | Hasta $30K / $30-70K / Más de $70K |
| `declara_impuestos` | Sí/No | Del bot |
| `regimen_fiscal` | Dropdown | Sueldos / Honorarios / Empresarial / RESICO / Arrendamiento |
| `objetivo_fiscal` | Dropdown | Reducir impuestos / Planear retiro / Ambos |
| `fuente_campaña` | Texto | ID de campaña de Facebook |
| `score_lead` | Número | Calificación calculada (ver sección 5.5) |

### 5.5 Lead Scoring simplificado

| Criterio | Puntos |
|----------|--------|
| Ingreso +$70K | +40 |
| Ingreso $30-70K | +25 |
| Ingreso <$30K | +10 |
| Declara impuestos: Sí | +15 |
| Objetivo: Ambos | +15 |
| Objetivo: Reducir impuestos | +10 |
| Asalariado o Honorarios | +10 |
| Empresario | +15 |
| Respondió a re-engagement | +10 |

**Score 60+** = Alta prioridad (atención inmediata de asesora)
**Score 35-59** = Media prioridad (flujo normal)
**Score <35** = Baja prioridad (cita informativa 15 min)

---

## Parte 6 — Meta Pixel + Tracking de Atribución (como Tesipedia)

### 6.0 ¿Por qué esto es crítico?

Hoy, el 99.8% de tus contactos en HubSpot aparecen como fuente "OFFLINE". No puedes saber qué campaña, qué anuncio, ni qué público generó cada lead. Sin esto, estás volando a ciegas.

Tesipedia tiene un sistema de tracking que le permite ver en su funnel exactamente de qué campaña y adset viene cada lead, filtrar por campaña, y medir conversión real por fuente. Vamos a replicar eso para Finance SCool.

### 6.1 Archivos creados/modificados

| Archivo | Qué hace |
|---------|----------|
| `client/index.html` | Meta Pixel + captura de UTMs en sessionStorage |
| `client/src/utils/tracking.js` | Funciones de tracking: Lead, Schedule, Calculadora, WhatsApp click, scroll depth, detección de fuente |

### 6.2 Cómo obtener tu Pixel ID

1. Ve a **Meta Business Suite** → https://business.facebook.com/
2. Menú lateral → **Events Manager** (Administrador de eventos)
3. En "Orígenes de datos" verás tu pixel (si no tienes uno, créalo ahí)
4. Copia el **ID del pixel** (número de ~16 dígitos)
5. Reemplaza `TU_PIXEL_ID_AQUI` en `client/index.html` (aparece 2 veces)

### 6.3 Cómo funciona el tracking completo

```
FLUJO DE ATRIBUCIÓN:

[Facebook Ad] ──click──→ [financescool.com?utm_source=facebook&utm_campaign=ppr_cdmx&fbclid=xxx]
                                    │
                                    ▼
                         [index.html captura UTMs en sessionStorage]
                                    │
                                    ▼
                         [Usuario navega la landing, usa calculadora ISR]
                         [tracking.js dispara: PageView, ViewContent, CalculadoraISR]
                                    │
                                    ▼
                         [Usuario hace clic en "Agendar asesoría" → WhatsApp]
                         [tracking.js dispara: Lead + WhatsAppClick]
                         [URL de WA incluye: src:meta_ppr_cdmx|cmp:ppr_cdmx|med:paid]
                                    │
                                    ▼
                         [Bot Sofía recibe mensaje con [src:...] tag]
                         [n8n parsea la fuente y la guarda en Supabase + HubSpot]
                                    │
                                    ▼
                         [En HubSpot: contacto tiene utm_source=facebook, utm_campaign=ppr_cdmx]
                         [En Supabase: lead tiene lead_source=meta_ppr_cdmx]
```

### 6.4 Cambios necesarios en n8n para parsear la fuente

En el nodo **"Parse WA Data"** del workflow de n8n, agregar lógica para extraer el tag `[src:...]` del primer mensaje:

```javascript
// Detectar source tag en el mensaje (viene de la landing)
let leadSource = 'whatsapp_directo';
const srcMatch = message.match(/\[src:([^\]]+)\]/);
if (srcMatch) {
  const parts = srcMatch[1].split('|');
  const srcObj = {};
  parts.forEach(p => {
    const [k, v] = p.split(':');
    if (k && v) srcObj[k] = v;
  });
  leadSource = srcObj.src || 'whatsapp_directo';

  // Limpiar el tag del mensaje visible
  message = message.replace(/\[src:[^\]]+\]/, '').trim();
}
```

Luego, en el nodo **"Upsert Lead State"**, agregar `lead_source` al body de Supabase.

Y en **"HubSpot Create Contact"**, pasar la propiedad `hs_analytics_source_data_1` con el valor de `leadSource`.

### 6.5 Configurar UTMs en tus anuncios de Facebook

Cuando crees o edites un anuncio en Ads Manager, en la sección de **"URL de destino"** o **"Tracking"**, configura los parámetros URL así:

```
Destino: https://financescool.com/?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&fbclid={{fbclid}}
```

Meta reemplaza automáticamente `{{campaign.name}}`, `{{ad.name}}` y `{{fbclid}}` con los valores reales.

**Para anuncios de Click-to-WhatsApp (tu caso actual):**

Como los anuncios de mensajes van directo a WhatsApp sin pasar por la web, la atribución se maneja diferente:

1. Meta envía metadata en el webhook de WhatsApp cuando es un anuncio Click-to-WhatsApp
2. En el webhook, busca el campo `entry[0].changes[0].value.messages[0].referral` — contiene:
   - `source_url` — URL del anuncio
   - `source_type` — "ad" si viene de anuncio
   - `source_id` — ID del anuncio
   - `headline` — Título del anuncio
   - `body` — Texto del anuncio

Agregar al nodo **"Parse WA Data"** en n8n:

```javascript
// Detectar si viene de un anuncio Click-to-WhatsApp
const referral = entry.messages?.[0]?.referral || entry.referral || null;
let adSource = null;
let adId = null;
let adHeadline = null;

if (referral) {
  adSource = referral.source_type || null;  // "ad"
  adId = referral.source_id || null;         // ID del anuncio
  adHeadline = referral.headline || null;     // Título del anuncio
}
```

Esto te permite saber **exactamente qué anuncio generó cada conversación de WhatsApp**.

### 6.6 Eventos de pixel que se disparan

| Evento | Cuándo se dispara | Para qué sirve |
|--------|-------------------|----------------|
| `PageView` | Al cargar financescool.com | Medir tráfico total |
| `ViewContent` | Al ver sección de servicios/calculadora | Medir engagement |
| `CalculadoraISR` (custom) | Al usar la calculadora y ver resultado | Identificar leads de alto valor |
| `Lead` | Al hacer clic en WhatsApp o si ingreso ≥$35K en calculadora | Alimentar el algoritmo de Meta |
| `WhatsAppClick` (custom) | Al hacer clic en cualquier CTA de WhatsApp | Medir tasa de clic por ubicación |
| `Schedule` | Al agendar cita (vía Conversions API desde n8n) | Optimizar campaña para citas |
| `ScrollDepth` (custom) | Al llegar a 25%, 50%, 75%, 100% de scroll | Medir engagement con la landing |

### 6.7 Conversions API (CAPI) — Tracking server-side desde n8n

Para que Meta reciba el evento "Lead calificado" y "Cita agendada" directamente desde el backend (sin depender del pixel del navegador), implementar la Conversions API.

En n8n, después del nodo **"IF Cita Agendada" → true**, agregar un nodo HTTP Request:

```
POST https://graph.facebook.com/v19.0/TU_PIXEL_ID/events
Authorization: Bearer TU_ACCESS_TOKEN

Body:
{
  "data": [{
    "event_name": "Schedule",
    "event_time": UNIX_TIMESTAMP,
    "action_source": "system_generated",
    "user_data": {
      "ph": [HASH_SHA256_DEL_TELEFONO],
      "em": [HASH_SHA256_DEL_EMAIL]
    },
    "custom_data": {
      "value": 0,
      "currency": "MXN",
      "content_name": "Asesoría Fiscal FSC"
    }
  }],
  "access_token": "TU_ACCESS_TOKEN"
}
```

Esto cierra el loop: Meta sabe que un clic en el anuncio resultó en una cita agendada, y puede optimizar para encontrar más personas similares.

### 6.8 Vista de funnel estilo Tesipedia para Finance SCool

Tesipedia tiene un Kanban con columnas y filtros por campaña/adset. Para replicar esto en Finance SCool, la vista `FunnelView.jsx` ya existe en tu proyecto pero necesita conectarse a los datos de Supabase con el campo `lead_source`.

Las columnas del funnel para FSC serían:

```
Nuevo → Calificando → Cita Agendada → Cita Asistida → 2da Cita → Cliente → Perdido
```

Con filtros por:
- Campaña de origen (lead_source)
- Rango de ingreso
- Fecha de entrada
- Asesora asignada

---

## Parte 7 — Métricas y KPIs Objetivo (antes Parte 6)

### 6.1 Métricas actuales vs. objetivo

| Métrica | Hoy | Objetivo (90 días) | Cómo lograrlo |
|---------|-----|---------------------|---------------|
| Conversaciones → Calificados | ~18% | 40-50% | Reducir bot a 5 pasos + pre-filtrar en ads |
| Calificados → Cita agendada | ~1% | 50-60% | Re-engagement + urgencia en cierre |
| Cita agendada → Asistida | Desconocido | 75-85% | Recordatorios WA (24h, 1h, 10min) |
| Asistida → Segunda cita | 0% | 40-50% | Nurture post-cita |
| Segunda cita → Cliente | 0% | 30-40% | Seguimiento de asesora |
| **CPL Calificado (+$35K)** | **~$3,438** | **$50-80 USD** | Todas las mejoras combinadas |
| **Costo por cita asistida** | **~$3,438** | **$150-250 USD** | Recordatorios + mejor calificación |
| **Deals por mes** | **<1** | **15-25** | Embudo completo funcionando |

### 6.2 Dashboard de seguimiento semanal

Revisar cada lunes:

1. **Leads nuevos** (cuántos entraron esta semana)
2. **Tasa de calificación** (cuántos completaron el bot)
3. **Citas agendadas** (cuántas se programaron)
4. **Tasa de asistencia** (cuántas se cumplieron)
5. **Segundas citas** (cuántas se agendaron post-primera)
6. **Deals cerrados** (cuántos se convirtieron en clientes)
7. **CPL calificado** (gasto FB / leads calificados)
8. **CQAA** (gasto total / citas asistidas)

---

## Parte 7 — Roadmap de Implementación

### Semana 1 (inmediato, alto impacto)

- [ ] **URGENTE: Corregir fuga geográfica** — Cambiar segmentación de ubicación a "Personas que VIVEN en esta ubicación" y excluir Puebla/Oaxaca
- [ ] Modificar copy de anuncios FB con filtros de ingreso
- [ ] Reducir flujo del bot de 8 pasos a 5
- [ ] Implementar recordatorios de cita (24h, 1h, 10min) en n8n
- [ ] Arreglar atribución FB → HubSpot (pasar UTM source)
- [ ] Crear propiedades personalizadas en HubSpot

### Semana 2 (mejoras de retención)

- [ ] Implementar re-engagement automático (3 mensajes para abandonos)
- [ ] Crear secuencia post-cita (día 0, 1, 3, 7, 14)
- [ ] Configurar pipeline de deals en HubSpot con etapas correctas
- [ ] Lanzar prueba A/B de creativos en FB Ads
- [ ] Implementar manejo de no-shows

### Semana 3-4 (optimización)

- [ ] Probar campaña con objetivo "Leads" y formulario nativo de Meta
- [ ] Implementar lead scoring en HubSpot
- [ ] Crear dashboard de métricas semanales
- [ ] Analizar primeros resultados de re-engagement
- [ ] Ajustar segmentación de FB basándose en datos de leads calificados

### Mes 2 (escala)

- [ ] Lookalike audience basado en clientes que cerraron
- [ ] Campaña de retargeting para visitantes que no completaron bot
- [ ] Automatizar nurture mensual para leads fríos
- [ ] Evaluar subir modelo de Haiku a Sonnet para leads de alta prioridad
- [ ] Considerar agregar canal de Instagram DMs

---

## Parte 8 — Reactivación de 892 Leads Fríos

Tienes 892 contactos en HubSpot que nunca fueron trabajados. Esta es una oportunidad inmediata de costo cero.

### Campaña de reactivación por WhatsApp

**Segmentar en Supabase:** leads con `filtro_actual <= 3` y `updated_at < NOW() - INTERVAL '7 days'`

**Mensaje de reactivación:**

```
Hola [nombre], soy Sofía de Finance S Cool.

Hace unas semanas platicamos sobre cómo optimizar
tus impuestos y se nos quedó pendiente.

Esta semana tenemos espacios disponibles para
asesorías gratuitas de 30 minutos.

¿Te gustaría agendar la tuya?
```
Botones: [Sí, agendar] [Más información]

**Importante:** Enviar en lotes de 50-100 por día para no saturar el número de WhatsApp ni activar restricciones de Meta Business.

**Estimación conservadora:** Si el 5% responde y el 50% de esos agenda = **22 citas adicionales** sin gastar un peso en ads.

---

## Parte 9 — Consideraciones Técnicas del Workflow n8n

### 9.1 Seguridad

Los API keys de Anthropic, Supabase y WhatsApp están hardcodeados en el workflow JSON. Migrar a variables de entorno en Railway.

### 9.2 Modelo del bot

Actualmente usa `claude-haiku-4-5-20251001` con `max_tokens: 800`. Para el flujo reducido de 5 pasos esto es suficiente. Si se implementa personalización avanzada post-cita, considerar `claude-sonnet-4-6` para esos mensajes específicos.

### 9.3 Deduplicación

El sistema actual usa INSERT con `resolution=ignore-duplicates` en Supabase + fallback a staticData. Esto funciona bien. No cambiar.

### 9.4 Google Calendar

La integración con Google Calendar para disponibilidad de Ingrid funciona correctamente. Para los recordatorios, crear un nuevo workflow con trigger tipo "Schedule" que corra cada hora y verifique citas próximas.

---

## Resumen de Impacto Esperado

| Mejora | Impacto estimado | Timeline |
|--------|-----------------|----------|
| Reducir bot a 5 pasos | +120% en tasa de calificación | Semana 1 |
| Recordatorios de cita | +60% en asistencia a citas | Semana 1 |
| Re-engagement automático | +50-80 leads/mes recuperados | Semana 2 |
| Pre-filtro en ads | -40% en CPL calificado | Semana 1-2 |
| Nurture post-cita | +30-40% en segundas citas | Semana 2 |
| Reactivación de leads fríos | ~22 citas adicionales (una vez) | Semana 1 |
| **Combinado** | **De ~1 deal/mes a 15-25 deals/mes** | **60-90 días** |

---

*Documento generado a partir de auditoría de datos reales de HubSpot CRM, Facebook Ads Manager y workflow n8n de Finance S Cool.*
