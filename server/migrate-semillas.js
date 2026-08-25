/**
 * Migra el portafolio de leads (hoja "Robert") a la base "Semillas".
 * Anonimiza (no arrastra el nombre del portafolio), carga cada empresa como una
 * semilla (data jsonb) y DERIVA servicios de cada categoría de gasto con monto.
 *
 * Uso: node server/migrate-semillas.js "<ruta.xlsx>"
 */
require('dotenv').config();
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const file = process.argv[2] || `${process.env.HOME}/Downloads/Portafolio Robert con mas data_2 (1).xlsx`;

const slug = (h) => String(h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 58) || 'col';

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

/* Columnas curadas: label limpio, tipo, grupo, visible. El resto se importa
   oculto (visible=false) pero editable/eliminable (solo Arturo puede borrar). */
const CURADAS = {
  'TMK ID':            { key: 'tmk_id', label: 'ID', tipo: 'text', grupo: 'Identidad', orden: 1 },
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

/* Categorías de gasto → servicios que brotan de cada semilla */
const CAT_SERVICIOS = {
  'avg_SEGUROS_12m_MXN': 'Seguros',
  'avg_AIR_12m_MXN': 'Aéreo / Viajes',
  'avg_LODGING_12m_MXN': 'Hospedaje',
  'avg_RESTAURANT_12m_MXN': 'Restaurantes',
  'avg_TRANSPORTATION_NON_TE_12m_MXN': 'Transporte no T&E',
  'avg_PROFESSIONAL_FINANCIAL_SERVICES_12m_MXN': 'Servicios financieros',
  'avg_GAS_PETROL_STATIONS_12m_MXN': 'Gasolina',
  'avg_IT_HARDWARE_12m_MXN': 'IT / Hardware',
  'avg_ADVERTISING_12m_MXN': 'Publicidad',
  'avg_MOBILE_TELECOMS_12m_MXN': 'Telecom',
  'avg_RETAIL_12m_MXN': 'Retail',
  'avg_GOVERNMENT_CHARGES_TAXES_12m_MXN': 'Impuestos / Gobierno',
};
const esMoneyHeader = (h) => /mxn|gasto|cv_|prima|avg_|otb|spending|sugerencia/i.test(h);

(async () => {
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Robert'], { header: 1, defval: '' });
  const headers = rows[0].map(h => String(h).trim()).filter(Boolean);

  // 1) Limpia tablas (base fresca)
  for (const t of ['semillas_seguimientos', 'semillas_servicios', 'semillas_leads', 'semillas_columnas'])
    await db.from(t).delete().gt('id', 0);

  // 2) Columnas
  const keyByHeader = {}, usados = new Set();
  const cols = headers.map((h, i) => {
    const cur = CURADAS[h];
    let key = cur ? cur.key : slug(h);
    while (usados.has(key)) key = key + '_' + i;
    usados.add(key); keyByHeader[h] = key;
    return {
      col_key: key, label: cur ? cur.label : h, tipo: cur ? cur.tipo : (esMoneyHeader(h) ? 'money' : 'text'),
      orden: cur ? cur.orden : 100 + i, visible: !!cur, ancho: cur?.ancho || 160, grupo: cur ? cur.grupo : 'Datos',
    };
  });
  const { error: ce } = await db.from('semillas_columnas').insert(cols);
  if (ce) throw new Error('columnas: ' + ce.message);

  // 3) Leads + servicios derivados
  let nLeads = 0, nServ = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !String(row[0]).trim()) continue;
    const data = {};
    headers.forEach((h, i) => {
      const key = keyByHeader[h];
      const raw = row[i];
      const col = cols.find(c => c.col_key === key);
      if (col.tipo === 'money' || col.tipo === 'number') data[key] = num(raw);
      else if (col.tipo === 'bool') data[key] = !!raw && String(raw).trim() !== '' && String(raw).trim() !== '0';
      else data[key] = String(raw ?? '').trim();
    });
    const { data: lead, error: le } = await db.from('semillas_leads').insert([{ data, estatus: 'nuevo' }]).select('id').single();
    if (le) throw new Error('lead: ' + le.message);
    nLeads++;

    const servicios = [];
    for (const [h, cat] of Object.entries(CAT_SERVICIOS)) {
      const idx = headers.indexOf(h);
      if (idx < 0) continue;
      const monto = num(row[idx]);
      if (monto > 1000) servicios.push({ lead_id: lead.id, categoria: cat, estatus: 'detectado', monto_estimado: Math.round(monto) });
    }
    if (servicios.length) {
      const { error: se } = await db.from('semillas_servicios').insert(servicios);
      if (se) throw new Error('servicios: ' + se.message);
      nServ += servicios.length;
    }
  }
  console.log(`OK · columnas: ${cols.length} · leads: ${nLeads} · servicios derivados: ${nServ}`);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
