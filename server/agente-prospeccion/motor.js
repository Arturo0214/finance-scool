/**
 * Agente de Prospección — MOTOR (100% local, sin IA ni tokens)
 * ─────────────────────────────────────────────────────────────
 * Cerebro determinista del agente de ventas por LinkedIn. No llama a ningún
 * modelo ni API de pago: todo sale de reglas sobre los datos del lead
 * (crm_mejores_leads) y de su bitácora (seg_notes_log).
 *
 * Responsabilidades:
 *   1) evaluarContacto()  → descarta perfiles muertos / inalcanzables y gradúa
 *      la dificultad, para NO quemar tiempo en gente que no va a aceptar.
 *   2) siguienteAccion()  → máquina de estados de la secuencia de ventas:
 *      invitación → (acepta) → bienvenida → seguimiento → interés →
 *      proponer sesión → agendar. Decide qué toca HOY por cada lead.
 *   3) redactarOutreach() → el texto exacto para LinkedIn por paso, campaña,
 *      perfil (rol/ciudad) y si viene de un referido.
 *   4) construirCola()    → arma la cola diaria asistida respetando el tope
 *      seguro de invitaciones nuevas (~20/día) para no exponer la cuenta.
 *
 * El envío es ASISTIDO: el agente redacta y ordena; el socio da el clic de
 * enviar en su propia sesión de LinkedIn. Cero automatización de navegador =
 * cero riesgo de baneo. Ver CONTEXTO.md.
 */

'use strict';

// ── Tope diario seguro de invitaciones de conexión nuevas por cuenta ──
const TOPE_INVITACIONES_DIA = 20;
// Días de "reposo" antes de que un mensaje enviado vuelva a la cola como seguimiento
const DIAS_SEGUIMIENTO = 3;

// ── Señales de perfil (reusan la lógica del calificador) ──
const SENIOR = /(due[ñn]o|propietari|founder|fundador|cofundador|socio|president|ceo\b|cfo\b|coo\b|director general|gerente general)/i;
const DUENO = /(due[ñn]o|propietari|founder|fundador|cofundador|consulta privada|consultorio|cl[ií]nica propia|pr[aá]ctica privada|despacho propio|negocio propio|emprendedor)/i;
const CORPORATIVO_GRANDE = /(multinacional|corporativo|global|fortune|grupo financiero|banco\b|instituci[oó]n|conglomerado|s\.?a\.?b\.?)/i;
const PERSONAL = /(\bsoy\b|\bme \w|ayudo|con m[aá]s de|a[ñn]os de (experiencia|trayectoria)|especialista en|apasionad|l[ií]der|fund[eé]|dedicad|enfocad|acompaño|asesor)/i;
const CIUDADES_RE = /(CDMX|Ciudad de M[eé]xico|Guadalajara|Monterrey|Puebla|Quer[eé]taro|M[eé]rida|Tijuana|Le[oó]n|Canc[uú]n|Veracruz|Aguascalientes|Toluca|San Luis Potos[ií]|Chihuahua|Saltillo|Torre[oó]n|Hermosillo|Culiac[aá]n|Morelia|Cuernavaca|Pachuca|Mexicali|Durango)/i;
const ETIQUETA_PLANTILLA = /^(experiencia|ubicaci[oó]n|educaci[oó]n|linkedin|actual|empresa)\s*:/i;

// Títulos/prefijos que NO son nombre de pila (muy común en médicos).
const TITULO = /^(dr|dra|lic|ing|mtro|mtra|mvz|c\.?p|cp|arq|q\.?f\.?b|od|odont|sr|sra|srta|psic|lcda?|m\.?c|prof)\.?$/i;
// Palabras-puesto: si el "nombre" empieza con una de estas, el campo trae un
// cargo (no una persona) → saludamos sin nombre en vez de "Hola Fundador,".
const PALABRA_PUESTO = /^(fundador|cofundador|due[ñn]o|propietari|director|directora|gerente|ceo|cfo|coo|presidente|vicepresidente|socio|consultor|asesor|especialista|empresario|titular|encargad|jefe|responsable)/i;
// Descripción en 1ª persona: el perfil es una frase, no un puesto limpio.
const DESCRIPCION = /\b(ayudo|acompaño|me dedico|me apasiona|especializ|brindo|ofrezco|asesoro|trabajo con|apoyo a)\b/i;

