/**
 * CRM Incubadora S-COOL — rutas /api/crm
 * Réplica funcional del Business Review: agentes, clientes, pólizas,
 * metas, recordatorios, archivos (Cloudinary), KPIs y forecast.
 *
 * Reglas de acceso:
 *  - superadmin / agencia / admin  → ven y administran todo
 *  - asesor                        → solo su propia cartera (crm_agents.user_id = req.user.id)
 */
const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const jwt = require('jsonwebtoken');
const { getDB } = require('../models/database');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { encryptFields, decryptFields, decryptRows } = require('../utils/cryptoFields');

/* URL firmada y temporal para archivos privados de Cloudinary (1 hora) */
function signedFileUrl(file) {
  if (!file.public_id) return file.url;
  try {
    return cloudinary.utils.private_download_url(file.public_id, null, {
      resource_type: file.resource_type || 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  } catch { return file.url; }
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/* ═══════════════ PORTAL DEL CLIENTE (público, con token firmado) ═══════════════
   Registrado ANTES de verifyToken: el cliente final accede con un enlace
   firmado (JWT scope crm-portal, 30 días) que le comparte su asesor. */
router.get('/portal', async (req, res) => {
  try {
    const dec = jwt.verify(String(req.query.t || ''), JWT_SECRET);
    if (dec.scope !== 'crm-portal') throw new Error('bad scope');
    const db = getDB();
    const { data: client } = await db.from('crm_clients').select('*').eq('id', dec.cid).maybeSingle();
    if (!client) return res.status(404).json({ error: 'No encontrado' });
    const c = decryptFields(client, 'crm_clients');
    const [{ data: pols }, { data: files }, { data: agent }] = await Promise.all([
      db.from('crm_policies').select('*').eq('client_id', dec.cid).order('created_at', { ascending: false }),
      db.from('crm_files').select('*').eq('client_id', dec.cid).order('created_at', { ascending: false }),
      db.from('crm_agents').select('nombre,telefono,email').eq('id', client.agent_id).maybeSingle(),
    ]);
    res.json({
      cliente: { nombre: c.nombre },
      asesor: agent || null,
      polizas: decryptRows(pols || [], 'crm_policies').map(p => ({
        id: p.id, plan: p.plan, poliza: p.poliza, tipo: p.tipo, prima: p.prima, forma_pago: p.forma_pago,
        suma_asegurada: p.suma_asegurada, estatus: p.estatus, fecha_emision: p.fecha_emision, fecha_renovacion: p.fecha_renovacion,
      })),
      archivos: (files || []).map(f => ({ id: f.id, nombre: f.nombre, categoria: f.categoria, bytes: f.bytes, created_at: f.created_at, url: signedFileUrl(f) })),
    });
  } catch { res.status(401).json({ error: 'Enlace inválido o expirado. Pide a tu asesor uno nuevo.' }); }
});

router.use(verifyToken);

const isAgency = (role) => ['superadmin', 'agencia', 'admin'].includes(role);

/* ── Bitácora de actividad (fire-and-forget; nunca bloquea la respuesta) ── */
function logActivity(req, action, entity, entityId, detail) {
  try {
    getDB().from('crm_activity').insert([{
      user_id: req.user.id, user_name: req.user.name || req.user.email, user_role: req.user.role,
      action, entity, entity_id: entityId != null ? String(entityId) : null, detail: detail || null,
    }]).then(({ error }) => { if (error) console.error('activity log:', error.message); });
  } catch (e) { console.error('activity log:', e.message); }
}

/* ── Tablas de bono PIR 2026 (del Business Review) ──
   Bandas por índice de conservación: <0.86 → 0%, ≥0.86, ≥0.90, ≥0.94 */
const BONO_TABLES = {
  NOVEL: {
    mensual:    [ { min: 143000, pct: [0.30, 0.35, 0.40] }, { min: 130000, pct: [0.25, 0.30, 0.35] }, { min: 118000, pct: [0.245, 0.25, 0.30] } ],
    trimestral: [ { min: 472000, pct: [0.35, 0.40, 0.45] }, { min: 431000, pct: [0.30, 0.35, 0.40] }, { min: 388000, pct: [0.275, 0.30, 0.35] } ],
  },
  'EN DESARROLLO': {
    mensual:    [ { min: 178000, pct: [0.25, 0.30, 0.38] }, { min: 147000, pct: [0.245, 0.25, 0.30] }, { min: 118000, pct: [0.22, 0.245, 0.25] } ],
    trimestral: [ { min: 713000, pct: [0.30, 0.35, 0.43] }, { min: 587000, pct: [0.275, 0.30, 0.35] }, { min: 472000, pct: [0.25, 0.275, 0.30] } ],
  },
};
BONO_TABLES.CONSOLIDADO = BONO_TABLES['EN DESARROLLO'];

function bandaConservacion(indice) {
  if (indice >= 0.94) return 2;
  if (indice >= 0.90) return 1;
  if (indice >= 0.86) return 0;
  return -1;
}

function calcularBono(cuaderno, periodo, prima, indice) {
  const tabla = (BONO_TABLES[cuaderno] || BONO_TABLES.NOVEL)[periodo];
  const banda = bandaConservacion(indice);
  if (banda < 0) return { rango: null, pct: 0, monto: 0 };
  for (let i = 0; i < tabla.length; i++) {
    if (prima >= tabla[i].min) {
      const pct = tabla[i].pct[banda];
      return { rango: i + 1, pct, monto: Math.round(prima * pct * 100) / 100 };
    }
  }
  return { rango: null, pct: 0, monto: 0 };
}

/* ── Helpers de scoping ── */
async function getOwnAgent(userId) {
  const db = getDB();
  const { data } = await db.from('crm_agents').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

// Devuelve el agent_id permitido para el request, o null si es agencia (sin restricción)
async function resolveScope(req, res) {
  if (isAgency(req.user.role)) return { restricted: false, agentId: null };
  const agent = await getOwnAgent(req.user.id);
  if (!agent) {
    res.status(403).json({ error: 'Tu usuario no tiene perfil de asesor en el CRM' });
    return null;
  }
  return { restricted: true, agentId: agent.id, agent };
}

/* ¿Puede este usuario editar datos (clientes/pólizas)? La administración siempre;
   los demás solo si el admin les otorgó el permiso users.crm_can_edit. */
async function canEditData(req) {
  if (isAgency(req.user.role)) return true;
  const { data } = await getDB().from('users').select('crm_can_edit').eq('id', req.user.id).maybeSingle();
  return !!(data && data.crm_can_edit);
}

/* Supabase trunca a 1000 filas por request: helper para traer todo paginado.
   `build` debe devolver un query NUEVO en cada llamada (los filtros se re-aplican). */
async function fetchAllRows(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const monthOf = (dateStr) => (dateStr ? parseInt(String(dateStr).slice(5, 7), 10) : null);
const yearOf = (dateStr) => (dateStr ? parseInt(String(dateStr).slice(0, 4), 10) : null);

/* ── KPIs de un conjunto de pólizas para un año ──
   idxOficial (crm_pru_polizas_indice vía computeIndice): índice de conservación
   oficial del Business Review Prudential. Cuando existe MANDA sobre lo derivado
   de crm_policies — es la única fuente que cuadra con el Excel de Prudential. */
function computeKpis(policies, goals, anio, pruPrimas = [], idxOficial = null) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    primaNueva: 0,        // pagada, tipo nueva
    primaRenovacion: 0,   // pagada, tipo renovacion
    meta: 0,
    pipeline: 0,          // en_tramite + pendiente_pago (por fecha emision/renovacion)
  }));

  let baseConservar = 0, baseConservada = 0, basePendiente = 0;

  for (const p of policies) {
    const prima = Number(p.prima) || 0;
    // Producción pagada por mes
    if (p.estatus === 'pagada' && yearOf(p.fecha_pago) === anio) {
      const m = monthOf(p.fecha_pago);
      if (m) {
        if (p.tipo === 'renovacion') months[m - 1].primaRenovacion += prima;
        else months[m - 1].primaNueva += prima;
      }
    }
    // Pipeline: pólizas vivas sin pago aplicado
    if (['en_tramite', 'pendiente_pago'].includes(p.estatus)) {
      const ref = p.fecha_renovacion && p.tipo === 'renovacion' ? p.fecha_renovacion : (p.fecha_emision || p.fecha_renovacion);
      const m = yearOf(ref) === anio ? monthOf(ref) : null;
      if (m) months[m - 1].pipeline += prima;
    }
    // Índice de conservación: renovaciones del año
    const renovYear = yearOf(p.fecha_renovacion);
    if (p.tipo === 'renovacion' && (renovYear === anio || (p.estatus === 'pagada' && yearOf(p.fecha_pago) === anio))) {
      baseConservar += prima;
      if (p.estatus === 'pagada') baseConservada += prima;
      else if (p.estatus === 'pendiente_pago') basePendiente += prima;
    }
  }

  /* Cortes oficiales Prudential (crm_pru_primas): la prima pagada inicial/
     renovación reportada por Prudential ES la venta real. Para un agente CON
     datos oficiales, el Business Review usa EXCLUSIVAMENTE los cortes: se
     descarta lo derivado de crm_policies, que puede traer renovaciones con
     fecha de pago futura y por lo tanto inflar la cartera (caso reportado por
     mesa de control: Gaby/Rodolfo con renovaciones de sep-dic contadas como ya
     pagadas). Sin datos oficiales, se conserva lo capturado en el CRM. */
  const tieneOficial = pruPrimas.some(pr => Number(pr.anio) === anio);
  if (tieneOficial) {
    for (const m of months) { m.primaNueva = 0; m.primaRenovacion = 0; }
    for (const pr of pruPrimas) {
      if (Number(pr.anio) !== anio) continue;
      const m = months[Number(pr.mes) - 1];
      if (!m) continue;
      m.primaNueva = Number(pr.prima_pagada_inicial) || 0;
      m.primaRenovacion = Number(pr.prima_pagada_renovacion) || 0;
    }
  }

  for (const g of goals) {
    if (g.anio === anio && g.mes >= 1 && g.mes <= 12) months[g.mes - 1].meta = Number(g.meta_prima) || 0;
  }

  const totalNueva = months.reduce((s, m) => s + m.primaNueva, 0);
  const totalRenovacion = months.reduce((s, m) => s + m.primaRenovacion, 0);
  const totalMeta = months.reduce((s, m) => s + m.meta, 0);
  const totalPipeline = months.reduce((s, m) => s + m.pipeline, 0);

  /* Índice de conservación: si hay corte oficial de Prudential, ese manda
     (base a conservar / conservada / pendiente vienen del detalle por póliza,
     crm_pru_polizas_indice). Solo sin oficial se usa lo derivado de crm_policies. */
  if (idxOficial) {
    baseConservar = idxOficial.baseAConservar || 0;
    baseConservada = idxOficial.baseConservada || 0;
    basePendiente = idxOficial.basePendiente || 0;
  }
  const indiceActual = baseConservar > 0 ? baseConservada / baseConservar : 1;
  const indiceProyectado = baseConservar > 0 ? (baseConservada + basePendiente) / baseConservar : 1;

  return {
    months,
    totales: {
      primaNueva: totalNueva,
      primaRenovacion: totalRenovacion,
      primaTotal: totalNueva + totalRenovacion,
      meta: totalMeta,
      pipeline: totalPipeline,
      cumplimiento: totalMeta > 0 ? (totalNueva / totalMeta) : null,
    },
    conservacion: {
      baseConservar,
      baseConservada,
      basePendiente,
      indiceActual,
      indiceProyectado,
    },
  };
}

/* Suma KPIs de varios agentes mes a mes (para los totales de la promotoría) */
function aggregateKpis(kpisList) {
  const months = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, primaNueva: 0, primaRenovacion: 0, meta: 0, pipeline: 0 }));
  const conservacion = { baseConservar: 0, baseConservada: 0, basePendiente: 0 };
  /* El cumplimiento debe comparar peras con peras: solo la prima nueva de los
     asesores que TIENEN meta capturada contra la suma de esas metas. Si no,
     el numerador (venta de TODA la promotoría) contra el denominador (metas de
     unos pocos) infla el % (ej. 214% con solo 3 metas capturadas de 26). */
  let nuevaConMeta = 0, agentesConMeta = 0;
  for (const k of kpisList) {
    k.months.forEach((m, i) => {
      months[i].primaNueva += m.primaNueva; months[i].primaRenovacion += m.primaRenovacion;
      months[i].meta += m.meta; months[i].pipeline += m.pipeline;
    });
    conservacion.baseConservar += k.conservacion.baseConservar;
    conservacion.baseConservada += k.conservacion.baseConservada;
    conservacion.basePendiente += k.conservacion.basePendiente;
    if ((k.totales?.meta || 0) > 0) { nuevaConMeta += k.totales.primaNueva || 0; agentesConMeta++; }
  }
  const totalNueva = months.reduce((s, m) => s + m.primaNueva, 0);
  const totalRenovacion = months.reduce((s, m) => s + m.primaRenovacion, 0);
  const totalMeta = months.reduce((s, m) => s + m.meta, 0);
  const totalPipeline = months.reduce((s, m) => s + m.pipeline, 0);
  return {
    months,
    totales: {
      primaNueva: totalNueva, primaRenovacion: totalRenovacion, primaTotal: totalNueva + totalRenovacion,
      meta: totalMeta, pipeline: totalPipeline,
      cumplimiento: totalMeta > 0 ? (nuevaConMeta / totalMeta) : null,
      primaNuevaConMeta: nuevaConMeta, agentesConMeta,
    },
    conservacion: {
      ...conservacion,
      indiceActual: conservacion.baseConservar > 0 ? conservacion.baseConservada / conservacion.baseConservar : 1,
      indiceProyectado: conservacion.baseConservar > 0 ? (conservacion.baseConservada + conservacion.basePendiente) / conservacion.baseConservar : 1,
    },
  };
}

/* ── Forecast: real + pipeline + run-rate de los últimos 3 meses con datos ── */
function computeForecast(kpis, anio) {
  const now = new Date();
  const currentMonth = now.getFullYear() === anio ? now.getMonth() + 1 : (now.getFullYear() > anio ? 12 : 0);
  const reales = kpis.months.map(m => m.primaNueva + m.primaRenovacion);
  const past = reales.slice(Math.max(0, currentMonth - 3), currentMonth).filter(v => v > 0);
  const runRate = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;

  return kpis.months.map((m, i) => {
    const mes = i + 1;
    const real = reales[i];
    let proyeccion;
    if (mes < currentMonth) proyeccion = real;
    else if (mes === currentMonth) proyeccion = Math.max(real + m.pipeline, real);
    else proyeccion = m.pipeline + runRate * 0.6; // meses futuros: pipeline programado + run-rate conservador
    return { mes, real, meta: m.meta, pipeline: m.pipeline, proyeccion: Math.round(proyeccion * 100) / 100 };
  });
}

/* ═══════════════ AGENTES ═══════════════ */

router.get('/agents', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  let q = db.from('crm_agents').select('*').order('nombre');
  if (scope.restricted) q = q.eq('id', scope.agentId);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ agents: data });
});

router.post('/agents', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede crear asesores' });
  const { clave, nombre, cuaderno, fecha_inicio_calculos, telefono, email, user_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  const db = getDB();
  const { data, error } = await db.from('crm_agents').insert([{ clave, nombre, cuaderno: cuaderno || 'NOVEL', fecha_inicio_calculos, telefono, email, user_id }]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', 'asesor', data[0].id, nombre);
  res.status(201).json({ agent: data[0] });
});

router.put('/agents/:id', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede editar asesores' });
  const allowed = ['clave', 'nombre', 'cuaderno', 'fecha_inicio_calculos', 'estatus', 'telefono', 'email', 'user_id', 'fireflies_api_key',
    'alta_pru', 'alta_il', 'activo_fsc', 'clasificacion'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  patch.updated_at = new Date().toISOString();
  const db = getDB();
  const { data, error } = await db.from('crm_agents').update(patch).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'editar', 'asesor', req.params.id, data[0]?.nombre);
  res.json({ agent: data[0] });
});

/* ═══════════════ CLIENTES ═══════════════ */

