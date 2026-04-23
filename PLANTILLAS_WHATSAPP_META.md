# Plantillas de WhatsApp para Finance S Cool

## Por qué se necesitan

WhatsApp Business API solo permite enviar mensajes de texto libre dentro de las 24 horas posteriores al último mensaje del usuario. Fuera de esa ventana, SOLO se pueden enviar Message Templates aprobados por Meta.

Los recordatorios de cita, follow-ups y nurture post-cita se envían fuera de la ventana de 24h, por lo tanto necesitan plantillas aprobadas.

## Dónde crearlas

1. Ve a https://business.facebook.com
2. Menu lateral → WhatsApp Manager → Message Templates (Plantillas de mensajes)
3. Si no aparece, ve a tu app en https://developers.facebook.com → WhatsApp → API Setup → Message Templates

## Plantillas a crear

---

### 1. `fsc_recordatorio_24h`
**Categoría:** UTILITY
**Idioma:** es_MX

```
Hola {{1}}, mañana es tu asesoría fiscal con Finance S Cool:

📅 {{2}}
🕐 {{3}}

¿Nos confirmas que asistirás?

Si necesitas reprogramar, solo responde a este mensaje.
```

**Variables:**
- {{1}} = nombre del lead
- {{2}} = fecha de la cita (ej: "Miércoles 23 de abril")
- {{3}} = hora de la cita (ej: "10:00 AM")

**Botones (Quick Reply):**
- "Sí, ahí estaré"
- "Necesito reprogramar"

---

### 2. `fsc_recordatorio_1h`
**Categoría:** UTILITY
**Idioma:** es_MX

```
⏰ {{1}}, en 1 hora es tu asesoría fiscal.

Tip: ten a la mano tu último recibo de nómina o tu constancia de situación fiscal del SAT.

¡Te esperamos!
```

**Variables:**
- {{1}} = nombre del lead

**Sin botones** (mensaje simple)

---

### 3. `fsc_recordatorio_10min`
**Categoría:** UTILITY
**Idioma:** es_MX

```
🟢 ¡{{1}}, ya estamos listos!

Tu asesora ya está conectada y te espera.

Responde a este mensaje si tienes algún problema para conectarte.
```

**Variables:**
- {{1}} = nombre del lead

**Sin botones**

---

### 4. `fsc_no_show`
**Categoría:** UTILITY
**Idioma:** es_MX

```
Hola {{1}}, vimos que no pudimos conectarnos hoy para tu asesoría fiscal.

No te preocupes, te puedo reagendar para esta semana. ¿Qué horario te funciona mejor?
```

**Variables:**
- {{1}} = nombre del lead

**Botones (Quick Reply):**
- "Mañana a la misma hora"
- "Ver otros horarios"

---

### 5. `fsc_nurture_dia1`
**Categoría:** MARKETING
**Idioma:** es_MX

```
¡Gracias por tu tiempo, {{1}}!

Fue un gusto platicar contigo sobre tu situación fiscal. Si te quedó alguna duda sobre lo que comentamos, puedes escribirme aquí.

Tu asesora queda pendiente de ti.

— Equipo Finance S Cool
```

**Variables:**
- {{1}} = nombre del lead

**Botones (Quick Reply):**
- "Tengo una duda"
- "Todo claro, gracias"

---

### 6. `fsc_nurture_segunda_cita`
**Categoría:** MARKETING
**Idioma:** es_MX

```
Hola {{1}}, esta semana tenemos disponibilidad para tu sesión de plan fiscal personalizado.

Es donde armamos la estrategia completa para que optimices tus impuestos este año.

¿Te agendo?
```

**Variables:**
- {{1}} = nombre del lead

**Botones (Quick Reply):**
- "Sí, agendar"
- "La próxima semana"

---

### 7. `fsc_reengagement`
**Categoría:** MARKETING
**Idioma:** es_MX

