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

/* ── KPIs de un conjunto de pólizas para un año ── */
function computeKpis(policies, goals, anio, pruPrimas = []) {
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

  /* Cortes oficiales Prudential (crm_pru_primas): en los meses con corte, la
     prima pagada inicial/renovación reportada por Prudential ES la venta real
     del mes — sustituye lo derivado de pólizas (que solo trae el índice de
     conservación y deja las ventas nuevas en 0). */
  for (const pr of pruPrimas) {
    if (Number(pr.anio) !== anio) continue;
    const m = months[Number(pr.mes) - 1];
    if (!m) continue;
    m.primaNueva = Number(pr.prima_pagada_inicial) || 0;
    m.primaRenovacion = Number(pr.prima_pagada_renovacion) || 0;
  }

  for (const g of goals) {
    if (g.anio === anio && g.mes >= 1 && g.mes <= 12) months[g.mes - 1].meta = Number(g.meta_prima) || 0;
  }

  const totalNueva = months.reduce((s, m) => s + m.primaNueva, 0);
  const totalRenovacion = months.reduce((s, m) => s + m.primaRenovacion, 0);
  const totalMeta = months.reduce((s, m) => s + m.meta, 0);
  const totalPipeline = months.reduce((s, m) => s + m.pipeline, 0);
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
  for (const k of kpisList) {
    k.months.forEach((m, i) => {
      months[i].primaNueva += m.primaNueva; months[i].primaRenovacion += m.primaRenovacion;
      months[i].meta += m.meta; months[i].pipeline += m.pipeline;
    });
    conservacion.baseConservar += k.conservacion.baseConservar;
    conservacion.baseConservada += k.conservacion.baseConservada;
    conservacion.basePendiente += k.conservacion.basePendiente;
  }
  const totalNueva = months.reduce((s, m) => s + m.primaNueva, 0);
  const totalRenovacion = months.reduce((s, m) => s + m.primaRenovacion, 0);
  const totalMeta = months.reduce((s, m) => s + m.meta, 0);
  const totalPipeline = months.reduce((s, m) => s + m.pipeline, 0);
  return {
    months,
    totales: {
      primaNueva: totalNueva, primaRenovacion: totalRenovacion, primaTotal: totalNueva + totalRenovacion,
      meta: totalMeta, pipeline: totalPipeline, cumplimiento: totalMeta > 0 ? (totalNueva / totalMeta) : null,
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
    'alta_pru', 'alta_il', 'activo_fsc'];
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
    'comision_pct', 'comision_monto', 'comision_estatus', 'comision_fecha', 'comision_notas', 'aseguradora', 'client_id', 'motivo_compra'];
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
    const [policies, clients] = await Promise.all([
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
    res.json({
      totales: {
        polizas: policies.length,
        vigentes: vigentes.length,
        canceladas: policies.filter(p => p.estatus === 'cancelada').length,
        clientes: clientesReales.length,
        primaNueva: Math.round(policies.filter(p => bloqueDe(p) === 0).reduce((s, p) => s + (Number(p.prima) || 0), 0) * 100) / 100,
        primaRenovacion: Math.round(policies.filter(p => typeof bloqueDe(p) === 'number' && bloqueDe(p) > 0).reduce((s, p) => s + (Number(p.prima) || 0), 0) * 100) / 100,
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
  const { data: agents } = await agentsQ;
  const ids = (agents || []).map(a => a.id);
  if (!ids.length) return { agents: [], policies: [], goals: [], clients: [] };

  const claves = (agents || []).map(a => a.clave).filter(Boolean);
  const [policies, clients, { data: goals }, { data: pruPrimas }] = await Promise.all([
    fetchAllRows(() => db.from('crm_policies').select('*').in('agent_id', ids).order('id')),
    fetchAllRows(() => db.from('crm_clients').select('id, agent_id, etapa').in('agent_id', ids).order('id')),
    db.from('crm_goals').select('*').eq('anio', anio).in('agent_id', ids),
    claves.length ? db.from('crm_pru_primas').select('*').eq('anio', anio).in('clave', claves) : Promise.resolve({ data: [] }),
  ]);
  return { agents: agents || [], policies, goals: goals || [], clients, pruPrimas: pruPrimas || [] };
}

function buildAgentSummary(agent, policies, goals, clients, anio, pruPrimas = []) {
  const own = policies.filter(p => p.agent_id === agent.id);
  const ownGoals = goals.filter(g => g.agent_id === agent.id);
  const ownClients = clients.filter(c => c.agent_id === agent.id);
  const kpis = computeKpis(own, ownGoals, anio, pruPrimas.filter(pr => pr.clave && pr.clave === agent.clave));
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
  const { agents, policies, goals, clients, pruPrimas } = await loadAgentData(db, anio, scope.restricted ? [scope.agentId] : null);

  const porAgente = agents.map(a => buildAgentSummary(a, policies, goals, clients, anio, pruPrimas));

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
  const { agents, policies, goals, clients, pruPrimas } = await loadAgentData(db, anio, [agentId]);
  if (!agents.length) return res.status(404).json({ error: 'Asesor no encontrado' });
  res.json({ anio, ...buildAgentSummary(agents[0], policies, goals, clients, anio, pruPrimas) });
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
  const { data: agents, error: eA } = await agQ;
  if (eA) return res.status(500).json({ error: eA.message });
  const ids = (agents || []).map(a => a.id);
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
    return {
      id: a.id, clave: a.clave, nombre: a.nombre, user_id: a.user_id,
      estatus_pru: a.estatus || null, activo_fsc: a.activo_fsc !== false,
      alta_pru: a.alta_pru || a.fecha_inicio_calculos || null,
      alta_il: a.alta_il || null,
      registrado_pru: !!(a.clave || a.alta_pru),
      registrado_il: !!a.alta_il,
      cuaderno: a.cuaderno || null,
      polizas: { pru: porAseg('PRU'), il: porAseg('IL') },
      ultima_venta: ultimaVenta,
      sin_actividad: a.activo_fsc === false || inactivoPru,
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
  const { agents, policies, goals, clients, pruPrimas } = await loadAgentData(db, anio, [agentId]);
  if (!agents.length) return null;
  const summary = buildAgentSummary(agents[0], policies, goals, clients, anio, pruPrimas);

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

const { computeIngresos, proyectarTrayectoria, derivarEstatus, MESES_FRECUENCIA, PIR_DEFAULT } = require('../utils/ingresos');

let _pirCache = null;
async function getPirTablas() {
  if (_pirCache) return _pirCache;
  const { data } = await getDB().from('crm_pir_tablas').select('tablas').eq('anio', new Date().getFullYear()).maybeSingle();
  _pirCache = (data && data.tablas) || PIR_DEFAULT;
  return _pirCache;
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

async function fetchIngresosData(clave) {
  const db = getDB();
  let qA = db.from('crm_pru_agentes').select('*').order('nombre');
  let qP = db.from('crm_pru_primas').select('*');
  let qZ = db.from('crm_pru_polizas_indice').select('*');
  if (clave) { qA = qA.eq('clave', clave); qP = qP.eq('clave', clave); qZ = qZ.eq('clave', clave); }
  const [{ data: agentes, error: e1 }, { data: primas, error: e2 }, { data: polizas, error: e3 }] =
    await Promise.all([qA, qP, qZ]);
  const err = e1 || e2 || e3;
  if (err) throw new Error(err.message);
  return { agentes: agentes || [], primas: primas || [], polizas: polizas || [] };
}

/* Resumen de todos los agentes (o el propio): índice + bonos del trimestre */
router.get('/ingresos/overview', async (req, res) => {
  try {
    const scope = await resolveClaveScope(req, res);
    if (!scope) return;
    const [pir, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), fetchIngresosData(scope.clave)]);
    const rows = agentes.map(a => {
      const r = computeIngresos({
        agente: a,
        primas: primas.filter(p => p.clave === a.clave),
        polizas: polizas.filter(p => p.clave === a.clave),
        pir,
      });
      return {
        clave: a.clave, nombre: a.nombre, cuaderno: a.cuaderno, estatus: a.estatus,
        mes_agente: r.agente.mes_agente, es_nuevo: r.agente.es_nuevo,
        indice: r.indice, primas: r.primas,
        bonos: { total_trimestre: r.bonos.total_trimestre, trimestral: r.bonos.trimestral, conservacion: r.bonos.conservacion, total_mensuales: r.bonos.total_mensuales },
        accionables: { pendientes: r.accionables.pendientesPago.length, rehabilitables: r.accionables.rehabilitables.length },
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
    const [pir, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), fetchIngresosData(null)]);
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
        pir,
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
    const seisMesesAtras = new Date(hoy); seisMesesAtras.setMonth(hoy.getMonth() - 6);
    for (const p of polizas) {
      conteo.total++;
      const st = derivarEstatus(p, hoy);
      if (st === 'CONSERVADA') conteo.conservadas++;
      else if (st === 'PENDIENTE DE PAGO') conteo.pendientes++;
      else {
        conteo.noConservadas++;
        if (p.fecha_ultima_cancelacion && new Date(p.fecha_ultima_cancelacion) >= seisMesesAtras) conteo.rehabilitables++;
      }
    }

    const div = (n, d) => (d > 0 ? Math.round((n / d) * 10000) / 10000 : 1);
    const baseRehabilitable = rehabilitables.reduce((s, p) => s + p.monto, 0);
    /* El impacto de cada póliza se re-expresa sobre la base TOTAL de la promotoría */
    const reimpacto = (lista) => lista.map(p => ({ ...p, impacto_indice: baseAConservar > 0 ? p.monto / baseAConservar : 0 }));

    res.json({
      umbral: 0.84,
      umbralAgente: 0.86,
      agentes: agentes.length,
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
        rehabilitables: reimpacto(rehabilitables.sort((a, b) => a.dias_restantes - b.dias_restantes)),
      },
    });
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
    const [pir, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), fetchIngresosData(null)]);
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
        pir,
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
        rehab.length ? `♻️ AÚN REHABILITABLES (canceladas hace menos de 6 meses — después ya no se puede):` : null,
        ...rehab.slice(0, 8).map(p => `  · Póliza ${p.poliza} — ${money(p.monto)} · cancelada ${p.fecha_ultima_cancelacion || 's/f'} · recuperaría +${pctTxt(p.impacto_indice)}`),
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
    const [pir, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), fetchIngresosData(clave)]);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });
    const detalle = computeIngresos({ agente: agentes[0], primas, polizas, pir });
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
    const [pir, { agentes, primas, polizas }] = await Promise.all([getPirTablas(), fetchIngresosData(clave)]);
    if (!agentes.length) return res.status(404).json({ error: `No hay data Prudential para la clave ${clave}` });
    const base = computeIngresos({ agente: agentes[0], primas, polizas, pir });
    const sim = computeIngresos({ agente: agentes[0], primas, polizas, pir }, {
      ventaAdicional: Number(req.body.ventaAdicional) || 0,
      cobrarPolizas: req.body.cobrarPolizas || [],
      rehabilitarPolizas: req.body.rehabilitarPolizas || [],
    });
    res.json({ base, simulado: sim, delta: { bonos: round2sim(sim.bonos.total_trimestre - base.bonos.total_trimestre), indice: sim.indice.operativo - base.indice.operativo } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const round2sim = (n) => Math.round(n * 100) / 100;

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

module.exports = router;
