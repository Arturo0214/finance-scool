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

const monthOf = (dateStr) => (dateStr ? parseInt(String(dateStr).slice(5, 7), 10) : null);
const yearOf = (dateStr) => (dateStr ? parseInt(String(dateStr).slice(0, 4), 10) : null);

/* ── KPIs de un conjunto de pólizas para un año ── */
function computeKpis(policies, goals, anio) {
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
  const allowed = ['clave', 'nombre', 'cuaderno', 'fecha_inicio_calculos', 'estatus', 'telefono', 'email', 'user_id', 'fireflies_api_key'];
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
  let q = db.from('crm_clients').select('*, crm_agents(nombre, clave)').order('created_at', { ascending: false });
  if (scope.restricted) q = q.eq('agent_id', scope.agentId);
  else if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
  if (req.query.etapa) q = q.eq('etapa', req.query.etapa);
  if (req.query.q) q = q.ilike('nombre', `%${req.query.q}%`);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ clients: decryptRows(data, 'crm_clients') });
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
  const allowed = ['nombre', 'email', 'telefono', 'rfc', 'fecha_nacimiento', 'ocupacion', 'empresa', 'direccion', 'etapa', 'origen', 'notas', 'agent_id',
    'ingreso_mensual', 'gasto_mensual', 'saldo_afore', 'retiro_deseado', 'edad_retiro_deseada'];
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
  let q = db.from('crm_policies').select('*, crm_clients(nombre), crm_agents(nombre, clave)').order('created_at', { ascending: false });
  if (scope.restricted) q = q.eq('agent_id', scope.agentId);
  else if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
  if (req.query.estatus) q = q.eq('estatus', req.query.estatus);
  if (req.query.client_id) q = q.eq('client_id', req.query.client_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ policies: decryptRows(data, 'crm_policies') });
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
  const allowed = ['poliza', 'plan', 'tipo', 'prima', 'forma_pago', 'suma_asegurada', 'fecha_emision', 'fecha_pago', 'fecha_renovacion', 'estatus', 'moneda', 'notas',
    'comision_pct', 'comision_monto', 'comision_estatus', 'comision_fecha', 'comision_notas'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k] === '' ? null : req.body[k];
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
  const { error } = await db.from('crm_policies').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req, 'eliminar', 'poliza', req.params.id, null);
  res.json({ ok: true });
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

  const [{ data: policies }, { data: goals }, { data: clients }] = await Promise.all([
    db.from('crm_policies').select('*').in('agent_id', ids),
    db.from('crm_goals').select('*').eq('anio', anio).in('agent_id', ids),
    db.from('crm_clients').select('id, agent_id, etapa').in('agent_id', ids),
  ]);
  return { agents: agents || [], policies: policies || [], goals: goals || [], clients: clients || [] };
}

function buildAgentSummary(agent, policies, goals, clients, anio) {
  const own = policies.filter(p => p.agent_id === agent.id);
  const ownGoals = goals.filter(g => g.agent_id === agent.id);
  const ownClients = clients.filter(c => c.agent_id === agent.id);
  const kpis = computeKpis(own, ownGoals, anio);
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
  const { agents, policies, goals, clients } = await loadAgentData(db, anio, scope.restricted ? [scope.agentId] : null);

  const porAgente = agents.map(a => buildAgentSummary(a, policies, goals, clients, anio));

  // Totales de la promotoría
  const globalKpis = computeKpis(policies, goals, anio);
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
  const { agents, policies, goals, clients } = await loadAgentData(db, anio, [agentId]);
  if (!agents.length) return res.status(404).json({ error: 'Asesor no encontrado' });
  res.json({ anio, ...buildAgentSummary(agents[0], policies, goals, clients, anio) });
});

/* ═══════════════ REPORTE PDF DEL BUSINESS REVIEW ═══════════════ */

async function buildReportData(db, agentId, anio) {
  const { agents, policies, goals, clients } = await loadAgentData(db, anio, [agentId]);
  if (!agents.length) return null;
  const summary = buildAgentSummary(agents[0], policies, goals, clients, anio);

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

module.exports = router;
