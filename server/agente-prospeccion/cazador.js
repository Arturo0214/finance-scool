/**
 * Agente Cazador — sourcing autónomo de perfiles ICP (gratis, sin Serper).
 * ──────────────────────────────────────────────────────────────────────
 * Busca perfiles de LinkedIn de tu ICP vía DuckDuckGo HTML (sin key, sin costo),
 * filtra competidores/consultores/no-personas, dedupe contra el banco y los
 * inserta en crm_mejores_leads (bucket linkedin-*). Lo corre el workflow n8n
 * "cazador diario" y reporta a Telegram. Volumen moderado (gratis = menos que Serper).
 */
'use strict';
const crypto = require('crypto');
const { getDB } = require('../models/database');
const { encryptFields } = require('../utils/cryptoFields');

// Perfiles que NO son ICP (competidores, consultores que venden a PyMEs, no-personas)
const VETO = /(seguros|asegurad|asesor\s+financiero|consultor|coach|broker|reclutad|recruit|head\s?hunt|multinivel|network\s+marketing|\bmlm\b|cripto|bitcoin|forex|\btrading\b|freelanc|becari|pasante|practicante|estudiante|desemplead|b[uú]squeda de empleo|open to work|looking for work|inmobiliaria\b)/i;

// Sets de búsqueda por campaña (se rotan para traer sangre nueva cada día)
const QUERIES = {
  'linkedin-medicos': [
    'médico cirujano consulta privada México', 'dentista odontólogo consultorio privado México',
    'dermatólogo consulta privada México', 'ginecólogo consultorio privado México',
    'ortopedista traumatólogo consulta privada México', 'oftalmólogo cirujano México',
    'pediatra consulta privada México', 'cardiólogo consultorio México',
    'cirujano plástico consulta privada México', 'gastroenterólogo consulta privada México',
    'otorrinolaringólogo México consultorio', 'urólogo consulta privada México',
  ],
  'linkedin-pyme': [
    'dueño fundador PyME México', 'director general empresa familiar México',
    'propietario negocio México', 'founder empresa México', 'socio director despacho México',
    'dueño restaurante negocio México', 'director general manufactura México',
  ],
  'linkedin-patrimonio': [
    'director general 25 años experiencia México', 'ex director corporativo México',
    'empresario patrimonio México', 'notario despacho propio México',
    'abogado socio despacho México', 'director comercial México 20 años',
  ],
};
const CAMPANA = {
  'linkedin-medicos': 'Médicos PPR (bancarización)',
  'linkedin-pyme': 'PyME Fiscal',
  'linkedin-patrimonio': 'Patrimonio · PPR · Contigo 50+ (Arturo)',
};