/* Extrae datos legibles del lead para personalizar sin IA. */
function datosDelLead(l) {
  const tokens = (l.nombre || '').trim().split(/\s+/).filter(Boolean);
  const cand = tokens.find(w => !TITULO.test(w)) || tokens[0] || '';
  // Si el "nombre" en realidad es un puesto, no lo usamos como nombre de pila.
  const primerNombre = (!cand || PALABRA_PUESTO.test(cand)) ? '' : cand;
  const texto = `${l.perfil || ''} · ${l.notas_origen || ''}`;
  const ciudad = (texto.match(CIUDADES_RE) || [])[0] || '';
  // Limpia el rol: quita "Soy ..." inicial, lo que va tras " en Empresa", y pipes.
  let rol = (l.perfil || '').replace(/^soy\s+(un[ao]?\s+)?/i, '').replace(/\s+en\s+.+$/i, '').replace(/\s*[|/·].*$/, '').trim();
  // Si el perfil es una frase/descripción (no un puesto), mejor no forzar "como X".
  if (DESCRIPCION.test(l.perfil || '') || rol.split(/\s+/).length > 6) rol = '';
  if (rol.length > 46) rol = rol.slice(0, 46).replace(/\s+\S*$/, '');
  return { primerNombre, ciudad, rol, texto };
}

/* ¿El perfil tiene sustancia real o es una ficha fantasma (solo etiquetas)? */
function tieneSustancia(l) {
  const partes = String(l.notas_origen || '').split(/\s*·\s*/).map(s => s.trim()).filter(Boolean);
  const personales = partes.filter(s => !ETIQUETA_PLANTILLA.test(s) && (s.length >= 70 || PERSONAL.test(s)));
  return personales.join(' ').length >= 55;
}

/**
 * evaluarContacto(lead) → { contactable, dificultad, motivo }
 *   contactable=false  → NO entra a la cola de LinkedIn (muerto o sin URL).
 *   dificultad: 'facil' | 'media' | 'dificil' (ejecutivo corporativo alto que
 *   difícilmente acepta un frío → mejor por referido; se despriorizra).
 */
function evaluarContacto(l) {
  if (!l.linkedin_url) return { contactable: false, dificultad: 'media', motivo: 'sin-linkedin' };
  if (!tieneSustancia(l)) return { contactable: false, dificultad: 'dificil', motivo: 'perfil-sin-actividad' };
  const { texto } = datosDelLead(l);
  // Ejecutivo senior de corporativo grande SIN señal de dueño/consulta propia
  // = baja probabilidad de aceptar un mensaje frío → difícil, mejor por referido.
  if (SENIOR.test(texto) && CORPORATIVO_GRANDE.test(texto) && !DUENO.test(texto)) {
    return { contactable: true, dificultad: 'dificil', motivo: 'ejecutivo-corporativo' };
  }
  if (SENIOR.test(texto) && !DUENO.test(texto)) return { contactable: true, dificultad: 'media', motivo: 'senior' };
  return { contactable: true, dificultad: 'facil', motivo: 'ok' };
}

// ── Propuesta de valor corta por campaña (para la nota de invitación, ≤300) ──
const VALOR_CORTO = {
  'linkedin-medicos': 'acompaño a médicos con consulta privada a ordenar ingresos y armar su retiro',
  'linkedin-pyme': 'ayudo a dueños y directores a que su empresa les pague mejor (eficiencia fiscal y patrimonio)',
  'linkedin-patrimonio': 'acompaño a directivos a convertir excedentes en patrimonio y un retiro sólido (PPR)',
};
const VALOR_LARGO = {
  'linkedin-medicos': 'acompaño a médicos con consulta privada a ordenar sus ingresos: bancarización, deducción y un plan de retiro a su medida',
  'linkedin-pyme': 'ayudo a dueños y directores a que su empresa les pague mejor: eficiencia fiscal, deducibilidad y patrimonio personal',
  'linkedin-patrimonio': 'acompaño a directivos con trayectoria a convertir sus excedentes en patrimonio y un plan de retiro sólido (PPR)',
};
const valorCorto = (b) => VALOR_CORTO[b] || VALOR_CORTO['linkedin-patrimonio'];
const valorLargo = (b) => VALOR_LARGO[b] || VALOR_LARGO['linkedin-patrimonio'];

/* Recorta a <=300 chars sin cortar palabras (límite de nota de invitación). */
function limitar(txt, max = 300) {
  if (txt.length <= max) return txt;
  return txt.slice(0, max - 1).replace(/\s+\S*$/, '').trim() + '…';
}

/**
 * redactarOutreach(lead, paso, padre) → texto para LinkedIn según el paso.
 * Mensajes locales, de ventas, con tono humano y un único CTA claro.
 */
