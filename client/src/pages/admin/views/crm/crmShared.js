/* ══════════════════════════════════════════════════════
   CRM Incubadora S-COOL — constantes y helpers compartidos
   ══════════════════════════════════════════════════════ */
import { C } from '../../constants';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const fmtMoney = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
  return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
};
export const fmtMoneyFull = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
export const fmtPct = (n, dec = 0) => (n == null ? '—' : `${(n * 100).toFixed(dec)}%`);
export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

/* Los 8 pasos del proceso de venta de la promotoría */
export const ETAPAS = [
  { id: 'prospecto',      label: 'Por llamar',          color: '#94A3B8' },
  { id: 'cita_agendada',  label: 'Cita agendada',       color: '#3B82F6' },
  { id: 'cita_realizada', label: 'Cita realizada',      color: '#0891B2' },
  { id: 'presentacion',   label: 'Presentación/Cierre', color: '#8B5CF6' },
  { id: 'solicitud',      label: 'Solicitud',           color: '#F59E0B' },
  { id: 'emitida',        label: 'Emitida y pagada',    color: '#10B981' },
  { id: 'postventa',      label: 'Post venta',          color: '#C1975B' },
  { id: 'inactivo',       label: 'Inactivo',            color: '#EF4444' },
];
export const etapaInfo = (id) => ETAPAS.find(e => e.id === id) || ETAPAS[0];

/* Benchmark semanal de la industria por etapa (los "15/10/8/4/2/1") */
export const BENCHMARK_SEMANAL = [
  { id: 'prospecto',      meta: 15 },
  { id: 'cita_agendada',  meta: 10 },
  { id: 'cita_realizada', meta: 8 },
  { id: 'presentacion',   meta: 4 },
  { id: 'solicitud',      meta: 2 },
  { id: 'emitida',        meta: 1 },
];

export const ESTATUS_POLIZA = [
  { id: 'en_tramite',     label: 'En trámite',     bg: '#EDE9FE', text: '#6D28D9' },
  { id: 'pendiente_pago', label: 'Pendiente pago', bg: C.amberBg,  text: C.amber },
  { id: 'pagada',         label: 'Pagada',         bg: C.greenBg,  text: C.green },
  { id: 'cancelada',      label: 'Cancelada',      bg: C.redBg,    text: C.red   },
];
export const estatusPoliza = (id) => ESTATUS_POLIZA.find(e => e.id === id) || ESTATUS_POLIZA[0];

export const TIPOS_RECORDATORIO = [
  { id: 'pago',        label: 'Pago',        color: '#D97706', emoji: '💰' },
  { id: 'renovacion',  label: 'Renovación',  color: '#7C3AED', emoji: '🔄' },
  { id: 'cumpleanos',  label: 'Cumpleaños',  color: '#DB2777', emoji: '🎂' },
  { id: 'cita',        label: 'Cita',        color: '#0891B2', emoji: '📅' },
  { id: 'seguimiento', label: 'Seguimiento', color: '#2563EB', emoji: '📞' },
];
export const tipoRecordatorio = (id) => TIPOS_RECORDATORIO.find(t => t.id === id) || TIPOS_RECORDATORIO[4];

/* ══ Sugerencias inteligentes por cliente ══
   Lee los datos capturados (edad, cónyuge, hijos, beneficiarios, pólizas,
   objeciones) y genera recomendaciones accionables para llegar con producto
   en el momento correcto — p.ej. "su hijo ya cumplió 12: ya es elegible
   para una póliza de vida, a los 7 no lo era". Motor de reglas local. */
export const edadDe = (fecha) => {
  const f = String(fecha || '').slice(0, 10);
  if (!f) return null;
  const e = Math.floor((Date.now() - new Date(`${f}T12:00:00`).getTime()) / 31557600000);
  return e >= 0 && e < 120 ? e : null;
};

/* Extrae edades del texto libre de "hijos": acepta "12 años", "12a" o años
   de nacimiento ("2014"). */
const edadesEnTexto = (txt) => {
  const out = [];
  const s = String(txt || '');
  for (const m of s.matchAll(/(\d{1,2})\s*(?:años|año|a[ñn]itos)\b/gi)) { const n = +m[1]; if (n > 0 && n < 30) out.push(n); }
  const yNow = new Date().getFullYear();
  for (const m of s.matchAll(/\b(19[7-9]\d|20[0-2]\d)\b/g)) { const e = yNow - +m[1]; if (e >= 0 && e < 30 && !out.includes(e)) out.push(e); }
  return out;
};

