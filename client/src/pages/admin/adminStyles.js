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
  @keyframes riseIn  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }

  /* ══ Global reset para móvil ══ */
  *, *::before, *::after { box-sizing:border-box; }
  html, body { overflow-x:hidden; width:100%; max-width:100vw; }

  /* ══ Reset global index.css residuals inside admin ══ */
  .admin-wrap p { margin:0; }

  /* ══ Layout raíz — porcelana con halo de marca ══ */
  .admin-wrap {
    display:flex; height:100vh; color:${C.text}; overflow:hidden; width:100%; max-width:100vw;
    font-family:'Archivo','Inter',-apple-system,BlinkMacSystemFont,sans-serif;
    background:
      radial-gradient(900px 480px at 85% -10%, rgba(0,61,165,.055), transparent 60%),
      radial-gradient(700px 420px at -10% 110%, rgba(193,151,91,.05), transparent 60%),
      ${C.bg};
  }
  .admin-wrap ::selection { background:rgba(193,151,91,.28); }
  .admin-wrap *::-webkit-scrollbar { width:9px; height:9px; }
  .admin-wrap *::-webkit-scrollbar-track { background:transparent; }
  .admin-wrap *::-webkit-scrollbar-thumb { background:rgba(11,27,51,.16); border-radius:8px; border:2px solid transparent; background-clip:content-box; }
  .admin-wrap *::-webkit-scrollbar-thumb:hover { background:rgba(11,27,51,.3); border:2px solid transparent; background-clip:content-box; }

  /* ══ Sidebar — navy profundo, textura y luz ══ */
  .sb {
    width:260px; color:#fff; display:flex; flex-direction:column; padding:22px 0 18px;
    transition:width .28s cubic-bezier(.4,0,.2,1); flex-shrink:0; position:relative;
    background:
      radial-gradient(480px 320px at 100% 0%, rgba(0,136,224,.16), transparent 65%),
      radial-gradient(420px 460px at 0% 100%, rgba(193,151,91,.10), transparent 60%),
      linear-gradient(168deg, ${C.navy} 0%, #06255C 58%, #052052 100%);
    border-right:1px solid rgba(255,255,255,.06);
  }
  .sb::after {
    content:''; position:absolute; inset:0; pointer-events:none; opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");
  }
  .sb > * { position:relative; z-index:1; }
  .sb.closed { width:74px; }
  .sb-head { display:flex; align-items:center; justify-content:space-between; padding:0 16px; margin-bottom:26px; }
  .sb-logo { display:flex; align-items:center; gap:10px; }
  .sb-logo-icon { width:34px; height:34px; background:linear-gradient(140deg, rgba(193,151,91,.32), rgba(193,151,91,.12)); border:1px solid rgba(193,151,91,.35); border-radius:10px; display:flex; align-items:center; justify-content:center; color:#E8CFA6; }
  .sb-logo span { font-size:15px; font-weight:700; white-space:nowrap; letter-spacing:-.3px; }

  /* Label & logo visibility — CSS-driven instead of React conditional */
  .sb-label { white-space:nowrap; overflow:hidden; transition:opacity .2s; }
  .sb.closed .sb-label { display:none; }
  .sb-logo-full { display:inline-flex; }
  .sb-logo-mini { display:none; }
  .sb.closed .sb-logo-full { display:none; }
  .sb.closed .sb-logo-mini { display:inline-flex; }
  .sb-toggle { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.65); cursor:pointer; padding:6px; display:flex; border-radius:8px; transition:all .2s; }
  .sb-toggle:hover { background:rgba(255,255,255,.12); color:#fff; }
  .sb-nav { flex:1; display:flex; flex-direction:column; gap:3px; padding:0 12px; overflow-y:auto; }
  .sb-nav::-webkit-scrollbar { width:0; }
  .sb-item {
    background:none; border:none; color:rgba(255,255,255,.66); padding:11px 13px; border-radius:10px;
    cursor:pointer; display:flex; align-items:center; gap:12px; font-size:13.5px; font-weight:500;
    letter-spacing:.1px; transition:all .18s ease; white-space:nowrap; font-family:inherit; position:relative;
  }
  .sb-item svg { opacity:.75; transition:opacity .18s; flex-shrink:0; }
  .sb-item:hover { background:rgba(255,255,255,.07); color:#fff; }
  .sb-item:hover svg { opacity:1; }
  .sb-item.active { background:linear-gradient(90deg, rgba(255,255,255,.13), rgba(255,255,255,.06)); color:#fff; font-weight:600; }
  .sb-item.active svg { opacity:1; color:#E8CFA6; }
  .sb-item.active::before { content:''; position:absolute; left:-12px; top:20%; bottom:20%; width:3px; border-radius:0 3px 3px 0; background:linear-gradient(180deg,#E8CFA6,${C.gold}); box-shadow:0 0 12px rgba(232,207,166,.5); }
  .sb-divider { padding:18px 13px 7px; font-size:9.5px; text-transform:uppercase; letter-spacing:2.2px; color:rgba(232,207,166,.5); font-weight:600; pointer-events:none; }
  .sb-logout { background:none; border:none; color:rgba(255,255,255,.55); padding:11px 13px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:12px; font-size:13.5px; margin:6px 12px 0; transition:all .2s; font-family:inherit; white-space:nowrap; border-top:none; }
  .sb-logout:hover { color:#fff; background:rgba(201,58,58,.28); }

  /* ══ Área principal ══ */
  .main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
  .topbar {
    background:rgba(255,255,255,.72); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
    padding:13px 30px; border-bottom:1px solid rgba(11,27,51,.07);
    display:flex; justify-content:space-between; align-items:center; flex-shrink:0;
  }
  .topbar-left { display:flex; align-items:center; gap:10px; }
  .role-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 11px; border-radius:20px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; }
  .topbar-user { font-size:13px; font-weight:600; color:${C.text}; display:flex; align-items:center; gap:9px; }
  .topbar-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(140deg,${C.primary},${C.primaryDark}); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; box-shadow:0 0 0 2px #fff, 0 0 0 3.5px rgba(193,151,91,.55); }

  /* .content: vistas normales con padding y scroll */
  .content { flex:1; overflow:auto; padding:30px 34px; }

  /* .content-wa: vistas full-screen (WhatsApp, etc.) sin padding */
  .content-wa { flex:1; overflow:hidden; padding:0; display:flex; flex-direction:column; }

  /* ══ Contenedor de vistas ══ */
  .view { max-width:1400px; margin:0 auto; width:100%; animation:fadeIn .3s ease; overflow-x:hidden; }
  .view-title { font-family:'Fraunces',Georgia,serif; font-size:30px; font-weight:600; color:${C.ink}; margin-bottom:6px; letter-spacing:-.4px; word-break:break-word; }
  .view-subtitle { font-size:14px; color:${C.textMuted}; margin-bottom:26px; }

  /* ══ Tarjetas de estadísticas — porcelana con cifras serif ══ */
  .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:28px; }
  .stat-card {
    background:linear-gradient(180deg,#fff, #FDFDFB); padding:20px 22px; border-radius:16px;
    display:flex; align-items:center; gap:15px; border:1px solid rgba(11,27,51,.08);
    box-shadow:0 1px 2px rgba(11,27,51,.04), 0 8px 24px -18px rgba(11,27,51,.25);
    transition:transform .22s ease, box-shadow .22s ease; position:relative; overflow:hidden;
    animation:riseIn .5s ease backwards;
  }
  .stat-card::before { content:''; position:absolute; top:0; left:22px; right:22px; height:2px; border-radius:0 0 3px 3px; background:linear-gradient(90deg, transparent, rgba(193,151,91,.55), transparent); opacity:0; transition:opacity .25s; }
  .stat-card:hover { transform:translateY(-3px); box-shadow:0 2px 4px rgba(11,27,51,.05), 0 20px 40px -20px rgba(0,43,117,.35); }
  .stat-card:hover::before { opacity:1; }
  .stat-card:nth-child(1) { animation-delay:.02s; } .stat-card:nth-child(2) { animation-delay:.08s; }
  .stat-card:nth-child(3) { animation-delay:.14s; } .stat-card:nth-child(4) { animation-delay:.20s; }
  .stat-card:nth-child(5) { animation-delay:.26s; } .stat-card:nth-child(6) { animation-delay:.32s; }
  .stat-icon { width:46px; height:46px; border-radius:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .stat-label { font-size:10.5px; color:${C.textMuted}; margin:0 0 3px; font-weight:700; text-transform:uppercase; letter-spacing:1.3px; }
  .stat-value { font-family:'Fraunces',Georgia,serif; font-size:29px; font-weight:600; color:${C.ink}; margin:0; letter-spacing:-.5px; font-variant-numeric:tabular-nums; }
  .stat-change { font-size:11px; font-weight:600; margin:0; }

  /* ══ Secciones ══ */
  .section {
    background:linear-gradient(180deg,#fff,#FDFDFC); padding:24px 26px; border-radius:16px;
    border:1px solid rgba(11,27,51,.08); margin-bottom:20px;
    box-shadow:0 1px 2px rgba(11,27,51,.03), 0 10px 30px -24px rgba(11,27,51,.3);
    animation:riseIn .5s ease backwards; animation-delay:.1s;
  }
  .section-title { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:600; color:${C.ink}; margin:0 0 14px; letter-spacing:-.2px; }
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

  /* ══ Tabla — registro patrimonial ══ */
  .tbl-wrap { overflow-x:auto; border-radius:14px; border:1px solid rgba(11,27,51,.08); box-shadow:0 1px 2px rgba(11,27,51,.03); }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  thead th { background:linear-gradient(180deg,#F7F8FA,#F2F4F8); padding:12px 16px; text-align:left; font-weight:700; color:${C.textMuted}; font-size:10.5px; text-transform:uppercase; letter-spacing:1.4px; border-bottom:1px solid rgba(11,27,51,.09); white-space:nowrap; }
  tbody td { padding:13px 16px; border-bottom:1px solid rgba(11,27,51,.055); color:${C.text}; font-variant-numeric:tabular-nums; }
  tbody tr { transition:background .15s; }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover { background:linear-gradient(90deg, rgba(0,61,165,.035), rgba(193,151,91,.03)); }
  .badge { display:inline-block; padding:3.5px 11px; border-radius:20px; font-size:11.5px; font-weight:700; letter-spacing:.2px; box-shadow:inset 0 0 0 1px rgba(11,27,51,.05); }
  .action-btn { background:none; border:none; color:${C.primary}; cursor:pointer; padding:4px; display:inline-flex; transition:color .2s; }
  .action-btn:hover { color:${C.accent}; }
  .empty { padding:36px; text-align:center; color:${C.textLight}; font-size:14px; font-style:italic; }

  /* ══ Tabs de filtro (compartido: LeadsView + ChatView) ══ */
  .filter-tabs { display:flex; gap:6px; flex-wrap:wrap; }
  .f-tab { padding:7px 15px; border-radius:20px; border:1px solid rgba(11,27,51,.13); background:${C.white}; cursor:pointer; font-size:13px; font-weight:600; transition:all .2s; font-family:inherit; color:${C.textMuted}; }
  .f-tab:hover { border-color:${C.primary}; color:${C.primary}; }
  .f-tab.active { background:linear-gradient(180deg,${C.primaryLight},${C.primary}); color:#fff; border-color:transparent; box-shadow:0 4px 12px -4px rgba(0,61,165,.5); }

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
  .btn-primary {
    background:linear-gradient(180deg,${C.primaryLight},${C.primary}); color:#fff; border:none; padding:10px 19px;
    border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit;
    display:inline-flex; align-items:center; gap:7px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 6px 16px -8px rgba(0,61,165,.55);
  }
  .btn-primary:hover { transform:translateY(-1px); box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 10px 22px -8px rgba(0,61,165,.6); }
  .btn-primary:active { transform:translateY(0); }
  .btn-secondary { background:#fff; color:${C.textMuted}; border:1px solid rgba(11,27,51,.14); padding:10px 18px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; }
  .btn-secondary:hover { border-color:rgba(11,27,51,.3); color:${C.ink}; }

  /* ══ Modal ══ */
  .modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(5,22,54,.45); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px); display:flex; align-items:center; justify-content:center; z-index:1000; }
  .modal { background:linear-gradient(180deg,#fff,#FBFBF9); border-radius:18px; box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 30px 60px -20px rgba(5,22,54,.45); max-width:480px; width:92%; max-height:90vh; display:flex; flex-direction:column; border:1px solid rgba(11,27,51,.08); animation:riseIn .3s ease; }
  .modal-head { padding:20px 24px; border-bottom:1px solid rgba(11,27,51,.07); display:flex; justify-content:space-between; align-items:center; }
  .modal-head h2 { font-family:'Fraunces',Georgia,serif; font-size:20px; font-weight:600; margin:0; color:${C.ink}; letter-spacing:-.2px; }
  .close-btn { background:none; border:none; cursor:pointer; color:${C.textMuted}; padding:4px; display:flex; transition:color .2s; }
  .close-btn:hover { color:${C.text}; }
  .modal-body { padding:22px; overflow:auto; flex:1; }
  .modal-foot { padding:18px 22px; border-top:1px solid ${C.border}; display:flex; gap:10px; justify-content:flex-end; }
  .field { margin-bottom:18px; }
  .field label { display:block; font-size:13px; font-weight:600; color:${C.text}; margin-bottom:5px; }
  .field input, .field select, .field textarea { width:100%; padding:10px 13px; border:1px solid rgba(11,27,51,.14); border-radius:10px; font-size:14px; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .2s, box-shadow .2s; background:${C.white}; color:${C.text}; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color:${C.primary}; box-shadow:0 0 0 3.5px rgba(0,61,165,.1); }
  .field p { margin:4px 0 0; font-size:14px; color:${C.text}; }

  /* ══ Loading ══ */
  .loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:14px; }
  .spinner { width:36px; height:36px; border:3px solid ${C.border}; border-top-color:${C.primary}; border-radius:50%; animation:spin .8s linear infinite; }
  .loading-wrap p { color:${C.textMuted}; font-size:14px; margin:0; }

  /* ══ Mobile/Desktop visibility helpers ══ */
  .mobile-only-cards { display:none; }
  .desktop-only-table { display:block; }
  @media(max-width:768px){
    .mobile-only-cards { display:flex !important; }
    .desktop-only-table { display:none !important; }
  }

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

  /* ═══════════════════════════════════════════════════
     MOBILE REDESIGN — Premium aesthetic for phones
     ═══════════════════════════════════════════════════ */
  @media(max-width:768px){
    /* ── Sidebar: glass-morphism drawer ── */
    .sb { position:fixed !important; top:0; left:0; bottom:0; width:280px !important; z-index:2000; transform:translateX(-100%); transition:transform .35s cubic-bezier(.4,0,.2,1); padding:24px 0 !important; overflow-y:auto !important; background:radial-gradient(480px 320px at 100% 0%, rgba(0,136,224,.16), transparent 65%), linear-gradient(168deg, ${C.navy} 0%, #06255C 58%, #052052 100%) !important; box-shadow:4px 0 24px rgba(0,0,0,.25); }
    .sb.closed { width:280px !important; }
    .sb.mobile-open { transform:translateX(0); }
    .sb.mobile-open .sb-label, .sb.closed.mobile-open .sb-label { display:inline !important; }
    .sb.mobile-open .sb-divider, .sb.closed.mobile-open .sb-divider { display:block !important; }
    .sb.mobile-open .sb-logo-full, .sb.closed.mobile-open .sb-logo-full { display:inline-flex !important; }
    .sb.mobile-open .sb-logo-mini, .sb.closed.mobile-open .sb-logo-mini { display:none !important; }
    .sb.closed.mobile-open { width:280px !important; }
    .sb-item { padding:9px 14px; border-radius:8px; font-size:0.82rem; gap:10px; }
    .sb-item.active { background:rgba(255,255,255,.18); box-shadow:inset 3px 0 0 ${C.accent}, 0 2px 8px rgba(0,0,0,.1); }
    .sb-logout { padding:9px 14px; font-size:0.82rem; margin:6px 10px; border-radius:8px; }
    .sb-nav { padding:0 10px; gap:1px; }

    /* ── Overlay backdrop with blur ── */
    .sb-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,.45); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); z-index:1999; transition:opacity .3s ease; }
    .sb-overlay.visible { display:block; }

    /* ── Hamburger button ── */
    .mobile-menu-btn { display:flex; background:none; border:none; color:${C.primary}; cursor:pointer; padding:8px; border-radius:10px; transition:all .2s; }
    .mobile-menu-btn:active { background:${C.blueBg}; transform:scale(.92); }

    /* ── WhatsApp mobile hamburger: no longer needed as floating (now inside WA header) ── */
    .wa-mobile-menu { display:none !important; }

    /* Hide desktop toggle */
    .sb-toggle { display:none; }

    /* ── Main area ── */
    .main { width:100%; max-width:100vw; overflow-x:hidden; }

    /* ── Topbar: elevated glass bar ── */
    .topbar { padding:8px 12px; gap:6px; background:rgba(255,255,255,.92); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-bottom:1px solid rgba(226,232,240,.6); position:sticky; top:0; z-index:100; }
    .topbar-user span { display:none; }
    .topbar-user { gap:6px; }
    .topbar-avatar { width:30px; height:30px; font-size:11px; box-shadow:0 2px 8px rgba(0,61,165,.15); }

    /* ── Content: clean spacing ── */
    .content { padding:16px; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
    .content-wa { padding:0; }

    /* ── View ── */
    .view { overflow-x:hidden; }
    .view-title { font-size:1.25rem; font-weight:700; letter-spacing:-.3px; background:linear-gradient(135deg,${C.primary},${C.accent}); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:4px; }
    .view-subtitle { font-size:0.8rem; margin-bottom:14px; color:${C.textLight}; }

    /* ── Stat Cards: horizontal scroll strip ── */
    .stats-grid { display:flex !important; gap:10px; overflow-x:auto; padding-bottom:6px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
    .stats-grid::-webkit-scrollbar { display:none; }
    .stat-card { min-width:130px; flex-shrink:0; scroll-snap-align:start; padding:14px; gap:10px; border-radius:12px; border:none; background:${C.white}; box-shadow:0 2px 12px rgba(0,61,165,.06); transition:transform .2s, box-shadow .2s; }
    .stat-card:active { transform:scale(.97); }
    .stat-icon { width:36px; height:36px; border-radius:10px; }
    .stat-value { font-size:1.25rem; font-weight:800; letter-spacing:-.3px; }
    .stat-label { font-size:0.65rem; font-weight:600; text-transform:uppercase; letter-spacing:.3px; }

    /* ── Sections: elevated cards ── */
    .section { padding:14px; margin-bottom:12px; border-radius:12px; border:none; background:${C.white}; box-shadow:0 2px 12px rgba(0,61,165,.05); }
    .section-title { font-size:0.85rem; font-weight:700; }

    /* ── Two/Three col → single col ── */
    .two-col, .three-col { grid-template-columns:1fr !important; gap:14px; }

    /* ── Charts: refined bars ── */
    .chart-bars { gap:10px; }
    .chart-row { gap:10px; }
    .chart-label { width:70px; font-size:12px; font-weight:600; color:${C.text}; }
    .chart-track { height:32px; border-radius:8px; }
    .chart-fill { border-radius:8px; }
    .source-name { width:70px; font-size:12px; font-weight:600; }

    /* ── Tables: card-like rows on mobile ── */
    .tbl-wrap { margin:0; overflow-x:auto; -webkit-overflow-scrolling:touch; border:none; border-radius:14px; box-shadow:0 1px 8px rgba(0,61,165,.04); }
    table { font-size:12.5px; min-width:520px; }
    thead th { padding:10px 12px; font-size:11px; background:${C.bg}; border-bottom:2px solid ${C.border}; }
    tbody td { padding:10px 12px; }
    tbody tr { transition:background .15s; }
    tbody tr:active { background:${C.blueBg}; }
    .badge { padding:4px 10px; border-radius:8px; font-size:11px; font-weight:700; }

    /* ── Mobile lead cards (shown instead of table) ── */
    .mobile-lead-cards { display:flex; flex-direction:column; gap:8px; }
    .mobile-lead-card { background:${C.white}; border-radius:12px; padding:12px; box-shadow:0 2px 10px rgba(0,61,165,.06); border:1px solid ${C.border}; display:flex; flex-direction:column; gap:8px; transition:transform .15s, box-shadow .15s; }
    .mobile-lead-card:active { transform:scale(.98); box-shadow:0 4px 16px rgba(0,61,165,.1); }
    .mlc-top { display:flex; justify-content:space-between; align-items:center; }
    .mlc-name { font-size:0.85rem; font-weight:700; color:${C.text}; }
    .mlc-row { display:flex; align-items:center; gap:5px; font-size:0.78rem; color:${C.textMuted}; }
    .mlc-row svg { flex-shrink:0; }
    .mlc-bottom { display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid ${C.border}; }
    .mlc-service { font-size:0.7rem; color:${C.textMuted}; font-weight:500; }

    /* ── Modals: bottom sheet style ── */
    .modal-overlay { align-items:flex-end; }
    .modal { max-width:100%; width:100%; margin:0; border-radius:20px 20px 0 0; max-height:88vh; animation:slideUp .35s cubic-bezier(.4,0,.2,1); }
    @keyframes slideUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
    .modal-head { padding:18px 20px; border-bottom:1px solid ${C.border}; }
    .modal-head::before { content:''; display:block; width:40px; height:4px; background:${C.border}; border-radius:4px; margin:0 auto 12px; }
    .modal-head h2 { font-size:1rem; font-weight:700; }
    .modal-body { padding:16px 18px; }
    .modal-foot { padding:14px 18px 20px; flex-wrap:wrap; gap:8px; }
    .modal-foot .btn-primary, .modal-foot .btn-secondary { flex:1; justify-content:center; min-width:0; padding:10px; border-radius:10px; font-size:0.85rem; }
    .modal-foot .btn-primary { box-shadow:0 4px 12px rgba(0,61,165,.2); }

    /* ── Filter tabs: pill style scrollable ── */
    .filter-tabs { overflow-x:auto; flex-wrap:nowrap; padding-bottom:4px; -webkit-overflow-scrolling:touch; gap:5px; scrollbar-width:none; }
    .filter-tabs::-webkit-scrollbar { display:none; }
    .f-tab { flex-shrink:0; padding:6px 12px; font-size:0.78rem; border-radius:16px; font-weight:600; transition:all .2s; }
    .f-tab.active { box-shadow:0 2px 8px rgba(0,61,165,.2); }

    /* ── Buttons: modern rounded ── */
    .btn-primary { padding:9px 16px; font-size:0.85rem; border-radius:10px; font-weight:700; box-shadow:0 2px 8px rgba(0,61,165,.15); transition:all .2s; }
    .btn-primary:active { transform:scale(.96); }
    .btn-secondary { padding:9px 16px; font-size:0.85rem; border-radius:10px; }

    /* ── KPI cards ── */
    .kpi-grid { grid-template-columns:repeat(2,1fr) !important; gap:10px; }
    .kpi-val { font-size:22px !important; }

    /* ── Funnel ── */
    .funnel-stage { padding:14px 16px; gap:12px; border-radius:12px; }
    .funnel-count { font-size:24px; min-width:48px; }
    .funnel-name { font-size:14px; }
    .funnel-pct { font-size:12px; }

    /* ── Source bars ── */
    .source-bar { gap:10px; padding:12px 0; }

    /* ── Info box ── */
    .info-box { font-size:13px; padding:14px 16px; border-radius:12px; }

    /* ── Role badge ── */
    .role-badge { font-size:10px; padding:4px 10px; border-radius:20px; font-weight:800; }

    /* ── Events: modern cards ── */
    .events-list { gap:10px; }
    .event-card { padding:14px 16px; border-radius:12px; border-left:4px solid ${C.accent}; background:${C.white}; box-shadow:0 1px 6px rgba(0,61,165,.05); flex-direction:column; align-items:flex-start; gap:6px; }
    .event-card h3 { font-size:14px; font-weight:600; }

    /* ── Config panel ── */
    .config-panel { padding:16px; border-radius:12px; }

    /* ── Field inputs ── */
    .field { margin-bottom:14px; }
    .field input, .field select, .field textarea { font-size:0.9rem !important; padding:8px 12px !important; border-radius:8px !important; border:1px solid ${C.border} !important; transition:all .2s; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color:${C.primary} !important; box-shadow:0 0 0 3px rgba(0,61,165,.08) !important; }
    .field label { font-size:0.78rem; font-weight:700; color:${C.text}; margin-bottom:5px; }

    /* ── Empty state ── */
    .empty { padding:40px 20px; font-size:14px; color:${C.textLight}; }

    /* ── Loading ── */
    .loading-wrap { min-height:300px; }
  }

  /* ═══════════════════════════════════════════
     SMALL PHONES (≤480px) — Extra compact
     ═══════════════════════════════════════════ */
  @media(max-width:480px){
    /* Stats single row scroll */
    .stat-card { min-width:120px; padding:10px; }
    .stat-value { font-size:1.1rem; }
    .stat-icon { width:32px; height:32px; border-radius:8px; }

    .kpi-grid { grid-template-columns:1fr !important; }

    /* Tighter content */
    .content { padding:10px; }
    .topbar { padding:6px 10px; }

    /* View */
    .view-title { font-size:1.1rem; }
    .view-subtitle { font-size:0.72rem; margin-bottom:10px; }

    /* Calendar compact */
    .cal-grid { font-size:11px; }
    .cal-day { min-height:44px !important; padding:4px !important; }
    .cal-dh { padding:4px !important; font-size:9px !important; }

    /* Chat */
    .chat-wrap { height:calc(100vh - 160px) !important; }
    .msg-bubble { max-width:88% !important; }

    /* Tables */
    table { min-width:440px; font-size:11.5px; }

    /* Mobile lead cards tighter */
    .mobile-lead-card { padding:10px; }
    .mlc-name { font-size:0.82rem; }

    /* Buttons full width */
    .btn-primary, .btn-secondary { width:100%; justify-content:center; padding:8px 14px; font-size:0.82rem; }

    /* Modal */
    .modal { border-radius:14px 14px 0 0; max-height:92vh; }
    .modal-foot { padding-bottom:max(20px, env(safe-area-inset-bottom)); }

    /* Section */
    .section { padding:12px; border-radius:10px; }
    .section-title { font-size:0.8rem; }
  }
`;