router.get('/clients', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  try {
    const data = await fetchAllRows(() => {
      let q = db.from('crm_clients').select('*, crm_agents(nombre, clave)').order('created_at', { ascending: false });
      if (scope.restricted) q = q.eq('agent_id', scope.agentId);
      else if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
      if (req.query.etapa) q = q.eq('etapa', req.query.etapa);
      if (req.query.q) q = q.ilike('nombre', `%${req.query.q}%`);
      return q;
    });
    res.json({ clients: decryptRows(data, 'crm_clients') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/clients/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: client, error } = await db.from('crm_clients').select('*, crm_agents(nombre, clave)').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (scope.restricted && client.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este cliente' });

  const [{ data: policies }, { data: reminders }, { data: files }] = await Promise.all([
    db.from('crm_policies').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    db.from('crm_reminders').select('*').eq('client_id', client.id).order('fecha'),
    db.from('crm_files').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
  ]);
  res.json({
    client: decryptFields(client, 'crm_clients'),
    policies: decryptRows(policies, 'crm_policies'),
    reminders: decryptRows(reminders, 'crm_reminders'),
    files: (files || []).map(f => ({ ...f, url: signedFileUrl(f) })),
  });
});

router.post('/clients', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const b = req.body;
  if (!b.nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  const agent_id = scope.restricted ? scope.agentId : b.agent_id;
  if (!agent_id) return res.status(400).json({ error: 'agent_id es requerido' });
  const db = getDB();
  const { data, error } = await db.from('crm_clients').insert([encryptFields({
    agent_id, nombre: b.nombre, email: b.email, telefono: b.telefono, rfc: b.rfc,
    fecha_nacimiento: b.fecha_nacimiento || null, ocupacion: b.ocupacion, empresa: b.empresa,
    direccion: b.direccion, etapa: b.etapa || 'prospecto', origen: b.origen || 'referido', notas: b.notas,
    aseguradora: b.aseguradora || 'PRU',
    fecha_nacimiento_conyuge: b.fecha_nacimiento_conyuge || null, hijos: b.hijos || null,
    motivo_no_compra: b.motivo_no_compra || null,
    ingreso_mensual: b.ingreso_mensual || null, gasto_mensual: b.gasto_mensual || null,
    saldo_afore: b.saldo_afore || null, retiro_deseado: b.retiro_deseado || null, edad_retiro_deseada: b.edad_retiro_deseada || null,
  }, 'crm_clients')]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', 'cliente', data[0].id, b.etapa || 'prospecto');
  res.status(201).json({ client: decryptFields(data[0], 'crm_clients') });
});

router.put('/clients/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: existing } = await db.from('crm_clients').select('agent_id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (scope.restricted && existing.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este cliente' });
  if (!(await canEditData(req))) return res.status(403).json({ error: 'No tienes permiso de edición. Pídeselo a tu administrador.' });
  const allowed = ['nombre', 'email', 'telefono', 'rfc', 'fecha_nacimiento', 'ocupacion', 'empresa', 'direccion', 'etapa', 'origen', 'notas', 'agent_id',
    'ingreso_mensual', 'gasto_mensual', 'saldo_afore', 'retiro_deseado', 'edad_retiro_deseada', 'aseguradora',
    'fecha_nacimiento_conyuge', 'hijos', 'motivo_no_compra'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k] === '' ? null : req.body[k];
  if (scope.restricted) delete patch.agent_id;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await db.from('crm_clients').update(encryptFields(patch, 'crm_clients')).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'editar', 'cliente', req.params.id, patch.etapa || null);
  res.json({ client: decryptFields(data[0], 'crm_clients') });
});

router.delete('/clients/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: existing } = await db.from('crm_clients').select('agent_id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (scope.restricted && existing.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este cliente' });
  if (!(await canEditData(req))) return res.status(403).json({ error: 'No tienes permiso de edición. Pídeselo a tu administrador.' });
  const { error } = await db.from('crm_clients').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'eliminar', 'cliente', req.params.id, null);
  res.json({ ok: true });
});

/* ═══════════════ PÓLIZAS ═══════════════ */

router.get('/policies', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  try {
    const data = await fetchAllRows(() => {
      let q = db.from('crm_policies').select('*, crm_clients(nombre, origen), crm_agents(nombre, clave)').order('created_at', { ascending: false });
      if (scope.restricted) q = q.eq('agent_id', scope.agentId);
      else if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
      if (req.query.estatus) q = q.eq('estatus', req.query.estatus);
      if (req.query.client_id) q = q.eq('client_id', req.query.client_id);
      return q;
    });
    const { data: ultima } = await db.from('crm_import_runs').select('*').eq('tipo', 'reporte-polizas').order('created_at', { ascending: false }).limit(1);
    res.json({ policies: decryptRows(data, 'crm_policies'), ultimaImportacion: (ultima && ultima[0]) || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/policies', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const b = req.body;
  if (!b.client_id) return res.status(400).json({ error: 'client_id es requerido' });
  const db = getDB();
  const { data: client } = await db.from('crm_clients').select('agent_id').eq('id', b.client_id).maybeSingle();
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (scope.restricted && client.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este cliente' });
  const { data, error } = await db.from('crm_policies').insert([encryptFields({
    client_id: b.client_id, agent_id: client.agent_id, poliza: b.poliza, plan: b.plan,
    tipo: b.tipo || 'nueva', prima: b.prima || 0, forma_pago: b.forma_pago || 'anual',
    suma_asegurada: b.suma_asegurada || null, fecha_emision: b.fecha_emision || null,
    fecha_pago: b.fecha_pago || null, fecha_renovacion: b.fecha_renovacion || null,
    estatus: b.estatus || 'en_tramite', moneda: b.moneda || 'MXN', notas: b.notas,
    aseguradora: b.aseguradora || 'PRU', motivo_compra: b.motivo_compra || null,
    beneficiarios: b.beneficiarios || null,
    comision_pct: b.comision_pct || null, comision_monto: b.comision_monto || null,
    comision_estatus: b.comision_estatus || 'pendiente',
  }, 'crm_policies')]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', 'poliza', data[0].id, b.estatus || 'en_tramite');
  res.status(201).json({ policy: decryptFields(data[0], 'crm_policies') });
});

router.put('/policies/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: existing } = await db.from('crm_policies').select('agent_id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Póliza no encontrada' });
  if (scope.restricted && existing.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a esta póliza' });
  if (!(await canEditData(req))) return res.status(403).json({ error: 'No tienes permiso de edición. Pídeselo a tu administrador.' });
  const allowed = ['poliza', 'plan', 'tipo', 'prima', 'forma_pago', 'suma_asegurada', 'fecha_emision', 'fecha_pago', 'fecha_renovacion', 'estatus', 'moneda', 'notas',
    'comision_pct', 'comision_monto', 'comision_estatus', 'comision_fecha', 'comision_notas', 'aseguradora', 'client_id', 'motivo_compra', 'beneficiarios'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k] === '' ? null : req.body[k];
  if (patch.client_id) {
    const { data: nuevoCliente } = await db.from('crm_clients').select('agent_id').eq('id', patch.client_id).maybeSingle();
    if (!nuevoCliente) return res.status(404).json({ error: 'El cliente destino no existe' });
    if (scope.restricted && nuevoCliente.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso al cliente destino' });
    patch.agent_id = nuevoCliente.agent_id;
  }
  patch.updated_at = new Date().toISOString();
  const { data, error } = await db.from('crm_policies').update(encryptFields(patch, 'crm_policies')).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'editar', 'poliza', req.params.id, patch.estatus || null);
  res.json({ policy: decryptFields(data[0], 'crm_policies') });
});

router.delete('/policies/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: existing } = await db.from('crm_policies').select('agent_id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Póliza no encontrada' });
  if (scope.restricted && existing.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a esta póliza' });
  if (!(await canEditData(req))) return res.status(403).json({ error: 'No tienes permiso de edición. Pídeselo a tu administrador.' });
  const { error } = await db.from('crm_policies').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'eliminar', 'poliza', req.params.id, null);
  res.json({ ok: true });
});

/* ═══════ Carga diaria del Reporte de pólizas + export + bitácora ═══════ */

const XLSX = require('xlsx');
const { importarReporte } = require('../utils/importPolizasReporte');

/* Sube el xlsx del reporte Prudential: actualiza/inserta sin duplicar y
   registra quién y cuándo (crm_import_runs). Solo administración. */
router.post('/polizas/import', upload.single('file'), async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede cargar el reporte' });
  if (!req.file) return res.status(400).json({ error: 'Adjunta el xlsx del Reporte de pólizas' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const resumen = await importarReporte(getDB(), {
      workbook, archivo: req.file.originalname,
      usuario: req.user.name || req.user.email, userId: req.user.id,
    });
    logActivity(req, 'importar', 'reporte-polizas', null, `${resumen.filas} filas · ${resumen.insertadas} nuevas · ${resumen.canceladas} canceladas`);
    res.json({ ok: true, resumen });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Última carga del reporte (quién, cuándo y resumen) */
router.get('/polizas/last-import', async (req, res) => {
  const { data, error } = await getDB().from('crm_import_runs').select('*')
    .eq('tipo', 'reporte-polizas').order('created_at', { ascending: false }).limit(1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ultima: (data && data[0]) || null });
});

/* Exporta la cartera de pólizas (misma información de la página) a Excel */
router.get('/polizas/export', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  try {
    const db = getDB();
    const data = await fetchAllRows(() => {
      let q = db.from('crm_policies').select('*, crm_clients(nombre, origen), crm_agents(nombre, clave)').order('created_at', { ascending: false });
      if (scope.restricted) q = q.eq('agent_id', scope.agentId);
      return q;
    });
    const filas = decryptRows(data, 'crm_policies').map(p => ({
      'Póliza': p.poliza || '',
      'Cliente': p.crm_clients?.nombre || '',
      'Asesor': p.crm_agents?.nombre || '',
      'Clave': p.crm_agents?.clave || '',
      'Aseguradora': p.aseguradora || 'PRU',
      'Plan': p.plan || '',
      'Tipo': p.tipo || '',
      'Prima': Number(p.prima) || 0,
      'Moneda': p.moneda || '',
      'Estatus': p.estatus || '',
      'Fecha emisión': p.fecha_emision || '',
      'Pagada hasta': p.fecha_pago || '',
      'Renovación': p.fecha_renovacion || '',
      'Motivo de compra': p.motivo_compra || '',
      'Notas': p.notas || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Polizas');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    logActivity(req, 'exportar', 'polizas', null, `${filas.length} pólizas`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Polizas_CRM_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════ Cartera segmentada por año de emisión + comparativo histórico ═══════
   Prima nueva/arrastre = pólizas emitidas en los últimos 12 meses.
   1ª renovación = 12–24 meses, 2ª = 24–36, etc. (bloques anuales). */
router.get('/cartera/resumen', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  try {
    const db = getDB();
    const [policies, clients, { data: pruPrimasAll }] = await Promise.all([
      fetchAllRows(() => {
        let q = db.from('crm_policies').select('id, agent_id, client_id, aseguradora, estatus, tipo, prima, moneda, fecha_emision, fecha_renovacion');
        if (scope.restricted) q = q.eq('agent_id', scope.agentId);
        return q.order('id');
      }),
      fetchAllRows(() => {
        let q = db.from('crm_clients').select('id, agent_id, origen');
        if (scope.restricted) q = q.eq('agent_id', scope.agentId);
        return q.order('id');
      }),
      scope.restricted
        ? (scope.agent?.clave
          ? db.from('crm_pru_primas').select('clave, anio, mes, prima_pagada_inicial, prima_pagada_renovacion').eq('clave', scope.agent.clave)
          : Promise.resolve({ data: [] }))
        : db.from('crm_pru_primas').select('clave, anio, mes, prima_pagada_inicial, prima_pagada_renovacion'),
    ]);
    const contenedores = new Set(clients.filter(c => c.origen === 'Prudential' || c.origen === 'Insignia').map(c => c.id));
    const clientesReales = clients.filter(c => !contenedores.has(c.id));

    const hoy = new Date();
    const mesesDesde = (f) => {
      if (!f) return null;
      const d = new Date(`${String(f).slice(0, 10)}T12:00:00`);
      return (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
    };

    /* Bloques por antigüedad de emisión */
    const bloques = new Map(); // n → { polizas, prima, clientes:Set, estatus:{} }
    const bloqueDe = (p) => {
      const m = mesesDesde(p.fecha_emision);
      if (m === null) return 'sin_fecha';
      return Math.max(0, Math.floor(m / 12));
    };
    for (const p of policies) {
      const b = bloqueDe(p);
      if (!bloques.has(b)) bloques.set(b, { bloque: b, polizas: 0, prima: 0, clientes: new Set(), estatus: {} });
      const g = bloques.get(b);
      g.polizas++;
      g.prima += Number(p.prima) || 0;
      if (p.client_id && !contenedores.has(p.client_id)) g.clientes.add(p.client_id);
      g.estatus[p.estatus] = (g.estatus[p.estatus] || 0) + 1;
    }
    const etiqueta = (b) => b === 'sin_fecha' ? 'Sin fecha de emisión'
      : b === 0 ? 'Año 1 — prima nueva / arrastre (0–12 meses)'
      : `${b}ª renovación (${b * 12}–${(b + 1) * 12} meses)`;
    const segmentos = [...bloques.values()]
      .sort((a, b) => (a.bloque === 'sin_fecha' ? 99 : a.bloque) - (b.bloque === 'sin_fecha' ? 99 : b.bloque))
      .map(g => ({ ...g, etiqueta: etiqueta(g.bloque), prima: Math.round(g.prima * 100) / 100, clientes: g.clientes.size }));

    /* Serie histórica por año-mes de emisión (para el comparativo) */
    const serie = new Map(); // 'YYYY-MM' → { anio, mes, polizas, prima, vigentes }
    for (const p of policies) {
      if (!p.fecha_emision) continue;
      const anio = yearOf(p.fecha_emision), mes = monthOf(p.fecha_emision);
      if (!anio || !mes) continue;
      const k = `${anio}-${mes}`;
      if (!serie.has(k)) serie.set(k, { anio, mes, polizas: 0, prima: 0, vigentes: 0 });
      const s = serie.get(k);
      s.polizas++;
      s.prima += Number(p.prima) || 0;
      if (['pagada', 'pendiente_pago'].includes(p.estatus)) s.vigentes++;
    }

    const vigentes = policies.filter(p => ['pagada', 'pendiente_pago'].includes(p.estatus));

    /* Prima nueva / arrastre según la definición de Flavio: lo pagado inicial
       en los CORTES Prudential de los últimos 12 meses (una póliza vendida de
       ago-2025 a hoy). Las ventas recientes aún no aparecen en el índice de
       conservación por fecha de emisión, así que la fuente es crm_pru_primas. */
    const hace12m = new Date(hoy); hace12m.setMonth(hoy.getMonth() - 12);
    const enVentana = (pr) => new Date(pr.anio, pr.mes - 1, 28) >= hace12m;
    const cortes12m = (pruPrimasAll || []).filter(enVentana);
    const arrastre12m = Math.round(cortes12m.reduce((s, p) => s + (Number(p.prima_pagada_inicial) || 0), 0) * 100) / 100;
    const renovacion12m = Math.round(cortes12m.reduce((s, p) => s + (Number(p.prima_pagada_renovacion) || 0), 0) * 100) / 100;

    res.json({
      totales: {
        polizas: policies.length,
        vigentes: vigentes.length,
        canceladas: policies.filter(p => p.estatus === 'cancelada').length,
        clientes: clientesReales.length,
        primaNueva: arrastre12m,
        primaRenovacion: renovacion12m,
        baseCarteraRenovacion: Math.round(policies.filter(p => typeof bloqueDe(p) === 'number' && bloqueDe(p) > 0).reduce((s, p) => s + (Number(p.prima) || 0), 0) * 100) / 100,
      },
      segmentos,
      serie: [...serie.values()].sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════ METAS ═══════════════ */

router.get('/goals', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  const db = getDB();
  let q = db.from('crm_goals').select('*').eq('anio', anio).order('mes');
  if (scope.restricted) q = q.eq('agent_id', scope.agentId);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ goals: data });
});

// Upsert masivo de metas: [{agent_id, anio, mes, meta_prima}]
router.put('/goals', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede editar metas' });
  const goals = Array.isArray(req.body.goals) ? req.body.goals : [];
  if (!goals.length) return res.status(400).json({ error: 'goals vacío' });
  const db = getDB();
  const rows = goals.map(g => ({
    agent_id: g.agent_id, anio: g.anio, mes: g.mes,
    meta_prima: Number(g.meta_prima) || 0, updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from('crm_goals').upsert(rows, { onConflict: 'agent_id,anio,mes' });
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'editar', 'metas', null, `${rows.length} metas`);
  res.json({ ok: true, count: rows.length });
});

/* ═══════════════ RECORDATORIOS ═══════════════ */

router.get('/reminders', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  let q = db.from('crm_reminders').select('*, crm_clients(nombre, telefono), crm_agents(nombre)').order('fecha');
  if (scope.restricted) q = q.eq('agent_id', scope.agentId);
  else if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
  if (req.query.estatus) q = q.eq('estatus', req.query.estatus);
  if (req.query.from) q = q.gte('fecha', req.query.from);
  if (req.query.to) q = q.lte('fecha', req.query.to);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reminders: decryptRows(data, 'crm_reminders') });
});

router.post('/reminders', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const b = req.body;
  if (!b.titulo || !b.fecha) return res.status(400).json({ error: 'titulo y fecha son requeridos' });
  const agent_id = scope.restricted ? scope.agentId : (b.agent_id || null);
  if (!agent_id) return res.status(400).json({ error: 'agent_id es requerido' });
  const db = getDB();
  const { data, error } = await db.from('crm_reminders').insert([encryptFields({
    agent_id, client_id: b.client_id || null, policy_id: b.policy_id || null,
    titulo: b.titulo, descripcion: b.descripcion, tipo: b.tipo || 'seguimiento',
    fecha: b.fecha, hora: b.hora || null, estatus: 'pendiente',
  }, 'crm_reminders')]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', 'recordatorio', data[0].id, b.tipo || 'seguimiento');
  res.status(201).json({ reminder: decryptFields(data[0], 'crm_reminders') });
});

router.put('/reminders/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: existing } = await db.from('crm_reminders').select('agent_id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  if (scope.restricted && existing.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso' });
  const allowed = ['titulo', 'descripcion', 'tipo', 'fecha', 'hora', 'estatus', 'client_id', 'policy_id'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k] === '' ? null : req.body[k];
  patch.updated_at = new Date().toISOString();
  const { data, error } = await db.from('crm_reminders').update(encryptFields(patch, 'crm_reminders')).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'editar', 'recordatorio', req.params.id, patch.estatus || null);
  res.json({ reminder: decryptFields(data[0], 'crm_reminders') });
});

router.delete('/reminders/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: existing } = await db.from('crm_reminders').select('agent_id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  if (scope.restricted && existing.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso' });
  const { error } = await db.from('crm_reminders').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'eliminar', 'recordatorio', req.params.id, null);
  res.json({ ok: true });
});

/* ── Pipeline accionable: "próxima acción obligatoria" ──────────────────────
   Cada prospecto en una etapa activa DEBE tener una próxima acción agendada.
   Cruza crm_clients (etapas de pipeline) con sus recordatorios pendientes y
   clasifica: sin_accion (hueco — la etapa sin siguiente paso), vencidas, hoy,
   proximas. Es el núcleo del "Pipeline accionable" de Powing, sin schema nuevo:
   la acción se agenda como un recordatorio normal. Asesor ve lo suyo; agencia
   ve todo o filtra por ?agent_id. */
const ETAPAS_ACTIVAS = ['prospecto', 'cita_agendada', 'cita_realizada', 'presentacion', 'solicitud'];
router.get('/pipeline/acciones', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  try {
    const clients = await fetchAllRows(() => {
      let q = db.from('crm_clients').select('id, agent_id, nombre, telefono, etapa, crm_agents(nombre)').in('etapa', ETAPAS_ACTIVAS).order('id');
      if (scope.restricted) q = q.eq('agent_id', scope.agentId);
      else if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
      return q;
    });
    const ids = clients.map(c => c.id);
    const rems = ids.length ? await fetchAllRows(() =>
      db.from('crm_reminders').select('id, client_id, titulo, tipo, fecha, estatus').in('client_id', ids).neq('estatus', 'completado').order('fecha')) : [];
    /* próximo recordatorio pendiente por cliente (el de fecha más temprana) */
    const nextByClient = new Map();
    for (const r of decryptRows(rems, 'crm_reminders')) {
      if (!r.fecha) continue;
      const prev = nextByClient.get(r.client_id);
      if (!prev || r.fecha < prev.fecha) nextByClient.set(r.client_id, r);
    }
    const hoyStr = new Date().toISOString().slice(0, 10);
    const grupos = { sin_accion: [], vencidas: [], hoy: [], proximas: [] };
    for (const c of decryptRows(clients, 'crm_clients')) {
      const nx = nextByClient.get(c.id);
      const item = {
        id: c.id, nombre: c.nombre, telefono: c.telefono || null, etapa: c.etapa,
        agente: c.crm_agents?.nombre || null,
        accion: nx ? { titulo: nx.titulo, tipo: nx.tipo, fecha: nx.fecha } : null,
      };
      if (!nx) grupos.sin_accion.push(item);
      else if (nx.fecha < hoyStr) grupos.vencidas.push(item);
      else if (nx.fecha === hoyStr) grupos.hoy.push(item);
      else grupos.proximas.push(item);
    }
    grupos.vencidas.sort((a, b) => (a.accion?.fecha || '').localeCompare(b.accion?.fecha || ''));
    grupos.proximas.sort((a, b) => (a.accion?.fecha || '').localeCompare(b.accion?.fecha || ''));
    res.json({
      resumen: {
        total: clients.length, sin_accion: grupos.sin_accion.length,
        vencidas: grupos.vencidas.length, hoy: grupos.hoy.length, proximas: grupos.proximas.length,
      },
      grupos,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════ ARCHIVOS (Cloudinary) ═══════════════ */

router.post('/files', upload.single('file'), async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido (campo "file")' });
  const { client_id, policy_id, categoria } = req.body;
  const db = getDB();

  let agent_id = scope.restricted ? scope.agentId : null;
  if (client_id) {
    const { data: client } = await db.from('crm_clients').select('agent_id').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (scope.restricted && client.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este cliente' });
    agent_id = client.agent_id;
  }

  try {
    // type:'authenticated' → el archivo NO es público; solo se sirve con URL firmada
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'fsc-crm', resource_type: 'auto', type: 'authenticated', use_filename: true, filename_override: req.file.originalname },
        (err, r) => (err ? reject(err) : resolve(r))
      );
      stream.end(req.file.buffer);
    });

    const { data, error } = await db.from('crm_files').insert([{
      agent_id, client_id: client_id || null, policy_id: policy_id || null,
      nombre: req.file.originalname, url: result.secure_url, public_id: result.public_id,
      formato: result.format || req.file.mimetype, bytes: result.bytes || req.file.size,
      resource_type: result.resource_type || 'raw',
      categoria: categoria || 'general', uploaded_by: req.user.id,
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req, 'subir', 'archivo', data[0].id, req.file.originalname);
    res.status(201).json({ file: { ...data[0], url: signedFileUrl(data[0]) } });
  } catch (err) {
    console.error('Cloudinary upload:', err.message);
    res.status(500).json({ error: 'Error al subir el archivo: ' + err.message });
  }
});

router.get('/files', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  let q = db.from('crm_files').select('*, crm_clients(nombre)').order('created_at', { ascending: false });
  if (scope.restricted) q = q.eq('agent_id', scope.agentId);
  if (req.query.client_id) q = q.eq('client_id', req.query.client_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ files: (data || []).map(f => ({ ...f, url: signedFileUrl(f) })) });
});

router.delete('/files/:id', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  const { data: file } = await db.from('crm_files').select('*').eq('id', req.params.id).maybeSingle();
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
  if (scope.restricted && file.agent_id !== scope.agentId) return res.status(403).json({ error: 'Sin acceso' });
  if (file.public_id) {
    try { await cloudinary.uploader.destroy(file.public_id, { resource_type: file.resource_type || 'raw', type: 'authenticated' }); } catch { /* no-fatal */ }
  }
  const { error } = await db.from('crm_files').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'eliminar', 'archivo', req.params.id, file.nombre);
  res.json({ ok: true });
});

/* ═══════════════ RECORDATORIOS AUTOMÁTICOS (cron) ═══════════════
   Genera recordatorios de renovación (30 días antes) y cumpleaños (7 días
   antes) + notificación in-app al asesor. Envío WhatsApp al asesor solo si
   CRM_WA_REMINDERS_ENABLED=true (apagado por default). */

async function sendWhatsAppToAgent(phone, text) {
  const WA_PHONE_ID = process.env.WA_PHONE_ID;
  const WA_TOKEN = process.env.WA_TOKEN;
  if (!WA_PHONE_ID || !WA_TOKEN) throw new Error('WhatsApp API no configurada');
  const res = await fetch(`https://graph.facebook.com/v22.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

router.post('/auto-reminders', async (req, res) => {
  if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo administración o cron interno' });
  }
  const db = getDB();
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const todayStr = iso(today);
  const in30 = iso(new Date(today.getTime() + 30 * 86400000));
  const created = { renovaciones: 0, cumpleanos: 0, notificaciones: 0, whatsapp: 0 };

  const [{ data: agents }, { data: clients }, { data: existing }] = await Promise.all([
    db.from('crm_agents').select('*').eq('estatus', 'ACTIVO'),
    db.from('crm_clients').select('id, agent_id, nombre, fecha_nacimiento'),
    db.from('crm_reminders').select('client_id, policy_id, tipo, fecha').gte('fecha', iso(new Date(today.getTime() - 45 * 86400000))),
  ]);
  const agentById = Object.fromEntries((agents || []).map(a => [a.id, a]));
  const clientById = Object.fromEntries((clients || []).map(c => [c.id, c]));
  const newReminders = [];

  // ── Renovaciones que vencen en ≤30 días sin recordatorio previo ──
  const { data: renewals } = await db.from('crm_policies')
    .select('id, client_id, agent_id, plan, poliza, prima, fecha_renovacion, estatus')
    .in('estatus', ['pagada', 'pendiente_pago'])
    .gte('fecha_renovacion', todayStr).lte('fecha_renovacion', in30);
  for (const p of (renewals || [])) {
    if (!agentById[p.agent_id]) continue;
    const dup = (existing || []).some(r => r.policy_id === p.id && r.tipo === 'renovacion');
    if (dup) continue;
    const cliente = clientById[p.client_id];
    newReminders.push(encryptFields({
      agent_id: p.agent_id, client_id: p.client_id, policy_id: p.id,
      titulo: `Renovación ${p.plan || 'póliza'} — ${cliente?.nombre || 'cliente'}`,
      descripcion: `Vence el ${p.fecha_renovacion}. Prima $${Number(p.prima).toLocaleString('es-MX')}. Generado automáticamente.`,
      tipo: 'renovacion', fecha: todayStr, estatus: 'pendiente',
    }, 'crm_reminders'));
    created.renovaciones++;
  }

  // ── Cumpleaños en los próximos 7 días ──
  const { decryptValue } = require('../utils/cryptoFields');
  for (const c of (clients || [])) {
    if (!agentById[c.agent_id]) continue;
    const fnac = decryptValue(c.fecha_nacimiento);
    if (!fnac || !/^\d{4}-\d{2}-\d{2}/.test(fnac)) continue;
    const [, mm, dd] = fnac.slice(0, 10).split('-');
    let bday = new Date(`${today.getFullYear()}-${mm}-${dd}T12:00:00`);
    if (iso(bday) < todayStr) bday = new Date(`${today.getFullYear() + 1}-${mm}-${dd}T12:00:00`);
    const diff = (bday - today) / 86400000;
    if (diff < 0 || diff > 7) continue;
    const bdayStr = iso(bday);
    const dup = (existing || []).some(r => r.client_id === c.id && r.tipo === 'cumpleanos' && r.fecha === bdayStr);
    if (dup) continue;
    newReminders.push(encryptFields({
      agent_id: c.agent_id, client_id: c.id, policy_id: null,
      titulo: `Cumpleaños de ${c.nombre}`,
      descripcion: 'Enviar felicitación. Generado automáticamente.',
      tipo: 'cumpleanos', fecha: bdayStr, estatus: 'pendiente',
    }, 'crm_reminders'));
    created.cumpleanos++;
  }

  if (newReminders.length) {
    const { error } = await db.from('crm_reminders').insert(newReminders);
    if (error) return res.status(500).json({ error: error.message });
  }

  // ── Notificación in-app por asesor + WhatsApp opcional ──
  const byAgent = {};
  for (const r of newReminders) byAgent[r.agent_id] = (byAgent[r.agent_id] || 0) + 1;
  for (const [agentId, count] of Object.entries(byAgent)) {
    const agent = agentById[agentId];
    if (agent?.user_id) {
      await db.from('notifications').insert([{
        user_id: agent.user_id, type: 'crm_reminder',
        message: `🔔 CRM: tienes ${count} recordatorio(s) nuevo(s) (renovaciones/cumpleaños)`,
        link: '/admin/crm-recordatorios',
      }]);
      created.notificaciones++;
    }
    if (process.env.CRM_WA_REMINDERS_ENABLED === 'true' && agent?.telefono) {
      try {
        await sendWhatsAppToAgent(agent.telefono.replace(/\D/g, ''),
          `🔔 CRM Finance S-Cool: tienes ${count} recordatorio(s) nuevo(s). Revisa: renovaciones próximas y cumpleaños de clientes.`);
        created.whatsapp++;
      } catch (e) { console.error('WA recordatorio asesor:', e.message); }
    }
  }

  res.json({ ok: true, ...created });
});

/* ═══════════════ DASHBOARD / KPIs / FORECAST ═══════════════ */

async function loadAgentData(db, anio, agentIds = null) {
  let agentsQ = db.from('crm_agents').select('*').order('nombre');
  if (agentIds) agentsQ = agentsQ.in('id', agentIds);
  const { data: agentsRaw } = await agentsQ;
  /* El personal administrativo no es asesor: fuera del ranking y de los KPIs */
  const agents = (agentsRaw || []).filter(a => a.clasificacion !== 'administrativo');
  const ids = (agents || []).map(a => a.id);
  if (!ids.length) return { agents: [], policies: [], goals: [], clients: [], pruPrimas: [], indiceOficial: {} };

  const claves = (agents || []).map(a => a.clave).filter(Boolean);
  const [policies, clients, { data: goals }, { data: pruPrimas }, pruPolizas] = await Promise.all([
    fetchAllRows(() => db.from('crm_policies').select('*').in('agent_id', ids).order('id')),
    fetchAllRows(() => db.from('crm_clients').select('id, agent_id, etapa, origen').in('agent_id', ids).order('id')),
    db.from('crm_goals').select('*').eq('anio', anio).in('agent_id', ids),
    claves.length ? db.from('crm_pru_primas').select('*').eq('anio', anio).in('clave', claves) : Promise.resolve({ data: [] }),
    claves.length ? fetchAllRows(() => db.from('crm_pru_polizas_indice').select('clave, base_a_conservar_mxn, base_conservada_mxn, estatus_conservacion').in('clave', claves).order('clave')) : Promise.resolve([]),
  ]);
  /* Índice de conservación oficial por clave (fuente de verdad del Business
     Review). Un mismo agente puede traer varios cortes; el último periodo es el
     vigente, pero el detalle importado ya trae solo el corte actual. */
  const polizasPorClave = {};
  for (const p of (pruPolizas || [])) (polizasPorClave[p.clave] = polizasPorClave[p.clave] || []).push(p);
  const indiceOficial = {};
  for (const clave of Object.keys(polizasPorClave)) indiceOficial[clave] = computeIndice(polizasPorClave[clave]);
  return { agents: agents || [], policies, goals: goals || [], clients, pruPrimas: pruPrimas || [], indiceOficial };
}

function buildAgentSummary(agent, policies, goals, clients, anio, pruPrimas = [], indiceOficial = {}) {
  const own = policies.filter(p => p.agent_id === agent.id);
  const ownGoals = goals.filter(g => g.agent_id === agent.id);
  /* Sin contenedores "Cartera Prudential/Insignia": son bolsas técnicas, no
     clientes — así "Clientes en cartera" cuadra con la sección Cartera. */
  const ownClients = clients.filter(c => c.agent_id === agent.id && c.origen !== 'Prudential' && c.origen !== 'Insignia');
  const kpis = computeKpis(own, ownGoals, anio, pruPrimas.filter(pr => pr.clave && pr.clave === agent.clave), indiceOficial[agent.clave] || null);
  const forecast = computeForecast(kpis, anio);

  // Bonos: trimestre actual
  const now = new Date();
  const q = now.getFullYear() === anio ? Math.floor(now.getMonth() / 3) : 3;
  const qMonths = [q * 3 + 1, q * 3 + 2, q * 3 + 3];
  const primaTrim = kpis.months.filter(m => qMonths.includes(m.mes)).reduce((s, m) => s + m.primaNueva, 0);
  const bonoTrim = calcularBono(agent.cuaderno, 'trimestral', primaTrim, kpis.conservacion.indiceProyectado);
  const primaMesActual = now.getFullYear() === anio ? (kpis.months[now.getMonth()]?.primaNueva || 0) : 0;
  const bonoMensual = calcularBono(agent.cuaderno, 'mensual', primaMesActual, kpis.conservacion.indiceProyectado);

  const funnel = {};
  for (const c of ownClients) funnel[c.etapa] = (funnel[c.etapa] || 0) + 1;

  return {
    agent,
    kpis,
    forecast,
    bonos: {
      trimestre: `${q + 1}Q ${anio}`,
      primaTrimestre: primaTrim,
      bonoTrimestral: bonoTrim,
      primaMesActual,
      bonoMensual,
    },
    clientes: { total: ownClients.length, funnel },
  };
}

// Tablero general (agencia ve todos; asesor recibe solo el suyo)
router.get('/dashboard', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  const db = getDB();
  const { agents, policies, goals, clients, pruPrimas, indiceOficial } = await loadAgentData(db, anio, scope.restricted ? [scope.agentId] : null);

  const porAgente = agents.map(a => buildAgentSummary(a, policies, goals, clients, anio, pruPrimas, indiceOficial));

  // Totales de la promotoría: suma de los meses por agente (respeta los cortes Prudential)
  const globalKpis = aggregateKpis(porAgente.map(a => a.kpis));
  const globalForecast = computeForecast(globalKpis, anio);

  // Recordatorios próximos (7 días)
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let remQ = db.from('crm_reminders').select('*, crm_clients(nombre), crm_agents(nombre)').eq('estatus', 'pendiente').gte('fecha', today).lte('fecha', in7).order('fecha').limit(20);
  if (scope.restricted) remQ = remQ.eq('agent_id', scope.agentId);
  const { data: upcoming } = await remQ;

  res.json({ anio, porAgente, global: { kpis: globalKpis, forecast: globalForecast }, proximosRecordatorios: decryptRows(upcoming, 'crm_reminders') });
});

// Detalle de un agente (Mi Tablero / drill-down de admin)
router.get('/agents/:id/summary', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const agentId = parseInt(req.params.id);
  if (scope.restricted && agentId !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este asesor' });
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  const db = getDB();
  const { agents, policies, goals, clients, pruPrimas, indiceOficial } = await loadAgentData(db, anio, [agentId]);
  if (!agents.length) return res.status(404).json({ error: 'Asesor no encontrado' });
  res.json({ anio, ...buildAgentSummary(agents[0], policies, goals, clients, anio, pruPrimas, indiceOficial) });
});

/* ═══════════════ CONSULTORES (tablero PRU / Insignia Life) ═══════════════
   Vista de Flavio: cada consultor con sus dos carteras (Prudential migrada e
   Insignia Life), pólizas vigentes por aseguradora, actividad, última venta y
   alta real en la promotoría. */

router.get('/consultores/overview', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  let agQ = db.from('crm_agents').select('*').order('nombre');
  if (scope.restricted) agQ = agQ.eq('id', scope.agentId);
  const { data: agentsAll, error: eA } = await agQ;
  if (eA) return res.status(500).json({ error: eA.message });
  /* El personal administrativo (p. ej. Karina) no figura como asesor */
  const agents = (agentsAll || []).filter(a => a.clasificacion !== 'administrativo');
  const ids = agents.map(a => a.id);
  if (!ids.length) return res.json({ consultores: [], huerfanas: { total: 0, detalle: [] } });

  const [policies, clients, { data: pruPrimas }, { data: users }] = await Promise.all([
    fetchAllRows(() => db.from('crm_policies').select('id, agent_id, client_id, aseguradora, estatus, tipo, prima, fecha_emision, fecha_pago').in('agent_id', ids).order('id')),
    fetchAllRows(() => db.from('crm_clients').select('id, agent_id, aseguradora, origen').in('agent_id', ids).order('id')),
    db.from('crm_pru_primas').select('clave, anio, mes, prima_pagada_inicial'),
    isAgency(req.user.role)
      ? db.from('users').select('id, crm_can_edit').in('id', (agents || []).map(a => a.user_id).filter(Boolean))
      : Promise.resolve({ data: [] }),
  ]);
  const canEditByUser = new Map((users || []).map(u => [u.id, !!u.crm_can_edit]));

  const VIGENTES = ['pagada', 'pendiente_pago'];
  const finDeMes = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}-28`;

  const consultores = (agents || []).map(a => {
    const pols = (policies || []).filter(p => p.agent_id === a.id);
    const cls = (clients || []).filter(c => c.agent_id === a.id);
    const porAseg = (aseg) => ({
      vigentes: pols.filter(p => (p.aseguradora || 'PRU') === aseg && VIGENTES.includes(p.estatus)).length,
      total: pols.filter(p => (p.aseguradora || 'PRU') === aseg).length,
      clientes: cls.filter(c => (c.aseguradora || 'PRU') === aseg && c.origen !== 'Prudential').length,
    });

    /* Última venta: lo más reciente entre pólizas nuevas capturadas y los
       cortes mensuales Prudential con prima inicial > 0 */
    let ultimaVenta = null;
    for (const p of pols) {
      if (p.tipo !== 'nueva') continue;
      const f = p.fecha_emision || p.fecha_pago;
      if (f && (!ultimaVenta || f > ultimaVenta)) ultimaVenta = f;
    }
    for (const pr of (pruPrimas || [])) {
      if (pr.clave !== a.clave || !(Number(pr.prima_pagada_inicial) > 0)) continue;
      const f = finDeMes(pr.anio, pr.mes);
      if (!ultimaVenta || f > ultimaVenta) ultimaVenta = f;
    }

    const inactivoPru = /INACTIVO/i.test(a.estatus || '');
    /* Clasificación comercial de 3 estados (lista de Arturo 2026-09-03):
       inactivo_con_produccion = tiene cartera y SÍ recibe recordatorios de venta */
    const clasificacion = a.clasificacion
      || (a.activo_fsc === false || inactivoPru ? 'inactivo_sin_produccion' : 'activo');
    return {
      id: a.id, clave: a.clave, nombre: a.nombre, user_id: a.user_id,
      clasificacion,
      estatus_pru: a.estatus || null, activo_fsc: a.activo_fsc !== false,
      alta_pru: a.alta_pru || a.fecha_inicio_calculos || null,
      alta_il: a.alta_il || null,
      registrado_pru: !!(a.clave || a.alta_pru),
      registrado_il: !!a.alta_il,
      cuaderno: a.cuaderno || null,
      polizas: { pru: porAseg('PRU'), il: porAseg('IL') },
      ultima_venta: ultimaVenta,
      sin_actividad: clasificacion !== 'activo',
      puede_editar: a.user_id ? (canEditByUser.get(a.user_id) || false) : false,
      tiene_usuario: !!a.user_id,
    };
  });

  /* Pólizas huérfanas: vigentes cuyo asesor ya no tiene actividad */
  const inactivos = new Map(consultores.filter(c => c.sin_actividad).map(c => [c.id, c]));
  const huerfanasRows = (policies || []).filter(p => inactivos.has(p.agent_id) && VIGENTES.includes(p.estatus));
  const detalle = [...inactivos.values()].map(c => ({
    agent_id: c.id, nombre: c.nombre, clave: c.clave, ultima_venta: c.ultima_venta,
    polizas: huerfanasRows.filter(p => p.agent_id === c.id).length,
    prima: huerfanasRows.filter(p => p.agent_id === c.id).reduce((s, p) => s + (Number(p.prima) || 0), 0),
  })).filter(d => d.polizas > 0).sort((x, y) => y.polizas - x.polizas);

  res.json({ consultores, huerfanas: { total: huerfanasRows.length, detalle } });
});

/* El admin otorga o quita a un usuario el permiso de editar datos del CRM */
router.put('/consultores/:agentId/edit-permission', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede asignar permisos de edición' });
  const db = getDB();
  const { data: agent } = await db.from('crm_agents').select('id, user_id, nombre').eq('id', req.params.agentId).maybeSingle();
  if (!agent) return res.status(404).json({ error: 'Asesor no encontrado' });
  if (!agent.user_id) return res.status(400).json({ error: 'Este asesor no tiene usuario vinculado — vincúlalo primero en Equipo' });
  const value = req.body.crm_can_edit === true;
  const { error } = await db.from('users').update({ crm_can_edit: value }).eq('id', agent.user_id);
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'editar', 'permiso-edicion', agent.id, `${agent.nombre}: ${value ? 'puede editar' : 'solo lectura'}`);
  res.json({ ok: true, crm_can_edit: value });
});

/* ═══════════════ PRODUCTOS (catálogo por aseguradora) ═══════════════ */

router.get('/products', async (req, res) => {
  const db = getDB();
  let q = db.from('crm_products').select('*').order('aseguradora').order('nombre');
  if (req.query.aseguradora) q = q.eq('aseguradora', req.query.aseguradora);
  if (req.query.activo !== 'todos') q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data });
});

router.post('/products', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede crear productos' });
  const b = req.body;
  if (!b.nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  const { data, error } = await getDB().from('crm_products').insert([{
    aseguradora: b.aseguradora === 'IL' ? 'IL' : 'PRU', nombre: b.nombre,
    tipo: b.tipo || null, moneda: b.moneda || 'MXN', descripcion: b.descripcion || null,
  }]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', 'producto', data[0].id, b.nombre);
  res.status(201).json({ product: data[0] });
});

router.put('/products/:id', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede editar productos' });
  const allowed = ['aseguradora', 'nombre', 'tipo', 'moneda', 'descripcion', 'activo'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  const { data, error } = await getDB().from('crm_products').update(patch).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ product: data[0] });
});

router.delete('/products/:id', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede eliminar productos' });
  const { error } = await getDB().from('crm_products').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* ═══════════════ REPORTE PDF DEL BUSINESS REVIEW ═══════════════ */

async function buildReportData(db, agentId, anio) {
  const { agents, policies, goals, clients, pruPrimas, indiceOficial } = await loadAgentData(db, anio, [agentId]);
  if (!agents.length) return null;
  const summary = buildAgentSummary(agents[0], policies, goals, clients, anio, pruPrimas, indiceOficial);

  // Renovaciones próximas 90 días (descifrando nombre de cliente vía join simple)
  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const { data: renovRows } = await db.from('crm_policies')
    .select('plan, prima, fecha_renovacion, crm_clients(nombre)')
    .eq('agent_id', agentId).in('estatus', ['pagada', 'pendiente_pago'])
    .gte('fecha_renovacion', today).lte('fecha_renovacion', in90).order('fecha_renovacion');
  const renovaciones = (renovRows || []).map(r => ({
    cliente: r.crm_clients?.nombre || '—', plan: r.plan, prima: r.prima, fecha_renovacion: r.fecha_renovacion,
  }));

  // Resumen de comisiones del año
  const own = policies.filter(p => p.agent_id === agentId && p.estatus === 'pagada');
  const montoDe = (p) => Number(p.comision_monto) || (Number(p.comision_pct) ? Number(p.prima) * Number(p.comision_pct) / 100 : 0);
  const comisiones = { estimada: 0, pagada: 0, conciliada: 0, porConciliar: 0 };
  for (const p of own) {
    const m = montoDe(p);
    comisiones.estimada += m;
    if (p.comision_estatus === 'pagada_gnp') { comisiones.pagada += m; comisiones.porConciliar += m; }
    if (p.comision_estatus === 'conciliada') { comisiones.pagada += m; comisiones.conciliada += m; }
  }
  return { summary, renovaciones, comisiones };
}

router.get('/report/:agentId', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const agentId = parseInt(req.params.agentId);
  if (scope.restricted && agentId !== scope.agentId) return res.status(403).json({ error: 'Sin acceso a este asesor' });
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  const mes = req.query.mes ? parseInt(req.query.mes) : null;
  const db = getDB();
  const data = await buildReportData(db, agentId, anio);
  if (!data) return res.status(404).json({ error: 'Asesor no encontrado' });

  const { buildAgentReportPDF } = require('../utils/crmReport');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="BusinessReview_${data.summary.agent.clave || agentId}_${anio}.pdf"`);
  const doc = buildAgentReportPDF(data.summary, { anio, mes, renovaciones: data.renovaciones, comisiones: data.comisiones });
  doc.pipe(res);
});

/* Cron mensual: genera y envía el PDF por correo a cada asesor.
   Solo activo con CRM_MONTHLY_REPORT_ENABLED=true + EMAIL_USER/EMAIL_PASS. */
router.post('/monthly-reports', async (req, res) => {
  if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo administración o cron interno' });
  }
  if (process.env.CRM_MONTHLY_REPORT_ENABLED !== 'true') {
    return res.json({ ok: false, skipped: 'CRM_MONTHLY_REPORT_ENABLED != true' });
  }
  const { sendMailWithPdf } = require('../utils/crmMailer');
  const { buildAgentReportPDF } = require('../utils/crmReport');
  const db = getDB();
  const anio = new Date().getFullYear();
  const mes = new Date().getMonth() + 1;
  const { data: agents } = await db.from('crm_agents').select('*').eq('estatus', 'ACTIVO');
  const sent = [], failed = [];

  for (const agent of (agents || [])) {
    if (!agent.email) continue;
    try {
      const data = await buildReportData(db, agent.id, anio);
      const doc = buildAgentReportPDF(data.summary, { anio, mes, renovaciones: data.renovaciones, comisiones: data.comisiones });
      const chunks = [];
      await new Promise((resolve, reject) => {
        doc.on('data', c => chunks.push(c));
        doc.on('end', resolve);
        doc.on('error', reject);
      });
      await sendMailWithPdf({
        to: agent.email,
        subject: `Business Review ${agent.nombre} — ${anio}`,
        text: `Hola ${agent.nombre.split(' ')[0]},\n\nAdjunto tu Business Review actualizado (${anio}). Revisa tu avance de metas, índice de conservación y bonos estimados en el CRM.\n\n— Incubadora S-COOL`,
        filename: `BusinessReview_${agent.clave || agent.id}_${anio}.pdf`,
        buffer: Buffer.concat(chunks),
      });
      sent.push(agent.email);
    } catch (e) { failed.push(`${agent.email}: ${e.message}`); }
  }
  res.json({ ok: true, sent, failed });
});

/* ═══════════════ NOTAS Y TAREAS por cliente ═══════════════ */

async function assertClientScope(req, res, clientId) {
  const scope = await resolveScope(req, res);
  if (!scope) return null;
  const db = getDB();
  const { data: client } = await db.from('crm_clients').select('id,agent_id').eq('id', clientId).maybeSingle();
  if (!client) { res.status(404).json({ error: 'Cliente no encontrado' }); return null; }
  if (scope.restricted && client.agent_id !== scope.agentId) { res.status(403).json({ error: 'Sin acceso a este cliente' }); return null; }
  return { scope, client };
}

router.get('/notes', async (req, res) => {
  if (!req.query.client_id) return res.status(400).json({ error: 'client_id requerido' });
  const ok = await assertClientScope(req, res, req.query.client_id);
  if (!ok) return;
  const { data, error } = await getDB().from('crm_notes').select('*').eq('client_id', req.query.client_id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ notes: data });
});

router.post('/notes', async (req, res) => {
  const { client_id, tipo, texto, due_date } = req.body;
  if (!client_id || !texto) return res.status(400).json({ error: 'client_id y texto son requeridos' });
  const ok = await assertClientScope(req, res, client_id);
  if (!ok) return;
  const { data, error } = await getDB().from('crm_notes').insert([{
    client_id, agent_id: ok.client.agent_id, user_id: req.user.id, user_name: req.user.name,
    tipo: tipo === 'tarea' ? 'tarea' : 'nota', texto, due_date: due_date || null,
  }]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', tipo === 'tarea' ? 'tarea' : 'nota', data[0].id, null);
  res.status(201).json({ note: data[0] });
});

router.put('/notes/:id', async (req, res) => {
  const db = getDB();
  const { data: note } = await db.from('crm_notes').select('*').eq('id', req.params.id).maybeSingle();
  if (!note) return res.status(404).json({ error: 'No encontrada' });
  const ok = await assertClientScope(req, res, note.client_id);
  if (!ok) return;
  const patch = { updated_at: new Date().toISOString() };
  for (const k of ['texto', 'due_date', 'done']) if (k in req.body) patch[k] = req.body[k];
  if (patch.done === true && !note.done) patch.done_at = new Date().toISOString();
  if (patch.done === false) patch.done_at = null;
  const { data, error } = await db.from('crm_notes').update(patch).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if ('done' in req.body) logActivity(req, req.body.done ? 'completar' : 'reabrir', 'tarea', req.params.id, null);
  res.json({ note: data[0] });
});

router.delete('/notes/:id', async (req, res) => {
  const db = getDB();
  const { data: note } = await db.from('crm_notes').select('client_id').eq('id', req.params.id).maybeSingle();
  if (!note) return res.status(404).json({ error: 'No encontrada' });
  const ok = await assertClientScope(req, res, note.client_id);
  if (!ok) return;
  const { error } = await db.from('crm_notes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* ═══════════════ FIREFLIES · Inteligencia de citas ═══════════════
   Trae de las reuniones grabadas el resumen y los action items y los vuelca al
   expediente del cliente (nota + tareas). Se activa con FIREFLIES_API_KEY; sin
   la llave, /status responde { enabled:false } y el resto responde 200 vacío en
   vez de 500, para no romper el CRM mientras se confirman las licencias. */
const { firefliesEnabled, listTranscripts, getTranscript } = require('../utils/fireflies');

router.get('/fireflies/status', (req, res) => {
  res.json({ enabled: firefliesEnabled() });
});

router.get('/fireflies/transcripts', async (req, res) => {
  if (!firefliesEnabled()) return res.json({ enabled: false, transcripts: [] });
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    res.json({ enabled: true, transcripts: await listTranscripts({ limit }) });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/fireflies/transcript/:id', async (req, res) => {
  if (!firefliesEnabled()) return res.status(503).json({ error: 'Fireflies no está configurado' });
  try {
    res.json({ enabled: true, transcript: await getTranscript(req.params.id) });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

/* Importa una cita al expediente: crea 1 nota (resumen) + 1 tarea por action
   item. Idempotencia ligera: evita duplicar si ya se importó esa reunión. */
router.post('/clients/:id/fireflies/import', async (req, res) => {
  if (!firefliesEnabled()) return res.status(503).json({ error: 'Fireflies no está configurado' });
  const { transcript_id } = req.body;
  if (!transcript_id) return res.status(400).json({ error: 'transcript_id requerido' });
  const ok = await assertClientScope(req, res, req.params.id);
  if (!ok) return;
  const db = getDB();
  try {
    const t = await getTranscript(transcript_id);
    const marca = `[Fireflies:${t.id}]`;
    const { data: yaSel } = await db.from('crm_notes').select('id').eq('client_id', req.params.id).ilike('texto', `%${marca}%`).limit(1);
    if (yaSel && yaSel.length) return res.status(409).json({ error: 'Esta cita ya se importó a este cliente' });

    const base = { client_id: Number(req.params.id), agent_id: ok.client.agent_id, user_id: req.user.id, user_name: req.user.name };
    const fecha = t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX') : '';
    const resumenTxt = `🎙️ Cita "${t.titulo}"${fecha ? ` (${fecha})` : ''} ${marca}\n\n${t.resumen || 'Sin resumen disponible.'}${t.temas.length ? `\n\nTemas: ${t.temas.join(', ')}` : ''}`;
    const rows = [{ ...base, tipo: 'nota', texto: resumenTxt }];
    for (const ai of t.action_items.slice(0, 30)) rows.push({ ...base, tipo: 'tarea', texto: `${ai} ${marca}`, done: false });

    const { data, error } = await db.from('crm_notes').insert(rows).select();
    if (error) throw new Error(error.message);
    logActivity(req, 'importar', 'cita-fireflies', req.params.id, `${t.action_items.length} pendientes`);
    res.status(201).json({ ok: true, nota: 1, tareas: rows.length - 1, action_items: t.action_items, notes: data });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

/* ═══════════════ TIMELINE unificado del cliente ═══════════════ */

router.get('/clients/:id/timeline', async (req, res) => {
  const ok = await assertClientScope(req, res, req.params.id);
  if (!ok) return;
  const db = getDB();
  const cid = req.params.id;
  const [{ data: acts }, { data: notes }, { data: rems }, { data: pols }, { data: files }] = await Promise.all([
    db.from('crm_activity').select('*').eq('entity', 'cliente').eq('entity_id', String(cid)).order('created_at', { ascending: false }).limit(80),
    db.from('crm_notes').select('*').eq('client_id', cid),
    db.from('crm_reminders').select('*').eq('client_id', cid),
    db.from('crm_policies').select('*').eq('client_id', cid),
    db.from('crm_files').select('id,nombre,categoria,created_at,uploaded_by').eq('client_id', cid),
  ]);
  const ev = [];
  for (const a of acts || []) ev.push({ ts: a.created_at, tipo: 'actividad', titulo: `${a.user_name} ${a.action === 'crear' ? 'creó' : a.action === 'editar' ? 'editó' : a.action === 'eliminar' ? 'eliminó' : a.action} el cliente`, detalle: a.detail });
  for (const n of notes || []) ev.push({ ts: n.created_at, tipo: n.tipo, titulo: n.tipo === 'tarea' ? `Tarea: ${n.texto}` : `Nota de ${n.user_name || 'asesor'}`, detalle: n.tipo === 'tarea' ? (n.done ? 'completada' : n.due_date ? `vence ${n.due_date}` : 'pendiente') : n.texto });
  for (const r of decryptRows(rems || [], 'crm_reminders')) ev.push({ ts: r.created_at, tipo: 'recordatorio', titulo: `Recordatorio: ${r.titulo}`, detalle: `${r.tipo} · ${r.fecha}${r.estatus === 'completado' ? ' · completado' : ''}` });
  for (const p of decryptRows(pols || [], 'crm_policies')) {
    ev.push({ ts: p.created_at, tipo: 'poliza', titulo: `Póliza ${p.plan || ''} registrada`, detalle: `${p.poliza || 's/n'} · prima $${Number(p.prima || 0).toLocaleString('es-MX')} · ${p.estatus}` });
    if (p.fecha_pago) ev.push({ ts: `${p.fecha_pago}T12:00:00Z`, tipo: 'pago', titulo: `Prima pagada — ${p.plan || p.poliza || ''}`, detalle: `$${Number(p.prima || 0).toLocaleString('es-MX')}` });
  }
  for (const f of files || []) ev.push({ ts: f.created_at, tipo: 'archivo', titulo: `Archivo subido: ${f.nombre}`, detalle: f.categoria });
  ev.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  res.json({ timeline: ev.slice(0, 150) });
});

/* ═══════════════ PORTAL: generar enlace (asesor/admin) ═══════════════ */

router.post('/clients/:id/portal-link', async (req, res) => {
  const ok = await assertClientScope(req, res, req.params.id);
  if (!ok) return;
  const token = jwt.sign({ cid: Number(req.params.id), scope: 'crm-portal' }, JWT_SECRET, { expiresIn: '30d' });
  const base = process.env.CLIENT_URL || 'https://financescool.com.mx';
  logActivity(req, 'compartir', 'portal', req.params.id, 'enlace 30 días');
  res.json({ url: `${base}/portal/cliente?t=${token}`, expira_dias: 30 });
});

/* ═══════════════ COPILOTO IA (Claude) ═══════════════ */

router.post('/clients/:id/copilot', async (req, res) => {
  const ok = await assertClientScope(req, res, req.params.id);
  if (!ok) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'El copiloto requiere configurar ANTHROPIC_API_KEY en el servidor.' });
  try {
    const db = getDB();
    const cid = req.params.id;
    const [{ data: client }, { data: pols }, { data: rems }, { data: notes }] = await Promise.all([
      db.from('crm_clients').select('*').eq('id', cid).maybeSingle(),
      db.from('crm_policies').select('*').eq('client_id', cid),
      db.from('crm_reminders').select('*').eq('client_id', cid).order('fecha').limit(15),
      db.from('crm_notes').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(20),
    ]);
    const c = decryptFields(client, 'crm_clients');
    const ps = decryptRows(pols || [], 'crm_policies');
    const rs = decryptRows(rems || [], 'crm_reminders');
    const hoy = new Date().toISOString().slice(0, 10);
    const contexto = [
      `HOY: ${hoy}`,
      `CLIENTE: ${c.nombre} | etapa: ${c.etapa} | ocupación: ${c.ocupacion || '?'} ${c.empresa ? '@ ' + c.empresa : ''} | origen: ${c.origen || '?'} | nacimiento: ${c.fecha_nacimiento || '?'}`,
      c.notas ? `NOTAS GENERALES: ${c.notas}` : '',
      `PÓLIZAS (${ps.length}): ` + ps.map(p => `${p.plan || '?'} ${p.poliza || ''} prima $${p.prima} ${p.forma_pago} estatus:${p.estatus} renovación:${p.fecha_renovacion || '?'}`).join(' || '),
      `RECORDATORIOS: ` + rs.map(r => `${r.fecha} ${r.tipo}: ${r.titulo}${r.estatus === 'completado' ? ' (hecho)' : ''}`).join(' || '),
      `NOTAS/TAREAS RECIENTES: ` + (notes || []).map(n => `[${n.tipo}${n.done ? '✓' : ''}] ${n.texto}`).join(' || '),
    ].filter(Boolean).join('\n');
    const pregunta = (req.body.pregunta || '').slice(0, 500) || 'Prepárame para mi siguiente contacto con este cliente.';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.COPILOT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: 'Eres el copiloto de un asesor de seguros y Plan Personal de Retiro (PPR) de Finance SCool (Prudential, México). Con los datos del cliente responde en español, conciso y accionable, con viñetas. Incluye: resumen del cliente en 2 líneas, pendientes/riesgos (renovaciones, pagos, tareas), y 2-3 siguientes mejores acciones concretas. No inventes datos que no estén en el contexto.',
        messages: [{ role: 'user', content: `${contexto}\n\nPETICIÓN DEL ASESOR: ${pregunta}` }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message });
    logActivity(req, 'copilot', 'cliente', cid, null);
    res.json({ respuesta: data.content?.[0]?.text || 'Sin respuesta' });
  } catch (e) { res.status(500).json({ error: 'Copiloto: ' + e.message }); }
});

/* ═══ Consultoría: extraer datos del prospecto desde una transcripción ═══ */

router.post('/clients/:id/consulta-extract', async (req, res) => {
  const ok = await assertClientScope(req, res, req.params.id);
  if (!ok) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'Configura ANTHROPIC_API_KEY en el servidor para la extracción con IA.' });
  const transcript = String(req.body.transcript || '').slice(0, 24000);
  if (transcript.length < 40) return res.status(400).json({ error: 'Pega la transcripción de la consultoría (mínimo unas líneas).' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.COPILOT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Extraes datos de una consultoría financiera (PPR/retiro, México). Responde SOLO un JSON válido con las claves: fecha_nacimiento (YYYY-MM-DD o null), ingreso_mensual (número o null), gasto_mensual (número o null), saldo_afore (número o null), retiro_deseado (número mensual deseado o null), edad_retiro_deseada (entero o null), ocupacion (string o null), notas_gastos (resumen breve de en qué gasta, string o null). Si un dato no aparece, usa null. Sin texto extra.',
        messages: [{ role: 'user', content: transcript }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message });
    const txt = (data.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
    const extract = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    logActivity(req, 'consulta-ia', 'cliente', req.params.id, null);
    res.json({ extract });
  } catch (e) { res.status(500).json({ error: 'Extracción: ' + e.message }); }
});

/* ═══════════════ CONCILIACIÓN Prudential desde Excel/CSV ═══════════════ */

const normPoliza = (s) => String(s || '').replace(/[\s\-.]/g, '').toUpperCase();

router.post('/commissions/reconcile-preview', upload.single('file'), async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración' });
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) return res.status(400).json({ error: 'El archivo no tiene filas' });
    const headers = Object.keys(rows[0]);
    const hPoliza = headers.find(h => /p[oó]liza|policy|contrato/i.test(h));
    const hMonto = headers.find(h => /comisi[oó]n|monto|importe|pago/i.test(h));
    if (!hPoliza || !hMonto) return res.status(400).json({ error: `No encontré columnas de póliza y monto. Encabezados: ${headers.join(', ')}` });

    const db = getDB();
    const { data: pols } = await db.from('crm_policies').select('*, crm_clients(nombre), crm_agents(nombre)');
    const decrypted = decryptRows(pols || [], 'crm_policies');
    const byPoliza = {};
    for (const p of decrypted) if (p.poliza) byPoliza[normPoliza(p.poliza)] = p;

    const matches = [], sinMatch = [];
    for (const row of rows) {
      const num = normPoliza(row[hPoliza]);
      const monto = Number(String(row[hMonto]).replace(/[$,\s]/g, '')) || 0;
      if (!num) continue;
      const p = byPoliza[num];
      if (p) matches.push({
        policy_id: p.id, poliza: p.poliza, plan: p.plan,
        cliente: decryptFields(p.crm_clients || {}, 'crm_clients')?.nombre || p.crm_clients?.nombre || '—',
        asesor: p.crm_agents?.nombre || '—',
        monto_gnp: monto, comision_actual: Number(p.comision_monto) || 0, estatus_actual: p.comision_estatus || 'pendiente',
      });
      else sinMatch.push({ poliza: row[hPoliza], monto });
    }
    res.json({ matches, sinMatch, columnas: { poliza: hPoliza, monto: hMonto }, filas: rows.length });
  } catch (e) { res.status(500).json({ error: 'No pude leer el archivo: ' + e.message }); }
});

router.post('/commissions/reconcile-confirm', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración' });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'items vacío' });
  const db = getDB();
  const hoy = new Date().toISOString().slice(0, 10);
  let okCount = 0;
  for (const it of items) {
    const { error } = await db.from('crm_policies').update({
      comision_monto: Number(it.monto) || 0, comision_estatus: 'conciliada', comision_fecha: hoy, updated_at: new Date().toISOString(),
    }).eq('id', it.policy_id);
    if (!error) okCount++;
  }
  logActivity(req, 'conciliar', 'comisiones', null, `${okCount} pólizas desde Excel Prudential`);
  res.json({ ok: true, conciliadas: okCount });
});

/* ═══════════════ COHORTES de conservación ═══════════════ */

router.get('/cohorts', async (req, res) => {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const db = getDB();
  let q = db.from('crm_policies').select('*');
  if (scope.restricted) q = q.eq('agent_id', scope.agentId);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  const pols = decryptRows(data || [], 'crm_policies').filter(p => p.fecha_emision);
  const hoy = new Date();
  const cohortes = {};
  for (const p of pols) {
    const d = new Date(`${String(p.fecha_emision).slice(0, 10)}T12:00:00`);
    const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    const c = (cohortes[key] ||= { cohorte: key, emitidas: 0, prima: 0, canceladas: 0, meses: Math.round((hoy - d) / 2629800000) });
    c.emitidas++; c.prima += Number(p.prima) || 0;
    if (p.estatus === 'cancelada') c.canceladas++;
    c.meses = Math.max(c.meses, Math.round((hoy - d) / 2629800000));
  }
  const out = Object.values(cohortes).sort((a, b) => a.cohorte.localeCompare(b.cohorte)).map(c => ({
    ...c,
    vigentes: c.emitidas - c.canceladas,
    pctVigente: c.emitidas ? (c.emitidas - c.canceladas) / c.emitidas : 0,
    p13: c.meses >= 13 ? (c.emitidas ? (c.emitidas - c.canceladas) / c.emitidas : 0) : null,
    p25: c.meses >= 25 ? (c.emitidas ? (c.emitidas - c.canceladas) / c.emitidas : 0) : null,
  }));
  res.json({ cohortes: out });
});

/* ═══════════════ ACTIVIDAD (bitácora, solo administración) ═══════════════ */

router.get('/activity', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede ver la actividad' });
  const db = getDB();
  const limit = Math.min(parseInt(req.query.limit) || 100, 300);
  let q = db.from('crm_activity').select('*').order('created_at', { ascending: false }).limit(limit);
  if (req.query.user_id) q = q.eq('user_id', req.query.user_id);
  if (req.query.since) q = q.gt('created_at', req.query.since);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ activity: data });
});

/* ═══════════════ TABLERO DE INGRESOS (PIR Prudential) ═══════════════
   Data del Business Review migrada a crm_pru_* (server/migrate-ingresos.js).
   Asesores solo ven su propia clave (crm_agents.clave ↔ crm_pru_agentes.clave). */

const { computeIngresos, computeIndice, proyectarTrayectoria, derivarEstatus, estatusHoy, esTerminalReporte, graciaInfo, clasificarRehabilitacion, compilePersonaliza, ordenRehab, finGracia, isoLocal, numPolizaId, REHAB_ETAPAS, MESES_FRECUENCIA, PIR_DEFAULT } = require('../utils/ingresos');

let _pirCache = null;
async function getPirTablas() {
  if (_pirCache) return _pirCache;
  const { data } = await getDB().from('crm_pir_tablas').select('tablas').eq('anio', new Date().getFullYear()).maybeSingle();
  _pirCache = (data && data.tablas) || PIR_DEFAULT;
  return _pirCache;
}

/* Lista de plan_id que son producto PERSONALIZA (ventana de rehabilitación de
   solo 30 días). Configurable desde crm_config; cacheada. */
let _personalizaCache = null;
async function getPersonalizaPlanes() {
  if (_personalizaCache) return _personalizaCache;
  const { data } = await getDB().from('crm_config').select('value').eq('key', 'personaliza_planes').maybeSingle();
  const arr = Array.isArray(data && data.value) ? data.value : [];
  _personalizaCache = arr.map(s => String(s).toUpperCase());
  return _personalizaCache;
}

/* Resuelve la clave Prudential permitida: null = todas (agencia) */
async function resolveClaveScope(req, res) {
  if (isAgency(req.user.role)) return { restricted: false, clave: req.query.clave || null };
  const agent = await getOwnAgent(req.user.id);
  if (!agent || !agent.clave) {
    res.status(403).json({ error: 'Tu usuario no tiene clave de agente Prudential asignada en el CRM' });
    return null;
  }
  return { restricted: true, clave: agent.clave };
}

/* Números de póliza que HOY están vigentes en la fuente viva (crm_policies).
   Reconcilia el snapshot del índice (crm_pru_polizas_indice, que viene del corte
   del Business Review y puede quedar desfasado): una cobertura cuyo número de
   póliza ya está vigente aquí NO debe listarse "por recuperar", aunque el corte
   aún la traiga cancelada. Caso reportado por mesa de control: póliza 96959. */
async function fetchEstadoVivoPorPoliza(db) {
  const rows = await fetchAllRows(() => db.from('crm_policies').select('poliza, estatus, estatus_reporte').order('id'));
  const map = new Map();
  for (const r of rows) {
    const num = String(decryptFields(r, 'crm_policies').poliza || '').replace(/\.0$/, '').trim();
    if (!num) continue;
    const prev = map.get(num);
    if (!prev) { map.set(num, { estatus: r.estatus, estatus_reporte: r.estatus_reporte || null }); continue; }
    // Consolida varias filas del mismo número: gana el estatus vigente y se
    // conserva el estatus_reporte más informativo.
    if (!prev.estatus_reporte && r.estatus_reporte) prev.estatus_reporte = r.estatus_reporte;
    if (['pagada', 'pendiente_pago'].includes(r.estatus) && !['pagada', 'pendiente_pago'].includes(prev.estatus)) prev.estatus = r.estatus;
  }
  return map;
}

const numPoliza = (v) => String(v || '').replace(/\.0$/, '').trim();

async function fetchIngresosData(clave) {
  const db = getDB();
  let qA = db.from('crm_pru_agentes').select('*').order('nombre');
  let qP = db.from('crm_pru_primas').select('*');
  let qZ = db.from('crm_pru_polizas_indice').select('*');
  if (clave) { qA = qA.eq('clave', clave); qP = qP.eq('clave', clave); qZ = qZ.eq('clave', clave); }
  const [{ data: agentes, error: e1 }, { data: primas, error: e2 }, { data: polizas, error: e3 }, estadoVivo] =
    await Promise.all([qA, qP, qZ, fetchEstadoVivoPorPoliza(db)]);
  const err = e1 || e2 || e3;
  if (err) throw new Error(err.message);
  /* Overlay del estado vivo (Reporte de pólizas / crm_policies), más fresco que
     el corte: live_vigente (revivió) excluye de rehabilitación; estatus_reporte
     distingue rescatadas (terminales, no rehabilitables) de canceladas por impago
     y detecta EN VIGOR para dar por conservada una que el corte traía cancelada. */
  const reconciliadas = (polizas || []).map(p => {
    const ev = estadoVivo.get(numPoliza(p.poliza));
    return { ...p,
      live_vigente: ev ? ['pagada', 'pendiente_pago'].includes(ev.estatus) : false,
      live_estatus: ev ? ev.estatus : null,
      estatus_reporte: ev ? ev.estatus_reporte : null };
  });
  return { agentes: agentes || [], primas: primas || [], polizas: reconciliadas };
}

/* Resumen de todos los agentes (o el propio): índice + bonos del trimestre */
router.get('/ingresos/overview', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(scope.clave)]);
    const rows = agentes.map(a => {
      const r = computeIngresos({
        agente: a,
        primas: primas.filter(p => p.clave === a.clave),
        polizas: polizas.filter(p => p.clave === a.clave),
        pir, personalizaPlanes,
      });
      return {
        clave: a.clave, nombre: a.nombre, cuaderno: a.cuaderno, estatus: a.estatus,
        mes_agente: r.agente.mes_agente, es_nuevo: r.agente.es_nuevo,
        indice: r.indice, primas: r.primas,
        bonos: { total_trimestre: r.bonos.total_trimestre, trimestral: r.bonos.trimestral, conservacion: r.bonos.conservacion, total_mensuales: r.bonos.total_mensuales },
        accionables: { pendientes: r.accionables.pendientesPago.length, rehabilitables: r.accionables.rehabilitables.length, rehab: r.accionables.rehabResumen },
        periodo: r.periodo,
      };
    });
    res.json({ agentes: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Tablero de la PROMOTORÍA: índice de conservación agregado de toda la
   cartera (no por agente) + accionables globales. Umbral promotoría: 84%
   (los agentes individuales necesitan 86%). El simulador de promotoría se
   resuelve en el cliente con estas mismas bases: índice simulado =
   (conservada + Σ bases seleccionadas) / base a conservar. ── */
router.get('/ingresos/promotoria', async (req, res) => {
  try {
    if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración ve el tablero de la promotoría' });
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(null)]);
    const hoy = new Date();
    const diasRestantes = (fechaCancelacion) => {
      const limite = new Date(fechaCancelacion); limite.setMonth(limite.getMonth() + 6);
      return Math.max(0, Math.ceil((limite - hoy) / 86400000));
    };

    let baseAConservar = 0, baseConservada = 0, basePendiente = 0;
    let hoyConservada = 0, hoyPendiente = 0;
    const conteo = { total: 0, conservadas: 0, pendientes: 0, noConservadas: 0, rehabilitables: 0 };
    const pendientesPago = [], rehabilitables = [];

    for (const a of agentes) {
      const r = computeIngresos({
        agente: a,
        primas: primas.filter(p => p.clave === a.clave),
        polizas: polizas.filter(p => p.clave === a.clave),
        pir, personalizaPlanes,
      });
      baseAConservar += r.indice.baseAConservar;
      baseConservada += r.indice.baseConservada;
      basePendiente += r.indice.basePendiente;
      hoyConservada += r.indice.hoy.baseConservada;
      hoyPendiente += r.indice.hoy.basePendiente;
      pendientesPago.push(...r.accionables.pendientesPago.map(p => ({ ...p, clave: a.clave, agente: a.nombre })));
      rehabilitables.push(...r.accionables.rehabilitables.map(p => ({
        ...p, clave: a.clave, agente: a.nombre, dias_restantes: diasRestantes(p.fecha_ultima_cancelacion),
      })));
    }
    /* Conteo de pólizas del índice con el estatus derivado a hoy */
    for (const p of polizas) {
      conteo.total++;
      const st = derivarEstatus(p, hoy);
      if (st === 'CONSERVADA') conteo.conservadas++;
      else if (st === 'PENDIENTE DE PAGO') conteo.pendientes++;
      else conteo.noConservadas++;
    }
    conteo.rehabilitables = rehabilitables.length; // ya excluye vencidas/PERSONALIZA fuera de plazo

    /* Resumen de rehabilitación agregado de la promotoría (por etapa/urgencia) */
    const rehabResumen = { total: rehabilitables.length, monto: 0,
      por_etapa: { AUTOMATICA: 0, CORREO: 0, FIRMA: 0 }, por_urgencia: { EXTREMA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 },
      automatizables: 0 };
    for (const r of rehabilitables) {
      rehabResumen.monto += r.monto || 0;
      if (rehabResumen.por_etapa[r.etapa] != null) rehabResumen.por_etapa[r.etapa]++;
      if (rehabResumen.por_urgencia[r.urgencia] != null) rehabResumen.por_urgencia[r.urgencia]++;
      if (r.automatizable) rehabResumen.automatizables++;
    }
    rehabResumen.monto = Math.round(rehabResumen.monto * 100) / 100;

    const div = (n, d) => (d > 0 ? Math.round((n / d) * 10000) / 10000 : 1);
    const baseRehabilitable = rehabilitables.reduce((s, p) => s + p.monto, 0);
    /* El impacto de cada póliza se re-expresa sobre la base TOTAL de la promotoría */
    const reimpacto = (lista) => lista.map(p => ({ ...p, impacto_indice: baseAConservar > 0 ? p.monto / baseAConservar : 0 }));

    res.json({
      umbral: 0.84,
      umbralAgente: 0.86,
      agentes: agentes.length,
      rehabResumen,
      indice: {
        actual: div(baseConservada, baseAConservar),
        conPendiente: div(baseConservada + basePendiente, baseAConservar),
        baseAConservar, baseConservada, basePendiente,
        hoy: {
          actual: div(hoyConservada, baseAConservar),
          conPendiente: div(hoyConservada + hoyPendiente, baseAConservar),
          baseConservada: hoyConservada, basePendiente: hoyPendiente,
        },
        siCobraTodo: div(hoyConservada + hoyPendiente, baseAConservar),
        siCobraYRehabilitaTodo: div(hoyConservada + hoyPendiente + baseRehabilitable, baseAConservar),
      },
      polizas: conteo,
      accionables: {
        pendientesPago: reimpacto(pendientesPago.sort((a, b) => b.monto - a.monto)),
        rehabilitables: reimpacto(rehabilitables.sort(ordenRehab)),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Rehabilitaciones: lista priorizada de canceladas rehabilitables por etapa
   (auto 0-30 · correo 30-90 · firma 90-180) y urgencia. Agencia ve toda la
   promotoría; asesor solo su cartera. También reporta las VENCIDAS (informativo)
   y las PERSONALIZA fuera de plazo (30 días). ── */
router.get('/ingresos/rehabilitaciones', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const [personalizaPlanes, { agentes, polizas }] = await Promise.all([getPersonalizaPlanes(), fetchIngresosData(scope.clave)]);
    const personalizaC = compilePersonaliza(personalizaPlanes);
    const hoy = new Date();
    const nombrePorClave = new Map(agentes.map(a => [a.clave, a.nombre]));

    const rehabilitables = [], vencidas = [];
    const resumen = { total: 0, monto: 0, automatizables: 0,
      por_etapa: { AUTOMATICA: 0, CORREO: 0, FIRMA: 0 }, por_urgencia: { EXTREMA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 } };
    /* Una fila por PÓLIZA (agrupa coberturas por clave+número). La fecha de
       cancelación efectiva usa el fin de gracia para Vigentes con gracia vencida. */
    const candidatas = polizas.filter(p => estatusHoy(p, hoy) === 'NO CONSERVADA' && !p.live_vigente && !esTerminalReporte(p));
    const grupos = new Map();
    for (const p of candidatas) {
      const k = `${p.clave}|${numPolizaId(p.poliza)}`;
      if (!grupos.has(k)) grupos.set(k, { principal: p, monto: 0, coberturas: 0 });
      const g = grupos.get(k);
      const base = Number(p.base_a_conservar_mxn) || 0;
      g.monto += base; g.coberturas++;
      if (base > (Number(g.principal.base_a_conservar_mxn) || 0)) g.principal = p;
    }
    for (const { principal: p, monto: montoRaw, coberturas } of grupos.values()) {
      const esVigente = String(p.estatus_calculo || '').toUpperCase() === 'VIGENTE';
      const finG = p.pagado_hasta && finGracia(p.pagado_hasta) ? isoLocal(finGracia(p.pagado_hasta)) : null;
      const fechaCancel = esVigente ? finG : (p.fecha_ultima_cancelacion || finG);
      if (!fechaCancel) continue;
      const c = clasificarRehabilitacion({ ...p, fecha_ultima_cancelacion: fechaCancel }, hoy, personalizaC);
      if (!c) continue;
      const monto = Math.round(montoRaw * 100) / 100;
      const item = { id: p.id, clave: p.clave, agente: nombrePorClave.get(p.clave) || p.clave,
        poliza: numPolizaId(p.poliza), plan_id: p.plan_id, coberturas, forma_pago: p.forma_pago, frecuencia_pago: p.frecuencia_pago,
        fecha_ultima_cancelacion: fechaCancel, monto, ...c };
      if (c.rehabilitable) {
        rehabilitables.push(item);
        resumen.total++; resumen.monto += monto;
        if (resumen.por_etapa[c.etapa] != null) resumen.por_etapa[c.etapa]++;
        if (resumen.por_urgencia[c.urgencia] != null) resumen.por_urgencia[c.urgencia]++;
        if (c.automatizable) resumen.automatizables++;
      } else {
        vencidas.push(item);
      }
    }
    resumen.monto = Math.round(resumen.monto * 100) / 100;
    rehabilitables.sort(ordenRehab);
    vencidas.sort((a, b) => b.monto - a.monto);
    res.json({
      scope: scope.restricted ? 'asesor' : 'promotoria',
      clave: scope.clave || null,
      etapas: REHAB_ETAPAS,
      personaliza_configurado: personalizaPlanes.length > 0,
      resumen, rehabilitables,
      vencidas: { total: vencidas.length, monto: Math.round(vencidas.reduce((s, v) => s + v.monto, 0) * 100) / 100, lista: vencidas.slice(0, 100) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Config de planes PERSONALIZA (solo agencia). GET lista la config + los
   plan_id disponibles en el índice para elegir. PUT reemplaza la lista. */
router.get('/ingresos/rehab-config', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración configura los planes PERSONALIZA' });
  try {
    const db = getDB();
    const [personalizaPlanes, { data: rows }] = await Promise.all([
      getPersonalizaPlanes(),
      db.from('crm_pru_polizas_indice').select('plan_id').range(0, 4999),
    ]);
    const conteo = new Map();
    for (const r of (rows || [])) { const k = String(r.plan_id || '').toUpperCase(); if (k) conteo.set(k, (conteo.get(k) || 0) + 1); }
    const planesDisponibles = [...conteo.entries()].map(([plan_id, polizas]) => ({ plan_id, polizas })).sort((a, b) => b.polizas - a.polizas);
    res.json({ personaliza_planes: personalizaPlanes, planes_disponibles: planesDisponibles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/ingresos/rehab-config', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración configura los planes PERSONALIZA' });
  try {
    const lista = Array.isArray(req.body.personaliza_planes) ? req.body.personaliza_planes : null;
    if (!lista) return res.status(400).json({ error: 'personaliza_planes debe ser un arreglo de códigos de plan' });
    const limpia = [...new Set(lista.map(s => String(s).trim().toUpperCase()).filter(Boolean))];
    const { error } = await getDB().from('crm_config').upsert(
      { key: 'personaliza_planes', value: limpia, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
    _personalizaCache = limpia; // invalida/actualiza cache
    logActivity(req, 'configurar', 'rehab-personaliza', null, `${limpia.length} planes`);
    res.json({ ok: true, personaliza_planes: limpia });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Alertas de rehabilitación por correo ──
   Manda a cada asesor sus canceladas urgentes (auto 0-30 + urgencia EXTREMA/ALTA
   por vencer etapa) y un digest a la promotoría (agencia). Manual desde el
   tablero (agencia) o vía cron diario con CRM_REHAB_ALERTS_ENABLED=true. La
   rehabilitación real se hace en Prudential/Zeus (el correo es el aviso). ── */
router.post('/ingresos/rehab-alerts', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración envía las alertas de rehabilitación' });
  const isCron = req.user && req.user.email === 'cron@internal';
  if (isCron && process.env.CRM_REHAB_ALERTS_ENABLED !== 'true') {
    return res.json({ ok: false, skipped: 'CRM_REHAB_ALERTS_ENABLED != true' });
  }
  try {
    const { sendMail, sendMailWithPdf } = require('../utils/crmMailer');
    const { buildRehabPDFBuffer } = require('../utils/rehabReport');
    const db = getDB();
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(null)]);
    const { data: crmAgents } = await db.from('crm_agents').select('clave, email, nombre, activo_fsc');
    const emailPorClave = new Map((crmAgents || []).filter(a => a.clave && a.email && a.activo_fsc !== false).map(a => [a.clave, a]));

    const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
    const urg = (u) => u === 'EXTREMA' ? '⚠️ EXTREMADAMENTE URGENTE' : u === 'ALTA' ? '⚠️ Urgente' : '';
    const lineaPoliza = (p) => `  · Póliza ${p.poliza} (${p.plan_id || ''}) — ${money(p.monto)} · ${p.etapa_label}: ${p.metodo} · quedan ${p.dias_para_vencer_etapa} días de esta etapa${urg(p.urgencia) ? ' · ' + urg(p.urgencia) : ''}`;

    /* Modos:
       - clave: enviar SOLO a ese asesor (resumen ejecutivo con TODAS sus rehabilitables).
       - incluirTodas: incluir todas (no solo urgentes). Automático si hay clave.
       - to: correo destino alterno (ej. el promotor quiere recibirlo él). */
    const soloClave = String(req.body.clave || '').toUpperCase() || null;
    const incluirTodas = soloClave ? true : !!req.body.incluirTodas;
    const overrideTo = (req.body.to && String(req.body.to).trim()) || null;

    const sent = [], skipped = [], failed = [];
    const digest = []; // acumula lo urgente de toda la promotoría

    for (const a of agentes) {
      if (soloClave && a.clave !== soloClave) continue;
      const r = computeIngresos({ agente: a, primas: primas.filter(p => p.clave === a.clave), polizas: polizas.filter(p => p.clave === a.clave), pir, personalizaPlanes });
      const rehab = r.accionables.rehabilitables;
      const urgentes = rehab.filter(p => p.automatizable || p.urgencia === 'EXTREMA' || p.urgencia === 'ALTA');
      const lista = incluirTodas ? rehab : urgentes;
      if (!lista.length) { skipped.push(a.clave); continue; }
      digest.push(...urgentes.map(p => ({ ...p, clave: a.clave, agente: a.nombre })));

      const dest = emailPorClave.get(a.clave);
      const to = overrideTo || dest?.email;
      if (!to) { skipped.push(a.clave + ' (sin correo)'); continue; }
      const monto = lista.reduce((s, p) => s + p.monto, 0);
      const por = { auto: lista.filter(p => p.etapa === 'AUTOMATICA').length, correo: lista.filter(p => p.etapa === 'CORREO').length, firma: lista.filter(p => p.etapa === 'FIRMA').length };
      const extremas = lista.filter(p => p.urgencia === 'EXTREMA').length;
      const cuerpo = [
        `RESUMEN EJECUTIVO — REHABILITACIONES`,
        `Asesor: ${a.nombre} (${a.clave})`,
        `Índice de conservación hoy: ${((r.indice.hoy?.actual ?? r.indice.actual) * 100).toFixed(2)}% (mínimo para bonos: 86%).`,
        ``,
        `${lista.length} póliza(s) rehabilitable(s) · ${money(monto)} en riesgo${extremas ? ` · ${extremas} EXTREMADAMENTE URGENTE(S)` : ''}.`,
        `Por etapa:  ${por.auto} automática(s) (0-30d)  ·  ${por.correo} con correo (30-90d)  ·  ${por.firma} con firma (90-180d).`,
        `El plazo corre desde la cancelación: al vencer cada etapa el trámite se endurece (o se pierde para siempre).`,
        ``,
        `DETALLE (ordenado por urgencia):`,
        ...lista.slice(0, 40).map(lineaPoliza),
        lista.length > 40 ? `  …y ${lista.length - 40} más (ver CRM → Ingresos → Rehabilitaciones).` : null,
        ``,
        `Acción: rehabilítalas en Prudential/Zeus. Cada rehabilitación sube tu índice y cuenta para tus bonos PIR.`,
        ``,
        '— Incubadora S-COOL',
      ].filter(l => l !== null);
      try {
        const pdf = await buildRehabPDFBuffer({ agentName: a.nombre, clave: a.clave, indiceHoy: r.indice.hoy?.actual ?? r.indice.actual, indiceConPendiente: r.indice.hoy?.conPendiente ?? r.indice.conPendiente, lista });
        await sendMailWithPdf({
          to, subject: `♻️ Resumen de rehabilitaciones — ${a.nombre} (${lista.length} coberturas · ${money(monto)})`,
          text: cuerpo.join('\n'),
          filename: `Rehabilitaciones-${a.clave}-${new Date().toISOString().slice(0, 10)}.pdf`, buffer: pdf,
        });
        sent.push(a.clave);
      } catch (e) { failed.push(`${a.clave}: ${e.message}`); }
    }

    // Digest a la promotoría (admins de agencia) — solo en envío masivo
    let digestSent = 0;
    if (!soloClave && digest.length) {
      const { data: admins } = await db.from('users').select('email, role').in('role', ['superadmin', 'agencia', 'admin']);
      const to = [...new Set((admins || []).map(u => u.email).filter(Boolean))];
      if (to.length) {
        digest.sort(ordenRehab);
        const extremas = digest.filter(d => d.urgencia === 'EXTREMA').length;
        const cuerpo = [
          `Rehabilitaciones accionables en la promotoría: ${digest.length} pólizas (${money(digest.reduce((s, d) => s + d.monto, 0))} en riesgo · ${extremas} extremadamente urgentes).`,
          '',
          `Top 20 por urgencia:`,
          ...digest.slice(0, 20).map(d => `  · ${d.agente} — Póliza ${d.poliza} (${d.plan_id || ''}) — ${money(d.monto)} · ${d.etapa_label} · quedan ${d.dias_para_vencer_etapa} días${urg(d.urgencia) ? ' · ' + urg(d.urgencia) : ''}`),
          '',
          `Detalle completo en el CRM → Ingresos → Rehabilitaciones.`,
          '',
          '— Sistema Incubadora S-COOL',
        ];
        try { await sendMail({ to: to.join(','), subject: `♻️ Digest de rehabilitaciones — ${digest.length} accionables (${extremas} extremas)`, text: cuerpo.join('\n') }); digestSent = to.length; } catch (e) { failed.push(`digest: ${e.message}`); }
      }
    }

    logActivity(req, 'enviar', 'rehab-alerts', null, `${sent.length} asesores, digest ${digestSent}`);
    res.json({ ok: true, enviados: sent, sinAccionOSinCorreo: skipped, fallidos: failed, digestDestinatarios: digestSent, accionablesTotales: digest.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Descarga/preview del PDF de rehabilitaciones de un asesor (branded, con logo) */
router.get('/ingresos/rehab-pdf/:clave', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const clave = String(req.params.clave).toUpperCase();
    if (scope.restricted && scope.clave !== clave) return res.status(403).json({ error: 'Solo puedes descargar tu propia clave' });
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(clave)]);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });
    const a = agentes[0];
    const r = computeIngresos({ agente: a, primas, polizas, pir, personalizaPlanes });
    const { buildRehabPDFBuffer } = require('../utils/rehabReport');
    const pdf = await buildRehabPDFBuffer({ agentName: a.nombre, clave: a.clave, indiceHoy: r.indice.hoy?.actual ?? r.indice.actual, indiceConPendiente: r.indice.hoy?.conPendiente ?? r.indice.conPendiente, lista: r.accionables.rehabilitables });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Rehabilitaciones-${clave}.pdf"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Mailing de cobranza por asesor: "esta es tu cartera por cobrar, este es
   tu índice y a esto sube si cobras — importa para tus bonos". Manual desde
   Metas (admin) o vía cron con CRM_COBRANZA_MAILING_ENABLED=true. ── */
router.post('/cobranza-mailing', async (req, res) => {
  if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración puede enviar el mailing de cobranza' });
  try {
    const { sendMail } = require('../utils/crmMailer');
    const db = getDB();
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(null)]);
    const { data: crmAgents } = await db.from('crm_agents').select('clave, email, nombre, activo_fsc');
    const emailPorClave = new Map((crmAgents || []).filter(a => a.clave && a.email && a.activo_fsc !== false).map(a => [a.clave, a]));
    const soloClave = req.body.clave || null; // opcional: enviar a uno solo
    const sent = [], failed = [], skipped = [];

    for (const a of agentes) {
      if (soloClave && a.clave !== soloClave) continue;
      const dest = emailPorClave.get(a.clave);
      if (!dest) { skipped.push(a.clave); continue; }
      const r = computeIngresos({
        agente: a,
        primas: primas.filter(p => p.clave === a.clave),
        polizas: polizas.filter(p => p.clave === a.clave),
        pir, personalizaPlanes,
      });
      const pend = r.accionables.pendientesPago;
      const rehab = r.accionables.rehabilitables;
      if (!pend.length && !rehab.length) { skipped.push(a.clave); continue; }
      const pctTxt = (n) => `${(n * 100).toFixed(2)}%`;
      const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
      const lineas = [
        `Hola ${String(dest.nombre || '').split(' ')[0]},`,
        '',
        `Tu índice de conservación hoy: ${pctTxt(r.indice.hoy?.actual ?? r.indice.actual)} (mínimo para bonos: 86%).`,
        `Si cobras todo lo pendiente sube a: ${pctTxt(r.indice.conPendiente)}.`,
        '',
        pend.length ? `📥 CARTERA POR COBRAR (${pend.length} pólizas · ${money(pend.reduce((s, p) => s + p.monto, 0))}):` : null,
        ...pend.slice(0, 12).map(p => `  · Póliza ${p.poliza} (${p.plan_id || ''}) — ${money(p.monto)} · vencida desde ${p.pagado_hasta || 's/f'} · sube tu índice +${pctTxt(p.impacto_indice)}`),
        pend.length > 12 ? `  …y ${pend.length - 12} más (revísalas en el CRM → Ingresos).` : null,
        '',
        rehab.length ? `♻️ AÚN REHABILITABLES (por etapa — el plazo corre desde la cancelación):` : null,
        ...rehab.slice(0, 10).map(p => `  · Póliza ${p.poliza} — ${money(p.monto)} · ${p.etapa_label} (${p.metodo}) · ${p.dias_para_vencer_etapa} días para vencer esta etapa · recuperaría +${pctTxt(p.impacto_indice)}${p.urgencia === 'EXTREMA' ? ' · ⚠️ EXTREMADAMENTE URGENTE' : p.urgencia === 'ALTA' ? ' · ⚠️ urgente' : ''}`),
        '',
        `Cada cobro cuenta para tus bonos PIR del trimestre. Entra al CRM → Ingresos para simular tu índice y registrar avances.`,
        '',
        '— Incubadora S-COOL',
      ].filter(l => l !== null);
      try {
        await sendMail({ to: dest.email, subject: `Tu cartera por cobrar y tu índice de conservación — ${a.nombre}`, text: lineas.join('\n') });
        sent.push(a.clave);
      } catch (e) { failed.push(`${a.clave}: ${e.message}`); }
    }
    logActivity(req, 'enviar', 'cobranza-mailing', null, `${sent.length} enviados`);
    res.json({ ok: true, enviados: sent, sinCorreoOSinPendientes: skipped, fallidos: failed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Detalle completo de un agente */
router.get('/ingresos/agent/:clave', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const clave = String(req.params.clave).toUpperCase();
    if (scope.restricted && scope.clave !== clave) return res.status(403).json({ error: 'Solo puedes consultar tu propia clave' });
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(clave)]);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });
    const detalle = computeIngresos({ agente: agentes[0], primas, polizas, pir, personalizaPlanes });
    const { data: hist } = await getDB().from('crm_pru_indices_hist').select('periodo,base_a_conservar,base_conservada,indice').eq('clave', clave).order('periodo');
    res.json({ ...detalle, historico: hist || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Simulador: ¿qué pasa si vendo $X y/o cobro/rehabilito estas pólizas? */
router.post('/ingresos/simulate', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const clave = String(req.body.clave || scope.clave || '').toUpperCase();
    if (!clave) return res.status(400).json({ error: 'clave requerida' });
    if (scope.restricted && scope.clave !== clave) return res.status(403).json({ error: 'Solo puedes simular tu propia clave' });
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(clave)]);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });
    const base = computeIngresos({ agente: agentes[0], primas, polizas, pir, personalizaPlanes });
    const sim = computeIngresos({ agente: agentes[0], primas, polizas, pir, personalizaPlanes }, {
      ventaAdicional: Number(req.body.ventaAdicional) || 0,
      cobrarPolizas: req.body.cobrarPolizas || [],
      rehabilitarPolizas: req.body.rehabilitarPolizas || [],
    });
    res.json({ base, simulado: sim, delta: { bonos: round2sim(sim.bonos.total_trimestre - base.bonos.total_trimestre), indice: sim.indice.operativo - base.indice.operativo } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const round2sim = (n) => Math.round(n * 100) / 100;

/* Simulador de la PROMOTORÍA: selecciona pólizas de cualquier asesor (cobrar
   pendientes / rehabilitar canceladas) y devuelve cómo queda el índice agregado
   y la suma de bonos del trimestre de toda la cartera. */
router.post('/ingresos/simulate-promotoria', async (req, res) => {
  try {
    if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo la agencia simula la promotoría' });
    const cobrar = new Set((req.body.cobrarPolizas || []).map(Number));
    const rehab = new Set((req.body.rehabilitarPolizas || []).map(Number));
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(null)]);
    const baseById = new Map(polizas.map(p => [p.id, Number(p.base_a_conservar_mxn) || 0]));

    let baseAConservar = 0, hoyConservada = 0, bonosBase = 0, bonosSim = 0;
    for (const a of agentes) {
      const ap = polizas.filter(p => p.clave === a.clave);
      const pr = primas.filter(p => p.clave === a.clave);
      const cobrarA = ap.filter(p => cobrar.has(p.id)).map(p => p.id);
      const rehabA = ap.filter(p => rehab.has(p.id)).map(p => p.id);
      const base = computeIngresos({ agente: a, primas: pr, polizas: ap, pir, personalizaPlanes });
      baseAConservar += base.indice.baseAConservar;
      hoyConservada += base.indice.hoy.baseConservada;
      bonosBase += base.bonos.total_trimestre;
      if (cobrarA.length || rehabA.length) {
        const sim = computeIngresos({ agente: a, primas: pr, polizas: ap, pir, personalizaPlanes }, { cobrarPolizas: cobrarA, rehabilitarPolizas: rehabA });
        bonosSim += sim.bonos.total_trimestre;
      } else bonosSim += base.bonos.total_trimestre;
    }
    const extra = [...cobrar, ...rehab].reduce((s, id) => s + (baseById.get(id) || 0), 0);
    const div = (n, d) => d > 0 ? Math.round((n / d) * 10000) / 10000 : 1;
    const baseHoy = div(hoyConservada, baseAConservar);
    const simHoy = div(Math.min(hoyConservada + extra, baseAConservar), baseAConservar);
    res.json({
      seleccionadas: { cobrar: cobrar.size, rehabilitar: rehab.size, total: cobrar.size + rehab.size, monto: round2sim(extra) },
      base: { indice: baseHoy, bonos: round2sim(bonosBase) },
      simulado: { indice: simHoy, bonos: round2sim(bonosSim) },
      delta: { indice: Math.round((simHoy - baseHoy) * 10000) / 10000, bonos: round2sim(bonosSim - bonosBase) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── "Mi Día" del asesor: próximos pasos priorizados (next-best-action). ──
   Traduce lo que ya calcula computeIngresos (índice hoy, pendientes de pago,
   canceladas rehabilitables, brecha al siguiente bono) en una lista de acciones
   ordenadas por impacto. El asesor ve su propia clave; la agencia pasa ?clave.
   Núcleo del reposicionamiento "Sistema de Productividad Comercial": no muestra
   datos, dice QUÉ HACER hoy para subir índice, bonos y conservación. */
router.get('/ingresos/proximos-pasos', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const clave = String(req.query.clave || scope.clave || '').toUpperCase();
    if (!clave) return res.status(400).json({ error: 'Selecciona un asesor (clave) para ver sus próximos pasos' });
    if (scope.restricted && scope.clave !== clave) return res.status(403).json({ error: 'Solo puedes ver tu propia clave' });
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(clave)]);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });
    const r = computeIngresos({ agente: agentes[0], primas, polizas, pir, personalizaPlanes });

    const p4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
    const base = r.indice.baseAConservar || 0;
    const hoyC = r.indice.hoy.baseConservada || 0;
    const hoyP = r.indice.hoy.basePendiente || 0;
    const rehabBase = r.accionables.rehabilitables.reduce((s, x) => s + (x.monto || 0), 0);
    const techo = base > 0 ? Math.min(1, (hoyC + hoyP + rehabBase) / base) : 1;

    const pasos = [];
    /* A. Rehabilitar canceladas (una acción por cobertura; urgencia manda) */
    for (const p of r.accionables.rehabilitables) {
      const pesoUrg = p.urgencia === 'EXTREMA' ? 1000 : p.urgencia === 'ALTA' ? 700 : p.urgencia === 'MEDIA' ? 400 : 150;
      const score = pesoUrg - (p.dias_para_vencer_etapa || 0) + (p.impacto_indice || 0) * 200;
      pasos.push({
        tipo: 'rehabilitar', prioridad: Math.round(score), urgencia: p.urgencia,
        titulo: `Rehabilita la póliza ${p.poliza}${p.plan_id ? ' · ' + p.plan_id : ''}`,
        detalle: `${REHAB_ETAPAS[p.etapa]?.metodo || p.etapa} · quedan ${p.dias_para_vencer_etapa}d para vencer la etapa`,
        monto: p.monto, impacto_indice: p4(p.impacto_indice), vence_en_dias: p.dias_para_vencer_etapa,
        cta: { accion: 'rehabilitar', poliza_id: p.id },
      });
    }
    /* B. Cobrar pendientes de pago (vigentes que arrastran el índice) */
    for (const p of r.accionables.pendientesPago) {
      pasos.push({
        tipo: 'cobrar', prioridad: Math.round(500 + (p.impacto_indice || 0) * 200), urgencia: 'MEDIA',
        titulo: `Cobra la póliza ${p.poliza}${p.plan_id ? ' · ' + p.plan_id : ''}`,
        detalle: `Vigente con pago pendiente${p.pagado_hasta ? ` (desde ${p.pagado_hasta})` : ''} · al cobrar sube tu índice`,
        monto: p.monto, impacto_indice: p4(p.impacto_indice),
        cta: { accion: 'cobrar', poliza_id: p.id },
      });
    }
    /* C. Brecha al siguiente umbral de bono */
    if (r.indice.umbral !== '0.94') {
      const meta = r.indice.operativo < 0.86 ? 0.86 : r.indice.operativo < 0.90 ? 0.90 : 0.94;
      pasos.push({
        tipo: 'indice', prioridad: r.indice.operativo < 0.86 ? 900 : 300, urgencia: r.indice.operativo < 0.86 ? 'ALTA' : 'BAJA',
        titulo: r.indice.operativo < 0.86
          ? 'Sube tu índice a 86% para desbloquear tus bonos'
          : `Sube tu índice a ${Math.round(meta * 100)}% para el siguiente rango de bono`,
        detalle: `Índice operativo hoy ${(r.indice.operativo * 100).toFixed(1)}% · techo alcanzable ${(techo * 100).toFixed(1)}% si cobras y rehabilitas todo`,
        monto: 0, meta, cta: { accion: 'ver-simulador' },
      });
    }
    pasos.sort((a, b) => b.prioridad - a.prioridad);

    res.json({
      clave, agente: agentes[0].nombre, cuaderno: agentes[0].cuaderno,
      indice: {
        cobrado: p4(r.indice.hoy.actual), realista: p4(r.indice.hoy.conPendiente),
        operativo: p4(r.indice.operativo), techo: p4(techo), umbral: r.indice.umbral, minimoBono: 0.86,
      },
      bono_trimestre: r.bonos.total_trimestre,
      resumen: {
        rehabilitables: r.accionables.rehabResumen.total, monto_rehab: round2sim(rehabBase),
        urgentes: (r.accionables.rehabResumen.por_urgencia.EXTREMA || 0) + (r.accionables.rehabResumen.por_urgencia.ALTA || 0),
        pendientes: r.accionables.pendientesPago.length,
        monto_pendiente: round2sim(r.accionables.pendientesPago.reduce((s, x) => s + (x.monto || 0), 0)),
      },
      pasos: pasos.slice(0, 40),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PROYECCIÓN COMERCIAL: el CRM que predice, no que cuenta el pasado ──────
   Por asesor: cuánto falta para el SIGUIENTE rango de bono (trimestral y de
   renovación/conservación), prima promedio de su cartera (MXN), a cuántas
   pólizas equivale el faltante, meta del mes y ESCENARIOS "si vendes $X más
   este trimestre, tu bono del Q sube a $Y" — calculados re-corriendo el motor
   PIR real (computeIngresos) con la venta simulada, no con aproximaciones. ── */
function simularVentaExtra(primas, clave, extra, hoy = new Date()) {
  const propias = primas.filter(p => p.clave === clave);
  if (!propias.length) {
    return [...primas, { clave, anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, trimestre: Math.ceil((hoy.getMonth() + 1) / 3), prima_pagada_inicial: extra, prima_ubicacion: extra, prima_pagada_renovacion: 0 }];
  }
  /* La venta extra cae en el último corte disponible (mismo trimestre que ve el motor) */
  const ultimo = [...propias].sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes)).pop();
  return primas.map(p => p === ultimo
    ? { ...p, prima_pagada_inicial: (Number(p.prima_pagada_inicial) || 0) + extra, prima_ubicacion: (Number(p.prima_ubicacion) || 0) + extra }
    : p);
}

/* Prima promedio anual por póliza (MXN) desde el detalle del índice */
function primaPromedioDe(polizas) {
  const porPoliza = new Map();
  for (const p of polizas) {
    const k = numPoliza(p.poliza);
    if (!k) continue;
    porPoliza.set(k, (porPoliza.get(k) || 0) + (Number(p.base_a_conservar_mxn) || 0));
  }
  const bases = [...porPoliza.values()].filter(v => v > 0);
  return { promedio: bases.length ? Math.round((bases.reduce((a, b) => a + b, 0) / bases.length) * 100) / 100 : 0, polizas: bases.length };
}

function buildProyeccion({ agente, primas, polizas, pir, personalizaPlanes, goals, primaPromedioFallback = 0, hoy = new Date() }) {
  const r = computeIngresos({ agente, primas, polizas, pir, personalizaPlanes });
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const pp = primaPromedioDe(polizas);
  /* Asesor nuevo sin cartera de renovación: usa el promedio de la promotoría
     para que "¿a cuántas pólizas equivale el faltante?" siempre tenga respuesta */
  const usaFallback = pp.promedio <= 0 && primaPromedioFallback > 0;
  const primaPromedio = usaFallback ? primaPromedioFallback : pp.promedio;
  const basesPoliza = { length: pp.polizas };

  const umbral = r.indice.umbral || '0.86';
  const siguiente = (lista) => {
    const orden = [...(lista || [])].sort((a, b) => a.prima_min - b.prima_min);
    const alcanzados = orden.filter(x => x.alcanzado);
    const n = orden.find(x => !x.alcanzado);
    return {
      rango_actual: alcanzados.length ? alcanzados[alcanzados.length - 1].rango : null,
      siguiente: n ? {
        rango: n.rango, prima_min: n.prima_min, faltante: n.faltante,
        bono_al_llegar: n.bonos[umbral] || 0,
        polizas_equivalentes: primaPromedio > 0 ? Math.ceil(n.faltante / primaPromedio) : null,
      } : null,
      rangos: orden.map(x => ({ rango: x.rango, prima_min: x.prima_min, alcanzado: x.alcanzado, bono: x.bonos[umbral] || 0 })),
    };
  };

  /* Escenarios: motor PIR real con venta adicional del trimestre */
  const escenarios = [25000, 50000, 100000, 200000].map(extra => {
    const rs = computeIngresos({ agente, primas: simularVentaExtra(primas, agente.clave, extra, hoy), polizas, pir, personalizaPlanes });
    return {
      venta_extra: extra,
      bono_trimestre: rs.bonos.total_trimestre,
      delta_bono: r2(rs.bonos.total_trimestre - r.bonos.total_trimestre),
      comision_marginal: rs.bonos.total_trimestre > 0 ? r2((rs.bonos.total_trimestre - r.bonos.total_trimestre) / extra) : 0,
    };
  });

  /* Meta del mes en curso (crm_goals por clave) vs vendido según cortes */
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const metaMes = (goals || []).filter(g => g.clave === agente.clave && Number(g.anio) === anioHoy && Number(g.mes) === mesHoy)
    .reduce((s, g) => s + (Number(g.meta_prima) || 0), 0);
  const vendidoMes = primas.filter(p => p.clave === agente.clave && Number(p.anio) === anioHoy && Number(p.mes) === mesHoy)
    .reduce((s, p) => s + (Number(p.prima_pagada_inicial) || 0), 0);

  return {
    clave: agente.clave, nombre: agente.nombre, cuaderno: agente.cuaderno,
    periodo: r.periodo,
    /* Accionables resumidos: el Copiloto los usa para responder "¿qué cobro/
       rehabilito hoy?" también en modo promotoría */
    accionables: {
      pendientes: r.accionables.pendientesPago.length,
      monto_pendiente: Math.round(r.accionables.pendientesPago.reduce((s, p) => s + (p.monto || 0), 0)),
      rehab_total: r.accionables.rehabilitables.length,
      rehab_monto: Math.round(r.accionables.rehabResumen.monto || 0),
      rehabilitables_top: r.accionables.rehabilitables.slice(0, 6).map(p => ({
        poliza: p.poliza, plan: p.plan_id || null, monto: Math.round(p.monto || 0),
        etapa: p.etapa, urgencia: p.urgencia, dias: p.dias_para_vencer_etapa,
      })),
      cobrar_top: r.accionables.pendientesPago.slice(0, 6).map(p => ({
        poliza: p.poliza, plan: p.plan_id || null, monto: Math.round(p.monto || 0),
      })),
    },
    indice: { operativo: r.indice.operativo, umbral: r.indice.umbral, bloqueado: !r.indice.umbral, minimoBono: 0.86 },
    prima_promedio: primaPromedio,
    prima_promedio_es_promotoria: usaFallback,
    polizas_en_cartera: basesPoliza.length,
    venta: { ubicacionQ: r.primas.ubicacionQ, pagadaInicialQ: r.primas.pagadaInicialQ, renovacionQ: r.primas.renovacionQ },
    bonos_hoy: r.bonos,
    trimestral: siguiente(r.enJuego?.trimestral),
    conservacion: siguiente(r.enJuego?.conservacion),
    escenarios,
    meta_mes: { anio: anioHoy, mes: mesHoy, meta: r2(metaMes), vendido: r2(vendidoMes), faltante: r2(Math.max(0, metaMes - vendidoMes)), pct: metaMes > 0 ? r2(vendidoMes / metaMes) : null },
  };
}

/* crm_goals guarda agent_id (no clave): traduce a clave vía crm_agents para
   cruzar con los cortes Prudential. Un select con 'clave' aquí falla mudo. */
async function fetchGoalsPorClave(db) {
  const [goalsQ, agQ] = await Promise.all([
    db.from('crm_goals').select('agent_id, anio, mes, meta_prima'),
    db.from('crm_agents').select('id, clave'),
  ]);
  const claveDe = new Map((agQ.data || []).map(a => [a.id, a.clave]));
  return (goalsQ.data || [])
    .map(g => ({ ...g, clave: claveDe.get(g.agent_id) || null }))
    .filter(g => g.clave);
}

router.get('/ingresos/proyeccion', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const clave = String(req.query.clave || scope.clave || '').toUpperCase() || null;
    const db = getDB();
    const [pir, personalizaPlanes, { agentes, primas, polizas }, goals, clasifQ] = await Promise.all([
      getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(clave),
      fetchGoalsPorClave(db),
      db.from('crm_agents').select('clave, clasificacion'),
    ]);
    const clasifDe = new Map((clasifQ.data || []).filter(a => a.clave).map(a => [a.clave, a.clasificacion || 'activo']));
    /* Promedio de TODA la promotoría como fallback para asesores sin cartera.
       Con clave el fetch ya viene filtrado: trae el global en una consulta extra. */
    let todasPolizas = polizas;
    if (clave) {
      todasPolizas = await fetchAllRows(() => db.from('crm_pru_polizas_indice').select('poliza, base_a_conservar_mxn').order('id'));
    }
    const ppGlobal = primaPromedioDe(todasPolizas).promedio;
    const rows = agentes.map(a => buildProyeccion({
      agente: a,
      primas: primas.filter(p => p.clave === a.clave),
      polizas: polizas.filter(p => p.clave === a.clave),
      pir, personalizaPlanes, goals, primaPromedioFallback: ppGlobal,
    }));
    /* Hasta qué mes llegan los cortes oficiales (fuente de los BONOS): el
       Reporte de pólizas diario actualiza estatus/índice, pero la prima pagada
       viene del Business Review — que se sepa qué corte están viendo. */
    const cortePrimas = primas.reduce((m, p) => {
      const k = `${p.anio}-${String(p.mes).padStart(2, '0')}`;
      return k > m ? k : m;
    }, '');
    if (clave) return res.json(rows[0] ? { ...rows[0], corte_primas: cortePrimas } : null);
    /* Carrera de la promotoría: SOLO asesores ACTIVOS — los inactivos no
       compiten (pedido de Arturo); su cartera sigue contando en índice/bonos. */
    const carrera = rows
      .filter(x => (clasifDe.get(x.clave) || 'activo') === 'activo')
      .map(x => ({ clave: x.clave, nombre: x.nombre, pagadaInicialQ: x.venta.pagadaInicialQ, bono: x.bonos_hoy.total_trimestre, indice: x.indice.operativo, bloqueado: x.indice.bloqueado, meta_mes: x.meta_mes }))
      .sort((a, b) => b.pagadaInicialQ - a.pagadaInicialQ);
    res.json({ agentes: rows.map(x => ({ ...x, clasificacion: clasifDe.get(x.clave) || 'activo' })), carrera, corte_primas: cortePrimas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── COPILOTO GENERAL DEL CRM (chatbot con contexto vivo de la base) ────────
   Responde sobre índice, bonos, cuánto falta para el siguiente rango, cartera,
   pipeline, metas, etc. Asesor: SOLO sus datos. Agencia/admin: la promotoría
   completa con detalle por asesor. El contexto se arma en cada pregunta con
   los mismos motores del CRM — el bot siempre habla del corte más reciente. ── */
router.post('/chat', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'El copiloto requiere ANTHROPIC_API_KEY en el servidor.' });
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const db = getDB();
    const [pir, personalizaPlanes, { agentes, primas, polizas }, goals, li] = await Promise.all([
      getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(scope.clave),
      fetchGoalsPorClave(db),
      db.from('crm_import_runs').select('archivo, created_at, resumen').eq('tipo', 'reporte-polizas').order('created_at', { ascending: false }).limit(1),
    ]);
    const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
    const pct = (n) => `${((Number(n) || 0) * 100).toFixed(1)}%`;
    const hoy = new Date().toISOString().slice(0, 10);

    const lineaAsesor = (x, detallado) => {
      const partes = [
        `${x.nombre} (${x.clave})${x.cuaderno ? ' · ' + x.cuaderno : ''}: índice ${pct(x.indice.operativo)}${x.indice.bloqueado ? ' ⚠ BAJO 86% — BONOS BLOQUEADOS' : ''}`,
        `venta nueva Q ${money(x.venta.pagadaInicialQ)} · renovación Q ${money(x.venta.renovacionQ)} · bono del Q hoy ${money(x.bonos_hoy.total_trimestre)}`,
        x.trimestral.siguiente ? `siguiente rango trimestral (R${x.trimestral.siguiente.rango}): faltan ${money(x.trimestral.siguiente.faltante)} ≈ ${x.trimestral.siguiente.polizas_equivalentes ?? '?'} pólizas (prima promedio ${money(x.prima_promedio)}) → bono ${money(x.trimestral.siguiente.bono_al_llegar)}` : 'rango trimestral máximo alcanzado',
        x.conservacion.siguiente ? `siguiente rango de renovación: faltan ${money(x.conservacion.siguiente.faltante)} → bono ${money(x.conservacion.siguiente.bono_al_llegar)}` : null,
        x.meta_mes.meta > 0 ? `meta del mes ${money(x.meta_mes.meta)}: lleva ${money(x.meta_mes.vendido)} (${x.meta_mes.pct != null ? pct(x.meta_mes.pct) : '?'})` : 'sin meta capturada este mes',
      ];
      if (detallado) partes.push(`escenarios: ` + x.escenarios.map(e => `+${money(e.venta_extra)} venta → bono Q ${money(e.bono_trimestre)} (+${money(e.delta_bono)})`).join(' | '));
      return '  - ' + partes.filter(Boolean).join('\n    ');
    };

    let contexto;
    if (scope.clave) {
      const a = agentes[0];
      if (!a) return res.status(404).json({ error: 'Sin datos Prudential para tu clave' });
      const globales = await fetchAllRows(() => db.from('crm_pru_polizas_indice').select('poliza, base_a_conservar_mxn').order('id'));
      const x = buildProyeccion({ agente: a, primas, polizas, pir, personalizaPlanes, goals, primaPromedioFallback: primaPromedioDe(globales).promedio });
      const r = computeIngresos({ agente: a, primas, polizas, pir, personalizaPlanes });
      contexto = [
        `HOY: ${hoy} · Trimestre ${x.periodo.trimestre}Q${x.periodo.anio}`,
        `ASESOR:`, lineaAsesor(x, true),
        `ACCIONABLES: ${r.accionables.pendientesPago.length} pólizas por cobrar (${money(r.accionables.pendientesPago.reduce((s, p) => s + p.monto, 0))}) · ${r.accionables.rehabilitables.length} rehabilitables (${money(r.accionables.rehabResumen.monto)})`,
        `DETALLE REHABILITABLES (top 10): ` + r.accionables.rehabilitables.slice(0, 10).map(p => `póliza ${p.poliza} ${money(p.monto)} etapa ${p.etapa} quedan ${p.dias_para_vencer_etapa}d`).join(' | '),
      ].join('\n');
    } else {
      const ppGlobal = primaPromedioDe(polizas).promedio;
      const rows = agentes.map(a => buildProyeccion({ agente: a, primas: primas.filter(p => p.clave === a.clave), polizas: polizas.filter(p => p.clave === a.clave), pir, personalizaPlanes, goals, primaPromedioFallback: ppGlobal }));
      const tot = (f) => rows.reduce((s, x) => s + f(x), 0);
      /* Accionables de TODA la promotoría: qué rehabilitar/cobrar HOY, con dueño */
      const rehabGlobal = rows.flatMap(x => (x.accionables?.rehabilitables_top || []).map(p => ({ ...p, agente: x.nombre, clave: x.clave })))
        .sort((a, b) => ({ EXTREMA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 }[a.urgencia] ?? 9) - ({ EXTREMA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 }[b.urgencia] ?? 9) || (a.dias ?? 999) - (b.dias ?? 999))
        .slice(0, 20);
      const cobrarGlobal = rows.flatMap(x => (x.accionables?.cobrar_top || []).map(p => ({ ...p, agente: x.nombre })))
        .sort((a, b) => b.monto - a.monto).slice(0, 15);
      contexto = [
        `HOY: ${hoy} · PROMOTORÍA Incubadora S-COOL: ${rows.length} asesores con datos Prudential`,
        `TOTALES DEL TRIMESTRE: venta nueva ${money(tot(x => x.venta.pagadaInicialQ))} · renovación ${money(tot(x => x.venta.renovacionQ))} · bonos ${money(tot(x => x.bonos_hoy.total_trimestre))}`,
        `ÚLTIMA CARGA DEL REPORTE DE PÓLIZAS: ${li.data?.[0] ? `${li.data[0].created_at.slice(0, 10)} (${li.data[0].resumen?.filas || '?'} filas)` : 'sin registro'}`,
        `NOTA: los BONOS y primas pagadas vienen de los cortes oficiales del Business Review Prudential (último corte cargado: ${primas.reduce((m, p) => { const k = `${p.anio}-${String(p.mes).padStart(2, '0')}`; return k > m ? k : m; }, 's/d')}); el Reporte de pólizas diario actualiza estatus, índice HOY, cartera y rehabilitaciones.`,
        `REHABILITAR HOY (top ${rehabGlobal.length} de ${rows.reduce((s, x) => s + (x.accionables?.rehab_total || 0), 0)} en toda la promotoría, ordenadas por urgencia): ` +
          rehabGlobal.map(p => `póliza ${p.poliza}${p.plan ? ' ' + p.plan : ''} de ${p.agente} · ${money(p.monto)} · etapa ${p.etapa} · ${p.urgencia} · quedan ${p.dias}d`).join(' | '),
        `COBRAR HOY (top ${cobrarGlobal.length} de ${rows.reduce((s, x) => s + (x.accionables?.pendientes || 0), 0)} pendientes): ` +
          cobrarGlobal.map(p => `póliza ${p.poliza}${p.plan ? ' ' + p.plan : ''} de ${p.agente} · ${money(p.monto)}`).join(' | '),
        `ASESORES:`,
        ...rows.sort((a, b) => b.venta.pagadaInicialQ - a.venta.pagadaInicialQ).map(x => lineaAsesor(x, false)),
      ].join('\n');
    }

    const mensajes = Array.isArray(req.body.messages) && req.body.messages.length
      ? req.body.messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2000) }))
      : [{ role: 'user', content: String(req.body.question || '¿Cómo voy y qué debo hacer hoy para ganar más bonos?').slice(0, 2000) }];

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.COPILOT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        system: `Eres el Copiloto Comercial de la Incubadora S-COOL (promotoría Prudential México). Tu misión es que el equipo VENDA MÁS: siempre habla del futuro (cuánto falta, qué vender, cuánto ganarían), no del pasado. Responde en español, breve y motivador, con números EXACTOS del contexto — nunca inventes cifras.

REGLAS DURAS:
1. El contexto de abajo ES la base de datos viva del CRM de HOY. Las listas "REHABILITAR HOY", "COBRAR HOY" y los accionables por asesor son reales y actuales: cuando pregunten qué rehabilitar/cobrar, RESPONDE CON ESAS PÓLIZAS (número, dueño, monto, etapa, días). NUNCA digas que no tienes acceso a esos datos.
2. Las ÚNICAS secciones del CRM son: Mi Día, Tableros CRM, Pipeline, Consultores, Pólizas, Ingresos, Campañas, Metas & Forecast, Recordatorios, Inteligencia de citas, Incubadora, Cotizador PPR y Semillas. NO inventes secciones ni reportes que no existen.
3. Cuando pregunten "cuánto me falta", usa los faltantes de rango y pólizas equivalentes del contexto. Sin índice ≥86% no hay bonos (84% para la promotoría).
4. Si de verdad algo no está en el contexto (documentos, un cliente específico), dilo en una línea y sugiere la sección real del CRM donde vive.

CONTEXTO EN VIVO DEL CRM:
${contexto}`,
        messages: mensajes,
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message });
    logActivity(req, 'copilot', 'crm-chat', null, null);
    res.json({ respuesta: data.content?.[0]?.text || 'Sin respuesta' });
  } catch (e) { res.status(500).json({ error: 'Copiloto: ' + e.message }); }
});

/* ── Incubadora de vendedores ───────────────────────────────────────────────
   Analiza qué sostienen los MEJORES asesores (índice, prima nueva, disciplina
   de rehabilitación) y lo convierte en un playbook + brechas para los nuevos.
   Todo desde datos ya existentes (PIR Prudential); sin schema nuevo. Agencia
   ve la promotoría completa; un asesor ve su propia brecha vs el top. */
router.get('/incubadora', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(null)]);
    const filas = agentes
      .filter(a => String(a.estatus || '').toUpperCase() !== 'EXTERNO')
      .map(a => {
        const r = computeIngresos({ agente: a, primas: primas.filter(p => p.clave === a.clave), polizas: polizas.filter(p => p.clave === a.clave), pir, personalizaPlanes });
        return {
          clave: a.clave, nombre: a.nombre, cuaderno: a.cuaderno, estatus: a.estatus,
          mes_agente: r.agente.mes_agente, es_nuevo: r.agente.es_nuevo,
          indice: r.indice.operativo, indice_cobrado: r.indice.hoy.actual,
          prima_nueva: r.primas.pagadaInicialQ, prima_renov: r.primas.renovacionQ,
          bono: r.bonos.total_trimestre, base: r.indice.baseAConservar,
          rehab_urgentes: (r.accionables.rehabResumen.por_urgencia.EXTREMA || 0) + (r.accionables.rehabResumen.por_urgencia.ALTA || 0),
          pendientes: r.accionables.pendientesPago.length,
        };
      });
    const conNegocio = filas.filter(f => f.base > 0 || f.prima_nueva > 0);
    const maxPrima = Math.max(1, ...conNegocio.map(f => f.prima_nueva));
    const score = (f) => f.indice * 0.6 + (f.prima_nueva / maxPrima) * 0.4;
    const ranked = [...conNegocio].sort((a, b) => score(b) - score(a)).map((f, i) => ({ ...f, score: Math.round(score(f) * 1000) / 1000, rank: i + 1 }));
    const nTop = Math.min(ranked.length, Math.max(3, Math.ceil(ranked.length * 0.25)));
    const top = ranked.slice(0, nTop), resto = ranked.slice(nTop);
    const median = (arr, key) => { const s = arr.map(x => x[key]).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const r2 = (n) => Math.round(n * 100) / 100;
    const playbook = [
      { metrica: 'Índice de conservación', fmt: 'pct', top: median(top, 'indice'), resto: median(resto, 'indice'),
        regla: 'Los mejores sostienen su índice arriba del mínimo de bono (86%). Cobran y rehabilitan antes del cierre del trimestre.' },
      { metrica: 'Prima nueva del trimestre', fmt: 'money', top: r2(median(top, 'prima_nueva')), resto: r2(median(resto, 'prima_nueva')),
        regla: 'Venden negocio nuevo cada mes; no dependen solo de la renovación.' },
      { metrica: 'Rehabilitaciones urgentes sin atender', fmt: 'num', menorEsMejor: true, top: median(top, 'rehab_urgentes'), resto: median(resto, 'rehab_urgentes'),
        regla: 'No dejan vencer rehabilitaciones: mantienen en cero las urgentes acumuladas.' },
      { metrica: 'Pólizas por cobrar sin atender', fmt: 'num', menorEsMejor: true, top: median(top, 'pendientes'), resto: median(resto, 'pendientes'),
        regla: 'Cobran a tiempo: la pendiente de pago es la fuga #1 del índice.' },
    ];
    const benchmark = { indice_top: median(top, 'indice'), prima_top: r2(median(top, 'prima_nueva')) };
    const gap = (f) => ({ ...f, brecha_indice: r2(Math.max(0, benchmark.indice_top - f.indice)), brecha_prima: r2(Math.max(0, benchmark.prima_top - f.prima_nueva)) });
    const nuevos = ranked.filter(f => f.es_nuevo).map(gap);

    if (scope.restricted) {
      const yo = ranked.find(f => f.clave === scope.clave);
      return res.json({ scope: 'asesor', benchmark, playbook, yo: yo ? gap(yo) : null, top: top.map(t => ({ nombre: t.nombre, indice: t.indice, prima_nueva: t.prima_nueva })) });
    }
    res.json({ scope: 'promotoria', total: ranked.length, top_n: nTop, benchmark, playbook, top, leaderboard: ranked, nuevos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Campañas de incentivos (Rumbo a la Grandeza, etc.) ──────────────────────
   Se suben varias veces al año a crm_campanas; el motor calcula por agente su
   Prima de Campaña, puntos y categoría desde la base de primas de FSC. */
const { computeCampana } = require('../utils/campanas');

router.get('/campanas', async (req, res) => {
  try {
    const { data, error } = await getDB().from('crm_campanas').select('id, nombre, slug, inicio, fin, activa').order('inicio', { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ campanas: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/campanas/:slug/avance', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const { data: camp, error: ce } = await getDB().from('crm_campanas').select('*').eq('slug', req.params.slug).maybeSingle();
    if (ce) throw new Error(ce.message);
    if (!camp) return res.status(404).json({ error: 'Campaña no encontrada' });
    const def = camp.definicion || {};
    const anio = new Date(camp.inicio).getFullYear();
    const [pir, personalizaPlanes, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(scope.clave)]);

    const calc = (a) => {
      const pr = primas.filter(p => p.clave === a.clave);
      const r = computeIngresos({ agente: a, primas: pr, polizas: polizas.filter(p => p.clave === a.clave), pir, personalizaPlanes });
      return { clave: a.clave, nombre: a.nombre, ...computeCampana(def, pr, { anio, indiceConservacion: r.indice.operativo }) };
    };
    const meta = { nombre: camp.nombre, slug: camp.slug, inicio: camp.inicio, fin: camp.fin, categorias: def.categorias };
    const ponderacionPendiente = def.producto_map?._draft === true;

    if (scope.restricted || req.query.clave) {
      const clave = String(scope.clave || req.query.clave || '').toUpperCase();
      const a = agentes.find(x => x.clave === clave);
      if (!a) return res.status(404).json({ error: `Sin datos Prudential para ${clave}` });
      return res.json({ campana: meta, avance: calc(a), ponderacion_pendiente: ponderacionPendiente });
    }
    const leaderboard = agentes
      .filter(a => String(a.estatus || '').toUpperCase() !== 'EXTERNO')
      .map(calc)
      .filter(f => f.prima_campana > 0 || f.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos || b.prima_campana - a.prima_campana);
    res.json({ campana: meta, leaderboard, ponderacion_pendiente: ponderacionPendiente });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   FORECAST / MODELADO A FUTURO de la promotoría (solo agencia)
   Responde: ¿cuánto puedo producir a través de mis asesores?, ¿quiénes son mis
   estrellas y qué está fallando?, ¿cómo voy vs. periodos pasados?, ¿a qué índice
   y venta cierro el año y los próximos años al ritmo actual?
   ═══════════════════════════════════════════════════════════════════════════ */
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const parsePeriodo = (s) => { const m = /(\d)\s*Q\s*(\d{4})/.exec(s || ''); return m ? { q: +m[1], anio: +m[2], orden: (+m[2]) * 4 + (+m[1]) } : { q: 0, anio: 0, orden: 0 }; };

router.get('/ingresos/forecast', async (req, res) => {
  try {
    if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo administración ve el forecast de la promotoría' });
    const db = getDB();
    const [pir, personalizaPlanes, { agentes, primas, polizas }, primasHist, indHist, goals] = await Promise.all([
      getPirTablas(), getPersonalizaPlanes(), fetchIngresosData(null),
      db.from('crm_pru_primas').select('clave,anio,mes,trimestre,prima_pagada_inicial,prima_pagada_renovacion,prima_ubicacion').then(r => r.data || []),
      db.from('crm_pru_indices_hist').select('clave,periodo,base_a_conservar,base_conservada').then(r => r.data || []),
      fetchGoalsPorClave(db),
    ]);
    const div = (n, d) => (d > 0 ? Math.round((n / d) * 10000) / 10000 : 0);

    /* ── 1) Producción mensual agregada de la promotoría ── */
    const mesMap = new Map();
    for (const p of primasHist) {
      const k = `${p.anio}-${String(p.mes).padStart(2, '0')}`;
      const cur = mesMap.get(k) || { anio: p.anio, mes: p.mes, nueva: 0, renov: 0, meta: 0 };
      cur.nueva += Number(p.prima_pagada_inicial) || 0;
      cur.renov += Number(p.prima_pagada_renovacion) || 0;
      mesMap.set(k, cur);
    }
    for (const g of goals) {
      const k = `${g.anio}-${String(g.mes).padStart(2, '0')}`;
      const cur = mesMap.get(k); if (cur) cur.meta += Number(g.meta_prima) || 0;
    }
    const produccionMensual = [...mesMap.values()]
      .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
      .map(m => ({
        anio: m.anio, mes: m.mes, label: `${MESES_CORTO[m.mes - 1]} '${String(m.anio).slice(2)}`,
        nueva: Math.round(m.nueva), renov: Math.round(m.renov), total: Math.round(m.nueva + m.renov), meta: Math.round(m.meta),
      }));

    /* ── 2) Trayectoria de índice por periodo (snapshots oficiales Prudential) ── */
    const perMap = new Map();
    for (const h of indHist) {
      const cur = perMap.get(h.periodo) || { periodo: h.periodo, base: 0, cons: 0 };
      cur.base += Number(h.base_a_conservar) || 0;
      cur.cons += Number(h.base_conservada) || 0;
      perMap.set(h.periodo, cur);
    }
    let indiceHist = [...perMap.values()].map(p => ({ ...p, ...parsePeriodo(p.periodo) }))
      .sort((a, b) => a.orden - b.orden)
      .map(p => ({ periodo: p.periodo, anio: p.anio, q: p.q, baseAConservar: Math.round(p.base), baseConservada: Math.round(p.cons), indice: div(p.cons, p.base) }));

    /* ── 3) Leaderboard por asesor + índice agregado de la promotoría a hoy ── */
    const metaPorClave = new Map();
    for (const g of goals) metaPorClave.set(g.clave, (metaPorClave.get(g.clave) || 0) + (Number(g.meta_prima) || 0));
    let agBase = 0, agCons = 0, agPend = 0, hoyCons = 0, hoyPend = 0, baseRehab = 0;
    const leaderboard = agentes.map(a => {
      const r = computeIngresos({ agente: a, primas: primas.filter(p => p.clave === a.clave), polizas: polizas.filter(p => p.clave === a.clave), pir, personalizaPlanes });
      agBase += r.indice.baseAConservar; agCons += r.indice.baseConservada; agPend += r.indice.basePendiente;
      hoyCons += r.indice.hoy.baseConservada; hoyPend += r.indice.hoy.basePendiente;
      baseRehab += r.accionables.rehabilitables.reduce((s, p) => s + (p.monto || 0), 0);
      const meta = metaPorClave.get(a.clave) || 0;
      const nueva = Math.round(r.primas.pagadaInicialQ || 0);
      const rehabA = r.accionables.rehabilitables.reduce((s, p) => s + (p.monto || 0), 0);
      return {
        clave: a.clave, nombre: a.nombre, cuaderno: a.cuaderno, estatus: a.estatus,
        mes_agente: r.agente.mes_agente, es_nuevo: r.agente.es_nuevo,
        nueva, renov: Math.round(r.primas.renovacionQ || 0), ubicacion: Math.round(r.primas.ubicacionQ || 0),
        indice: r.indice.actual, conPendiente: r.indice.conPendiente,
        bonos: Math.round(r.bonos.total_trimestre || 0),
        meta: Math.round(meta), cumplimiento: meta > 0 ? div(nueva, meta) : null,
        rehabilitables: r.accionables.rehabilitables.length, pendientes: r.accionables.pendientesPago.length,
        /* Componentes crudos del índice para re-agregar cualquier subconjunto en el cliente */
        idx: {
          base: Math.round(r.indice.baseAConservar), cons: Math.round(r.indice.baseConservada), pend: Math.round(r.indice.basePendiente),
          hoyCons: Math.round(r.indice.hoy.baseConservada), hoyPend: Math.round(r.indice.hoy.basePendiente), rehab: Math.round(rehabA),
        },
      };
    }).sort((a, b) => b.nueva - a.nueva);

    const totalNuevaQ = leaderboard.reduce((s, a) => s + a.nueva, 0);
    const totalRenovQ = leaderboard.reduce((s, a) => s + a.renov, 0);
    leaderboard.forEach(a => { a.aporte = totalNuevaQ > 0 ? div(a.nueva, totalNuevaQ) : 0; });

    const indicePromo = {
      actual: div(agCons, agBase), conPendiente: div(agCons + agPend, agBase),
      hoy: div(hoyCons, agBase), hoyConPendiente: div(hoyCons + hoyPend, agBase),
      techo: div(Math.min(hoyCons + hoyPend + baseRehab, agBase), agBase),
      baseAConservar: Math.round(agBase),
    };

    /* ── 4) Run-rate y cierre de año (al ritmo actual) ── */
    const anios = [...new Set(produccionMensual.map(m => m.anio))].sort();
    const anioActual = anios.length ? anios[anios.length - 1] : new Date().getFullYear();
    const mesesAnio = produccionMensual.filter(m => m.anio === anioActual);
    const mesesConDatos = mesesAnio.filter(m => m.total > 0).length || mesesAnio.length || 1;
    const ytdNueva = mesesAnio.reduce((s, m) => s + m.nueva, 0);
    const ytdRenov = mesesAnio.reduce((s, m) => s + m.renov, 0);
    const baselineNueva = ytdNueva / mesesConDatos;      // prima nueva mensual promedio del año
    const baselineRenov = ytdRenov / mesesConDatos;
    /* Ritmo reciente = promedio de los 3 últimos meses con venta nueva>0 */
    const conVenta = mesesAnio.filter(m => m.nueva > 0);
    const ult3 = conVenta.slice(-3);
    const runRateNueva = ult3.length ? ult3.reduce((s, m) => s + m.nueva, 0) / ult3.length : baselineNueva;
    const mesesRestantes = Math.max(0, 12 - mesesConDatos);
    /* Último trimestre COMPLETO (3 meses con datos) = baseline más representativo
       para proyectar, evitando el sesgo de meses de corte parcial (ej. el mes
       en curso trae solo media quincena). */
    const trimMeses = new Map();
    for (const m of mesesAnio.filter(x => x.total > 0)) {
      const t = Math.ceil(m.mes / 3);
      const cur = trimMeses.get(t) || { t, meses: 0, nueva: 0, renov: 0 };
      cur.meses++; cur.nueva += m.nueva; cur.renov += m.renov; trimMeses.set(t, cur);
    }
    const trimsCompletos = [...trimMeses.values()].filter(t => t.meses >= 3).sort((a, b) => b.t - a.t);
    const trimBase = trimsCompletos[0] || [...trimMeses.values()].sort((a, b) => b.t - a.t)[0] || { t: 0, meses: 1, nueva: baselineNueva, renov: baselineRenov };
    const mensualTrimNueva = trimBase.nueva / (trimBase.meses || 1);
    const mensualTrimRenov = trimBase.renov / (trimBase.meses || 1);
    const cierreAnio = {
      anio: anioActual, mesesConDatos, mesesRestantes,
      ytdNueva: Math.round(ytdNueva), ytdRenov: Math.round(ytdRenov),
      baselineNuevaMensual: Math.round(baselineNueva), runRateNuevaMensual: Math.round(runRateNueva),
      trimBaseLabel: trimBase.t ? `T${trimBase.t} ${anioActual}${trimBase.meses < 3 ? ' (parcial)' : ''}` : '—',
      mensualTrimNueva: Math.round(mensualTrimNueva), mensualTrimRenov: Math.round(mensualTrimRenov),
      proyNuevaAnio: Math.round(ytdNueva + mensualTrimNueva * mesesRestantes),
      proyNuevaAnioRitmo: Math.round(ytdNueva + runRateNueva * mesesRestantes),
      proyRenovAnio: Math.round(ytdRenov + mensualTrimRenov * mesesRestantes),
    };

    /* ── 5) Comparativa periodo a periodo (año/trimestre) ── */
    const porTrim = new Map();
    for (const p of primasHist) {
      const k = `${p.anio}-T${p.trimestre}`;
      const cur = porTrim.get(k) || { anio: p.anio, trimestre: p.trimestre, nueva: 0, renov: 0 };
      cur.nueva += Number(p.prima_pagada_inicial) || 0; cur.renov += Number(p.prima_pagada_renovacion) || 0;
      porTrim.set(k, cur);
    }
    const comparativaTrim = [...porTrim.values()].sort((a, b) => a.anio - b.anio || a.trimestre - b.trimestre)
      .map(t => ({ label: `T${t.trimestre} ${t.anio}`, anio: t.anio, trimestre: t.trimestre, nueva: Math.round(t.nueva), renov: Math.round(t.renov), total: Math.round(t.nueva + t.renov) }));

    /* ── 6) Diagnóstico: qué está fallando ── */
    const activos = leaderboard.filter(a => a.estatus !== 'BAJA');
    const sinProduccion = activos.filter(a => a.nueva === 0);
    const bajoIndice = leaderboard.filter(a => (a.renov > 0 || a.conPendiente < 1) && a.conPendiente < 0.86 && a.conPendiente > 0);
    const nuevosSinArrancar = activos.filter(a => a.es_nuevo && a.nueva === 0);
    const top3 = leaderboard.slice(0, 3).reduce((s, a) => s + a.nueva, 0);
    const concentracionTop3 = totalNuevaQ > 0 ? div(top3, totalNuevaQ) : 0;
    /* El último snapshot de índice suele ser el trimestre EN CURSO: su índice
       "crudo" (conservada/base) está artificialmente bajo porque faltan cobros.
       Lo marcamos como en curso y le pegamos el índice realista (con pendientes)
       que ya calculamos en vivo, para no dibujar un falso desplome. */
    const ultHist = indiceHist[indiceHist.length - 1];
    if (ultHist && Math.abs(ultHist.baseAConservar - indicePromo.baseAConservar) < indicePromo.baseAConservar * 0.02) {
      ultHist.enCurso = true;
      ultHist.indiceRealista = indicePromo.conPendiente;
      ultHist.techo = indicePromo.techo;
    }
    /* Tendencia honesta: índice realista actual vs. el periodo cerrado previo */
    const prevHist = indiceHist[indiceHist.length - 2];
    const indiceActualComparable = ultHist?.enCurso ? indicePromo.conPendiente : (ultHist?.indice ?? 0);
    const tendenciaIndice = prevHist ? indiceActualComparable - prevHist.indice : 0;

    const diagnostico = [];
    if (indicePromo.conPendiente < 0.86) diagnostico.push({ severidad: 'alta', tipo: 'indice', titulo: 'Índice bajo el mínimo de bono', detalle: `El índice realista (con pendientes) es ${(indicePromo.conPendiente * 100).toFixed(1)}%, debajo del 86% que activa bonos. Cobrando y rehabilitando llegas a ${(indicePromo.techo * 100).toFixed(1)}%.`, valor: indicePromo.conPendiente });
    if (sinProduccion.length) diagnostico.push({ severidad: sinProduccion.length > activos.length / 2 ? 'alta' : 'media', tipo: 'produccion', titulo: `${sinProduccion.length} asesores sin venta este trimestre`, detalle: `De ${activos.length} asesores activos, ${sinProduccion.length} no han colocado prima nueva. Reactivarlos es la palanca más rápida.`, valor: sinProduccion.length, nombres: sinProduccion.slice(0, 8).map(a => a.nombre) });
    if (concentracionTop3 > 0.6) diagnostico.push({ severidad: 'media', tipo: 'concentracion', titulo: 'Producción muy concentrada', detalle: `El ${(concentracionTop3 * 100).toFixed(0)}% de la venta nueva depende de solo 3 asesores. Riesgo si alguno baja el ritmo.`, valor: concentracionTop3 });
    if (nuevosSinArrancar.length) diagnostico.push({ severidad: 'media', tipo: 'onboarding', titulo: `${nuevosSinArrancar.length} asesores nuevos sin arrancar`, detalle: `Asesores en sus primeros meses aún sin primera venta — atención de onboarding.`, valor: nuevosSinArrancar.length, nombres: nuevosSinArrancar.slice(0, 8).map(a => a.nombre) });
    if (bajoIndice.length) diagnostico.push({ severidad: 'media', tipo: 'conservacion', titulo: `${bajoIndice.length} asesores con índice bajo 86%`, detalle: `Su conservación individual no alcanza banda de bono; revisar cobranza y rehabilitaciones de su cartera.`, valor: bajoIndice.length, nombres: bajoIndice.slice(0, 8).map(a => a.nombre) });
    if (tendenciaIndice < -0.02) diagnostico.push({ severidad: 'alta', tipo: 'tendencia', titulo: 'El índice viene cayendo', detalle: `Cayó ${(Math.abs(tendenciaIndice) * 100).toFixed(1)} pts vs. el periodo anterior. La cartera se está desconservando.`, valor: tendenciaIndice });

    /* ── 7) Estrellas y focos rojos ── */
    const estrellas = leaderboard.filter(a => a.nueva > 0).slice(0, 5).map(a => ({ ...a, buenIndice: a.conPendiente >= 0.86 }));
    const focos = [...sinProduccion.map(a => ({ ...a, motivo: 'Sin venta nueva' })), ...bajoIndice.filter(a => a.nueva > 0).map(a => ({ ...a, motivo: `Índice ${(a.conPendiente * 100).toFixed(0)}%` }))]
      .filter((a, i, arr) => arr.findIndex(x => x.clave === a.clave) === i).slice(0, 8);

    /* ── 8) DATOS CRUDOS para modelado interactivo en el cliente (filtros por
       año / asesor, tendencias, escenarios). Volumen pequeño: ~26×8 filas. ── */
    const nombrePorClave = new Map(agentes.map(a => [a.clave, a.nombre]));
    const prodPorClaveMes = [...primasHist.reduce((m, p) => {
      const k = `${p.clave}|${p.anio}|${p.mes}`;
      const cur = m.get(k) || { clave: p.clave, anio: p.anio, mes: p.mes, nueva: 0, renov: 0 };
      cur.nueva += Number(p.prima_pagada_inicial) || 0; cur.renov += Number(p.prima_pagada_renovacion) || 0;
      return m.set(k, cur);
    }, new Map()).values()].map(x => ({ ...x, nueva: Math.round(x.nueva), renov: Math.round(x.renov) }));
    const indiceClavePeriodo = indHist.map(h => ({ clave: h.clave, ...parsePeriodo(h.periodo), periodo: h.periodo, base: Math.round(Number(h.base_a_conservar) || 0), cons: Math.round(Number(h.base_conservada) || 0) }));
    const aniosDisponibles = [...new Set([...primasHist.map(p => p.anio), ...indiceClavePeriodo.map(h => h.anio)])].filter(Boolean).sort();
    const agentesLista = leaderboard.map(a => ({ clave: a.clave, nombre: a.nombre, es_nuevo: a.es_nuevo, cuaderno: a.cuaderno }));

    res.json({
      anioActual, umbralPromo: 0.84, umbralAgente: 0.86,
      totalAgentes: agentes.length, activos: activos.length,
      produccionMensual, indiceHist, comparativaTrim,
      leaderboard, estrellas, focos, diagnostico,
      indicePromo,
      totales: { nuevaQ: totalNuevaQ, renovQ: totalRenovQ },
      cierreAnio,
      concentracionTop3, tendenciaIndice: Math.round(tendenciaIndice * 10000) / 10000,
      raw: { prodPorClaveMes, indiceClavePeriodo, aniosDisponibles, agentesLista },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Trayectoria del índice a N meses: ¿cuándo cruzo el 86/90/94% si vendo
   $X/mes conservando cierta tasa? Defaults: ritmo = promedio mensual de prima
   ubicación del último trimestre; tasa = último índice histórico del agente. */
router.post('/ingresos/trayectoria', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const clave = String(req.body.clave || scope.clave || '').toUpperCase();
    if (!clave) return res.status(400).json({ error: 'clave requerida' });
    if (scope.restricted && scope.clave !== clave) return res.status(403).json({ error: 'Solo puedes proyectar tu propia clave' });

    const { agentes, primas, polizas } = await fetchIngresosData(clave);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });

    let ventaMensual = Number(req.body.ventaMensual);
    if (!Number.isFinite(ventaMensual) || ventaMensual < 0) {
      const conPrima = primas.filter(p => Number(p.prima_ubicacion) > 0);
      ventaMensual = conPrima.length ? conPrima.reduce((s, p) => s + Number(p.prima_ubicacion), 0) / conPrima.length : 0;
    }
    let tasaConservacion = Number(req.body.tasaConservacion);
    if (!Number.isFinite(tasaConservacion) || tasaConservacion <= 0 || tasaConservacion > 1) {
      const { data: hist } = await getDB().from('crm_pru_indices_hist').select('indice').eq('clave', clave).order('periodo', { ascending: false }).limit(1);
      tasaConservacion = (hist && hist[0] && Number(hist[0].indice) > 0) ? Math.min(1, Number(hist[0].indice)) : 0.90;
    }

    const tray = proyectarTrayectoria({
      polizas,
      ventaMensual,
      tasaConservacion,
      cobrarPendientes: Boolean(req.body.cobrarPendientes),
      meses: Math.min(36, Math.max(3, Number(req.body.meses) || 15)),
    });
    res.json({ clave, nombre: agentes[0].nombre, ...tray });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Expediente de una póliza del índice ──
   Liga la fila de crm_pru_polizas_indice con su expediente en crm_policies por
   número de póliza (campo cifrado → barrido con descifrado). Da el contexto
   para trabajar una rehabilitación: cliente, motivo de cancelación y notas. */
const normNumPoliza = (v) => String(v ?? '').trim().replace(/\.0$/, '');

async function findPolicyByNumero(db, numero) {
  const rows = await fetchAllRows(() => db.from('crm_policies')
    .select('*, crm_clients(id, nombre, telefono, email), crm_agents(nombre)'));
  for (const r of rows) {
    const d = decryptFields(r, 'crm_policies');
    if (normNumPoliza(d.poliza) === numero) return d;
  }
  return null;
}

async function loadIndexRowScoped(req, res) {
  const scope = await resolveClaveScope(req, res);
  if (!scope) return null;
  const db = getDB();
  const { data: pol, error } = await db.from('crm_pru_polizas_indice').select('*').eq('id', req.params.id).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return null; }
  if (!pol) { res.status(404).json({ error: 'Póliza no encontrada' }); return null; }
  if (scope.restricted && scope.clave !== String(pol.clave).toUpperCase()) {
    res.status(403).json({ error: 'Solo puedes consultar pólizas de tu propia clave' });
    return null;
  }
  return { db, pol };
}

router.get('/ingresos/poliza/:id/expediente', async (req, res) => {
  try {
    const ctx = await loadIndexRowScoped(req, res);
    if (!ctx) return;
    const numero = normNumPoliza(ctx.pol.poliza);
    const policy = await findPolicyByNumero(ctx.db, numero);
    let notes = [];
    if (policy?.crm_clients?.id) {
      const { data: n } = await ctx.db.from('crm_notes').select('*')
        .eq('client_id', policy.crm_clients.id).order('created_at', { ascending: false });
      notes = (n || []).filter(x => String(x.texto || '').includes(`[Póliza ${numero}]`));
    }
    const personalizaPlanes = await getPersonalizaPlanes();
    const hoy = new Date();
    /* Todas las coberturas de esta póliza (misma clave + número) para dar la
       base TOTAL y el número de coberturas, no solo la fila abierta. */
    const { data: coberturasRaw } = await ctx.db.from('crm_pru_polizas_indice').select('*')
      .eq('clave', ctx.pol.clave).eq('poliza', ctx.pol.poliza);
    const coberturas = (coberturasRaw && coberturasRaw.length) ? coberturasRaw : [ctx.pol];
    const baseTotal = Math.round(coberturas.reduce((s, c) => s + (Number(c.base_a_conservar_mxn) || 0), 0) * 100) / 100;

    /* Estatus DERIVADO a hoy (incluye periodo de gracia): una Vigente con pago
       vencido pero <30 días está en gracia; con la gracia vencida se toma como
       cancelada y entra a rehabilitación desde el fin de gracia. */
    const estatusDerivado = derivarEstatus(ctx.pol, hoy);
    const gracia = estatusDerivado === 'PENDIENTE DE PAGO' ? graciaInfo(ctx.pol, hoy) : null;
    const esVigente = String(ctx.pol.estatus_calculo || '').toUpperCase() === 'VIGENTE';
    const finG = ctx.pol.pagado_hasta && finGracia(ctx.pol.pagado_hasta) ? isoLocal(finGracia(ctx.pol.pagado_hasta)) : null;
    const fechaCancelEfectiva = esVigente ? finG : (ctx.pol.fecha_ultima_cancelacion || finG);
    const rehab = (estatusDerivado === 'NO CONSERVADA' && fechaCancelEfectiva)
      ? clasificarRehabilitacion({ ...ctx.pol, fecha_ultima_cancelacion: fechaCancelEfectiva }, hoy, compilePersonaliza(personalizaPlanes))
      : null;
    res.json({ indice: ctx.pol, numero, policy, notes, rehab,
      estatus_derivado: estatusDerivado, gracia, base_total: baseTotal,
      coberturas: coberturas.length, fecha_cancelacion_efectiva: fechaCancelEfectiva });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Motivo de cancelación: anotación operativa de la rehabilitación — la puede
   capturar el asesor dueño de la clave o la agencia (no pasa por crm_can_edit) */
router.put('/ingresos/poliza/:id/motivo', async (req, res) => {
  try {
    const ctx = await loadIndexRowScoped(req, res);
    if (!ctx) return;
    const numero = normNumPoliza(ctx.pol.poliza);
    const policy = await findPolicyByNumero(ctx.db, numero);
    if (!policy) return res.status(404).json({ error: 'Esta póliza aún no tiene expediente en el CRM — carga el reporte de pólizas en la sección Pólizas' });
    const patch = encryptFields({ motivo_cancelacion: String(req.body.motivo_cancelacion || '').trim() || null }, 'crm_policies');
    const { error } = await ctx.db.from('crm_policies')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', policy.id);
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req, 'editar', 'poliza-motivo-cancelacion', policy.id, `póliza ${numero}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Registrar un cobro o rehabilitación real (solo agencia): avanza pagado_hasta
   un periodo según la frecuencia de pago y el índice "hoy" lo refleja al
   instante. No toca el estatus del corte — ese es el oficial de Prudential. */
router.patch('/ingresos/poliza/:id', async (req, res) => {
  try {
    if (!isAgency(req.user.role)) return res.status(403).json({ error: 'Solo la agencia registra cobros; los asesores pueden simularlos' });
    const accion = req.body.accion;
    if (!['pago', 'rehabilitar'].includes(accion)) return res.status(400).json({ error: "accion debe ser 'pago' o 'rehabilitar'" });

    const db = getDB();
    const { data: pol, error: e1 } = await db.from('crm_pru_polizas_indice').select('*').eq('id', req.params.id).maybeSingle();
    if (e1) return res.status(500).json({ error: e1.message });
    if (!pol) return res.status(404).json({ error: 'Póliza no encontrada' });

    const meses = MESES_FRECUENCIA[String(pol.frecuencia_pago || '').toUpperCase()] || 12;
    const desde = pol.pagado_hasta ? new Date(pol.pagado_hasta) : new Date();
    desde.setMonth(desde.getMonth() + meses);
    const patch = { pagado_hasta: desde.toISOString().slice(0, 10), updated_at: new Date().toISOString() };
    if (accion === 'rehabilitar') patch.estatus_calculo = 'Vigente';

    const { data, error: e2 } = await db.from('crm_pru_polizas_indice').update(patch).eq('id', pol.id).select();
    if (e2) return res.status(500).json({ error: e2.message });
    logActivity(req, accion === 'pago' ? 'cobro' : 'rehabilitar', 'poliza-indice', pol.id, `${pol.clave} · ${pol.poliza} → pagada hasta ${patch.pagado_hasta}`);
    res.json({ poliza: data[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════ SEMILLAS · base de leads customizable ═══════════════
   Base viva estilo hoja de cálculo, SOLO para nivel agencia (superadmin+agencia,
   NO admin). Cada lead es una semilla con servicios derivados + bitácora.
   Borrar columnas: SOLO Arturo (superadmin). */
const soloAgencia = (req, res) => {
  if (!['superadmin', 'agencia'].includes(req.user.role)) { res.status(403).json({ error: 'Sección exclusiva de nivel agencia' }); return false; }
  return true;
};

router.get('/semillas/columnas', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const { data, error } = await getDB().from('semillas_columnas').select('*').order('orden');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ columnas: data || [], puede_borrar_columnas: req.user.role === 'superadmin' });
});

router.post('/semillas/columnas', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const b = req.body;
  if (!b.label) return res.status(400).json({ error: 'label requerido' });
  const col_key = String(b.col_key || b.label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 58) || ('col_' + Date.now());
  const row = { col_key, label: b.label, tipo: b.tipo || 'text', formula: b.formula || null,
    visible: b.visible !== false, orden: b.orden ?? 999, ancho: b.ancho || 160, grupo: b.grupo || 'Personalizadas' };
  const { data, error } = await getDB().from('semillas_columnas').insert([row]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ columna: data[0] });
});

router.patch('/semillas/columnas/:id', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const patch = {};
  for (const k of ['label', 'tipo', 'visible', 'orden', 'ancho', 'formula', 'grupo']) if (k in req.body) patch[k] = req.body[k];
  const { data, error } = await getDB().from('semillas_columnas').update(patch).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ columna: data[0] });
});

router.delete('/semillas/columnas/:id', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Solo Arturo puede eliminar columnas' });
  const { error } = await getDB().from('semillas_columnas').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/semillas/leads', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  try {
    let leads = await fetchAllRows(() => getDB().from('semillas_leads')
      .select('*, semillas_servicios(id,categoria,estatus,monto_estimado)').order('id'));
    const q = String(req.query.q || '').toLowerCase();
    if (q) leads = leads.filter(l => JSON.stringify(l.data).toLowerCase().includes(q));
    res.json({ leads });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/semillas/leads/:id', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const db = getDB();
  const { data: lead } = await db.from('semillas_leads').select('*').eq('id', req.params.id).maybeSingle();
  if (!lead) return res.status(404).json({ error: 'Semilla no encontrada' });
  const [{ data: servicios }, { data: seguimientos }] = await Promise.all([
    db.from('semillas_servicios').select('*').eq('lead_id', lead.id).order('monto_estimado', { ascending: false }),
    db.from('semillas_seguimientos').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
  ]);
  res.json({ lead, servicios: servicios || [], seguimientos: seguimientos || [] });
});

router.patch('/semillas/leads/:id/celda', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const { key, valor } = req.body;
  if (!key) return res.status(400).json({ error: 'key requerido' });
  const db = getDB();
  const { data: lead } = await db.from('semillas_leads').select('data').eq('id', req.params.id).maybeSingle();
  if (!lead) return res.status(404).json({ error: 'Semilla no encontrada' });
  const nuevo = { ...(lead.data || {}), [key]: valor };
  const { data, error } = await db.from('semillas_leads').update({ data: nuevo, updated_at: new Date().toISOString() }).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ lead: data[0] });
});

router.patch('/semillas/leads/:id', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const patch = { updated_at: new Date().toISOString() };
  for (const k of ['estatus', 'owner']) if (k in req.body) patch[k] = req.body[k];
  const { data, error } = await getDB().from('semillas_leads').update(patch).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ lead: data[0] });
});

router.post('/semillas/leads/:id/servicios', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const b = req.body;
  const row = { lead_id: Number(req.params.id), categoria: b.categoria || 'Servicio', estatus: b.estatus || 'detectado', monto_estimado: b.monto_estimado || 0, notas: b.notas || null };
  const { data, error } = await getDB().from('semillas_servicios').insert([row]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ servicio: data[0] });
});

router.patch('/semillas/servicios/:id', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const patch = { updated_at: new Date().toISOString() };
  for (const k of ['categoria', 'estatus', 'monto_estimado', 'notas']) if (k in req.body) patch[k] = req.body[k];
  const { data, error } = await getDB().from('semillas_servicios').update(patch).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ servicio: data[0] });
});

router.post('/semillas/leads/:id/seguimientos', async (req, res) => {
  if (!soloAgencia(req, res)) return;
  const b = req.body;
  if (!b.texto) return res.status(400).json({ error: 'texto requerido' });
  const row = { lead_id: Number(req.params.id), servicio_id: b.servicio_id || null, texto: b.texto, tipo: b.tipo || 'nota', user_id: req.user.id, user_name: req.user.name };
  const { data, error } = await getDB().from('semillas_seguimientos').insert([row]).select();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'crear', 'semilla-seguimiento', req.params.id, b.tipo || 'nota');
  res.status(201).json({ seguimiento: data[0] });
});

module.exports = router;