function redactarOutreach(l, paso, padre) {
  const { primerNombre, ciudad, rol } = datosDelLead(l);
  const hola = primerNombre ? `Hola ${primerNombre}` : 'Hola';       // "Hola Pedro" / "Hola"
  const nom = primerNombre ? `${primerNombre}, ` : '';               // "Pedro, " / ""
  const refLinea = padre ? `${(padre.nombre || '').split(' ')[0]} me habló muy bien de ti y me pasó tu contacto. ` : '';
  const trayecto = rol ? `vi tu trayectoria como ${rol}${ciudad ? ` en ${ciudad}` : ''}` : `me llamó la atención tu perfil${ciudad ? ` (${ciudad})` : ''}`;

  switch (paso) {
    case 'invitacion':
      return limitar(`${hola}, ${refLinea}${trayecto}. Soy socio en Finance S-Cool: ${valorCorto(l.bucket)}. Me encantaría conectar. Saludos.`);
    case 'bienvenida':
      return `${nom || 'Hola, '}¡gracias por conectar! Voy al grano: en Finance S-Cool ${valorLargo(l.bucket)}. Si te hace sentido, te comparto en 3 bullets una idea concreta aplicable a tu caso${rol ? ` como ${rol}` : ''}. ¿Te late? Sin compromiso.`;
    case 'seguimiento':
      return `${hola}, ¿cómo vas? Retomo mi mensaje: no es nada genérico — ${valorCorto(l.bucket)}. Me basta una llamada de 15 min para mostrarte el beneficio concreto para ti. ¿Qué día de esta semana te acomoda?`;
    case 'proponer_sesion':
      return `${nom ? `${nom}¡qué gusto!` : '¡Qué gusto!'} Te propongo una sesión inicial de 20-25 min para aterrizarlo a tus números reales${rol ? ` como ${rol}` : ''}. Yo mando la liga de videollamada (Google Meet). ¿Te acomoda mañana o pasado? Dime tu mejor horario y lo agendo.`;
    case 'agendar_sesion':
      return `${nom ? `Perfecto, ${nom}` : 'Perfecto. '}Agendo la sesión inicial y te llega la invitación con la liga de Meet. ¿Confirmo ese día y hora? Si surge algo lo movemos sin bronca — la idea es que salgas con claridad sobre tu patrimonio y retiro.`;
    default:
      return '';
  }
}

// ── Catálogo de pasos de la máquina de estados ──
// cada paso declara su etiqueta, canal y los botones (acciones) que avanzan.
const ACCION = {
  INV_ENVIADA: { id: 'invitacion_enviada', label: 'Invitación enviada', tono: 'ok' },
  ACEPTO: { id: 'acepto', label: 'Aceptó conexión', tono: 'ok' },
  BIENVENIDA_ENVIADA: { id: 'bienvenida_enviada', label: 'Mensaje enviado', tono: 'ok' },
  SEG_ENVIADO: { id: 'seguimiento_enviado', label: 'Seguimiento enviado', tono: 'ok' },
  RESPONDIO: { id: 'respondio_interesado', label: 'Respondió / interesado', tono: 'ok' },
  SESION_PROPUESTA: { id: 'sesion_propuesta', label: 'Sesión propuesta', tono: 'ok' },
  SESION_AGENDADA: { id: 'sesion_agendada', label: 'Agendar sesión', tono: 'gold' },
  DESCARTAR: { id: 'descartar', label: 'No interesado', tono: 'ghost' },
};

/* Resultado (id) → cómo queda el lead: paso nuevo + etapa CRM + texto de bitácora. */
const RESULTADOS = {
  invitacion_enviada: { paso: 'invitacion_enviada', seg_status: 'contactado', texto: '🔗 Invitación de conexión enviada en LinkedIn' },
  acepto: { paso: 'conectado', seg_status: 'contactado', texto: '🤝 Aceptó la conexión en LinkedIn' },
  bienvenida_enviada: { paso: 'bienvenida', seg_status: 'contactado', texto: '💬 Mensaje de bienvenida/valor enviado' },
  seguimiento_enviado: { paso: 'seguimiento', seg_status: 'contactado', texto: '🔁 Seguimiento enviado' },
  respondio_interesado: { paso: 'interesado', seg_status: 'interesado', texto: '⭐ Respondió — mostró interés' },
  sesion_propuesta: { paso: 'sesion_propuesta', seg_status: 'interesado', texto: '📅 Sesión inicial propuesta' },
  sesion_agendada: { paso: 'sesion_agendada', seg_status: 'negociando', texto: '✅ Sesión inicial agendada' },
  descartar: { paso: 'cerrado', seg_status: 'descartado', texto: '🚪 Marcado como no interesado (puerta abierta)' },
};

