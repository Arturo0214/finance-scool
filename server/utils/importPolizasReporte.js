/**
 * Importación del "Reporte de pólizas" de Prudential (xlsx).
 * Reutilizado por el CLI (server/migrate-polizas-reporte.js) y por la carga
 * diaria desde la UI (POST /api/crm/polizas/import).
 *
 * Reglas:
 *  - NUNCA duplica: matchea por número de póliza (descifrado en memoria).
 *  - Refleja movimientos del día: cancelaciones/rescates del reporte cancelan;
 *    una póliza EN VIGOR que estaba cancelada en el CRM revive.
 *  - Clientes: encuentra o crea por (asesor, nombre normalizado); si la póliza
 *    estaba en un contenedor "Cartera Prudential — asesor" se reasigna al real.
 *  - Cada corrida queda en crm_import_runs (quién, cuándo y resumen).
 *
 * Columnas esperadas (hoja "Polizas", fila 2 = encabezado):
 *   Póliza | Solicitud | Contratante | Asegurado | Agente | Tel. Celular |
 *   Prima | Moneda | Estatus | Mes | Día   (Mes/Día = aniversario)
 */
const XLSX = require('xlsx');
const { encryptFields, decryptFields } = require('./cryptoFields');

/* C12033 es la clave externa/anterior de Flavio; en el CRM es C15995 */
const CLAVE_ALIAS = { C12033: 'C15995' };

const CANCELA = new Set(['CANCELADA', 'RESCATADA', 'PÓLIZA NO EMITIDA', 'NO TOMADA', 'CADUCADA']);

const titulo = (s) => String(s || '').toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const nowIso = () => new Date().toISOString();

function proximaRenovacion(mes, dia) {
  const m = parseInt(mes, 10), d = parseInt(dia, 10);
  if (!m || !d) return null;
  const hoy = new Date();
  let f = new Date(hoy.getFullYear(), m - 1, d);
  if (f < hoy) f = new Date(hoy.getFullYear() + 1, m - 1, d);
  return f.toISOString().slice(0, 10);
}

