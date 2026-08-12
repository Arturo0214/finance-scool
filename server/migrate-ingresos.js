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

  console.log('Migración de ingresos completa.');
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
