# Agente de Prospección — Contexto operativo

**Qué es:** un agente de ventas por LinkedIn, **100% local y sin tokens**. No llama
a ningún modelo ni API de pago. Todo su "cerebro" son reglas deterministas sobre
los datos del prospecto (`crm_mejores_leads`) y su bitácora (`seg_notes_log`).

**Para quién:** la Mesa de Socios de Finance S-Cool (hoy activo para **Arturo**).
Vive dentro de la sección **Prospectos → Agente de ventas**.

---

## 1. Misión (y lo único que hace)

Convertir la base de prospectos LinkedIn en **sesiones iniciales agendadas**. Punto.
No hace soporte, no responde dudas de clientes, no manda cobros. Solo:

1. Decide **a quién contactar hoy** (y a quién NO).
2. Redacta el **mensaje de conexión** y toda la secuencia de ventas.
3. Empuja al prospecto por el embudo hasta **agendar la sesión inicial**.

## 2. Modo de envío: COLA ASISTIDA (cero riesgo de baneo)

LinkedIn **no tiene API** para mandar invitaciones/mensajes a terceros. Las dos
alternativas automáticas (bots de navegador) violan los ToS y pueden **restringir
o banear la cuenta del socio**. Por eso el agente es **asistido**:

- El agente **selecciona, califica, redacta y ordena** la cola del día.
- El socio **abre LinkedIn en su sesión y da el clic de enviar** (copiar-pegar).
- Al enviar, marca el resultado con un botón → el agente avanza la secuencia.

Resultado: LinkedIn nunca ve un bot, la cuenta está a salvo, y el socio solo
ejecuta trabajo ya pensado.

## 3. A quién SÍ y a quién NO (filtro anti-perfiles muertos)

El agente **saca de la cola en frío**:

- **Perfiles fantasma / inactivos** — su origen es puro membrete
  (`Experiencia: · Ubicación: · Educación:`) sin texto personal real. Regla:
  necesita ≥55 caracteres de sustancia personal (1ª persona, "acompaño/ayudo/soy",
  años de trayectoria, especialidad). Si no, no se contacta.
- **Sin LinkedIn** — sin URL no hay invitación que mandar.

Y **despriorizar** (los deja, pero hasta el fondo y marcados "mejor por referido"):

- **Ejecutivo corporativo alto** — CEO/CFO/Director General de un corporativo
  grande **sin** señal de dueño/consulta propia. Baja probabilidad de aceptar un
  mensaje frío; conviene llegarle por un referido, no en frío.

Prioriza: **dueños, médicos con consulta privada, directores de PyME, directivos
con trayectoria** (grado A y B del calificador local).

## 4. Secuencia de ventas (máquina de estados)

```
  invitación ──enviada──▶ [esperando que acepte] ──acepta──▶ bienvenida
      │                                                          │
   descartar                                              respondió/interesado
                                                                 │
   seguimiento ◀──(3 días sin respuesta)── bienvenida            ▼
      │                                               proponer sesión inicial
   respondió                                                     │
      └──────────────────▶ interesado ─────────────────▶ agendar sesión ✅
```

- **invitación** — nota de conexión ≤300 caracteres, cálida y con 1 CTA.
- **bienvenida** — al aceptar: agradece + propuesta de valor + oferta de idea concreta.
- **seguimiento** — se activa a los **3 días** sin respuesta (no antes: no satura).
- **proponer sesión** — sesión inicial de 20-25 min por Google Meet.
- **agendar** — confirma día/hora; enlaza con el calendario del socio (Meet).

Cada transición escribe una entrada `type:'outreach'` en `seg_notes_log`, así que
la **bitácora del expediente muestra todo el historial del agente** sin tabla extra,
y mueve la **etapa del CRM** (pendiente → contactado → interesado → negociando).

## 5. Topes y cadencia (proteger la cuenta)

- **≤20 invitaciones de conexión nuevas por día** (tope seguro de LinkedIn). Lo que
  sobra se pospone automáticamente al día siguiente.
- Los mensajes a **conexiones ya aceptadas** no gastan ese cupo.
- La cola se recalcula en vivo en cada carga (no hay cron ni estado oculto).

## 6. Personalización (local, sin IA)

Cada mensaje se arma con: primer nombre, rol/puesto y ciudad (extraídos del origen),
campaña (médicos / PyME / patrimonio) y, si es referido, el nombre de quien lo
refirió. La propuesta de valor cambia por campaña. Si hay notas previas en la
bitácora, el seguimiento las reconoce.

## 7. Arquitectura

- `motor.js` — cerebro puro (sin DB, testeable): `evaluarContacto`,
  `siguienteAccion`, `redactarOutreach`, `construirCola`, `RESULTADOS`.
- Endpoints (en `server/routes/crm.js`): `GET /crm/prospectos/cola` (arma la cola
  del socio) y `POST /crm/prospectos/:id/outreach` (registra el resultado y avanza).
- UI (en `CrmProspectosView.jsx`): pestaña **Agente de ventas** con la cola del día.
- `test.js` — pruebas del motor con leads sintéticos (correr antes de desplegar).

## 8. Límites honestos

- No envía solo: el clic final es humano (por diseño, para no arriesgar la cuenta).
- No lee las respuestas de LinkedIn: el socio marca el resultado (interesado / no).
- No inventa datos del prospecto; si el origen viene pobre, lo trata como frío.