/* Supabase trunca a 1000 filas por request */
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function importarReporte(db, { workbook, archivo, usuario, userId }) {
  const hoja = workbook.Sheets['Polizas'] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(hoja, { header: 1 }).slice(2).filter(r => r && r[0]);
  if (!rows.length) throw new Error('El archivo no trae filas de pólizas (se espera la hoja "Polizas" del reporte Prudential)');

  /* Agentes */
  const agentsRows = await fetchAll(() => db.from('crm_agents').select('id, clave, nombre').order('id'));
  const porClave = new Map(agentsRows.filter(a => a.clave).map(a => [a.clave, a]));
  const placeholders = [];
  for (const raw of new Set(rows.map(r => String(r[4] || '').trim()))) {
    const clave = CLAVE_ALIAS[raw] || raw;
    if (!clave || porClave.has(clave)) continue;
    const { data, error } = await db.from('crm_agents').insert([{
      clave, nombre: `Agente externo ${clave}`, cuaderno: 'NOVEL', estatus: 'EXTERNO',
      activo_fsc: false, updated_at: nowIso(),
    }]).select('id, clave, nombre');
    if (error) throw new Error(`crm_agents ${clave}: ${error.message}`);
    porClave.set(clave, data[0]);
    placeholders.push(clave);
  }

  /* Clientes (nombre en claro) y contenedores */
  const clientRows = await fetchAll(() => db.from('crm_clients').select('id, agent_id, nombre, origen').order('id'));
  const contenedores = new Set(clientRows.filter(c => c.origen === 'Prudential' || c.origen === 'Insignia').map(c => c.id));
  const clientePorNombre = new Map();
  for (const c of clientRows) {
    if (contenedores.has(c.id)) continue;
    clientePorNombre.set(`${c.agent_id}|${norm(c.nombre)}`, c.id);
  }

  /* Pólizas existentes por número (descifrado) */
  const polRows = await fetchAll(() => db.from('crm_policies').select('id, agent_id, client_id, poliza, estatus, fecha_renovacion, pago_manual_at').order('id'));
  const polPorNumero = new Map();
  for (const p of polRows) {
    const numero = String(decryptFields(p, 'crm_policies').poliza || '').replace(/\.0$/, '');
    if (!numero) continue;
    if (!polPorNumero.has(numero)) polPorNumero.set(numero, []);
    polPorNumero.get(numero).push(p);
  }

  const resumen = { filas: rows.length, clientesNuevos: 0, actualizadas: 0, canceladas: 0, revividas: 0, insertadas: 0, saltadas: 0, protegidasPagoManual: 0, placeholders };

  /* Pago confirmado a mano con comprobante (< 60 días): el corte de Prudential
     llega con retraso, así que el reporte NO puede re-cancelar esa póliza. */
  const pagoManualVigente = (p) => p.pago_manual_at && (Date.now() - new Date(p.pago_manual_at).getTime()) < 60 * 86400000;

  for (const r of rows) {
    const numero = String(r[0]).trim();
    const contratante = norm(r[2]);
    const claveRaw = String(r[4] || '').trim();
    const agente = porClave.get(CLAVE_ALIAS[claveRaw] || claveRaw);
    if (!agente || !contratante) { resumen.saltadas++; continue; }

    const telefono = String(r[5] || '').replace(/\D/g, '') || null;
    const prima = parseFloat(String(r[6] || '0').replace(/,/g, '')) || 0;
    const moneda = /D[OÓ]LARES/i.test(String(r[7])) ? 'USD' : 'UDIS';
    const estatusOrig = norm(r[8]);
    const fechaRenov = proximaRenovacion(r[9], r[10]);
    const asegurado = norm(r[3]);
    const notaAseg = asegurado && asegurado !== contratante ? ` · asegurado: ${titulo(asegurado)}` : '';

    /* cliente real */
    const kCli = `${agente.id}|${contratante}`;
    let clientId = clientePorNombre.get(kCli);
    if (!clientId) {
      const { data, error } = await db.from('crm_clients').insert([encryptFields({
        agent_id: agente.id, nombre: titulo(contratante), telefono,
        etapa: 'postventa', origen: 'otro', aseguradora: 'PRU',
        notas: `Importado del Reporte de pólizas Prudential (${claveRaw}).`,
      }, 'crm_clients')]).select('id');
      if (error) throw new Error(`crm_clients ${contratante}: ${error.message}`);
      clientId = data[0].id;
      clientePorNombre.set(kCli, clientId);
      resumen.clientesNuevos++;
    }

    const existentes = polPorNumero.get(numero);
    if (existentes && existentes.length) {
      for (const ex of existentes) {
        const patch = { updated_at: nowIso(), estatus_reporte: estatusOrig };
        if (contenedores.has(ex.client_id)) patch.client_id = clientId;
        if (fechaRenov) patch.fecha_renovacion = fechaRenov;
        if (CANCELA.has(estatusOrig) && ex.estatus !== 'cancelada') {
          if (pagoManualVigente(ex)) resumen.protegidasPagoManual++;
          else { patch.estatus = 'cancelada'; resumen.canceladas++; }
        }
        else if (estatusOrig === 'EN VIGOR' && ex.estatus === 'cancelada') { patch.estatus = 'pagada'; resumen.revividas++; }
        else if (estatusOrig === 'PENDIENTE' && ex.estatus === 'cancelada') { patch.estatus = 'pendiente_pago'; resumen.revividas++; }
        const { error } = await db.from('crm_policies').update(patch).eq('id', ex.id);
        if (error) throw new Error(`crm_policies ${numero}: ${error.message}`);
        resumen.actualizadas++;
      }
    } else {
      const { data, error } = await db.from('crm_policies').insert([encryptFields({
        agent_id: agente.id, client_id: clientId, poliza: numero,
        plan: null, tipo: 'renovacion', prima, moneda, aseguradora: 'PRU',
        fecha_renovacion: fechaRenov, estatus_reporte: estatusOrig,
        estatus: estatusOrig === 'EN VIGOR' ? 'pagada' : estatusOrig === 'PENDIENTE' ? 'pendiente_pago' : 'cancelada',
        notas: `Reporte de pólizas Prudential · estatus original: ${estatusOrig}${notaAseg} · solicitud ${r[1] || ''}`,
        updated_at: nowIso(),
      }, 'crm_policies')]).select('id, agent_id, client_id, estatus');
      if (error) throw new Error(`crm_policies ${numero}: ${error.message}`);
      polPorNumero.set(numero, data);
      resumen.insertadas++;
    }
  }

  await db.from('crm_import_runs').insert([{
    tipo: 'reporte-polizas', archivo: archivo || null, usuario: usuario || null,
    user_id: userId || null, resumen,
  }]);
  return resumen;
}

module.exports = { importarReporte, fetchAll };
