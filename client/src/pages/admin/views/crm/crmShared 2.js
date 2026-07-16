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

export const ETAPAS = [
  { id: 'prospecto',  label: 'Prospecto',  color: '#94A3B8' },
  { id: 'contactado', label: 'Contactado', color: '#3B82F6' },
  { id: 'cita',       label: 'Cita',       color: '#8B5CF6' },
  { id: 'propuesta',  label: 'Propuesta',  color: '#F59E0B' },
  { id: 'cliente',    label: 'Cliente',    color: '#10B981' },
  { id: 'inactivo',   label: 'Inactivo',   color: '#EF4444' },
];
export const etapaInfo = (id) => ETAPAS.find(e => e.id === id) || ETAPAS[0];

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

export const CUADERNOS = ['NOVEL', 'EN DESARROLLO', 'CONSOLIDADO'];
export const PLANES = ['PPR Trasciende', 'PPR Patrimonial', 'Vida Ordinario', 'Vida Temporal', 'GMM Esencial', 'GMM Flex', 'GMM Premium', 'Otro'];

/* CSS específico del módulo CRM (complementa getAdminCSS) */
export const getCrmCSS = () => `
  .crm-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
  .crm-toolbar-right { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .crm-select { padding:9px 12px; border:1px solid ${C.border}; border-radius:8px; font-size:13.5px; font-family:inherit; background:${C.white}; color:${C.text}; outline:none; cursor:pointer; }
  .crm-select:focus { border-color:${C.primary}; }
  .crm-search { padding:9px 12px 9px 34px; border:1px solid ${C.border}; border-radius:8px; font-size:13.5px; font-family:inherit; background:${C.white}; color:${C.text}; outline:none; min-width:200px; }
  .crm-search:focus { border-color:${C.primary}; box-shadow:0 0 0 3px rgba(0,61,165,.08); }
  .crm-search-wrap { position:relative; display:flex; align-items:center; }
  .crm-search-wrap svg { position:absolute; left:10px; color:${C.textLight}; pointer-events:none; }

  .crm-progress { height:8px; background:${C.bg}; border-radius:6px; overflow:hidden; min-width:70px; }
  .crm-progress-fill { height:100%; border-radius:6px; transition:width .5s ease; }

  .crm-chart-card { background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:20px; margin-bottom:20px; }
  .crm-chart-card h3 { font-size:15px; font-weight:600; margin:0 0 4px; color:${C.text}; }
  .crm-chart-card .sub { font-size:12.5px; color:${C.textMuted}; margin:0 0 14px; }

  .crm-rank-row { cursor:pointer; }

  .crm-detail-tabs { display:flex; gap:4px; border-bottom:2px solid ${C.border}; margin-bottom:16px; overflow-x:auto; scrollbar-width:none; }
  .crm-detail-tabs::-webkit-scrollbar { display:none; }
  .crm-dtab { padding:9px 14px; border:none; background:none; font-size:13.5px; font-weight:600; color:${C.textMuted}; cursor:pointer; font-family:inherit; border-bottom:2px solid transparent; margin-bottom:-2px; white-space:nowrap; transition:all .2s; }
  .crm-dtab:hover { color:${C.primary}; }
  .crm-dtab.active { color:${C.primary}; border-bottom-color:${C.primary}; }

  .crm-modal-lg { max-width:760px !important; }
  .crm-modal-xl { max-width:980px !important; }

  .crm-file-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid ${C.border}; border-radius:10px; margin-bottom:8px; background:${C.bg}; }
  .crm-file-row .fname { flex:1; font-size:13px; font-weight:600; color:${C.text}; word-break:break-all; }
  .crm-file-row .fmeta { font-size:11px; color:${C.textMuted}; }

  .crm-upload-zone { border:2px dashed ${C.border}; border-radius:12px; padding:22px; text-align:center; cursor:pointer; transition:all .2s; color:${C.textMuted}; font-size:13.5px; margin-bottom:14px; }
  .crm-upload-zone:hover, .crm-upload-zone.drag { border-color:${C.primary}; background:${C.blueBg}; color:${C.primary}; }

  .crm-rem-group { margin-bottom:22px; }
  .crm-rem-group h4 { font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${C.textMuted}; margin:0 0 10px; font-weight:700; }
  .crm-rem-card { display:flex; gap:12px; align-items:flex-start; background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:14px; margin-bottom:10px; transition:box-shadow .2s; }
  .crm-rem-card:hover { box-shadow:0 4px 12px rgba(0,61,165,.08); }
  .crm-rem-card.done { opacity:.55; }
  .crm-rem-emoji { font-size:20px; width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .crm-rem-body { flex:1; min-width:0; }
  .crm-rem-title { font-size:14px; font-weight:600; color:${C.text}; margin:0; }
  .crm-rem-desc { font-size:12.5px; color:${C.textMuted}; margin:2px 0 0; }
  .crm-rem-meta { display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; font-size:12px; color:${C.textMuted}; align-items:center; }
  .crm-rem-actions { display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }
  .crm-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid ${C.border}; background:${C.white}; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:${C.textMuted}; transition:all .2s; }
  .crm-icon-btn:hover { border-color:${C.primary}; color:${C.primary}; }
  .crm-icon-btn.ok:hover { border-color:${C.green}; color:${C.green}; background:${C.greenBg}; }
  .crm-icon-btn.del:hover { border-color:${C.red}; color:${C.red}; background:${C.redBg}; }
  .crm-icon-btn.wa:hover { border-color:#25D366; color:#25D366; background:#ECFDF5; }

  .crm-goal-input { width:100%; min-width:74px; padding:6px 8px; border:1px solid ${C.border}; border-radius:6px; font-size:12.5px; font-family:inherit; text-align:right; outline:none; background:${C.white}; color:${C.text}; }
  .crm-goal-input:focus { border-color:${C.primary}; }
  .crm-goal-input.changed { border-color:${C.amber}; background:${C.amberBg}; }

  .crm-kpi-detail { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:18px; }
  .crm-kpi-box { background:${C.bg}; border-radius:10px; padding:14px; }
  .crm-kpi-box .k-label { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:${C.textMuted}; font-weight:700; margin-bottom:4px; }
  .crm-kpi-box .k-value { font-size:20px; font-weight:800; color:${C.text}; letter-spacing:-.3px; }
  .crm-kpi-box .k-sub { font-size:11.5px; color:${C.textMuted}; margin-top:2px; }

  .crm-mobile-card { background:${C.white}; border-radius:12px; padding:14px; border:1px solid ${C.border}; box-shadow:0 2px 10px rgba(0,61,165,.05); margin-bottom:10px; }
  .crm-mc-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px; }
  .crm-mc-name { font-size:14.5px; font-weight:700; color:${C.text}; }
  .crm-mc-row { display:flex; justify-content:space-between; font-size:12.5px; color:${C.textMuted}; padding:3px 0; }
  .crm-mc-row b { color:${C.text}; font-weight:600; }

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