const canon = (u) => u.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.|mx\.|[a-z]{2}\.)?/, 'https://www.');
const waHash = (u) => crypto.createHash('sha256').update('linkedin|' + canon(u)).digest('hex');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* Una búsqueda DDG → [{url, titulo}] de perfiles /in/ */
async function buscarDDG(q) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent('site:linkedin.com/in ' + q), { headers: { 'User-Agent': UA } });
  const html = await res.text();
  const out = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]*uddg=[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const uddg = (href.match(/uddg=([^&"]+)/) || [])[1];
    if (!uddg) continue;
    let url; try { url = decodeURIComponent(uddg); } catch { continue; }
    if (!/linkedin\.com\/in\//i.test(url)) continue;
    const titulo = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
    out.push({ url, titulo });
  }
  return out;
}

/* Del título "Dr. Juan Pérez - Cirujano - Hospital X" → {nombre, perfil} */
function parseTitulo(t) {
  const limpio = t.replace(/\s*[|–—]\s*LinkedIn\s*$/i, '').replace(/\s*-\s*LinkedIn\s*$/i, '').trim();
  const partes = limpio.split(/\s+[-–—]\s+/);
  let nombre = (partes[0] || '').trim();
  const perfil = partes.slice(1).join(' · ').trim();
  // Si el "nombre" se repite como primer y segundo segmento (DDG a veces duplica), usa uno
  return { nombre, perfil };
}

/* Score rápido al cazar (lo afina el calificador luego; evita que entren como 'C'). */
function scoreRapido(bucket, perfil) {
  const t = String(perfil || '');
  let p = 50;
  if (/(due[ñn]o|propietari|fundador|founder|director general|cirujan|consulta privada|consultorio|cl[ií]nica propia)/i.test(t)) p += 18;
  if (bucket === 'linkedin-medicos' && /(m[eé]dico|dentista|dermat|cardi|pediatra|ginec|ortoped|oftalm|ur[oó]log|gastro|cirujan|anestesi)/i.test(t)) p += 12;
  if (/(director|gerente|socio|presidente|ceo|cfo)/i.test(t)) p += 8;
  return Math.min(90, Math.max(45, p));
}

const esNombrePersona = (n) => {
  if (!n) return false;
  const palabras = n.split(/\s+/).filter(Boolean);
  if (palabras.length < 2 || palabras.length > 6) return false;
  if (n === n.toUpperCase() && n.length > 12) return false; // TODO MAYÚSCULAS largo = empresa
  if (/\b(s\.?a\.?|s\.?c\.?|srl|grupo|corporativo|asociados|consulting|solutions|company|inc\b|llc)\b/i.test(n)) return false;
  return true;
};

/**
 * cazar({ max }) → busca, filtra, dedupe e inserta. Devuelve reporte.
 */
async function cazar({ max = 30 } = {}) {
  const db = getDB();
  const { data: existing } = await db.from('crm_mejores_leads').select('wa_hash').like('bucket', 'linkedin-%');
  const yaHay = new Set((existing || []).map(r => r.wa_hash));
  const hoy = new Date().toISOString().slice(0, 10);

  const porBucket = { 'linkedin-medicos': 0, 'linkedin-pyme': 0, 'linkedin-patrimonio': 0 };
  const muestra = [];
  const vistosRun = new Set();
  const porCampana = Math.max(2, Math.floor(max / 3 / 3)); // ~queries por campaña

  for (const bucket of Object.keys(QUERIES)) {
    const pool = QUERIES[bucket].slice().sort(() => Math.random() - 0.5).slice(0, 3);
    for (const q of pool) {
      if (Object.values(porBucket).reduce((a, b) => a + b, 0) >= max) break;
      let resultados = [];
      try { resultados = await buscarDDG(q); } catch { /* DDG falló esta query, sigue */ }
      await sleep(900);
      for (const { url, titulo } of resultados) {
        if (porBucket[bucket] >= Math.ceil(max / 3)) break;
        const h = waHash(url);
        if (yaHay.has(h) || vistosRun.has(h)) continue;
        if (VETO.test(titulo)) continue;
        const { nombre, perfil } = parseTitulo(titulo);
        if (!esNombrePersona(nombre)) continue;
        if (VETO.test(perfil)) continue;
        vistosRun.add(h);
        const fila = encryptFields({
          wa_hash: h, bucket, campana: CAMPANA[bucket], nombre,
          perfil: perfil || null, linkedin_url: url, score: scoreRapido(bucket, perfil),
          notas_origen: `${perfil || 'LinkedIn'} · Cazado por el Agente (DDG) ${hoy} · query: ${q}`,
          seg_status: 'pendiente', fecha_lead: hoy,
        }, 'crm_mejores_leads');
        const { error } = await db.from('crm_mejores_leads').insert([fila]);
        if (!error) {
          yaHay.add(h); porBucket[bucket]++;
          if (muestra.length < 8) muestra.push({ nombre, perfil, bucket });
        }
      }
    }
  }
  const nuevos = Object.values(porBucket).reduce((a, b) => a + b, 0);
  return { nuevos, porBucket, muestra, fecha: hoy };
}

module.exports = { cazar, buscarDDG, VETO };
