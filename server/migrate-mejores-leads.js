/**
 * Importa la base "Mejores Leads" de Tesipedia (server/data/mejores-leads.json,
 * extraída de Tesipedia_Mejores_Leads_2026-09-05.xlsx) a crm_mejores_leads.
 *
 * Idempotente por wa_hash (sha256 del WhatsApp): los leads ya importados se
 * saltan COMPLETOS — nunca pisa el seguimiento (seg_status, notas, asignado)
 * que ya se haya trabajado en el CRM. WhatsApp y teléfono van cifrados.
 *
 * Uso: node server/migrate-mejores-leads.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const path = require('path');
const { getDB } = require('./models/database');
const { encryptFields } = require('./utils/cryptoFields');

const waHash = (lead) =>
  crypto.createHash('sha256')
    .update(String(lead.whatsapp || `${lead.nombre}|${lead.bucket}`).replace(/\D/g, '') || `${lead.nombre}|${lead.bucket}`)
    .digest('hex');

(async () => {
  const db = getDB();
  const leads = require(path.join(__dirname, 'data', 'mejores-leads.json'));

  // Hashes ya importados (paginado: Supabase trunca a 1000)
  const existentes = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('crm_mejores_leads').select('wa_hash').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach(r => existentes.add(r.wa_hash));
    if (!data || data.length < 1000) break;
  }

  const nuevos = [];
  for (const l of leads) {
    const h = waHash(l);
    if (existentes.has(h)) continue;
    existentes.add(h);
    nuevos.push(encryptFields({ ...l, wa_hash: h }, 'crm_mejores_leads'));
  }

  const CHUNK = 200;
  for (let i = 0; i < nuevos.length; i += CHUNK) {
    const { error } = await db.from('crm_mejores_leads').insert(nuevos.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
    console.log(`  … ${Math.min(i + CHUNK, nuevos.length)}/${nuevos.length}`);
  }

  console.log(`✓ crm_mejores_leads: ${nuevos.length} nuevos, ${leads.length - nuevos.length} ya existían`);
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
