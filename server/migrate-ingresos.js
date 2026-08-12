/**
 * Migración de la data Prudential (Business Review xlsb → server/data/*.json)
 * al Tablero de Ingresos: crm_pru_agentes, crm_pru_primas,
 * crm_pru_polizas_indice, crm_pru_indices_hist y crm_pir_tablas.
 *
 * Idempotente: upserta por llave natural; se puede re-correr con cada corte
 * que mande Prudential (re-extraer los JSON y volver a ejecutar).
 *
 * Uso: node server/migrate-ingresos.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { getDB } = require('./models/database');

const DATA = f => require(path.join(__dirname, 'data', f));

async function upsert(table, rows, onConflict) {
  const db = getDB();
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`✓ ${table}: ${rows.length} filas`);
}

(async () => {
  const agentes = DATA('pru-agentes.json').map(a => ({ ...a, updated_at: new Date().toISOString() }));
  await upsert('crm_pru_agentes', agentes, 'clave');

  await upsert('crm_pru_primas', DATA('pru-primas.json'), 'clave,anio,mes');

  const polizas = DATA('pru-polizas-indice.json').map(p => ({ ...p, plan_id: p.plan_id || '' }));
  await upsert('crm_pru_polizas_indice', polizas, 'clave,poliza,plan_id,anio,periodo');

  await upsert('crm_pru_indices_hist', DATA('pru-indices-hist.json'), 'clave,periodo');

  await upsert('crm_pir_tablas', [{ anio: 2026, tablas: DATA('pir2026.json') }], 'anio');

  /* ── Sincronización al CRM operativo ──────────────────────────────
     Roster → crm_agents (por clave; no toca user_id ni renombra los ya
     capturados) y pólizas → crm_policies bajo un cliente contenedor
     "Cartera Prudential — <asesor>" por agente. El Business Review no trae
     nombres de clientes: al capturar al cliente real se le reasigna la póliza. */
  const { encryptFields, decryptFields } = require('./utils/cryptoFields');
  const { derivarEstatus } = require('./utils/ingresos');
  const db = getDB();
  const nowIso = () => new Date().toISOString();
  const titulo = (s) => String(s || '').toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  const { data: agentesCrm, error: eAg } = await db.from('crm_agents').select('id, clave, nombre');
  if (eAg) throw new Error(`crm_agents: ${eAg.message}`);
  const agentePorClave = new Map(agentesCrm.filter(a => a.clave).map(a => [a.clave, a]));

  let agNuevos = 0;
  for (const a of agentes) {
    const patch = { cuaderno: a.cuaderno, fecha_inicio_calculos: a.fecha_inicio_calculos, estatus: a.estatus, updated_at: nowIso() };
    const ex = agentePorClave.get(a.clave);
    if (ex) {
      const { error } = await db.from('crm_agents').update(patch).eq('id', ex.id);
      if (error) throw new Error(`crm_agents: ${error.message}`);
    } else {
      const { data, error } = await db.from('crm_agents').insert([{ ...patch, clave: a.clave, nombre: titulo(a.nombre) }]).select('id, clave, nombre');
      if (error) throw new Error(`crm_agents: ${error.message}`);
      agentePorClave.set(a.clave, data[0]);
      agNuevos++;
    }
  }
  console.log(`✓ crm_agents sincronizados: ${agNuevos} nuevos, ${agentes.length - agNuevos} actualizados`);

  const { data: contenedores, error: eCt } = await db.from('crm_clients').select('id, agent_id').eq('origen', 'Prudential');
  if (eCt) throw new Error(`crm_clients: ${eCt.message}`);
  const contPorAgente = new Map(contenedores.map(c => [c.agent_id, c.id]));
  for (const a of agentes) {
    const ag = agentePorClave.get(a.clave);
    if (!ag || contPorAgente.has(ag.id)) continue;
    const { data, error } = await db.from('crm_clients').insert([encryptFields({
      agent_id: ag.id,
      nombre: `Cartera Prudential — ${ag.nombre || titulo(a.nombre)}`,
      etapa: 'postventa', origen: 'Prudential',
      notas: 'Cliente contenedor de la cartera migrada del Business Review. Reasigna cada póliza a su cliente real al capturarlo.',
    }, 'crm_clients')]).select('id, agent_id');
    if (error) throw new Error(`crm_clients: ${error.message}`);
    contPorAgente.set(ag.id, data[0].id);
  }
  console.log(`✓ clientes contenedores Prudential: ${contPorAgente.size}`);

  /* Pólizas: el número va cifrado en crm_policies, así que el match de
     idempotencia se hace descifrando lo existente en memoria */
  const { data: polActuales, error: ePl } = await db.from('crm_policies').select('id, agent_id, plan, poliza').range(0, 9999);
  if (ePl) throw new Error(`crm_policies: ${ePl.message}`);
  const polKey = (agentId, numero, plan) => `${agentId}|${numero}|${plan || ''}`;
  const yaImportadas = new Map(polActuales.map(p => [polKey(p.agent_id, decryptFields(p, 'crm_policies').poliza, p.plan), p.id]));

  const hoy = new Date();
  const unAnioAtras = new Date(hoy); unAnioAtras.setFullYear(hoy.getFullYear() - 1);
  const insertar = [], actualizar = [];
  for (const p of polizas) {
    const ag = agentePorClave.get(p.clave);
    if (!ag) continue;
    const numero = String(p.poliza).replace(/\.0$/, '');
    const st = derivarEstatus(p, hoy);
    const row = {
      agent_id: ag.id, client_id: contPorAgente.get(ag.id),
      poliza: numero, plan: p.plan_id || null,
      tipo: (p.fecha_emision && new Date(p.fecha_emision) >= unAnioAtras) ? 'nueva' : 'renovacion',
      prima: p.base_a_conservar_mxn, forma_pago: String(p.frecuencia_pago || '').toLowerCase() || null,
      fecha_emision: p.fecha_emision || null, fecha_pago: p.pagado_hasta || null,
      estatus: st === 'CONSERVADA' ? 'pagada' : st === 'PENDIENTE DE PAGO' ? 'pendiente_pago' : 'cancelada',
      moneda: 'MXN',
      notas: `Business Review ${p.anio}-${p.periodo} · prima original ${p.prima_neta_anualizada} ${p.moneda} (t.c. ${p.tipo_cambio})`,
      updated_at: nowIso(),
    };
    const exId = yaImportadas.get(polKey(ag.id, numero, row.plan));
    if (exId) actualizar.push({ id: exId, patch: { prima: row.prima, fecha_pago: row.fecha_pago, estatus: row.estatus, updated_at: row.updated_at } });
    else insertar.push(encryptFields(row, 'crm_policies'));
  }
  for (let i = 0; i < insertar.length; i += 200) {
    const { error } = await db.from('crm_policies').insert(insertar.slice(i, i + 200));
    if (error) throw new Error(`crm_policies: ${error.message}`);
  }
  for (const u of actualizar) {
    const { error } = await db.from('crm_policies').update(u.patch).eq('id', u.id);
    if (error) throw new Error(`crm_policies: ${error.message}`);
  }
  console.log(`✓ crm_policies: ${insertar.length} insertadas, ${actualizar.length} actualizadas`);

  console.log('Migración de ingresos completa.');
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
