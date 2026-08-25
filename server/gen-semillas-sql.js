/**
 * Genera el SQL de la base "Semillas" desde el Excel (solo lectura local + escribe
 * archivos .sql en /tmp). El SQL se ejecuta luego vía el Supabase MCP.
 * Uso: node server/gen-semillas-sql.js "<ruta.xlsx>"
 */
const XLSX = require('xlsx');
const fs = require('fs');
const file = process.argv[2] || `${process.env.HOME}/Downloads/Portafolio Robert con mas data_2 (1).xlsx`;

const slug = (h) => String(h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 58) || 'col';
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''") + "'";
const jq = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";

const CURADAS = {
  'TMK ID':            { key: 'tmk_id', label: 'ID', tipo: 'text', grupo: 'Identidad', orden: 1, ancho: 110 },
  'Grupo Holding':     { key: 'grupo_holding', label: 'Grupo / Holding', tipo: 'text', grupo: 'Identidad', orden: 2 },
  'RAZON SOCIAL':      { key: 'razon_social', label: 'Empresa', tipo: 'text', grupo: 'Identidad', orden: 3, ancho: 240 },
  'SIC Code Español':  { key: 'industria', label: 'Industria', tipo: 'text', grupo: 'Identidad', orden: 4, ancho: 200 },
  'Estado':            { key: 'estado', label: 'Estado', tipo: 'text', grupo: 'Ubicación', orden: 5 },
  'Municipio':         { key: 'municipio', label: 'Municipio', tipo: 'text', grupo: 'Ubicación', orden: 6 },
  'gasto_prom_6m_MXN': { key: 'gasto_prom_6m', label: 'Gasto prom. 6m', tipo: 'money', grupo: 'Gasto', orden: 7 },
  'CV_YTD_2025_MXN':   { key: 'cv_2025', label: 'CV YTD 2025', tipo: 'money', grupo: 'Gasto', orden: 8 },
  'CV_YTD_2026_MXN':   { key: 'cv_2026', label: 'CV YTD 2026', tipo: 'money', grupo: 'Gasto', orden: 9 },
  'avg_SEGUROS_12m_MXN': { key: 'gasto_seguros', label: 'Gasto Seguros 12m', tipo: 'money', grupo: 'Gasto', orden: 10 },
  'TOP 150':           { key: 'top_150', label: 'Top 150', tipo: 'bool', grupo: 'Prioridad', orden: 11, ancho: 90 },
  'Contacto Efectivo': { key: 'contacto_efectivo', label: 'Contacto efectivo', tipo: 'text', grupo: 'Seguimiento', orden: 12 },
  '¿Se encontró oportunidad?': { key: 'oportunidad', label: '¿Oportunidad?', tipo: 'text', grupo: 'Seguimiento', orden: 13 },
  'Comentarios':       { key: 'comentarios', label: 'Comentarios', tipo: 'text', grupo: 'Seguimiento', orden: 14, ancho: 260 },
  'contact_full_nm_1': { key: 'contacto_1', label: 'Contacto 1', tipo: 'text', grupo: 'Contactos', orden: 15, ancho: 180 },
  'contact_role_1':    { key: 'contacto_1_puesto', label: 'Puesto 1', tipo: 'text', grupo: 'Contactos', orden: 16 },
  'contact_email_1':   { key: 'contacto_1_email', label: 'Email 1', tipo: 'text', grupo: 'Contactos', orden: 17, ancho: 200 },
  'contact_phone_1':   { key: 'contacto_1_tel', label: 'Tel 1', tipo: 'text', grupo: 'Contactos', orden: 18 },
};
const CAT_SERVICIOS = {
  'avg_SEGUROS_12m_MXN': 'Seguros', 'avg_AIR_12m_MXN': 'Aéreo / Viajes', 'avg_LODGING_12m_MXN': 'Hospedaje',
  'avg_RESTAURANT_12m_MXN': 'Restaurantes', 'avg_TRANSPORTATION_NON_TE_12m_MXN': 'Transporte no T&E',
  'avg_PROFESSIONAL_FINANCIAL_SERVICES_12m_MXN': 'Servicios financieros', 'avg_GAS_PETROL_STATIONS_12m_MXN': 'Gasolina',
  'avg_IT_HARDWARE_12m_MXN': 'IT / Hardware', 'avg_ADVERTISING_12m_MXN': 'Publicidad',
  'avg_MOBILE_TELECOMS_12m_MXN': 'Telecom', 'avg_RETAIL_12m_MXN': 'Retail', 'avg_GOVERNMENT_CHARGES_TAXES_12m_MXN': 'Impuestos / Gobierno',
};
const esMoney = (h) => /mxn|gasto|cv_|prima|avg_|otb|spending|sugerencia/i.test(h);

