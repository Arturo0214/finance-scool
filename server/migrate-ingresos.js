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

  /* Contenedores "Cartera Prudential — asesor": SOLO se crean si hace falta
     insertar una póliza sin cliente real (el Reporte de pólizas ya asigna a
     casi todas su cliente con nombre). */
  const { data: contenedores, error: eCt } = await db.from('crm_clients').select('id, agent_id').eq('origen', 'Prudential');
  if (eCt) throw new Error(`crm_clients: ${eCt.message}`);
  const contPorAgente = new Map(contenedores.map(c => [c.agent_id, c.id]));
  async function contenedorDe(ag) {
    if (contPorAgente.has(ag.id)) return contPorAgente.get(ag.id);
    const { data, error } = await db.from('crm_clients').insert([encryptFields({
      agent_id: ag.id,
      nombre: `Cartera Prudential — ${ag.nombre}`,
      etapa: 'postventa', origen: 'Prudential',
      notas: 'Cliente contenedor de la cartera migrada del Business Review. Reasigna cada póliza a su cliente real al capturarlo.',
    }, 'crm_clients')]).select('id, agent_id');
    if (error) throw new Error(`crm_clients: ${error.message}`);
    contPorAgente.set(ag.id, data[0].id);
    return data[0].id;
  }

  /* Pólizas: el índice trae UNA FILA POR COBERTURA — se agrupan por número
     de póliza (prima = suma de coberturas, datos de la cobertura principal).
     El match de idempotencia es por número descifrando lo existente en
     memoria; Supabase trunca a 1000 filas, así que se pagina. */
  const polActuales = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('crm_policies').select('id, agent_id, plan, poliza').order('id').range(from, from + 999);
    if (error) throw new Error(`crm_policies: ${error.message}`);
    polActuales.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const yaImportadas = new Map();
  for (const p of polActuales) {
    const numero = String(decryptFields(p, 'crm_policies').poliza || '').replace(/\.0$/, '');
    if (numero && !yaImportadas.has(numero)) yaImportadas.set(numero, p.id);
  }

  const grupos = new Map(); // `${clave}|${numero}` → líneas de cobertura
  for (const p of polizas) {
    const numero = String(p.poliza).replace(/\.0$/, '');
    const k = `${p.clave}|${numero}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }

  const hoy = new Date();
  const unAnioAtras = new Date(hoy); unAnioAtras.setFullYear(hoy.getFullYear() - 1);
  let insertadas = 0, actualizadas = 0;
  for (const lineas of grupos.values()) {
    const ag = agentePorClave.get(lineas[0].clave);
    if (!ag) continue;
    const numero = String(lineas[0].poliza).replace(/\.0$/, '');
    const principal = lineas.reduce((a, b) => (Number(b.base_a_conservar_mxn) || 0) > (Number(a.base_a_conservar_mxn) || 0) ? b : a);
    const primaTotal = Math.round(lineas.reduce((s, l) => s + (Number(l.base_a_conservar_mxn) || 0), 0) * 100) / 100;
    const st = derivarEstatus(principal, hoy);
    const patchComun = {
      prima: primaTotal, fecha_pago: principal.pagado_hasta || null,
      estatus: st === 'CONSERVADA' ? 'pagada' : st === 'PENDIENTE DE PAGO' ? 'pendiente_pago' : 'cancelada',
      updated_at: nowIso(),
    };
    const exId = yaImportadas.get(numero);
    if (exId) {
      const { error } = await db.from('crm_policies').update(patchComun).eq('id', exId);
      if (error) throw new Error(`crm_policies: ${error.message}`);
      actualizadas++;
    } else {
      const row = {
        agent_id: ag.id, client_id: await contenedorDe(ag),
        poliza: numero, plan: principal.plan_id || null,
        tipo: (principal.fecha_emision && new Date(principal.fecha_emision) >= unAnioAtras) ? 'nueva' : 'renovacion',
        forma_pago: String(principal.frecuencia_pago || '').toLowerCase() || null,
        fecha_emision: principal.fecha_emision || null,
        moneda: 'MXN', aseguradora: 'PRU',
        notas: `Business Review ${principal.anio}-${principal.periodo} · prima original ${principal.prima_neta_anualizada} ${principal.moneda} (t.c. ${principal.tipo_cambio})${lineas.length > 1 ? ` · ${lineas.length} coberturas (prima = suma)` : ''}`,
        ...patchComun,
      };
      const { data, error } = await db.from('crm_policies').insert([encryptFields(row, 'crm_policies')]).select('id');
      if (error) throw new Error(`crm_policies: ${error.message}`);
      yaImportadas.set(numero, data[0].id);
      insertadas++;
    }
  }
  console.log(`✓ crm_policies: ${insertadas} insertadas, ${actualizadas} actualizadas (${grupos.size} pólizas del índice)`);

  console.log('Migración de ingresos completa.');
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
