/**
 * CrmProspectosView — Mesa de socios (Arturo · Ingrid · Flavio)
 * CRM de prospección LinkedIn: PPR, fiscal y patrimonio.
 *
 *  · PIPELINE kanban con drag & drop por etapa de venta (sellos de lacre)
 *  · RED genealógica de referidos multi-nivel (referido del referido, infinito)
 *  · Expediente lateral (drawer): asignación, Rap, bitácora, referidos
 *  · CALENDARIOS: agendas Google de los 3 socios combinadas
 *
 * Estética "banca privada": porcelana, tinta marina, oro champagne grabado,
 * monogramas de sello y Fraunces para los números. Gating: whitelist de correos
 * (backend PROSPECTOS_EMAILS + AdminPanel).
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  Search, Linkedin, RefreshCw, GitBranch, Crown, CalendarDays, Video,
  Plus, X, UserCheck, KanbanSquare, Network, ExternalLink, StickyNote, ChevronDown,
} from 'lucide-react';

const GOLD = C.gold, INK = C.ink;

const CAMPANAS = [
  { id: 'linkedin-patrimonio', label: 'Patrimonio · 50+', color: '#8A6A34' },
  { id: 'linkedin-pyme',       label: 'PyME Fiscal',      color: '#0E8A63' },
  { id: 'linkedin-medicos',    label: 'Médicos PPR',      color: '#0A5BC4' },
];
const campanaInfo = (b) => CAMPANAS.find(c => c.id === b) || { label: 'Referido directo', color: '#7C3AED' };

const SOCIOS = ['Arturo', 'Ingrid', 'Flavio'];
const SOCIO_COLOR = { Arturo: '#8A6A34', Ingrid: '#7C3AED', Flavio: '#0891B2' };

const ETAPAS = [
  { id: 'pendiente',  label: 'Pendiente',  color: '#B97F1E' },
  { id: 'contactado', label: 'Contactado', color: '#2563EB' },
  { id: 'interesado', label: 'Interesado', color: '#7C3AED' },
  { id: 'negociando', label: 'Negociando', color: '#0891B2' },
  { id: 'convertido', label: 'Convertido', color: '#0E8A63' },
  { id: 'descartado', label: 'Descartado', color: '#9AA7B8' },
];
const etapaInfo = (id) => ETAPAS.find(s => s.id === id) || ETAPAS[0];

const iniciales = (nombre = '') => nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/* ═══════════════════════════ CSS ═══════════════════════════ */
const PLV_CSS = `
  .plv { --gold:${GOLD}; --ink:${INK}; --hair:rgba(11,27,51,.09); --porcelain:#FBFAF7; }
  @keyframes plvRise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  @keyframes plvDrawer { from { transform:translateX(40px); opacity:0; } to { transform:none; opacity:1; } }
  @keyframes plvNode { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }
  @keyframes plvPulse { 0%,100% { box-shadow:0 0 0 0 rgba(193,151,91,.35); } 50% { box-shadow:0 0 0 6px rgba(193,151,91,0); } }

  /* ── Placa de la mesa de socios ── */
  .plv-plaque { position:relative; overflow:hidden; display:flex; justify-content:space-between; align-items:center; gap:22px; flex-wrap:wrap; margin-bottom:18px; padding:22px 28px 20px; border-radius:18px; background:radial-gradient(130% 170% at 8% 0%, #14315E 0%, ${INK} 55%, #081324 100%); box-shadow:0 18px 44px -22px rgba(4,12,26,.65), inset 0 1px 0 rgba(255,255,255,.07); animation:plvRise .5s ease backwards; }
  .plv-plaque::before { content:''; position:absolute; inset:0; background-image:radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px); background-size:22px 22px; opacity:.35; pointer-events:none; }
  .plv-plaque-frame { position:absolute; inset:8px; border:1px solid rgba(193,151,91,.32); border-radius:12px; pointer-events:none; }
  .plv-plaque-frame::before { content:'◆'; position:absolute; top:-8px; left:50%; transform:translateX(-50%); font-size:9px; color:rgba(193,151,91,.75); padding:0 8px; }
  .plv-overline { display:flex; align-items:center; gap:10px; margin:0 0 6px; }
  .plv-overline span { height:1px; width:26px; background:linear-gradient(90deg,transparent,rgba(193,151,91,.85)); }
  .plv-overline span:last-child { background:linear-gradient(90deg,rgba(193,151,91,.85),transparent); }
  .plv-overline em { font-style:normal; font-size:9.5px; letter-spacing:2.6px; text-transform:uppercase; color:#D6B37E; font-weight:700; white-space:nowrap; }
  .admin-wrap .plv h1.plv-title { font-family:'Fraunces',Georgia,serif; font-size:30px; font-weight:600; letter-spacing:-.4px; margin:0; color:#F2E4C8; text-shadow:0 1px 0 rgba(0,0,0,.35), 0 0 22px rgba(193,151,91,.35); }
  .plv-sub { font-size:12px; color:rgba(233,240,250,.6); margin:4px 0 0; }
  .plv-pstats { position:relative; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  .plv-pstat { display:flex; flex-direction:column; min-width:52px; }
  .plv-pstat i { font-style:normal; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(214,179,126,.85); font-weight:700; }
  .plv-pstat b { font-family:'Fraunces',Georgia,serif; font-size:23px; font-weight:600; color:#F6F1E6; font-variant-numeric:tabular-nums; letter-spacing:-.4px; line-height:1.15; }
  .plv-pstat u { text-decoration:none; font-size:10px; color:rgba(233,240,250,.5); }
  .plv-pdiv { width:1px; align-self:stretch; background:linear-gradient(180deg,transparent,rgba(193,151,91,.4),transparent); }
  .plv-refresh { width:36px; height:36px; border-radius:50%; border:1px solid rgba(193,151,91,.4); background:rgba(255,255,255,.04); color:#D6B37E; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .25s; }
  .plv-refresh:hover { border-color:var(--gold); background:rgba(193,151,91,.14); transform:rotate(90deg); }

  /* ── Conmutador de vistas + filtros ── */
  .plv-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px; animation:plvRise .5s .05s ease backwards; }
  .plv-views { display:inline-flex; border:1px solid var(--hair); border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 1px 2px rgba(11,27,51,.05); }
  .plv-view { display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-size:12.5px; font-weight:700; padding:9px 16px; border:none; background:none; color:${C.textMuted}; cursor:pointer; transition:all .2s; }
  .plv-view + .plv-view { border-left:1px solid var(--hair); }
  .plv-view.on { background:linear-gradient(180deg,#FBF4E6,#F5EBD6); color:#8A6A34; }
  .plv-camp { display:inline-flex; align-items:center; gap:6px; font-family:inherit; font-size:11.5px; font-weight:700; padding:7px 13px; border-radius:20px; border:1px solid var(--hair); background:#fff; color:${C.textMuted}; cursor:pointer; transition:all .2s; }
  .plv-camp:hover { transform:translateY(-1px); }
  .plv-camp.on { border-color:var(--cc); color:var(--cc); background:color-mix(in srgb, var(--cc) 7%, #fff); }
  .plv-camp .n { font-variant-numeric:tabular-nums; opacity:.65; font-weight:600; }
  .plv-search { position:relative; display:flex; align-items:center; min-width:200px; }
  .plv-search svg { position:absolute; left:12px; color:${C.textLight}; pointer-events:none; }
  .plv-search input { width:100%; padding:8px 13px 8px 34px; border:1px solid var(--hair); border-radius:20px; font-size:12.5px; font-family:inherit; background:#fff; color:${C.text}; outline:none; transition:all .2s; }
  .plv-search input:focus { border-color:var(--gold); box-shadow:0 0 0 3.5px rgba(193,151,91,.16); }
  .plv-select { padding:8px 11px; border:1px solid var(--hair); border-radius:10px; font-size:12px; font-family:inherit; background:#fff; color:${C.text}; outline:none; cursor:pointer; }

  /* ── Pipeline kanban ── */
  .plv-board { display:grid; grid-template-columns:repeat(6, minmax(215px, 1fr)); gap:10px; overflow-x:auto; padding-bottom:10px; animation:plvRise .5s .1s ease backwards; }
  .plv-col { background:linear-gradient(180deg, rgba(255,255,255,.75), rgba(251,250,247,.6)); border:1px solid var(--hair); border-radius:14px; padding:10px 9px 9px; min-height:300px; display:flex; flex-direction:column; transition:all .2s; }
  .plv-col.over { border-color:var(--gold); background:linear-gradient(180deg,#FDF8EE,#FBF4E3); box-shadow:inset 0 0 0 1px rgba(193,151,91,.45); }
  .plv-col-h { display:flex; align-items:center; gap:8px; padding:2px 6px 9px; border-bottom:2px solid; margin-bottom:9px; }
  .plv-seal { width:11px; height:11px; border-radius:50%; box-shadow:inset 0 -2px 3px rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.18); flex-shrink:0; }
  .plv-col-h b { font-size:11px; letter-spacing:1.4px; text-transform:uppercase; color:var(--ink); }
  .plv-col-h i { font-style:normal; margin-left:auto; font-family:'Fraunces',Georgia,serif; font-size:16px; color:${C.textMuted}; font-variant-numeric:tabular-nums; }
  .plv-col-drop { flex:1; display:flex; flex-direction:column; gap:7px; min-height:60px; }

  .plv-card { position:relative; background:linear-gradient(180deg,#fff,#FDFCFA); border:1px solid var(--hair); border-radius:12px; padding:10px 11px 9px; cursor:grab; transition:all .18s ease; animation:plvRise .35s ease backwards; }
  .plv-card:hover { transform:translateY(-2px); border-color:rgba(193,151,91,.5); box-shadow:0 12px 24px -16px rgba(0,43,117,.35); }
  .plv-card:active { cursor:grabbing; }
  .plv-card.dragging { opacity:.35; transform:rotate(2deg) scale(.98); }
  .plv-card-top { display:flex; align-items:center; gap:8px; }
  .plv-mono { width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',Georgia,serif; font-size:11px; font-weight:700; color:#8A6A34; background:radial-gradient(circle at 35% 30%, #FDF6E8, #F0E3C8); border:1px solid rgba(193,151,91,.55); box-shadow:inset 0 -2px 4px rgba(193,151,91,.25); }
  .plv-card-name { font-size:12.5px; font-weight:700; color:var(--ink); line-height:1.25; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .plv-card-sub { font-size:10.5px; color:${C.textMuted}; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .plv-card-foot { display:flex; align-items:center; gap:6px; margin-top:8px; }
  .plv-dot-camp { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .plv-card-camp { font-size:9px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; color:${C.textMuted}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .plv-card-badges { margin-left:auto; display:flex; align-items:center; gap:5px; }
  .plv-crown { color:#B9872C; filter:drop-shadow(0 1px 1px rgba(185,135,44,.4)); }
  .plv-refcount { display:inline-flex; align-items:center; gap:3px; font-size:9.5px; font-weight:700; color:#7C3AED; }
  .plv-socio-tag { font-size:9px; font-weight:800; letter-spacing:.5px; padding:2px 7px; border-radius:10px; color:#fff; }

  /* ── Red genealógica ── */
  .plv-net { animation:plvRise .5s .1s ease backwards; }
  .plv-net-hint { font-size:12px; color:${C.textMuted}; margin:0 0 14px; }
  .plv-trunk { display:flex; align-items:center; gap:11px; width:100%; text-align:left; font-family:inherit; border:none; background:linear-gradient(180deg,#fff,#FBF8F2); border:1px solid rgba(193,151,91,.35); border-radius:14px; padding:12px 16px; margin:18px 0 0; cursor:pointer; transition:all .2s; }
  .plv-trunk:first-child { margin-top:0; }
  .plv-trunk:hover { border-color:var(--gold); box-shadow:0 10px 24px -18px rgba(0,43,117,.4); }
  .plv-trunk-seal { width:14px; height:14px; border-radius:50%; box-shadow:inset 0 -2px 3px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2); flex-shrink:0; }
  .plv-trunk b { font-family:'Fraunces',Georgia,serif; font-size:16.5px; font-weight:600; color:var(--ink); letter-spacing:-.2px; }
  .plv-trunk i { font-style:normal; font-size:11px; color:${C.textMuted}; font-weight:600; }
  .plv-trunk .chev { margin-left:auto; color:#8A6A34; transition:transform .25s; }
  .plv-trunk.closed .chev { transform:rotate(-90deg); }
  .plv-trunk-body { padding:12px 4px 4px 10px; border-left:2px solid rgba(193,151,91,.35); margin:8px 0 4px 22px; }
  .plv-grove-lab { font-size:9.5px; letter-spacing:2px; text-transform:uppercase; color:#8A6A34; font-weight:800; margin:12px 0 7px; }
  .plv-grove { display:grid; grid-template-columns:repeat(auto-fill, minmax(235px, 1fr)); gap:7px; }
  .plv-leaf { display:flex; align-items:center; gap:8px; background:linear-gradient(180deg,#fff,#FDFCFA); border:1px solid var(--hair); border-radius:11px; padding:7px 9px; cursor:pointer; transition:all .18s; min-width:0; animation:plvNode .3s ease backwards; }
  .plv-leaf:hover { border-color:rgba(193,151,91,.55); box-shadow:0 10px 20px -16px rgba(0,43,117,.35); transform:translateY(-1px); }
  .plv-leaf .plv-mono { width:26px; height:26px; font-size:9.5px; }
  .plv-leaf-txt { flex:1; min-width:0; }
  .plv-leaf-name { font-size:12px; font-weight:700; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .plv-leaf-sub { font-size:10px; color:${C.textMuted}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .plv-leaf-plus { width:24px; height:24px; border-radius:50%; border:1px dashed rgba(193,151,91,.65); background:none; color:#8A6A34; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .18s; }
  .plv-leaf-plus:hover { background:${C.goldBg}; border-style:solid; transform:scale(1.1); }
  .plv-tree { list-style:none; margin:0; padding:0; }
  .plv-tree ul { list-style:none; margin:0; padding-left:34px; position:relative; }
  .plv-tree ul::before { content:''; position:absolute; left:15px; top:-6px; bottom:14px; width:2px; background:linear-gradient(180deg, rgba(193,151,91,.75), rgba(193,151,91,.2)); border-radius:2px; }
  .plv-tree li { position:relative; padding-top:8px; }
  .plv-tree ul li::before { content:''; position:absolute; left:-19px; top:30px; width:19px; height:2px; background:rgba(193,151,91,.55); border-radius:2px; }
  .plv-node { display:flex; align-items:center; gap:10px; background:linear-gradient(180deg,#fff,#FDFCFA); border:1px solid var(--hair); border-radius:13px; padding:9px 13px; max-width:620px; transition:all .2s; animation:plvNode .3s ease backwards; }
  .plv-node:hover { border-color:rgba(193,151,91,.55); box-shadow:0 10px 22px -16px rgba(0,43,117,.35); }
  .plv-node.rap { border-color:rgba(193,151,91,.65); background:linear-gradient(180deg,#FFFDF8,#FBF4E3); animation:plvNode .3s ease backwards, plvPulse 3.2s ease-in-out infinite; }
  .plv-node-main { flex:1; min-width:0; cursor:pointer; }
  .plv-node-name { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:700; color:var(--ink); }
  .plv-node-sub { font-size:10.5px; color:${C.textMuted}; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .plv-node-add { display:inline-flex; align-items:center; gap:4px; font-family:inherit; font-size:10.5px; font-weight:700; color:#8A6A34; background:none; border:1px dashed rgba(193,151,91,.6); border-radius:16px; padding:4px 10px; cursor:pointer; white-space:nowrap; transition:all .2s; }
  .plv-node-add:hover { background:${C.goldBg}; border-style:solid; }
  .plv-mini-seal { width:9px; height:9px; border-radius:50%; box-shadow:inset 0 -1px 2px rgba(0,0,0,.25); flex-shrink:0; }

  /* ── Drawer expediente ── */
  .plv-scrim { position:fixed; inset:0; background:rgba(5,16,36,.35); backdrop-filter:blur(2px); z-index:60; }
  .plv-drawer { position:fixed; top:0; right:0; bottom:0; width:min(440px, 94vw); background:var(--porcelain); z-index:61; box-shadow:-24px 0 60px -30px rgba(4,12,26,.5); display:flex; flex-direction:column; animation:plvDrawer .28s ease; border-left:1px solid rgba(193,151,91,.35); }
  .plv-dw-head { position:relative; padding:20px 22px 16px; background:radial-gradient(140% 180% at 10% 0%, #14315E 0%, ${INK} 60%); color:#F2E4C8; }
  .plv-dw-close { position:absolute; top:14px; right:14px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); color:#E9DFC8; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; }
  .plv-dw-close:hover { background:rgba(193,151,91,.25); }
  .plv-dw-id { display:flex; align-items:center; gap:12px; }
  .plv-dw-mono { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',Georgia,serif; font-size:16px; font-weight:700; color:#6F5426; background:radial-gradient(circle at 35% 30%, #FDF6E8, #EBD9B4); border:2px solid rgba(193,151,91,.8); box-shadow:0 4px 12px rgba(0,0,0,.3); flex-shrink:0; }
  .plv-dw-name { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:600; letter-spacing:-.2px; line-height:1.2; }
  .plv-dw-meta { font-size:11px; color:rgba(233,240,250,.65); margin-top:3px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .plv-dw-body { flex:1; overflow-y:auto; padding:18px 22px 26px; }
  .plv-dw-label { font-size:9.5px; letter-spacing:2px; text-transform:uppercase; color:#8A6A34; font-weight:800; margin:16px 0 8px; display:flex; align-items:center; gap:6px; }
  .plv-dw-label:first-child { margin-top:0; }
  .plv-dw-label::after { content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(193,151,91,.4), transparent); }
  .plv-chips { display:flex; gap:6px; flex-wrap:wrap; }
  .plv-chip-btn { font-family:inherit; font-size:11.5px; font-weight:700; padding:7px 13px; border-radius:18px; border:1px solid var(--hair); background:#fff; color:${C.textMuted}; cursor:pointer; transition:all .18s; }
  .plv-chip-btn:hover { transform:translateY(-1px); }
  .plv-chip-btn.on { color:#fff; border-color:transparent; box-shadow:0 6px 14px -8px var(--sc); }
  .plv-dw-origen { font-size:12px; color:${C.textMuted}; line-height:1.55; background:#fff; border:1px solid var(--hair); border-radius:10px; padding:10px 12px; }
  .plv-ln-btn { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#fff; background:#0A66C2; border:none; border-radius:9px; padding:8px 14px; cursor:pointer; text-decoration:none; transition:all .2s; }
  .plv-ln-btn:hover { background:#084d93; }
  .plv-rapline { display:flex; align-items:center; justify-content:space-between; gap:10px; background:linear-gradient(180deg,#FFFDF8,#FBF4E3); border:1px solid rgba(193,151,91,.5); border-radius:12px; padding:11px 14px; }
  .plv-rapline p { margin:0; font-size:11px; color:#6F5426; line-height:1.45; }
  .plv-rapline b { display:block; font-size:12.5px; color:#51400F; }
  .plv-switch { position:relative; width:42px; height:23px; border-radius:20px; border:none; cursor:pointer; background:#D9DEE8; transition:background .2s; flex-shrink:0; }
  .plv-switch::after { content:''; position:absolute; top:2.5px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:transform .2s; }
  .plv-switch.on { background:linear-gradient(180deg,#C1975B,#A87F45); }
  .plv-switch.on::after { transform:translateX(18px); }
  .plv-reflist { display:flex; flex-direction:column; gap:6px; }
  .plv-refitem { display:flex; align-items:center; gap:9px; background:#fff; border:1px solid var(--hair); border-radius:10px; padding:8px 11px; font-size:12px; color:${C.text}; cursor:pointer; transition:all .18s; }
  .plv-refitem:hover { border-color:rgba(193,151,91,.5); }
  .plv-refitem .plv-mono { width:24px; height:24px; font-size:9px; }
  .plv-addref { display:flex; flex-direction:column; gap:6px; background:#fff; border:1px dashed rgba(193,151,91,.55); border-radius:11px; padding:11px 12px; }
  .plv-addref input { padding:8px 11px; border:1px solid var(--hair); border-radius:8px; font-size:12px; font-family:inherit; outline:none; background:var(--porcelain); }
  .plv-addref input:focus { border-color:var(--gold); }
  .plv-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:inherit; font-size:11.5px; font-weight:700; border-radius:9px; padding:8px 14px; cursor:pointer; transition:all .2s; border:1px solid transparent; }
  .plv-btn.gold { background:linear-gradient(180deg,#C8A066,#A87F45); color:#fff; box-shadow:0 6px 14px -8px rgba(168,127,69,.7); }
  .plv-btn.gold:hover { filter:brightness(1.06); }
  .plv-btn.ghost { background:#fff; border-color:var(--hair); color:${C.textMuted}; }
  .plv-btn.ghost:hover { border-color:var(--gold); color:#8A6A34; }
  .plv-btn:disabled { opacity:.45; cursor:default; }
  .plv-timeline { position:relative; padding-left:16px; }
  .plv-timeline::before { content:''; position:absolute; left:4px; top:6px; bottom:6px; width:2px; background:linear-gradient(180deg, rgba(193,151,91,.6), rgba(193,151,91,.12)); border-radius:2px; }
  .plv-tl-item { position:relative; padding:0 0 12px; }
  .plv-tl-item::before { content:''; position:absolute; left:-15.5px; top:5px; width:9px; height:9px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #E8CFA2, #B9872C); box-shadow:0 0 0 2.5px var(--porcelain); }
  .plv-tl-item b { font-size:11.5px; color:#8A6A34; }
  .plv-tl-item i { font-style:normal; font-size:10px; color:${C.textLight}; margin-left:6px; }
  .plv-tl-item p { margin:2px 0 0; font-size:12.5px; color:${C.text}; line-height:1.45; }
  .plv-notebar { display:flex; gap:6px; margin-top:4px; }
  .plv-notebar input { flex:1; padding:9px 12px; border:1px solid var(--hair); border-radius:9px; font-size:12.5px; font-family:inherit; outline:none; background:#fff; }
  .plv-notebar input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(193,151,91,.14); }

  /* ── Calendarios ── */
  .plv-cal-conns { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px; }
  .plv-cal-chip { font-size:11.5px; background:#fff; border:1px solid var(--hair); border-radius:20px; padding:5px 13px; font-weight:700; }
  .plv-cal-hint { font-size:11.5px; color:${C.textMuted}; margin:0 0 14px; }
  .plv-cal-day { font-size:10.5px; letter-spacing:1.8px; text-transform:uppercase; color:#8A6A34; font-weight:800; margin:18px 0 7px; display:flex; align-items:center; gap:8px; }
  .plv-cal-day::after { content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(193,151,91,.35), transparent); }
  .plv-cal-ev { display:flex; align-items:center; gap:10px; padding:9px 14px; background:#fff; border:1px solid var(--hair); border-radius:10px; margin-bottom:5px; font-size:12.5px; color:${C.text}; transition:all .18s; }
  .plv-cal-ev:hover { border-color:rgba(193,151,91,.5); }
  .plv-cal-ev .dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; box-shadow:inset 0 -1px 2px rgba(0,0,0,.25); }
  .plv-cal-ev .hora { color:${C.textMuted}; width:86px; flex-shrink:0; font-variant-numeric:tabular-nums; font-weight:600; }
  .plv-cal-ev .who { font-size:10.5px; color:${C.textLight}; }
  /* ── Modal nuevo prospecto ── */
  .plv-modal { position:fixed; inset:0; z-index:62; display:flex; align-items:center; justify-content:center; padding:20px; }
  .plv-modal-card { position:relative; width:min(430px, 94vw); background:var(--porcelain); border-radius:16px; border:1px solid rgba(193,151,91,.4); box-shadow:0 30px 70px -30px rgba(4,12,26,.6); overflow:hidden; animation:plvRise .3s ease; }
  .plv-modal-head { padding:16px 20px 13px; background:radial-gradient(140% 180% at 10% 0%, #14315E 0%, ${INK} 60%); color:#F2E4C8; display:flex; align-items:center; justify-content:space-between; }
  .plv-modal-head h3 { margin:0; font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:600; }
  .plv-modal-body { padding:16px 20px 20px; display:flex; flex-direction:column; gap:9px; }
  .plv-modal-body input { padding:9px 12px; border:1px solid var(--hair); border-radius:9px; font-size:12.5px; font-family:inherit; outline:none; background:#fff; color:${C.text}; }
  .plv-modal-body input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(193,151,91,.14); }
  .plv-modal-lab { font-size:9.5px; letter-spacing:1.8px; text-transform:uppercase; color:#8A6A34; font-weight:800; margin-top:4px; }

  .plv-empty { color:${C.textMuted}; font-size:13px; padding:16px 4px; }

  @media (max-width: 1100px) { .plv-board { grid-template-columns:repeat(6, 230px); } }
`;

