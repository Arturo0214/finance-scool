/* Pruebas del motor del Agente de Prospección (sin DB, sin tokens).
   Correr:  node server/agente-prospeccion/test.js   */
'use strict';
const assert = require('assert');
const M = require('./motor');

const HOY = '2026-10-18T15:00:00.000Z';
let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('  ✓', nombre); };

// ── Datos sintéticos ──
const medicoVivo = {
  id: 1, nombre: 'Dr. Javier Molina', perfil: 'Cirujano dentista en Guadalajara',
  bucket: 'linkedin-medicos', score: 82, linkedin_url: 'https://linkedin.com/in/javier',
  seg_status: 'pendiente', seg_assigned_to: 'Arturo',
  notas_origen: 'Experiencia: 14 años · Soy especialista en implantología con consulta privada propia en Guadalajara, apasionado por la salud dental',
  seg_notes_log: [],
};
const perfilMuerto = {
  id: 2, nombre: 'Alfredo Rojo', perfil: 'Profesional', bucket: 'linkedin-patrimonio',
  score: 40, linkedin_url: 'https://linkedin.com/in/alfredo', seg_status: 'pendiente',
  notas_origen: 'Experiencia: · Ubicación: México · Educación:', seg_notes_log: [],
};
const sinLinkedin = {
  id: 3, nombre: 'Rosa Vega', perfil: 'Dueña de PyME', bucket: 'linkedin-pyme', score: 70,
  linkedin_url: null, seg_status: 'pendiente',
  notas_origen: 'Soy fundadora de una empresa de logística con más de 12 años de trayectoria', seg_notes_log: [],
};
const ejecutivoAlto = {
  id: 4, nombre: 'Laura Fdez', perfil: 'CFO en Grupo Financiero multinacional',
  bucket: 'linkedin-patrimonio', score: 78, linkedin_url: 'https://linkedin.com/in/laura',
  seg_status: 'pendiente', notas_origen: 'Soy CFO con 20 años de experiencia en banca corporativa global', seg_notes_log: [],
};
const yaConectado = {
  id: 5, nombre: 'Pedro Luna', perfil: 'Dueño de despacho contable', bucket: 'linkedin-pyme',
  score: 75, linkedin_url: 'https://linkedin.com/in/pedro', seg_status: 'contactado', seg_assigned_to: 'Arturo',
  notas_origen: 'Soy dueño de un despacho contable propio, ayudo a PyMES con su fiscal',
  seg_notes_log: [{ type: 'outreach', step: 'conectado', at: '2026-10-17T10:00:00Z', text: 'aceptó' }],
};

// 1. evaluarContacto
t('médico con consulta → contactable fácil', () => {
  const e = M.evaluarContacto(medicoVivo);
  assert.strictEqual(e.contactable, true); assert.strictEqual(e.dificultad, 'facil');
});
t('perfil fantasma → NO contactable', () => {
  const e = M.evaluarContacto(perfilMuerto);
  assert.strictEqual(e.contactable, false); assert.strictEqual(e.motivo, 'perfil-sin-actividad');
});
t('sin LinkedIn → NO contactable', () => {
  assert.strictEqual(M.evaluarContacto(sinLinkedin).contactable, false);
});
t('CFO corporativo → contactable pero difícil', () => {
  const e = M.evaluarContacto(ejecutivoAlto);
  assert.strictEqual(e.contactable, true); assert.strictEqual(e.dificultad, 'dificil');
});

// 2. redactarOutreach: invitación ≤300
t('invitación no excede 300 caracteres', () => {
  const msg = M.redactarOutreach(medicoVivo, 'invitacion');
  assert.ok(msg.length <= 300, `len=${msg.length}`);
  assert.ok(/Javier/.test(msg) && /conectar/i.test(msg));
});
t('referido menciona a quien refirió', () => {
  const msg = M.redactarOutreach(medicoVivo, 'invitacion', { nombre: 'Carlos Pérez' });
  assert.ok(/Carlos/.test(msg));
});

