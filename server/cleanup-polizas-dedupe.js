/**
 * Limpieza única de crm_policies (2026-08-14):
 *
 * 1. Dedupe por número de póliza: la migración del índice insertó una fila
 *    por COBERTURA (plan_id) — 199 números con 2 a 7 filas. Se fusionan en una
 *    sola póliza: prima = Σ de las coberturas del índice, se conserva el plan
 *    de la cobertura principal y el cliente real si alguna fila ya lo tenía.
 * 2. Elimina los datos DEMO del 2026-07-16 (pólizas PL-* con clientes
 *    ficticios de la fase de demostración) y sus clientes si quedan vacíos.
 * 3. Reasigna al cliente real las pólizas que seguían en un contenedor
 *    "Cartera Prudential — asesor" y borra los contenedores vacíos.
 *
 * Uso: node server/cleanup-polizas-dedupe.js [--dry]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getDB } = require('./models/database');
const { decryptFields, encryptFields } = require('./utils/cryptoFields');

const DRY = process.argv.includes('--dry');
const nowIso = () => new Date().toISOString();

/* Supabase trunca a 1000 filas por request: traer todo paginado */
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

(async () => {
  const db = getDB();
  const pols = await fetchAll(() => db.from('crm_policies').select('*').order('id'));
  const clis = await fetchAll(() => db.from('crm_clients').select('id, agent_id, nombre, origen, created_at').order('id'));
  console.log(`pólizas: ${pols.length} · clientes: ${clis.length}${DRY ? '  [DRY RUN]' : ''}`);

  const contenedores = new Set(clis.filter(c => c.origen === 'Prudential' || c.origen === 'Insignia').map(c => c.id));
  const dec = pols.map(p => {
    const d = decryptFields(p, 'crm_policies');
    return { ...p, numero: String(d.poliza || '').replace(/\.0$/, ''), notasDec: d.notas || '' };
  });
  const fuente = (p) => p.notasDec.startsWith('Business Review') ? 'indice'
    : p.notasDec.startsWith('Reporte de pólizas') ? 'reporte' : 'manual';

  const del = async (tabla, ids) => {
    if (!ids.length || DRY) return;
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await db.from(tabla).delete().in('id', ids.slice(i, i + 100));
      if (error) throw new Error(`${tabla} delete: ${error.message}`);
    }
  };

  /* ── 2. Datos demo (PL-*, 2026-07-16) ── */
  const demoPols = dec.filter(p => p.numero.startsWith('PL-') && String(p.created_at).startsWith('2026-07-16'));
  const demoClientIds = [...new Set(demoPols.map(p => p.client_id).filter(Boolean))];
  await del('crm_policies', demoPols.map(p => p.id));
  console.log(`✓ pólizas demo eliminadas: ${demoPols.length}`);
  const demoSet = new Set(demoPols.map(p => p.id));
  const rest = dec.filter(p => !demoSet.has(p.id));
  let demoClisBorrados = 0;
  for (const cid of demoClientIds) {
    const c = clis.find(x => x.id === cid);
    if (!c || contenedores.has(cid)) continue;
    if (!String(c.created_at).startsWith('2026-07-16')) continue;
    if (rest.some(p => p.client_id === cid)) continue; // aún tiene pólizas reales
    if (!DRY) {
      for (const t of ['crm_reminders', 'crm_notes', 'crm_files']) await db.from(t).delete().eq('client_id', cid);
      const { error } = await db.from('crm_clients').delete().eq('id', cid);
      if (error) { console.log(`⚠ cliente demo ${cid} (${c.nombre}): ${error.message}`); continue; }
    }
    demoClisBorrados++;
  }
  console.log(`✓ clientes demo eliminados: ${demoClisBorrados}`);

  /* ── 1. Dedupe por número ── */
  const porNum = new Map();
  for (const p of rest) {
    if (!p.numero) continue;
    if (!porNum.has(p.numero)) porNum.set(p.numero, []);
    porNum.get(p.numero).push(p);
  }
  let fusionadas = 0, borradas = 0;
  for (const grupo of porNum.values()) {
    if (grupo.length < 2 && !contenedores.has(grupo[0]?.client_id)) continue;
    const indices = grupo.filter(p => fuente(p) === 'indice');
    const reportes = grupo.filter(p => fuente(p) === 'reporte');
    // canónica: la del reporte (trae cliente real) > índice con cliente real > primera
    const canon = reportes[0] || grupo.find(p => !contenedores.has(p.client_id)) || grupo[0];
    const clienteReal = grupo.map(p => p.client_id).find(id => id && !contenedores.has(id)) || canon.client_id;
    const principal = indices.length
      ? indices.reduce((a, b) => (Number(b.prima) || 0) > (Number(a.prima) || 0) ? b : a)
      : canon;

    const patch = {
      client_id: clienteReal,
      agent_id: (reportes[0] || principal).agent_id,
      plan: principal.plan || canon.plan || null,
      prima: indices.length ? Math.round(indices.reduce((s, p) => s + (Number(p.prima) || 0), 0) * 100) / 100 : Number(canon.prima) || 0,
      moneda: indices.length ? 'MXN' : canon.moneda,
      aseguradora: 'PRU',
      // estatus: una cancelación del reporte (más reciente) manda; si no, el del índice
      estatus: reportes.some(p => p.estatus === 'cancelada') && !indices.some(p => ['pagada', 'pendiente_pago'].includes(p.estatus))
        ? 'cancelada' : (principal.estatus || canon.estatus),
      tipo: principal.tipo || canon.tipo || 'renovacion',
      fecha_emision: grupo.map(p => p.fecha_emision).filter(Boolean).sort()[0] || null,
      fecha_pago: grupo.map(p => p.fecha_pago).filter(Boolean).sort().pop() || null,
      fecha_renovacion: grupo.map(p => p.fecha_renovacion).filter(Boolean).sort()[0] || null,
      updated_at: nowIso(),
    };
    const notas = [
      principal.notasDec || canon.notasDec,
      indices.length > 1 ? `Fusión: ${indices.length} coberturas del índice (prima = suma).` : null,
    ].filter(Boolean).join(' · ');

    if (!DRY) {
      const { error } = await db.from('crm_policies')
        .update(encryptFields({ ...patch, notas }, 'crm_policies')).eq('id', canon.id);
      if (error) throw new Error(`fusión ${grupo[0].numero}: ${error.message}`);
    }
    const aBorrar = grupo.filter(p => p.id !== canon.id).map(p => p.id);
    await del('crm_policies', aBorrar);
    fusionadas++;
    borradas += aBorrar.length;
  }
  console.log(`✓ números fusionados/reasignados: ${fusionadas} · filas eliminadas: ${borradas}`);

  /* ── 3. Contenedores vacíos ── */
  const quedan = await fetchAll(() => db.from('crm_policies').select('id, client_id').order('id'));
  const conPoliza = new Set(quedan.map(p => p.client_id));
  let contBorrados = 0;
  for (const cid of contenedores) {
    if (conPoliza.has(cid)) continue;
    if (!DRY) {
      const { error } = await db.from('crm_clients').delete().eq('id', cid);
      if (error) { console.log(`⚠ contenedor ${cid}: ${error.message}`); continue; }
    }
    contBorrados++;
  }
  console.log(`✓ contenedores vacíos eliminados: ${contBorrados} de ${contenedores.size}`);
  console.log(`Total final de pólizas: ${quedan.length - (DRY ? 0 : 0)}`);
  console.log('Limpieza completa.');
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