/* ═══════════════ Subcomponentes (nivel módulo: no se remontan al teclear) ═══════════════ */

function Card({ l, idx, porId, hijosDe, dragId, onDragStart, onDragEnd, onOpen }) {
  const camp = campanaInfo(l.bucket);
  const nRefs = (hijosDe.get(l.id) || []).length;
  return (
    <div
      className={`plv-card${dragId === l.id ? ' dragging' : ''}`}
      style={{ animationDelay: `${Math.min(idx * 0.025, 0.35)}s` }}
      draggable
      onDragStart={(e) => { onDragStart(l); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(l.id)}
    >
      <div className="plv-card-top">
        <span className="plv-mono">{iniciales(l.nombre)}</span>
        <span className="plv-card-name">{l.nombre}</span>
      </div>
      {(l.perfil || l.referido_de) && (
        <div className="plv-card-sub">
          {l.referido_de ? <>↳ referido de <b style={{ color: '#8A6A34' }}>{porId.get(l.referido_de)?.nombre || '—'}</b></> : l.perfil}
        </div>
      )}
      <div className="plv-card-foot">
        <span className="plv-dot-camp" style={{ background: camp.color }} />
        <span className="plv-card-camp">{camp.label}</span>
        <span className="plv-card-badges">
          {nRefs > 0 && <span className="plv-refcount"><GitBranch size={10} />{nRefs}</span>}
          {l.representante && <Crown className="plv-crown" size={12} />}
          {l.seg_assigned_to && <span className="plv-socio-tag" style={{ background: SOCIO_COLOR[l.seg_assigned_to] || C.textMuted }}>{l.seg_assigned_to[0]}</span>}
        </span>
      </div>
    </div>
  );
}

function Nodo({ l, depth, hijosDe, onOpen, onAddRef }) {
  const camp = campanaInfo(l.bucket);
  const et = etapaInfo(l.seg_status || 'pendiente');
  const hijos = hijosDe.get(l.id) || [];
  return (
    <li>
      <div className={`plv-node${l.representante ? ' rap' : ''}`} style={{ animationDelay: `${Math.min(depth * 0.06, 0.3)}s` }}>
        <span className="plv-mono">{iniciales(l.nombre)}</span>
        <div className="plv-node-main" onClick={() => onOpen(l.id)}>
          <div className="plv-node-name">
            {l.nombre}
            {l.representante && <Crown className="plv-crown" size={12} />}
            <span className="plv-mini-seal" title={et.label} style={{ background: `radial-gradient(circle at 35% 30%, ${et.color}CC, ${et.color})` }} />
          </div>
          <div className="plv-node-sub">
            {l.perfil || camp.label}{l.seg_assigned_to ? ` · ${l.seg_assigned_to}` : ' · sin asignar'}{hijos.length ? ` · ${hijos.length} referido${hijos.length > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        {l.linkedin_url && (
          <a href={l.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#0A66C2', display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
            <Linkedin size={14} />
          </a>
        )}
        <button className="plv-node-add" onClick={() => onAddRef(l.id)}>
          <Plus size={11} /> referido
        </button>
      </div>
      {hijos.length > 0 && <ul>{hijos.map(h => <Nodo key={h.id} l={h} depth={depth + 1} hijosDe={hijosDe} onOpen={onOpen} onAddRef={onAddRef} />)}</ul>}
    </li>
  );
}

function Leaf({ l, idx, onOpen, onAddRef }) {
  const et = etapaInfo(l.seg_status || 'pendiente');
  return (
    <div className="plv-leaf" style={{ animationDelay: `${Math.min(idx * 0.012, 0.3)}s` }} onClick={() => onOpen(l.id)}>
      <span className="plv-mono">{iniciales(l.nombre)}</span>
      <div className="plv-leaf-txt">
        <div className="plv-leaf-name">{l.nombre}</div>
        <div className="plv-leaf-sub">
          <span className="plv-mini-seal" title={et.label} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 5, background: `radial-gradient(circle at 35% 30%, ${et.color}CC, ${et.color})` }} />
          {l.perfil || et.label}{l.seg_assigned_to ? ` · ${l.seg_assigned_to}` : ''}
        </div>
      </div>
      {l.representante && <Crown className="plv-crown" size={11} />}
      <button className="plv-leaf-plus" title={`Agregar referido de ${l.nombre}`}
        onClick={(e) => { e.stopPropagation(); onAddRef(l.id); }}>
        <GitBranch size={11} />
      </button>
    </div>
  );
}

function Calendarios({ connections, calendars, calLoading, onReload }) {
  const ownerColor = (email) => {
    const i = (calendars || []).findIndex(c => c.owner === email);
    return ['#8A6A34', '#7C3AED', '#0891B2', '#0E8A63'][((i % 4) + 4) % 4];
  };
  const porDia = useMemo(() => {
    const m = new Map();
    for (const cal of calendars || []) for (const e of cal.events) {
      const dia = String(e.start).slice(0, 10);
      if (!m.has(dia)) m.set(dia, []);
      m.get(dia).push({ ...e, owner: cal.owner });
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [calendars]);
  return (
    <div className="plv-net">
      <div className="plv-cal-conns">
        {(connections || []).map(c => (
          <span className="plv-cal-chip" key={c.google_email} style={{ color: ownerColor(c.google_email) }}>● {c.google_email}</span>
        ))}
        <button className="plv-btn gold" onClick={async () => { const { url } = await api.getGoogleAuthUrl(); window.location.href = url; }}>
          <CalendarDays size={13} /> Conectar mi Google Calendar
        </button>
        <button className="plv-btn ghost" onClick={onReload}><RefreshCw size={12} /></button>
      </div>
      <p className="plv-cal-hint">Cada socio conecta su Google una sola vez (con SU cuenta). Aquí se combinan las agendas de todos — próximos 14 días, con su Meet directo.</p>
      {calLoading && <p className="plv-empty">Cargando agendas…</p>}
      {!calLoading && porDia.length === 0 && <p className="plv-empty">Sin eventos en los próximos 14 días (o nadie ha conectado su calendario todavía).</p>}
      {porDia.map(([dia, evs]) => (
        <div key={dia}>
          <div className="plv-cal-day">{new Date(`${dia}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          {evs.sort((a, b) => String(a.start).localeCompare(String(b.start))).map(e => (
            <div className="plv-cal-ev" key={`${e.owner}|${e.id}`}>
              <span className="dot" style={{ background: `radial-gradient(circle at 35% 30%, ${ownerColor(e.owner)}CC, ${ownerColor(e.owner)})` }} title={e.owner} />
              <span className="hora">{e.all_day ? 'Todo el día' : new Date(e.start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ flex: 1 }}>{e.title}</span>
              <span className="who">{(e.owner || '').split('@')[0]}</span>
              {e.meet && <a href={e.meet} target="_blank" rel="noreferrer" style={{ color: C.blue, display: 'inline-flex' }}><Video size={14} /></a>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Drawer({ l, porId, hijosDe, savingId, autoRef, onPatch, onCreateRef, onClose, onOpen }) {
  // Estado LOCAL: tecleos no re-renderizan la vista completa ni pierden foco.
  const emptyRef = { nombre: '', whatsapp: '', perfil: '', linkedin_url: '' };
  const [nota, setNota] = useState('');
  const [refForm, setRefForm] = useState(autoRef ? { ...emptyRef } : null);
  const camp = campanaInfo(l.bucket);
  const et = etapaInfo(l.seg_status || 'pendiente');
  const hijos = hijosDe.get(l.id) || [];
  const padre = l.referido_de ? porId.get(l.referido_de) : null;
  const guardaNota = () => { if (nota.trim()) { onPatch(l, { nota }); setNota(''); } };
  return (
    <>
      <div className="plv-scrim" onClick={onClose} />
      <aside className="plv-drawer">
        <div className="plv-dw-head">
          <button className="plv-dw-close" onClick={onClose}><X size={15} /></button>
          <div className="plv-dw-id">
            <span className="plv-dw-mono">{iniciales(l.nombre)}</span>
            <div>
              <div className="plv-dw-name">{l.nombre} {l.representante && <Crown size={14} style={{ color: '#E3B458', verticalAlign: '-2px' }} />}</div>
              <div className="plv-dw-meta">
                <span style={{ color: '#D6B37E' }}>{camp.label}</span>
                {typeof l.score === 'number' && <span>score {Math.round(l.score)}</span>}
                <span style={{ color: '#B9C5D4' }}>● {et.label}</span>
                {padre && (
                  <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => onOpen(padre.id)}>
                    ↳ referido de {padre.nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="plv-dw-body">
          {l.perfil && <div className="plv-dw-label">Perfil</div>}
          {l.perfil && <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{l.perfil}</div>}

          <div className="plv-dw-label">Etapa de venta</div>
          <div className="plv-chips">
            {ETAPAS.map(s => (
              <button key={s.id} className={`plv-chip-btn${(l.seg_status || 'pendiente') === s.id ? ' on' : ''}`}
                style={(l.seg_status || 'pendiente') === s.id ? { background: s.color, '--sc': s.color } : undefined}
                disabled={savingId === l.id} onClick={() => onPatch(l, { seg_status: s.id })}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="plv-dw-label">Asignado a</div>
          <div className="plv-chips">
            {SOCIOS.map(s => (
              <button key={s} className={`plv-chip-btn${l.seg_assigned_to === s ? ' on' : ''}`}
                style={l.seg_assigned_to === s ? { background: SOCIO_COLOR[s], '--sc': SOCIO_COLOR[s] } : undefined}
                disabled={savingId === l.id}
                onClick={() => onPatch(l, { seg_assigned_to: l.seg_assigned_to === s ? '' : s })}>
                {s}
              </button>
            ))}
          </div>

          <div className="plv-dw-label">Representante</div>
          <div className="plv-rapline">
            <p><b>{l.representante ? 'Es representante (Rap)' : '¿Funge como representante?'}</b>
              Trae referidos al esquema — su red completa vive en la vista Red.</p>
            <button className={`plv-switch${l.representante ? ' on' : ''}`} disabled={savingId === l.id}
              onClick={() => onPatch(l, { representante: !l.representante })} aria-label="Representante" />
          </div>

          <div className="plv-dw-label"><GitBranch size={11} /> Referidos ({hijos.length})</div>
          <div className="plv-reflist">
            {hijos.map(h => (
              <div className="plv-refitem" key={h.id} onClick={() => onOpen(h.id)}>
                <span className="plv-mono">{iniciales(h.nombre)}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{h.nombre}</span>
                <span className="plv-mini-seal" style={{ background: etapaInfo(h.seg_status || 'pendiente').color }} />
                {(hijosDe.get(h.id) || []).length > 0 && <span className="plv-refcount"><GitBranch size={10} />{(hijosDe.get(h.id) || []).length}</span>}
              </div>
            ))}
            {refForm ? (
              <div className="plv-addref">
                <input autoFocus placeholder="Nombre del referido *" value={refForm.nombre} onChange={e => setRefForm(f => ({ ...f, nombre: e.target.value }))} />
                <input placeholder="WhatsApp (opcional)" value={refForm.whatsapp} onChange={e => setRefForm(f => ({ ...f, whatsapp: e.target.value }))} />
                <input placeholder="Perfil / puesto (opcional)" value={refForm.perfil} onChange={e => setRefForm(f => ({ ...f, perfil: e.target.value }))} />
                <input placeholder="LinkedIn (opcional)" value={refForm.linkedin_url} onChange={e => setRefForm(f => ({ ...f, linkedin_url: e.target.value }))} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="plv-btn gold" style={{ flex: 1 }} disabled={!refForm.nombre.trim() || savingId === l.id}
                    onClick={() => onCreateRef(l.id, refForm)}>Guardar referido</button>
                  <button className="plv-btn ghost" onClick={() => setRefForm(null)}><X size={13} /></button>
                </div>
              </div>
            ) : (
              <button className="plv-btn ghost" onClick={() => setRefForm({ ...emptyRef })}>
                <Plus size={12} /> Agregar referido de {l.nombre.split(' ')[0]}
              </button>
            )}
          </div>

          {l.linkedin_url && (
            <>
              <div className="plv-dw-label">Contacto</div>
              <a className="plv-ln-btn" href={l.linkedin_url} target="_blank" rel="noreferrer">
                <Linkedin size={14} /> Abrir perfil de LinkedIn <ExternalLink size={11} />
              </a>
            </>
          )}

          {l.notas_origen && (
            <>
              <div className="plv-dw-label">Origen</div>
              <div className="plv-dw-origen">{l.notas_origen}</div>
            </>
          )}

          <div className="plv-dw-label"><StickyNote size={11} /> Bitácora</div>
          <div className="plv-timeline">
            {(Array.isArray(l.seg_notes_log) ? l.seg_notes_log : []).slice().reverse().map((n, i) => (
              <div className="plv-tl-item" key={i}>
                <b>{n.by}</b><i>{fmtFechaHora(n.at)}</i>
                <p>{n.text}</p>
              </div>
            ))}
            {!(l.seg_notes_log || []).length && <p className="plv-empty" style={{ padding: '2px 0 8px' }}>Sin notas todavía.</p>}
          </div>
          <div className="plv-notebar">
            <input placeholder="Escribir nota de seguimiento…" value={nota} onChange={e => setNota(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') guardaNota(); }} />
            <button className="plv-btn gold" disabled={!nota.trim() || savingId === l.id} onClick={guardaNota}>Guardar</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NuevoProspecto({ saving, onCreate, onClose }) {
  const [f, setF] = useState({ nombre: '', bucket: 'linkedin-patrimonio', perfil: '', whatsapp: '', linkedin_url: '', seg_assigned_to: '' });
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="plv-modal">
      <div className="plv-scrim" style={{ position: 'absolute' }} onClick={onClose} />
      <div className="plv-modal-card">
        <div className="plv-modal-head">
          <h3>Nuevo prospecto</h3>
          <button className="plv-dw-close" style={{ position: 'static' }} onClick={onClose}><X size={15} /></button>
        </div>
        <div className="plv-modal-body">
          <input autoFocus placeholder="Nombre completo *" value={f.nombre} onChange={set('nombre')} />
          <div className="plv-modal-lab">Campaña</div>
          <div className="plv-chips">
            {CAMPANAS.map(c => (
              <button key={c.id} className={`plv-chip-btn${f.bucket === c.id ? ' on' : ''}`}
                style={f.bucket === c.id ? { background: c.color, '--sc': c.color } : undefined}
                onClick={() => setF(prev => ({ ...prev, bucket: c.id }))}>{c.label}</button>
            ))}
          </div>
          <input placeholder="Perfil / puesto (opcional)" value={f.perfil} onChange={set('perfil')} />
          <input placeholder="WhatsApp (opcional)" value={f.whatsapp} onChange={set('whatsapp')} />
          <input placeholder="LinkedIn (opcional)" value={f.linkedin_url} onChange={set('linkedin_url')} />
          <div className="plv-modal-lab">Asignar a (opcional)</div>
          <div className="plv-chips">
            {SOCIOS.map(sc => (
              <button key={sc} className={`plv-chip-btn${f.seg_assigned_to === sc ? ' on' : ''}`}
                style={f.seg_assigned_to === sc ? { background: SOCIO_COLOR[sc], '--sc': SOCIO_COLOR[sc] } : undefined}
                onClick={() => setF(prev => ({ ...prev, seg_assigned_to: prev.seg_assigned_to === sc ? '' : sc }))}>{sc}</button>
            ))}
          </div>
          <button className="plv-btn gold" style={{ marginTop: 6 }} disabled={!f.nombre.trim() || saving}
            onClick={() => onCreate(f)}>Guardar prospecto</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Componente ═══════════════════════════ */
export default function CrmProspectosView() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState('red'); // red | pipeline | calendarios
  const [campAbierta, setCampAbierta] = useState({});
  const [fCamp, setFCamp] = useState('');
  const [fSocio, setFSocio] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [autoRef, setAutoRef] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [connections, setConnections] = useState([]);
  const [calendars, setCalendars] = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const dragLeadRef = useRef(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const { leads: data } = await api.crmGetProspectos();
      setLeads(data || []);
    } catch (e) { setError(e.message || 'No se pudo cargar'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function loadCalendars() {
    setCalLoading(true);
    try {
      const { connections: conns } = await api.getCalendarConnections();
      setConnections(conns || []);
      const now = new Date();
      const { calendars: cals } = await api.getCalendarEventsAll(now.toISOString(), new Date(now.getTime() + 14 * 86400000).toISOString());
      setCalendars(cals || []);
    } catch { setCalendars([]); }
    finally { setCalLoading(false); }
  }
  useEffect(() => { if (vista === 'calendarios' && calendars === null) loadCalendars(); }, [vista]); // eslint-disable-line

  async function patch(lead, data) {
    setSavingId(lead.id);
    try {
      const { lead: act } = await api.crmUpdateMejorLead(lead.id, data);
      setLeads(prev => prev.map(l => (l.id === act.id ? act : l)));
    } catch (e) { alert(e.message || 'No se pudo guardar'); }
    finally { setSavingId(null); }
  }

  async function crearReferido(parentId, form) {
    setSavingId(parentId);
    try {
      const { lead } = await api.crmAddReferidoProspecto(parentId, form);
      setLeads(prev => [...prev, lead]);
      setAutoRef(false);
      setSel(lead.id); // abre el expediente del referido recién creado
    } catch (e) { alert(e.message || 'No se pudo crear el referido'); }
    finally { setSavingId(null); }
  }

  async function crearProspecto(form) {
    setSavingId('nuevo');
    try {
      const { lead } = await api.crmAddProspecto(form);
      setLeads(prev => [lead, ...prev]);
      setShowNew(false);
      setSel(lead.id); // abre su expediente recién creado
    } catch (e) { alert(e.message || 'No se pudo crear el prospecto'); }
    finally { setSavingId(null); }
  }

  const abrir = (id) => { setSel(id); setAutoRef(false); };
  const abrirConReferido = (id) => { setSel(id); setAutoRef(true); };

  /* ── Datos derivados ── */
  const porId = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);
  const hijosDe = useMemo(() => {
    const m = new Map();
    for (const l of leads) {
      if (!l.referido_de) continue;
      if (!m.has(l.referido_de)) m.set(l.referido_de, []);
      m.get(l.referido_de).push(l);
    }
    return m;
  }, [leads]);

  const pasaFiltros = (l) => {
    if (fCamp && l.bucket !== fCamp) return false;
    if (fSocio === 'sin' ? (l.seg_assigned_to || '') !== '' : (fSocio && l.seg_assigned_to !== fSocio)) return false;
    if (q) {
      const t = `${l.nombre} ${l.perfil || ''} ${l.notas_origen || ''}`.toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  };
  const visibles = leads.filter(pasaFiltros);

  const stats = useMemo(() => {
    const porSocio = Object.fromEntries(SOCIOS.map(s => [s, 0]));
    let sinAsignar = 0, reps = 0, refs = 0;
    for (const l of leads) {
      if (l.seg_assigned_to && porSocio[l.seg_assigned_to] !== undefined) porSocio[l.seg_assigned_to]++;
      else sinAsignar++;
      if (l.representante) reps++;
      if (l.referido_de) refs++;
    }
    return { porSocio, sinAsignar, reps, refs };
  }, [leads]);

  const selLead = sel != null ? porId.get(sel) : null;

  return (
    <div className="plv">
      <style>{PLV_CSS}</style>

      <div className="plv-plaque">
        <div className="plv-plaque-frame" />
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div className="plv-overline"><span /><em>Mesa de socios · PPR · Fiscal · Patrimonio</em><span /></div>
          <h1 className="plv-title">Prospectos</h1>
          <p className="plv-sub">Pipeline, red de referidos y agendas — exclusivo de Arturo, Ingrid y Flavio</p>
        </div>
        <div className="plv-pstats">
          <div className="plv-pstat"><i>Prospectos</i><b>{leads.length}</b><u>{stats.sinAsignar} sin asignar</u></div>
          <div className="plv-pdiv" />
          {SOCIOS.map(s => <div className="plv-pstat" key={s}><i>{s}</i><b>{stats.porSocio[s]}</b></div>)}
          <div className="plv-pdiv" />
          <div className="plv-pstat"><i>Raps</i><b>{stats.reps}</b></div>
          <div className="plv-pstat"><i>Referidos</i><b>{stats.refs}</b></div>
          <button className="plv-refresh" onClick={load} title="Actualizar"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="plv-bar">
        <div className="plv-views" role="tablist">
          <button className={`plv-view${vista === 'red' ? ' on' : ''}`} onClick={() => setVista('red')}><Network size={14} /> Red de referidos</button>
          <button className={`plv-view${vista === 'pipeline' ? ' on' : ''}`} onClick={() => setVista('pipeline')}><KanbanSquare size={14} /> Pipeline</button>
          <button className={`plv-view${vista === 'calendarios' ? ' on' : ''}`} onClick={() => setVista('calendarios')}><CalendarDays size={14} /> Calendarios</button>
        </div>
        {vista !== 'calendarios' && (
          <>
            <button className="plv-btn gold" onClick={() => setShowNew(true)}><Plus size={13} /> Nuevo prospecto</button>
            {CAMPANAS.map(c => (
              <button key={c.id} className={`plv-camp${fCamp === c.id ? ' on' : ''}`} style={{ '--cc': c.color }}
                onClick={() => setFCamp(fCamp === c.id ? '' : c.id)}>
                {c.label} <span className="n">{leads.filter(l => l.bucket === c.id).length}</span>
              </button>
            ))}
            <select className="plv-select" value={fSocio} onChange={e => setFSocio(e.target.value)}>
              <option value="">Asignado: todos</option>
              {SOCIOS.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="sin">Sin asignar</option>
            </select>
            <div className="plv-search" style={{ marginLeft: 'auto' }}>
              <Search size={13} />
              <input placeholder="Buscar prospecto…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {error && <p style={{ color: C.red }}>{error}</p>}
      {loading && vista !== 'calendarios' && <p className="plv-empty">Cargando prospectos…</p>}

      {!loading && vista === 'pipeline' && (
        <div className="plv-board">
          {ETAPAS.map(et => {
            const cards = visibles.filter(l => (l.seg_status || 'pendiente') === et.id);
            return (
              <div key={et.id}
                className={`plv-col${overCol === et.id ? ' over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverCol(et.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
                onDrop={() => {
                  const l = dragLeadRef.current;
                  setOverCol(null); setDragId(null);
                  if (l && (l.seg_status || 'pendiente') !== et.id) patch(l, { seg_status: et.id });
                }}>
                <div className="plv-col-h" style={{ borderColor: `${et.color}44` }}>
                  <span className="plv-seal" style={{ background: `radial-gradient(circle at 35% 30%, ${et.color}CC, ${et.color})` }} />
                  <b>{et.label}</b><i>{cards.length}</i>
                </div>
                <div className="plv-col-drop">
                  {cards.map((l, i) => (
                    <Card key={l.id} l={l} idx={i} porId={porId} hijosDe={hijosDe} dragId={dragId}
                      onDragStart={(lead) => { dragLeadRef.current = lead; setDragId(lead.id); }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onOpen={abrir} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && vista === 'red' && (
        <div className="plv-net">
          <p className="plv-net-hint">
            Cada prospecto es una rama: tócale el <GitBranch size={11} style={{ verticalAlign: '-1px', color: '#8A6A34' }} /> y se le desprende un referido — y al referido otro, sin límite. Las redes con <Crown size={11} style={{ verticalAlign: '-1px', color: '#B9872C' }} /> (Raps) y ramificaciones se dibujan arriba de cada campaña.
          </p>
          {CAMPANAS.filter(c => !fCamp || fCamp === c.id).map(c => {
            const delCamp = visibles.filter(l => !l.referido_de && l.bucket === c.id);
            if (!delCamp.length) return null;
            const conRed = delCamp
              .filter(l => l.representante || (hijosDe.get(l.id) || []).length > 0)
              .sort((a, b) => (hijosDe.get(b.id) || []).length - (hijosDe.get(a.id) || []).length);
            const semillero = delCamp
              .filter(l => !l.representante && !(hijosDe.get(l.id) || []).length)
              .sort((a, b) => (b.score || 0) - (a.score || 0));
            const nRefs = delCamp.reduce((n, l) => n + (hijosDe.get(l.id) || []).length, 0);
            const abierto = campAbierta[c.id] !== false;
            return (
              <div key={c.id}>
                <button className={`plv-trunk${abierto ? '' : ' closed'}`}
                  onClick={() => setCampAbierta(p => ({ ...p, [c.id]: !abierto }))}>
                  <span className="plv-trunk-seal" style={{ background: `radial-gradient(circle at 35% 30%, ${c.color}CC, ${c.color})` }} />
                  <b>{c.label}</b>
                  <i>{delCamp.length} prospectos{conRed.length ? ` · ${conRed.length} con red` : ''}{nRefs ? ` · ${nRefs} referidos` : ''}</i>
                  <ChevronDown className="chev" size={16} />
                </button>
                {abierto && (
                  <div className="plv-trunk-body">
                    {conRed.length > 0 && (
                      <>
                        <div className="plv-grove-lab">Redes activas</div>
                        <ul className="plv-tree">
                          {conRed.map(l => <Nodo key={l.id} l={l} depth={0} hijosDe={hijosDe} onOpen={abrir} onAddRef={abrirConReferido} />)}
                        </ul>
                      </>
                    )}
                    <div className="plv-grove-lab">Ramas por abrir · {semillero.length}</div>
                    <div className="plv-grove">
                      {semillero.map((l, i) => <Leaf key={l.id} l={l} idx={i} onOpen={abrir} onAddRef={abrirConReferido} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visibles.filter(l => !l.referido_de).length === 0 && <p className="plv-empty">Nada con esos filtros.</p>}
        </div>
      )}

      {vista === 'calendarios' && (
        <Calendarios connections={connections} calendars={calendars} calLoading={calLoading} onReload={loadCalendars} />
      )}

      {showNew && <NuevoProspecto saving={savingId === 'nuevo'} onCreate={crearProspecto} onClose={() => setShowNew(false)} />}

      {selLead && (
        <Drawer key={`${selLead.id}|${autoRef ? 'r' : ''}`} l={selLead} porId={porId} hijosDe={hijosDe}
          savingId={savingId} autoRef={autoRef} onPatch={patch} onCreateRef={crearReferido}
          onClose={() => { setSel(null); setAutoRef(false); }} onOpen={abrir} />
      )}
    </div>
  );
}