/* Última entrada de outreach en la bitácora → paso actual de la secuencia. */
function ultimoPaso(l) {
  const log = Array.isArray(l.seg_notes_log) ? l.seg_notes_log : [];
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i] && log[i].type === 'outreach' && log[i].step) return { paso: log[i].step, at: log[i].at };
  }
  return null;
}

/* Cuántas invitaciones nuevas ya se enviaron HOY (para respetar el tope). */
function invitacionesHoy(leads, hoyISO) {
  const dia = hoyISO.slice(0, 10);
  let n = 0;
  for (const l of leads) {
    const log = Array.isArray(l.seg_notes_log) ? l.seg_notes_log : [];
    for (const e of log) if (e && e.step === 'invitacion_enviada' && String(e.at || '').slice(0, 10) === dia) n++;
  }
  return n;
}

const diasDesde = (iso, hoyISO) => {
  if (!iso) return 999;
  return Math.floor((new Date(hoyISO) - new Date(iso)) / 86400000);
};

/**
 * siguienteAccion(lead, {hoyISO}) → qué toca con este lead, o null si ya salió
 * de la secuencia (convertido/descartado/agendado → se trabaja en el CRM normal).
 * grupo: 'hoy' (acción de envío lista) | 'esperando' (depende de que el lead responda/acepte).
 */
function siguienteAccion(l, { hoyISO, padre } = {}) {
  const estado = (l.seg_status || 'pendiente');
  if (estado === 'convertido' || estado === 'descartado') return null;

  const up = ultimoPaso(l);
  const paso = up ? up.paso : null;
  const edad = diasDesde(up && up.at, hoyISO);

  // Lead agendado → ya está en el flujo de cierre del CRM, fuera de la cola.
  if (paso === 'sesion_agendada' || paso === 'cerrado') return null;

  if (!paso) {
    return { grupo: 'hoy', paso: 'invitacion', etiqueta: 'Invitación de conexión', canal: 'invitacion',
      mensaje: redactarOutreach(l, 'invitacion', padre), limite: 300,
      acciones: [ACCION.INV_ENVIADA, ACCION.DESCARTAR] };
  }
  if (paso === 'invitacion_enviada') {
    return { grupo: 'esperando', paso: 'espera_aceptacion', etiqueta: 'Esperando que acepte', canal: 'estado',
      mensaje: null, nota: `Invitación enviada hace ${edad} día${edad === 1 ? '' : 's'}. En cuanto acepte, pasa a bienvenida.`,
      acciones: [ACCION.ACEPTO, ACCION.DESCARTAR] };
  }
  if (paso === 'conectado') {
    return { grupo: 'hoy', paso: 'bienvenida', etiqueta: 'Mensaje de bienvenida', canal: 'mensaje',
      mensaje: redactarOutreach(l, 'bienvenida', padre),
      acciones: [ACCION.BIENVENIDA_ENVIADA, ACCION.RESPONDIO, ACCION.DESCARTAR] };
  }
  if (paso === 'bienvenida' || paso === 'seguimiento') {
    const listo = edad >= DIAS_SEGUIMIENTO;
    return { grupo: listo ? 'hoy' : 'esperando', paso: 'seguimiento', etiqueta: 'Seguimiento', canal: 'mensaje',
      mensaje: redactarOutreach(l, 'seguimiento', padre),
      nota: listo ? null : `Mensaje enviado hace ${edad} día${edad === 1 ? '' : 's'}; el seguimiento se activa a los ${DIAS_SEGUIMIENTO}.`,
      acciones: [ACCION.RESPONDIO, ACCION.SEG_ENVIADO, ACCION.DESCARTAR] };
  }
  if (paso === 'interesado') {
    return { grupo: 'hoy', paso: 'proponer_sesion', etiqueta: 'Proponer sesión inicial', canal: 'mensaje',
      mensaje: redactarOutreach(l, 'proponer_sesion', padre),
      acciones: [ACCION.SESION_PROPUESTA, ACCION.DESCARTAR] };
  }
  if (paso === 'sesion_propuesta') {
    return { grupo: 'hoy', paso: 'agendar_sesion', etiqueta: 'Agendar la sesión', canal: 'sesion',
      mensaje: redactarOutreach(l, 'agendar_sesion', padre),
      acciones: [ACCION.SESION_AGENDADA, ACCION.DESCARTAR] };
  }
  return null;
}