const parseBeneficiarios = (raw) => {
  if (!raw) return [];
  try { const b = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(b) ? b : []; } catch { return []; }
};

export function buildSugerencias(client, policiesCliente = []) {
  const sug = [];
  const push = (icono, titulo, detalle, tipo = 'producto') => sug.push({ icono, titulo, detalle, tipo });
  const low = (s) => String(s || '').toLowerCase();
  const vigentes = policiesCliente.filter(p => p.estatus !== 'cancelada');
  const planesTxt = vigentes.map(p => low(p.plan)).join(' ');
  const tiene = (...kws) => kws.some(k => planesTxt.includes(k));
  const edad = edadDe(client.fecha_nacimiento);
  const edadCony = edadDe(client.fecha_nacimiento_conyuge);

  /* Edades de hijos: texto libre de "hijos" + beneficiarios jóvenes con fecha */
  const hijosEdades = edadesEnTexto(client.hijos);
  for (const p of policiesCliente) {
    for (const b of parseBeneficiarios(p.beneficiarios)) {
      const e = edadDe(b.fecha_nacimiento);
      const rel = low(b.relacion);
      if (e !== null && (e < 25 || rel.includes('hij')) && !hijosEdades.includes(e)) hijosEdades.push(e);
    }
  }

  /* ── Hijos: elegibilidad por edad ── */
  for (const e of [...new Set(hijosEdades)].sort((a, b) => a - b)) {
    if (e >= 12 && e < 18) {
      push('👨‍👧', `Su hijo(a) de ${e} años ya es elegible para póliza de vida`,
        `A los 12 ya se puede contratar vida/ahorro a nombre del menor (a los 7 no se podía). Llega con un plan que asegure universidad y arranque su patrimonio con prima baja — sube cada año que esperen.`);
    } else if (e < 12) {
      push('🎓', `Hijo(a) de ${e} años: momento ideal para plan educativo`,
        `Antes de los 12 el producto indicado es el educativo/dotal: ${12 - e} año(s) de ventaja de acumulación antes de que sea elegible para vida.`);
    } else if (e >= 18 && e <= 26) {
      push('🚀', `Su hijo(a) de ${e} años ya puede ser titular de su propia póliza`,
        `Es prospecto directo: primer PPR o vida con la prima más baja de su vida. Pide la referencia — es la venta natural de la cartera.`);
    }
  }

  /* ── Momento de vida del titular ── */
  if (edad !== null) {
    if (edad >= 25 && edad <= 45 && !tiene('ppr', 'patrimonial', 'trasciende', 'retiro', 'dotal'))
      push('🏦', `A sus ${edad} años, cada año sin PPR cuesta caro`,
        `Está en la ventana de máxima acumulación para el retiro. Un PPR ahora vale mucho más que el mismo PPR a los ${edad + 10}. Además deduce impuestos (Art. 151 LISR).`, 'momento');
    if (edad >= 46 && edad <= 60 && !tiene('gmm', 'médic', 'medic', 'salud'))
      push('🏥', `${edad} años sin GMM: asegurable hoy, quizá no mañana`,
        `Después de los 60 el GMM se encarece o se niega por padecimientos. Contratarlo ahora fija su asegurabilidad.`, 'momento');
    if (edad >= 55 && vigentes.length > 0)
      push('📜', 'Conversación de legado y beneficiarios',
        'Revisa con él/ella beneficiarios y suma seguro con componente sucesorio: es la edad donde más se agradece y menos se ofrece.', 'momento');
  } else {
    push('📋', 'Captura su fecha de nacimiento',
      'Sin edad no se pueden detectar ventanas de producto (PPR, GMM, prima por edad). Pídela en la siguiente llamada.', 'datos');
  }

  /* ── Cumpleaños próximo = cambio de edad actuarial ── */
  if (client.fecha_nacimiento) {
    const f = String(client.fecha_nacimiento).slice(0, 10);
    const hoy = new Date();
    const cumple = new Date(`${hoy.getFullYear()}-${f.slice(5)}T12:00:00`);
    if (cumple < hoy) cumple.setFullYear(cumple.getFullYear() + 1);
    const dias = Math.round((cumple - hoy) / 86400000);
    if (dias <= 45 && edad !== null)
      push('⏳', `Cumple ${edad + 1} años en ${dias} día(s): la prima sube`,
        `Cualquier póliza nueva contratada antes de su cumpleaños se calcula con edad ${edad}. Es el mejor argumento de urgencia honesto que existe.`, 'momento');
  }

  /* ── Cónyuge ── */
  if (client.fecha_nacimiento_conyuge && vigentes.length > 0)
    push('💍', `Cónyuge${edadCony !== null ? ` de ${edadCony} años` : ''} sin proteger`,
      'El titular ya confió en ti: proteger ambos ingresos duplica la protección familiar y tu prima — y los hogares con 2 pólizas casi no cancelan.');

  /* ── Cross-sell por hueco de portafolio ── */
  if (vigentes.length > 0) {
    if (tiene('gmm', 'médic', 'medic', 'salud') && !tiene('vida', 'ordinario', 'temporal', 'trasciende'))
      push('🛡️', 'Tiene GMM pero no vida', 'Ya entendió el valor de asegurarse: la conversación de vida es corta. Protege el ingreso, no solo la salud.');
    if (tiene('vida', 'ordinario', 'temporal') && !tiene('gmm', 'médic', 'medic', 'salud'))
      push('🏥', 'Tiene vida pero no GMM', 'Un evento médico mayor es el riesgo financiero más probable antes de los 65. Complemento natural de su vida.');
    if ((client.aseguradora || 'PRU') === 'PRU' && !policiesCliente.some(p => p.aseguradora === 'IL'))
      push('🔁', 'Solo tiene cartera Prudential', 'Evalúa si un producto Insignia Life complementa (o viceversa): el cliente multi-póliza retiene el doble.', 'producto');
  }

  /* ── Objeción registrada: re-abordaje ── */
  if (client.motivo_no_compra)
    push('🚧', 'Objeción registrada: úsala para re-abordar', `Dijo: "${client.motivo_no_compra}". Prepara la respuesta a ESA objeción antes de volver a llamar — no repitas el pitch general.`, 'abordaje');
  const motivos = policiesCliente.map(p => p.motivo_compra).filter(Boolean);
  if (motivos.length)
    push('❤️', 'Ancla de retención: por qué compró', `"${motivos[0]}" — recuérdaselo en cada renovación o intento de cancelación; es su propio argumento.`, 'abordaje');

  /* ── Higiene de datos que desbloquea sugerencias ── */
  const faltan = [];
  if (!client.telefono) faltan.push('teléfono');
  if (!client.email) faltan.push('correo');
  if (!client.hijos && hijosEdades.length === 0) faltan.push('hijos');
  if (!client.ocupacion) faltan.push('ocupación');
  if (faltan.length)
    push('📋', `Completa su expediente: falta ${faltan.join(', ')}`,
      'Cada dato nuevo genera sugerencias nuevas (elegibilidad de hijos, cumpleaños, perfil lookalike). Aprovecha la siguiente interacción para pedirlos.', 'datos');

  return sug;
}