const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Robert'], { header: 1, defval: '' });
const headers = rows[0].map(h => String(h).trim()).filter(Boolean);

const keyByHeader = {}, usados = new Set();
const cols = headers.map((h, i) => {
  const cur = CURADAS[h];
  let key = cur ? cur.key : slug(h);
  while (usados.has(key)) key = key + '_' + i;
  usados.add(key); keyByHeader[h] = key;
  return { col_key: key, label: cur ? cur.label : h, tipo: cur ? cur.tipo : (esMoney(h) ? 'money' : 'text'),
    orden: cur ? cur.orden : 100 + i, visible: !!cur, ancho: cur?.ancho || 160, grupo: cur ? cur.grupo : 'Datos' };
});

// 1) columnas
let sqlCols = 'delete from semillas_seguimientos where id>0; delete from semillas_servicios where id>0; delete from semillas_leads where id>0; delete from semillas_columnas where id>0;\n';
sqlCols += 'insert into semillas_columnas (col_key,label,tipo,orden,visible,ancho,grupo) values\n';
sqlCols += cols.map(c => `(${q(c.col_key)},${q(c.label)},${q(c.tipo)},${c.orden},${c.visible},${c.ancho},${q(c.grupo)})`).join(',\n') + ';\n';
fs.writeFileSync('/tmp/sem_cols.sql', sqlCols);

// 2) leads (batched) + 3) servicios (values→join por tmk_id)
const leadVals = [], servVals = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || !String(row[0]).trim()) continue;
  const data = {};
  headers.forEach((h, i) => {
    const key = keyByHeader[h], col = cols.find(c => c.col_key === key), raw = row[i];
    if (col.tipo === 'money' || col.tipo === 'number') { const n = num(raw); if (n) data[key] = n; }
    else if (col.tipo === 'bool') { if (raw && String(raw).trim() && String(raw).trim() !== '0') data[key] = true; }
    else { const s = String(raw ?? '').trim(); if (s && s !== '0') data[key] = s; }
  });
  leadVals.push(`(${jq(data)},'nuevo')`);
  const tmk = String(row[0]).trim();
  for (const [h, cat] of Object.entries(CAT_SERVICIOS)) {
    const idx = headers.indexOf(h); if (idx < 0) continue;
    const m = num(row[idx]); if (m > 1000) servVals.push(`(${q(tmk)},${q(cat)},${Math.round(m)})`);
  }
}
// Versión compacta: solo columnas visibles (curadas) → payload chico para MCP.
const VIS = new Set(cols.filter(c => c.visible).map(c => c.col_key));
const leadValsC = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || !String(row[0]).trim()) continue;
  const data = {};
  headers.forEach((h, i) => {
    const key = keyByHeader[h]; if (!VIS.has(key)) return;
    const col = cols.find(c => c.col_key === key), raw = row[i];
    if (col.tipo === 'money' || col.tipo === 'number') { const n = num(raw); if (n) data[key] = n; }
    else if (col.tipo === 'bool') { if (raw && String(raw).trim() && String(raw).trim() !== '0') data[key] = true; }
    else { const s = String(raw ?? '').trim(); if (s && s !== '0') data[key] = s; }
  });
  leadValsC.push(`(${jq(data)},'nuevo')`);
}
const B = 20; let nb = 0;
for (let i = 0; i < leadValsC.length; i += B) {
  fs.writeFileSync(`/tmp/sem_leads_c_${nb}.sql`, 'insert into semillas_leads (data,estatus) values\n' + leadValsC.slice(i, i + B).join(',\n') + ';\n');
  nb++;
}
let sqlServ = 'insert into semillas_servicios (lead_id,categoria,estatus,monto_estimado)\n';
sqlServ += 'select l.id, v.categoria, \'detectado\', v.monto from (values\n';
sqlServ += servVals.join(',\n') + '\n) as v(tmk,categoria,monto) join semillas_leads l on l.data->>\'tmk_id\' = v.tmk;\n';
fs.writeFileSync('/tmp/sem_serv.sql', sqlServ);

console.log(`cols:${cols.length} leads:${leadVals.length} batches:${nb} servicios:${servVals.length}`);
