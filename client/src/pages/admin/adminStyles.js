import { C } from './constants';

/* ══════════════════════════════════════════════════════════
   Shared Admin CSS — Finance SCool
   SÓLO contiene estilos estructurales y componentes reutilizables.
   Cada vista gestiona sus propios estilos específicos con
   una etiqueta <style> dentro del propio componente.
   ══════════════════════════════════════════════════════════ */
export const getAdminCSS = () => `
  @keyframes spin    { to { transform:rotate(360deg); } }
  @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  /* ══ Global reset para móvil ══ */
  *, *::before, *::after { box-sizing:border-box; }
  html, body { overflow-x:hidden; width:100%; }

  /* ══ Layout raíz ══ */
  .admin-wrap { display:flex; height:100vh; font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; background:${C.bg}; color:${C.text}; overflow-x:hidden; width:100%; max-width:100vw; }

  /* ══ Sidebar ══ */
  .sb { width:260px; background:linear-gradient(180deg,${C.primary} 0%,${C.primaryDark} 100%); color:#fff; display:flex; flex-direction:column; padding:20px 0; transition:width .25s ease; flex-shrink:0; }
  .sb.closed { width:72px; }
  .sb-head { display:flex; align-items:center; justify-content:space-between; padding:0 16px; margin-bottom:28px; }
  .sb-logo { display:flex; align-items:center; gap:10px; }
  .sb-logo-icon { width:32px; height:32px; background:rgba(255,255,255,.15); border-radius:8px; display:flex; align-items:center; justify-content:center; }
  .sb-logo span { font-size:15px; font-weight:700; white-space:nowrap; letter-spacing:-.3px; }

  /* Label & logo visibility — CSS-driven instead of React conditional */
  .sb-label { white-space:nowrap; overflow:hidden; transition:opacity .2s; }
  .sb.closed .sb-label { display:none; }
  .sb-logo-full { display:inline-flex; }
  .sb-logo-mini { display:none; }
  .sb.closed .sb-logo-full { display:none; }
  .sb.closed .sb-logo-mini { display:inline-flex; }
  .sb-toggle { background:none; border:none; color:rgba(255,255,255,.7); cursor:pointer; padding:6px; display:flex; border-radius:6px; transition:background .2s; }
  .sb-toggle:hover { background:rgba(255,255,255,.1); }
  .sb-nav { flex:1; display:flex; flex-direction:column; gap:4px; padding:0 10px; overflow-y:auto; }
  .sb-item { background:none; border:none; color:rgba(255,255,255,.75); padding:11px 14px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:11px; font-size:13.5px; font-weight:500; transition:all .2s; white-space:nowrap; font-family:inherit; }
  .sb-item:hover { background:rgba(255,255,255,.08); color:#fff; }
  .sb-item.active { background:rgba(255,255,255,.15); color:#fff; font-weight:600; box-shadow:inset 3px 0 0 ${C.accent}; }
  .sb-divider { padding:14px 14px 6px; font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:rgba(255,255,255,.35); font-weight:600; pointer-events:none; }
  .sb-logout { background:none; border:none; color:rgba(255,255,255,.6); padding:11px 14px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:11px; font-size:13.5px; margin:0 10px; transition:all .2s; font-family:inherit; white-space:nowrap; }
  .sb-logout:hover { color:#fff; background:rgba(220,38,38,.25); }

  /* ══ Área principal ══ */
  .main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
  .topbar { background:${C.white}; padding:14px 28px; border-bottom:1px solid ${C.border}; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
  .topbar-left { display:flex; align-items:center; gap:10px; }
  .role-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
  .topbar-user { font-size:13px; font-weight:500; color:${C.textMuted}; display:flex; align-items:center; gap:8px; }
  .topbar-avatar { width:30px; height:30px; border-radius:50%; background:${C.primary}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }

  /* .content: vistas normales con padding y scroll */
  .content { flex:1; overflow:auto; padding:28px; }

  /* .content-wa: vistas full-screen (WhatsApp, etc.) sin padding */
  .content-wa { flex:1; overflow:hidden; padding:0; display:flex; flex-direction:column; }

  /* ══ Contenedor de vistas ══ */
  .view { max-width:1400px; margin:0 auto; width:100%; animation:fadeIn .3s ease; overflow-x:hidden; }
  .view-title { font-size:26px; font-weight:700; color:${C.text}; margin-bottom:6px; letter-spacing:-.3px; word-break:break-word; }
  .view-subtitle { font-size:14px; color:${C.textMuted}; margin-bottom:24px; }

  /* ══ Tarjetas de estadísticas ══ */
  .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:28px; }
  .stat-card { background:${C.white}; padding:20px; border-radius:12px; display:flex; align-items:center; gap:14px; border:1px solid ${C.border}; transition:box-shadow .2s; }
  .stat-card:hover { box-shadow:0 4px 12px rgba(0,61,165,.08); }
  .stat-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .stat-label { font-size:12px; color:${C.textMuted}; margin:0 0 2px; font-weight:500; }
  .stat-value { font-size:26px; font-weight:700; color:${C.text}; margin:0; }
  .stat-change { font-size:11px; font-weight:600; margin:0; }

  /* ══ Secciones ══ */
  .section { background:${C.white}; padding:22px; border-radius:12px; border:1px solid ${C.border}; margin-bottom:20px; }
  .section-title { font-size:16px; font-weight:600; color:${C.text}; margin:0 0 14px; }
  .section-subtitle { font-size:13px; color:${C.textMuted}; margin:-10px 0 14px; }

  /* ══ Gráficas de barras ══ */
  .chart-bars { display:flex; flex-direction:column; gap:10px; }
  .chart-row { display:flex; align-items:center; gap:14px; }
  .chart-label { width:90px; font-size:13px; font-weight:500; color:${C.textMuted}; }
  .chart-track { flex:1; height:28px; background:${C.bg}; border-radius:6px; overflow:hidden; }
  .chart-fill { height:100%; display:flex; align-items:center; justify-content:flex-end; padding-right:10px; border-radius:6px; transition:width .6s ease; }
  .chart-val { color:#fff; font-size:12px; font-weight:600; }

  /* ══ Funnel (compartido: AgencyDashboardView + FunnelView) ══ */
  .funnel-wrap { display:flex; flex-direction:column; gap:0; }
  .funnel-stage { display:flex; align-items:center; gap:16px; padding:16px 20px; border-radius:10px; margin:0 auto; transition:all .3s; }
  .funnel-stage:hover { transform:scale(1.02); }
  .funnel-count { font-size:28px; font-weight:800; color:#fff; min-width:60px; text-align:center; }
  .funnel-info { flex:1; }
  .funnel-name { font-size:15px; font-weight:600; color:#fff; }
  .funnel-pct { font-size:12px; color:rgba(255,255,255,.8); }
  .funnel-arrow { text-align:center; color:${C.textLight}; font-size:18px; padding:4px 0; }

  /* ══ Source Bars (compartido: AgencyDashboardView + SourcesView) ══ */
  .source-bar { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid ${C.border}; }
  .source-bar:last-child { border-bottom:none; }
  .source-name { width:100px; font-size:13px; font-weight:600; color:${C.text}; }
  .source-track { flex:1; height:24px; background:${C.bg}; border-radius:6px; overflow:hidden; position:relative; }
  .source-fill { height:100%; border-radius:6px; transition:width .6s ease; display:flex; align-items:center; justify-content:flex-end; padding-right:8px; }
  .source-count { font-size:12px; font-weight:600; color:#fff; }
  .source-pct { font-size:12px; font-weight:600; color:${C.textMuted}; min-width:40px; text-align:right; }

  /* ══ Helpers de cuadrícula ══ */
  .two-col   { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .three-col { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }

  /* ══ Tabla ══ */
  .tbl-wrap { overflow-x:auto; border-radius:10px; border:1px solid ${C.border}; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  thead th { background:${C.bg}; padding:10px 14px; text-align:left; font-weight:600; color:${C.textMuted}; font-size:12px; text-transform:uppercase; letter-spacing:.3px; border-bottom:1px solid ${C.border}; }
  tbody td { padding:10px 14px; border-bottom:1px solid ${C.border}; color:${C.text}; }
  tbody tr:hover { background:${C.blueBg}; }
  .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
  .action-btn { background:none; border:none; color:${C.primary}; cursor:pointer; padding:4px; display:inline-flex; transition:color .2s; }
  .action-btn:hover { color:${C.accent}; }
  .empty { padding:32px; text-align:center; color:${C.textMuted}; font-size:14px; }

  /* ══ Tabs de filtro (compartido: LeadsView + ChatView) ══ */
  .filter-tabs { display:flex; gap:6px; flex-wrap:wrap; }
  .f-tab { padding:7px 14px; border-radius:6px; border:1px solid ${C.border}; background:${C.white}; cursor:pointer; font-size:13px; font-weight:500; transition:all .2s; font-family:inherit; color:${C.textMuted}; }
  .f-tab:hover { border-color:${C.primary}; color:${C.primary}; }
  .f-tab.active { background:${C.primary}; color:#fff; border-color:${C.primary}; }

  /* ══ Eventos (compartido: CalendarView + DashboardView) ══ */
  .events-list { display:flex; flex-direction:column; gap:10px; }
  .event-card { background:${C.bg}; padding:12px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border-left:3px solid ${C.accent}; }
  .event-card h3 { font-size:14px; font-weight:600; color:${C.text}; margin:0 0 2px; }
  .event-card .ev-time { display:flex; align-items:center; gap:4px; font-size:12px; color:${C.textMuted}; }

  /* ══ Info Box ══ */
  .info-box { background:${C.blueBg}; border:1px solid rgba(0,102,204,.2); border-radius:8px; padding:14px 16px; display:flex; gap:10px; align-items:flex-start; font-size:13px; color:${C.blue}; }
  .info-box p { margin:0; }

  /* ══ Config Panel (compartido: HubSpotView + WorkflowAIView) ══ */
  .config-panel { background:${C.bg}; padding:18px; border-radius:8px; margin-bottom:14px; }
  .help-text { display:block; margin-top:4px; color:${C.textLight}; font-size:12px; }

  /* ══ Botones ══ */
  .btn-primary { background:${C.primary}; color:#fff; border:none; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; display:inline-flex; align-items:center; gap:6px; }
  .btn-primary:hover { background:${C.primaryLight}; }
  .btn-secondary { background:${C.bg}; color:${C.textMuted}; border:1px solid ${C.border}; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; }
  .btn-secondary:hover { background:${C.border}; }

  /* ══ Modal ══ */
  .modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,.4); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000; }
  .modal { background:${C.white}; border-radius:14px; box-shadow:0 20px 25px -5px rgba(0,0,0,.12); max-width:480px; width:92%; max-height:90vh; display:flex; flex-direction:column; }
  .modal-head { padding:20px 22px; border-bottom:1px solid ${C.border}; display:flex; justify-content:space-between; align-items:center; }
  .modal-head h2 { font-size:18px; font-weight:600; margin:0; color:${C.text}; }
  .close-btn { background:none; border:none; cursor:pointer; color:${C.textMuted}; padding:4px; display:flex; transition:color .2s; }
  .close-btn:hover { color:${C.text}; }
  .modal-body { padding:22px; overflow:auto; flex:1; }
  .modal-foot { padding:18px 22px; border-top:1px solid ${C.border}; display:flex; gap:10px; justify-content:flex-end; }
  .field { margin-bottom:18px; }
  .field label { display:block; font-size:13px; font-weight:600; color:${C.text}; margin-bottom:5px; }
  .field input, .field select, .field textarea { width:100%; padding:10px 12px; border:1px solid ${C.border}; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .2s; background:${C.white}; color:${C.text}; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color:${C.primary}; box-shadow:0 0 0 3px rgba(0,61,165,.08); }
  .field p { margin:4px 0 0; font-size:14px; color:${C.text}; }

  /* ══ Loading ══ */
  .loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:14px; }
  .spinner { width:36px; height:36px; border:3px solid ${C.border}; border-top-color:${C.primary}; border-radius:50%; animation:spin .8s linear infinite; }
  .loading-wrap p { color:${C.textMuted}; font-size:14px; margin:0; }

  /* ══ Mobile hamburger button (hidden on desktop) ══ */
  .mobile-menu-btn { display:none; background:none; border:none; color:${C.primary}; cursor:pointer; padding:6px; border-radius:6px; transition:background .2s; }
  .mobile-menu-btn:hover { background:${C.bg}; }

  /* ══ Sidebar overlay backdrop (mobile only) ══ */
  .sb-overlay { display:none; }

  /* ══ Responsive ══ */
  @media(max-width:1100px) and (min-width:769px){ .two-col,.three-col { grid-template-columns:1fr; } }
  @media(max-width:900px) and (min-width:769px){
    .sb { width:72px !important; }
    .sb span, .sb-divider { display:none !important; }
    .content { padding:18px; }
    .stats-grid { grid-template-columns:repeat(2,1fr); }
  }
  @media(max-width:768px){
    /* Sidebar as overlay drawer */
    .sb { position:fixed !important; top:0; left:0; bottom:0; width:270px !important; z-index:2000; transform:translateX(-100%); transition:transform .3s ease; padding:20px 0 !important; overflow-y:auto !important; }
    .sb.closed { width:270px !important; }
    .sb.mobile-open { transform:translateX(0); }
    .sb.mobile-open .sb-label { display:inline !important; }
    .sb.mobile-open .sb-divider { display:block !important; }
    .sb.mobile-open .sb-logo-full { display:inline-flex !important; }
    .sb.mobile-open .sb-logo-mini { display:none !important; }

    /* Overlay backdrop */
    .sb-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,.5); z-index:1999; }
    .sb-overlay.visible { display:block; }

    /* Show hamburger */
    .mobile-menu-btn { display:flex; }

    /* Hide desktop toggle inside sidebar */
    .sb-toggle { display:none; }

    /* Main content takes full width */
    .main { width:100%; max-width:100vw; }

    /* Topbar adjustments */
    .topbar { padding:10px 14px; gap:8px; }
    .topbar-user span { display:none; }
    .topbar-user { gap:4px; }

    /* Content area */
    .content { padding:14px; overflow-x:hidden; }
    .content-wa { padding:0; }

    /* Stats */
    .stats-grid { grid-template-columns:repeat(2,1fr); gap:10px; }

    /* View */
    .view { overflow-x:hidden; }
    .view-title { font-size:20px; }
    .view-subtitle { font-size:12px; margin-bottom:14px; }

    /* Tables scroll horizontally */
    .tbl-wrap { margin:0 -2px; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    table { font-size:12px; min-width:500px; }
    thead th, tbody td { padding:8px 10px; white-space:nowrap; }

    /* Modals full-width on mobile */
    .modal { max-width:96%; width:96%; margin:10px auto; max-height:85vh; }
    .modal-head { padding:14px 16px; }
    .modal-body { padding:14px 16px; }
    .modal-foot { padding:12px 16px; flex-wrap:wrap; }
    .modal-foot .btn-primary, .modal-foot .btn-secondary { flex:1; justify-content:center; min-width:0; }

    /* Filter tabs scroll */
    .filter-tabs { overflow-x:auto; flex-wrap:nowrap; padding-bottom:4px; -webkit-overflow-scrolling:touch; gap:4px; }
    .f-tab { flex-shrink:0; padding:6px 12px; font-size:12px; }

    /* Buttons */
    .btn-primary, .btn-secondary { padding:9px 14px; font-size:13px; }

    /* Sections */
    .section { padding:14px; margin-bottom:12px; border-radius:10px; }

    /* Charts */
    .chart-bars { gap:8px; }
    .chart-row { gap:8px; }
    .chart-label { width:60px; font-size:11px; overflow:hidden; text-overflow:ellipsis; }
    .source-name { width:60px; font-size:11px; overflow:hidden; text-overflow:ellipsis; }

    /* Two/three col become single col */
    .two-col, .three-col { grid-template-columns:1fr !important; gap:12px; }

    /* KPI cards */
    .kpi-grid { grid-template-columns:repeat(2,1fr) !important; gap:10px; }
    .kpi-val { font-size:22px !important; }

    /* Stat cards */
    .stat-card { padding:12px; gap:10px; }
    .stat-icon { width:36px; height:36px; }
    .stat-value { font-size:20px; }
    .stat-label { font-size:11px; }

    /* Funnel responsive */
    .funnel-stage { padding:12px 14px; gap:10px; }
    .funnel-count { font-size:22px; min-width:44px; }
    .funnel-name { font-size:13px; }
    .funnel-pct { font-size:11px; }

    /* Source bars */
    .source-bar { gap:8px; padding:10px 0; }

    /* Info box */
    .info-box { font-size:12px; padding:10px 12px; flex-wrap:wrap; }

    /* Role badge */
    .role-badge { font-size:10px; padding:3px 8px; }

    /* Events */
    .event-card { padding:10px 12px; flex-direction:column; align-items:flex-start; gap:6px; }
    .event-card h3 { font-size:13px; }

    /* Config panel */
    .config-panel { padding:14px; }

    /* Field inputs */
    .field input, .field select, .field textarea { font-size:16px; padding:10px; }
    .field label { font-size:12px; }
  }

  @media(max-width:480px){
    .stats-grid { grid-template-columns:1fr; gap:8px; }
    .kpi-grid { grid-template-columns:1fr !important; }

    /* Content even tighter */
    .content { padding:10px; }
    .topbar { padding:8px 10px; }

    /* View titles */
    .view-title { font-size:18px; }

    /* Calendar grid smaller cells */
    .cal-grid { font-size:11px; }
    .cal-day { min-height:44px !important; padding:4px !important; }
    .cal-dh { padding:4px !important; font-size:9px !important; }

    /* Chat full height */
    .chat-wrap { height:360px !important; }
    .msg-bubble { max-width:88% !important; }

    /* Tables */
    table { min-width:420px; font-size:11px; }
    thead th, tbody td { padding:6px 8px; }

    /* Stat cards even more compact */
    .stat-card { padding:10px; gap:8px; }
    .stat-icon { width:32px; height:32px; }
    .stat-value { font-size:18px; }

    /* Buttons full width */
    .btn-primary, .btn-secondary { width:100%; justify-content:center; }

    /* Modal */
    .modal { max-width:100%; width:100%; margin:0; border-radius:12px 12px 0 0; max-height:90vh; }
  }
`;