// Prioridad de grado para ordenar la cola (A antes que B antes que C).
const gradoRank = (s) => (typeof s === 'number' ? (s >= 75 ? 0 : s >= 55 ? 1 : 2) : 2);
const dificultadRank = { facil: 0, media: 1, dificil: 2 };

/**
 * construirCola(leads, { socio, hoyISO, porId }) → la cola asistida de HOY.
 * Filtra por socio (asignados a él + sin asignar), descarta perfiles muertos,
 * respeta el tope de invitaciones nuevas y ordena por urgencia/calidad.
 * Devuelve { hoy:[...], esperando:[...], descartados:{muertos,sinLinkedin}, tope }.
 */
function construirCola(leads, { socio, hoyISO, porId } = {}) {
  const yaInvitadasHoy = invitacionesHoy(leads, hoyISO);
  let cupoInvitaciones = Math.max(0, TOPE_INVITACIONES_DIA - yaInvitadasHoy);

  const mios = leads.filter(l => {
    if (!socio) return true;
    const a = l.seg_assigned_to || '';
    return a === socio || a === '';
  });

  const hoy = [], esperando = [];
  let muertos = 0, sinLinkedin = 0, dificiles = 0;

  for (const l of mios) {
    const ev = evaluarContacto(l);
    const padre = l.referido_de && porId ? porId.get(l.referido_de) : null;
    const acc = siguienteAccion(l, { hoyISO, padre });
    if (!acc) continue;

    // Perfil muerto / sin LinkedIn: solo cuenta si apenas iba a entrar (invitación).
    if (acc.paso === 'invitacion' && !ev.contactable) {
      if (ev.motivo === 'sin-linkedin') sinLinkedin++; else muertos++;
      continue;
    }

    const item = {
      id: l.id, nombre: l.nombre, perfil: l.perfil || null, bucket: l.bucket,
      score: l.score, linkedin_url: l.linkedin_url || null,
      seg_assigned_to: l.seg_assigned_to || null,
      padre: padre ? { id: padre.id, nombre: padre.nombre } : null,
      dificultad: ev.dificultad, motivo: ev.motivo,
      ...acc,
    };
    if (ev.dificultad === 'dificil') dificiles++;
    (acc.grupo === 'hoy' ? hoy : esperando).push(item);
  }

  // Orden: por paso (lo más avanzado primero cierra ventas), luego grado, dificultad, score.
  const ordenPaso = { agendar_sesion: 0, proponer_sesion: 1, seguimiento: 2, bienvenida: 3, invitacion: 4 };
  hoy.sort((a, b) =>
    (ordenPaso[a.paso] ?? 9) - (ordenPaso[b.paso] ?? 9) ||
    gradoRank(a.score) - gradoRank(b.score) ||
    (dificultadRank[a.dificultad] ?? 1) - (dificultadRank[b.dificultad] ?? 1) ||
    (b.score || 0) - (a.score || 0)
  );

  // Aplica el tope solo a invitaciones nuevas; el resto (ya conectados) no gasta cupo.
  const hoyLimitado = [];
  let invitacionesEnCola = 0, pospuestas = 0;
  for (const it of hoy) {
    if (it.paso === 'invitacion') {
      if (invitacionesEnCola >= cupoInvitaciones) { pospuestas++; continue; }
      invitacionesEnCola++;
    }
    hoyLimitado.push(it);
  }

  return {
    hoy: hoyLimitado,
    esperando: esperando.sort((a, b) => gradoRank(a.score) - gradoRank(b.score)),
    resumen: {
      para_hoy: hoyLimitado.length,
      invitaciones_en_cola: invitacionesEnCola,
      cupo_invitaciones: cupoInvitaciones,
      invitaciones_enviadas_hoy: yaInvitadasHoy,
      tope_diario: TOPE_INVITACIONES_DIA,
      pospuestas_por_tope: pospuestas,
      esperando: esperando.length,
      descartados_perfil_muerto: muertos,
      descartados_sin_linkedin: sinLinkedin,
      dificiles,
    },
  };
}

module.exports = {
  TOPE_INVITACIONES_DIA, DIAS_SEGUIMIENTO,
  evaluarContacto, tieneSustancia, datosDelLead,
  redactarOutreach, siguienteAccion, ultimoPaso, construirCola,
  RESULTADOS,
};
