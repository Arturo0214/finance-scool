/**
 * Migración one-off: cifra los campos sensibles ya existentes en
 * crm_clients, crm_policies y crm_reminders (idempotente — los valores
 * ya cifrados con prefijo enc:v1: se dejan intactos).
 *
 * Uso: node server/migrate-encrypt-crm.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getDB } = require('./models/database');
const { encryptFields, ENCRYPTED_FIELDS } = require('./utils/cryptoFields');

async function migrateTable(table) {
  const db = getDB();
  const fields = ENCRYPTED_FIELDS[table];
  const { data: rows, error } = await db.from(table).select(['id', ...fields].join(','));
  if (error) throw new Error(`${table}: ${error.message}`);
  let updated = 0;
  for (const row of rows) {
    const needs = fields.some(f => row[f] && !String(row[f]).startsWith('enc:v1:'));
    if (!needs) continue;
    const patch = encryptFields(row, table);
    delete patch.id;
    const { error: upErr } = await db.from(table).update(patch).eq('id', row.id);
    if (upErr) throw new Error(`${table}#${row.id}: ${upErr.message}`);
    updated++;
  }
  console.log(`✓ ${table}: ${updated}/${rows.length} filas cifradas`);
}

(async () => {
  for (const table of Object.keys(ENCRYPTED_FIELDS)) await migrateTable(table);
  console.log('Migración de cifrado completada.');
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