// 3. siguienteAccion: máquina de estados
t('nuevo → invitación (grupo hoy)', () => {
  const a = M.siguienteAccion(medicoVivo, { hoyISO: HOY });
  assert.strictEqual(a.paso, 'invitacion'); assert.strictEqual(a.grupo, 'hoy');
});
t('invitación enviada → esperando aceptación', () => {
  const l = { ...medicoVivo, seg_notes_log: [{ type: 'outreach', step: 'invitacion_enviada', at: HOY }] };
  const a = M.siguienteAccion(l, { hoyISO: HOY });
  assert.strictEqual(a.grupo, 'esperando');
});
t('conectado → bienvenida (hoy)', () => {
  const a = M.siguienteAccion(yaConectado, { hoyISO: HOY });
  assert.strictEqual(a.paso, 'bienvenida'); assert.strictEqual(a.grupo, 'hoy');
});
t('bienvenida reciente → seguimiento esperando; vieja → hoy', () => {
  const reciente = { ...medicoVivo, seg_notes_log: [{ type: 'outreach', step: 'bienvenida', at: HOY }] };
  assert.strictEqual(M.siguienteAccion(reciente, { hoyISO: HOY }).grupo, 'esperando');
  const vieja = { ...medicoVivo, seg_notes_log: [{ type: 'outreach', step: 'bienvenida', at: '2026-10-10T10:00:00Z' }] };
  assert.strictEqual(M.siguienteAccion(vieja, { hoyISO: HOY }).grupo, 'hoy');
});
t('agendada / convertido / descartado → fuera de cola', () => {
  assert.strictEqual(M.siguienteAccion({ ...medicoVivo, seg_notes_log: [{ type: 'outreach', step: 'sesion_agendada', at: HOY }] }, { hoyISO: HOY }), null);
  assert.strictEqual(M.siguienteAccion({ ...medicoVivo, seg_status: 'convertido' }, { hoyISO: HOY }), null);
  assert.strictEqual(M.siguienteAccion({ ...medicoVivo, seg_status: 'descartado' }, { hoyISO: HOY }), null);
});

// 4. construirCola: filtros, tope, orden
t('cola descarta muertos y sin-linkedin, incluye vivos', () => {
  const leads = [medicoVivo, perfilMuerto, sinLinkedin, ejecutivoAlto, yaConectado];
  const porId = new Map(leads.map(l => [l.id, l]));
  const c = M.construirCola(leads, { socio: 'Arturo', hoyISO: HOY, porId });
  assert.strictEqual(c.resumen.descartados_perfil_muerto, 1);
  assert.strictEqual(c.resumen.descartados_sin_linkedin, 1);
  // médico (invitación) + conectado (bienvenida) + ejecutivo (sin asignar, difícil) en cola de hoy
  const ids = c.hoy.map(i => i.id);
  assert.ok(ids.includes(1) && ids.includes(5));
  // conectado (bienvenida, paso más avanzado) va antes que la invitación nueva
  assert.ok(c.hoy.findIndex(i => i.id === 5) < c.hoy.findIndex(i => i.id === 1));
});
t('tope de invitaciones se respeta', () => {
  const muchos = [];
  for (let i = 100; i < 130; i++) muchos.push({ ...medicoVivo, id: i, seg_assigned_to: 'Arturo' });
  const porId = new Map(muchos.map(l => [l.id, l]));
  const c = M.construirCola(muchos, { socio: 'Arturo', hoyISO: HOY, porId });
  assert.strictEqual(c.resumen.invitaciones_en_cola, M.TOPE_INVITACIONES_DIA);
  assert.strictEqual(c.resumen.pospuestas_por_tope, 30 - M.TOPE_INVITACIONES_DIA);
});
t('filtro por socio: no trae los de otro socio', () => {
  const deOtro = { ...medicoVivo, id: 200, seg_assigned_to: 'Ingrid' };
  const c = M.construirCola([deOtro], { socio: 'Arturo', hoyISO: HOY, porId: new Map([[200, deOtro]]) });
  assert.strictEqual(c.hoy.length, 0);
});

// 5. RESULTADOS: catálogo de transiciones consistente
t('RESULTADOS cubre todas las acciones', () => {
  for (const id of ['invitacion_enviada', 'acepto', 'bienvenida_enviada', 'seguimiento_enviado', 'respondio_interesado', 'sesion_propuesta', 'sesion_agendada', 'descartar']) {
    assert.ok(M.RESULTADOS[id] && M.RESULTADOS[id].seg_status && M.RESULTADOS[id].texto, id);
  }
});

console.log(`\n✅ ${ok} pruebas OK`);