export const CUADERNOS = ['NOVEL', 'EN DESARROLLO', 'CONSOLIDADO'];
/* Los nombres de plan REALES son los códigos Prudential del Reporte/índice
   (WLTF65I, RINF65I, ENDF20I…): los dropdowns se arman con los planes vistos
   en la base + el catálogo de Productos que administra la agencia. */
export const planesReales = (policies = [], products = [], aseguradora = null) => [...new Set([
  ...products.filter(p => p.activo !== false && (!aseguradora || p.aseguradora === aseguradora)).map(p => p.nombre),
  ...policies.filter(p => !aseguradora || (p.aseguradora || 'PRU') === aseguradora).map(p => p.plan),
].filter(Boolean))].sort();

/* CSS específico del módulo CRM (complementa getAdminCSS) — lenguaje
   "banca privada": porcelana, hairlines, serif en cifras y acento champagne */
export const getCrmCSS = () => `
  .crm-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:22px; }
  .crm-toolbar-right { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .crm-select { padding:9px 13px; border:1px solid rgba(11,27,51,.14); border-radius:10px; font-size:13.5px; font-family:inherit; background:${C.white}; color:${C.text}; outline:none; cursor:pointer; box-shadow:0 1px 2px rgba(11,27,51,.04); transition:border-color .2s, box-shadow .2s; }
  .crm-select:focus { border-color:${C.primary}; box-shadow:0 0 0 3.5px rgba(0,61,165,.1); }
  .crm-search { padding:9px 13px !important; padding-left:38px !important; border:1px solid rgba(11,27,51,.14); border-radius:10px; font-size:13.5px; font-family:inherit; background:${C.white}; color:${C.text}; outline:none; min-width:220px; box-shadow:0 1px 2px rgba(11,27,51,.04); transition:border-color .2s, box-shadow .2s; }
  .crm-search:focus { border-color:${C.primary}; box-shadow:0 0 0 3.5px rgba(0,61,165,.1); }
  .crm-search-wrap { position:relative; display:flex; align-items:center; }
  .crm-search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${C.textLight}; pointer-events:none; z-index:1; }

  .crm-progress { height:8px; background:rgba(11,27,51,.07); border-radius:6px; overflow:hidden; min-width:70px; box-shadow:inset 0 1px 2px rgba(11,27,51,.06); }
  .crm-progress-fill { height:100%; border-radius:6px; transition:width .5s ease; background-image:linear-gradient(180deg, rgba(255,255,255,.25), transparent); }

  .crm-chart-card {
    background:linear-gradient(180deg,#fff,#FDFDFC); border:1px solid rgba(11,27,51,.08); border-radius:16px;
    padding:22px 24px; margin-bottom:20px;
    box-shadow:0 1px 2px rgba(11,27,51,.03), 0 10px 30px -24px rgba(11,27,51,.3);
    animation:riseIn .5s ease backwards;
  }
  .crm-chart-card h3 { font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:600; margin:0 0 4px; color:${C.ink}; letter-spacing:-.2px; }
  .crm-chart-card .sub { font-size:12.5px; color:${C.textMuted}; margin:0 0 16px; }

  .crm-rank-row { cursor:pointer; }

  .crm-detail-tabs { display:flex; gap:4px; border-bottom:1px solid rgba(11,27,51,.1); margin-bottom:18px; overflow-x:auto; scrollbar-width:none; }
  .crm-detail-tabs::-webkit-scrollbar { display:none; }
  .crm-dtab { padding:9px 15px; border:none; background:none; font-size:13.5px; font-weight:600; color:${C.textMuted}; cursor:pointer; font-family:inherit; border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; transition:all .2s; letter-spacing:.1px; }
  .crm-dtab:hover { color:${C.primary}; }
  .crm-dtab.active { color:${C.primary}; border-bottom-color:${C.gold}; }

  .crm-modal-lg { max-width:760px !important; }
  .crm-modal-xl { max-width:980px !important; }

  .crm-file-row { display:flex; align-items:center; gap:10px; padding:11px 13px; border:1px solid rgba(11,27,51,.08); border-radius:12px; margin-bottom:8px; background:linear-gradient(180deg,#FBFCFD,#F7F9FB); transition:border-color .2s; }
  .crm-file-row:hover { border-color:rgba(11,27,51,.18); }
  .crm-file-row .fname { flex:1; font-size:13px; font-weight:600; color:${C.text}; word-break:break-all; }
  .crm-file-row .fmeta { font-size:11px; color:${C.textMuted}; }

  .crm-upload-zone { border:1.5px dashed rgba(11,27,51,.22); border-radius:14px; padding:24px; text-align:center; cursor:pointer; transition:all .25s; color:${C.textMuted}; font-size:13.5px; margin-bottom:14px; background:linear-gradient(180deg,transparent,rgba(11,27,51,.015)); }
  .crm-upload-zone:hover, .crm-upload-zone.drag { border-color:${C.gold}; background:${C.goldBg}; color:#8A6A34; }

  .crm-rem-group { margin-bottom:24px; }
  .crm-rem-group h4 { font-size:10.5px; text-transform:uppercase; letter-spacing:2px; color:rgba(138,106,52,.85); margin:0 0 10px; font-weight:700; }
  .crm-rem-card { display:flex; gap:13px; align-items:flex-start; background:linear-gradient(180deg,#fff,#FDFDFB); border:1px solid rgba(11,27,51,.08); border-radius:14px; padding:15px 16px; margin-bottom:10px; transition:transform .2s ease, box-shadow .2s ease; box-shadow:0 1px 2px rgba(11,27,51,.03); }
  .crm-rem-card:hover { transform:translateY(-2px); box-shadow:0 14px 30px -18px rgba(0,43,117,.35); }
  .crm-rem-card.done { opacity:.5; filter:saturate(.6); }
  .crm-rem-emoji { font-size:20px; width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:inset 0 0 0 1px rgba(11,27,51,.05); }
  .crm-rem-body { flex:1; min-width:0; }
  .crm-rem-title { font-size:14px; font-weight:600; color:${C.ink}; margin:0; }
  .crm-rem-desc { font-size:12.5px; color:${C.textMuted}; margin:2px 0 0; }
  .crm-rem-meta { display:flex; gap:10px; flex-wrap:wrap; margin-top:7px; font-size:12px; color:${C.textMuted}; align-items:center; }
  .crm-rem-actions { display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }
  .crm-icon-btn { width:33px; height:33px; border-radius:10px; border:1px solid rgba(11,27,51,.12); background:${C.white}; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:${C.textMuted}; transition:all .2s; box-shadow:0 1px 2px rgba(11,27,51,.04); }
  .crm-icon-btn:hover { border-color:${C.primary}; color:${C.primary}; transform:translateY(-1px); }
  .crm-icon-btn.ok:hover { border-color:${C.green}; color:${C.green}; background:${C.greenBg}; }
  .crm-icon-btn.del:hover { border-color:${C.red}; color:${C.red}; background:${C.redBg}; }
  .crm-icon-btn.wa:hover { border-color:#25D366; color:#25D366; background:#ECFDF5; }

  .crm-goal-input { width:100%; min-width:74px; padding:7px 9px; border:1px solid rgba(11,27,51,.14); border-radius:8px; font-size:12.5px; font-family:inherit; text-align:right; outline:none; background:${C.white}; color:${C.text}; font-variant-numeric:tabular-nums; transition:border-color .2s, box-shadow .2s; }
  .crm-goal-input:focus { border-color:${C.primary}; box-shadow:0 0 0 3px rgba(0,61,165,.09); }
  .crm-goal-input.changed { border-color:${C.gold}; background:${C.goldBg}; }

  .crm-kpi-detail { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:18px; }
  .crm-kpi-box { background:linear-gradient(180deg,#fff,#FCFCFA); border:1px solid rgba(11,27,51,.08); border-radius:14px; padding:15px 16px; position:relative; overflow:hidden; box-shadow:0 1px 2px rgba(11,27,51,.03); transition:transform .2s ease, box-shadow .2s ease; }
  .crm-kpi-box::before { content:''; position:absolute; top:0; left:16px; right:16px; height:2px; background:linear-gradient(90deg,transparent,rgba(193,151,91,.5),transparent); opacity:0; transition:opacity .25s; }
  .crm-kpi-box:hover { transform:translateY(-2px); box-shadow:0 14px 28px -18px rgba(0,43,117,.35); }
  .crm-kpi-box:hover::before { opacity:1; }
  .crm-kpi-box .k-label { font-size:10px; text-transform:uppercase; letter-spacing:1.3px; color:${C.textMuted}; font-weight:700; margin-bottom:5px; }
  .crm-kpi-box .k-value { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:600; color:${C.ink}; letter-spacing:-.4px; font-variant-numeric:tabular-nums; }
  .crm-kpi-box .k-sub { font-size:11.5px; color:${C.textMuted}; margin-top:3px; }

  .crm-mobile-card { background:linear-gradient(180deg,#fff,#FDFDFB); border-radius:14px; padding:15px; border:1px solid rgba(11,27,51,.08); box-shadow:0 2px 10px rgba(11,27,51,.05); margin-bottom:10px; }
  .crm-mc-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px; }
  .crm-mc-name { font-size:14.5px; font-weight:700; color:${C.ink}; }
  .crm-mc-row { display:flex; justify-content:space-between; font-size:12.5px; color:${C.textMuted}; padding:3px 0; }
  .crm-mc-row b { color:${C.text}; font-weight:600; font-variant-numeric:tabular-nums; }

  @media(max-width:768px){
    .crm-toolbar { flex-direction:column; align-items:stretch; }
    .crm-toolbar-right { justify-content:stretch; }
    .crm-toolbar-right > * { flex:1; }
    .crm-search { min-width:0; width:100%; }
    .crm-chart-card { padding:14px; border:none; box-shadow:0 2px 12px rgba(0,61,165,.05); }
    .crm-kpi-detail { grid-template-columns:repeat(2,1fr); }
    .crm-rem-actions { flex-direction:column; }
  }
`;

/* ── Clasificación comercial de asesores ──
   Los selectores y listas muestran ACTIVOS por default; los inactivos (con/sin
   producción) van agrupados aparte y el personal administrativo nunca aparece. */
export const esAgenteActivo = (a) => (a?.clasificacion || 'activo') === 'activo';
export const partirAgentes = (agents = []) => ({
  activos: agents.filter(esAgenteActivo),
  inactivos: agents.filter(a => !esAgenteActivo(a) && a?.clasificacion !== 'administrativo'),
});