```
Hola {{1}}, soy Sofía de Finance S Cool.

Hace unos días platicamos sobre cómo optimizar tus impuestos y se nos quedó pendiente.

Esta semana tenemos espacios para asesorías gratuitas de 30 minutos. ¿Te gustaría agendar la tuya?
```

**Variables:**
- {{1}} = nombre del lead

**Botones (Quick Reply):**
- "Sí, agendar"
- "Más información"

---

## Cambios necesarios en el servidor

Una vez que las plantillas estén aprobadas por Meta (tarda 1-24 horas), el código del servidor necesita cambiar de enviar texto libre a usar templates.

### Formato de envío de template por la API de WhatsApp:

```javascript
// EN VEZ DE ESTO (texto libre — solo funciona dentro de 24h):
{
  messaging_product: 'whatsapp',
  to: phone,
  type: 'text',
  text: { body: message }
}

// USAR ESTO (template — funciona siempre):
{
  messaging_product: 'whatsapp',
  to: phone,
  type: 'template',
  template: {
    name: 'fsc_recordatorio_24h',    // nombre de la plantilla aprobada
    language: { code: 'es_MX' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Juan' },     // {{1}} nombre
          { type: 'text', text: 'Miércoles 23 de abril' },  // {{2}} fecha
          { type: 'text', text: '10:00 AM' }, // {{3}} hora
        ]
      }
    ]
  }
}
```

### Función helper para el servidor (agregar en whatsapp.js):

```javascript
function buildTemplatePayload(phone, templateName, params = []) {
  const components = params.length > 0 ? [{
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: String(p) }))
  }] : [];

  return {
    messaging_product: 'whatsapp',
    to: phone.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_MX' },
      components
    }
  };
}
```

### Cambios por endpoint:

**POST /reminders:**
```javascript
// Recordatorio 24h
const payload = buildTemplatePayload(phone, 'fsc_recordatorio_24h', [
  lead.nombre_lead || 'Hola',
  fechaFormateada,   // "Miércoles 23 de abril"
  lead.hora_cita     // "10:00"
]);

// Recordatorio 1h
const payload = buildTemplatePayload(phone, 'fsc_recordatorio_1h', [
  lead.nombre_lead || 'Hola'
]);

// Recordatorio 10min
const payload = buildTemplatePayload(phone, 'fsc_recordatorio_10min', [
  lead.nombre_lead || 'Hola'
]);
```

**POST /no-show:**
```javascript
const payload = buildTemplatePayload(phone, 'fsc_no_show', [
  lead.nombre_lead || 'Hola'
]);
```

**POST /post-cita:**
```javascript
// Día 1
const payload = buildTemplatePayload(phone, 'fsc_nurture_dia1', [
  lead.nombre_lead || 'Hola'
]);

// Día 3 y 7
const payload = buildTemplatePayload(phone, 'fsc_nurture_segunda_cita', [
  lead.nombre_lead || 'Hola'
]);
```

**POST /follow-up (ya existente):**
```javascript
const payload = buildTemplatePayload(phone, 'fsc_reengagement', [
  lead.nombre_lead || 'Hola'
]);
```

---

## Proceso de aprobación

1. Crear cada plantilla en WhatsApp Manager
2. Meta las revisa en 1-24 horas (UTILITY se aprueba más rápido que MARKETING)
3. Una vez aprobadas, actualizar el código del servidor para usar templates
4. Probar con un número de prueba

## Notas importantes

- Las plantillas UTILITY (recordatorios, no-show) se aprueban más rápido y tienen mejor tasa de entrega
- Las plantillas MARKETING (nurture, re-engagement) pueden tardar más y Meta puede rechazarlas si el texto es demasiado promocional
- Máximo 1024 caracteres por plantilla
- Las variables {{1}}, {{2}}, etc. deben ser genéricas en el ejemplo al crear la plantilla (no pongas datos reales)
- Si Meta rechaza una plantilla, revisa que no tenga: promesas financieras específicas, lenguaje urgente excesivo, o referencias a competidores
