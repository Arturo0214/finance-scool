/**
 * WhatsAppView — Finance SCool
 * Copia fiel del layout de Tesipedia AdminWhatsApp:
 *   - Columna izquierda: header verde + búsqueda + filtros + lista de leads
 *   - Columna derecha: chat con textura WhatsApp, full-height
 *   - SIN barras horizontales de ancho completo arriba
 *   - CSS completamente aislado dentro del componente
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Users, RefreshCw, Search,
  Send, AlertCircle, Check, CheckCheck, Clock, X, Ban, Zap, FileText,
} from 'lucide-react';
import { api } from '../../../utils/api';

/* ── Colores por estado (FSC + HubSpot) ── */
const EC = {
  nuevo:                { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Nuevo' },
  en_calificacion:      { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', label: 'En calificación' },
  calificado:           { bg: '#E0E7FF', text: '#3730A3', dot: '#6366F1', label: 'Calificado' },
  cita_agendada:        { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'Cita agendada' },
  no_calificado:        { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'No calificado' },
  cerrado_no_calificado:{ bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', label: 'Cerrado' },
  // Legacy statuses (whatsapp_leads)
  contactado:           { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', label: 'Contactado' },
  en_proceso:           { bg: '#FFF7ED', text: '#9A3412', dot: '#F97316', label: 'En proceso' },
  convertido:           { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'Convertido' },
  descartado:           { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Descartado' },
};

/* ── Íconos de estado de mensaje ── */
const MSI = {
  sent:      <Check      size={11} color="#93A3B8" />,
  delivered: <CheckCheck size={11} color="#93A3B8" />,
  read:      <CheckCheck size={11} color="#53BDEB" />,
  failed:    <X          size={11} color="#EF4444" />,
  pending:   <Clock      size={11} color="#F59E0B" />,
};

/* ── Formatear timestamp ── */
function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts), diff = Date.now() - d;
  if (diff < 86400000)  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const AVATAR_COLORS = ['#25D366','#0088E0','#7C3AED','#F59E0B','#EF4444','#10B981','#8B5CF6','#3B82F6'];
const avColor = (name) => AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length];

/* ════════════════════════════════
   Modal de plantillas
   ════════════════════════════════ */
function TemplatesModal({ onClose, onSend }) {
  const T = [
    { name: 'hello_world',   label: 'Saludo Inicial',  body: 'Hola, te contactamos desde Finance SCool. ¿En qué podemos ayudarte?', language: 'es' },
    { name: 'followup_lead', label: 'Seguimiento',     body: 'Hola, notamos interés en nuestro Plan Personal de Retiro. ¿Tienes alguna pregunta?', language: 'es' },
    { name: 'appointment',   label: 'Agendar Cita',    body: '¡Hola! Queremos agendar una llamada. ¿Cuándo tienes disponibilidad?', language: 'es' },
  ];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:12, padding:20, width:440, maxWidth:'94vw', boxShadow:'0 20px 40px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#0f172a' }}>Plantillas de WhatsApp</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:4, display:'flex' }}><X size={18} /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {T.map(t => (
            <div key={t.name} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div><div style={{ fontSize:13, fontWeight:600, color:'#0f172a', marginBottom:2 }}>{t.label}</div><div style={{ fontSize:11.5, color:'#64748b', lineHeight:1.4 }}>{t.body}</div></div>
              <button onClick={() => { onSend(t.name, t.language); onClose(); }} style={{ background:'#25D366', color:'#fff', border:'none', borderRadius:7, padding:'6px 13px', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>Enviar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════ */
export default function WhatsAppView() {
  const [leads, setLeads]               = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [chatData, setChatData]         = useState(null);
  const [messageText, setMessageText]   = useState('');
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterAgent, setFilterAgent]   = useState('todos');
  const [waStats, setWaStats]           = useState(null);
  const [windowStatus, setWindowStatus] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [togglingHuman, setTogglingHuman] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);

  const chatEndRef = useRef(null);
  const pollRef    = useRef(null);
  const prevMapRef = useRef(new Map());

  /* ── Sonido ── */
  const playNotif = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const play = (freq, start, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = 'sine'; g.gain.setValueAtTime(0.25, start); g.gain.exponentialRampToValueAtTime(0.01, start + dur); o.start(start); o.stop(start + dur); };
      const t = ctx.currentTime; play(880, t, 0.15); play(1100, t + 0.18, 0.15);
    } catch {}
  }, []);

  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, []);

  const showNotif = useCallback((title, body) => {
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico', tag: 'fs-wa' }); } catch {}
  }, []);

  const checkNewMessages = useCallback((newLeads) => {
    const getKey = l => (l.last_message_at || l.updated_at || '') + '_' + (l.unread_count || 0);
    if (prevMapRef.current.size === 0) { const m = new Map(); newLeads.forEach(l => m.set(l.wa_id, getKey(l))); prevMapRef.current = m; return; }
    const newMsgs = [];
    newLeads.forEach(l => { const p = prevMapRef.current.get(l.wa_id); const k = getKey(l); if (p && k !== p && l.unread_count > 0) newMsgs.push(l); });
    const m = new Map(); newLeads.forEach(l => m.set(l.wa_id, getKey(l))); prevMapRef.current = m;
    if (newMsgs.length > 0) { playNotif(); showNotif(`💬 ${newMsgs.length} nuevo${newMsgs.length > 1 ? 's' : ''}`, newMsgs.slice(0,3).map(l => l.contact_name || l.wa_id).join(', ')); }
  }, [playNotif, showNotif]);

  const loadLeads = useCallback(async (silent = false) => {
    try {
      const p = {}; if (filterEstado !== 'todos') p.estado = filterEstado; if (filterAgent !== 'todos') p.assigned_to = filterAgent; if (searchTerm) p.search = searchTerm;
      const data = await api.getWhatsAppLeads(p); const list = data.leads || [];
      if (silent) checkNewMessages(list); setLeads(list);
    } catch {}
  }, [filterEstado, filterAgent, searchTerm, checkNewMessages]);

  const loadStats = async () => { try { setWaStats(await api.getWhatsAppStats()); } catch {} };

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadLeads(false), loadStats()]); setLoading(false); })(); pollRef.current = setInterval(() => loadLeads(true), 12000); return () => clearInterval(pollRef.current); }, []); // eslint-disable-line
  useEffect(() => { loadLeads(false); }, [filterEstado, filterAgent, searchTerm]); // eslint-disable-line

  const selectLead = async (lead) => {
    setSelectedLead(lead); setChatData(null);
    try { const [data, ws] = await Promise.all([api.getWhatsAppLead(lead.wa_id), api.getWhatsAppWindowStatus(lead.wa_id).catch(() => null)]); setChatData(data); setWindowStatus(ws); setLeads(p => p.map(l => l.wa_id === lead.wa_id ? { ...l, unread_count: 0 } : l)); } catch (e) { console.error(e); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatData]);

  const handleSend = async () => { if (!messageText.trim() || !selectedLead || sending) return; setSending(true); try { const r = await api.sendWhatsAppMessage(selectedLead.wa_id, messageText); setMessageText(''); const f = await api.getWhatsAppLead(selectedLead.wa_id); setChatData(f); if (r?.queued) alert('Ventana expirada — mensaje en cola. Envía una plantilla.'); } catch (e) { alert('Error: ' + (e.message || '')); } finally { setSending(false); } };
  const handleTemplate = async (name, lang) => { if (!selectedLead) return; try { await api.sendWhatsAppTemplate(selectedLead.wa_id, name, lang); setChatData(await api.getWhatsAppLead(selectedLead.wa_id)); setWindowStatus(await api.getWhatsAppWindowStatus(selectedLead.wa_id).catch(() => null)); } catch (e) { alert('Error: ' + (e.message || '')); } };
  const handleEstadoChange = async (waId, estado) => { try { await api.updateWhatsAppEstado(waId, estado); if (chatData?.wa_id === waId) setChatData(p => ({ ...p, estado })); setLeads(p => p.map(l => l.wa_id === waId ? { ...l, estado } : l)); } catch {} };
  const handleClaim = async (waId) => { try { const r = await api.claimWhatsAppLead(waId); if (chatData?.wa_id === waId) setChatData(p => ({ ...p, assigned_to: r.assigned_to })); loadLeads(false); } catch {} };
  const handleToggleHuman = async () => { if (!chatData || togglingHuman) return; setTogglingHuman(true); try { const r = await api.toggleWhatsAppModoHumano(chatData.wa_id); setChatData(p => ({ ...p, modo_humano: r.modo_humano })); setLeads(p => p.map(l => l.wa_id === chatData.wa_id ? { ...l, modo_humano: r.modo_humano } : l)); } catch {} setTogglingHuman(false); };
  const handleToggleBlock = async () => { if (!chatData || togglingBlock) return; if (!window.confirm(chatData.blocked ? '¿Desbloquear?' : '¿Bloquear? No recibirá mensajes del bot.')) return; setTogglingBlock(true); try { const r = await api.toggleWhatsAppBlock(chatData.wa_id); setChatData(p => ({ ...p, blocked: r.blocked })); } catch {} setTogglingBlock(false); };

  const hist    = chatData?.historial_chat || [];
  const agents  = [...new Set(leads.map(l => l.assigned_to).filter(Boolean))];
  const st      = waStats || {};
  const expired = windowStatus && !windowStatus.open;

  const groupedHist = hist.reduce((acc, msg) => {
    const day = new Date(msg.timestamp || msg.created_at).toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
    if (!acc[day]) acc[day] = []; acc[day].push(msg); return acc;
  }, {});

  /* ═══════════════════════════════════
     CSS — Layout idéntico a Tesipedia
     ═══════════════════════════════════ */
  return (
    <>
      <style>{`
        /* ── Raíz: 2 columnas, full-height ── */
        .wa { display:flex; height:100%; background:#f0f2f5; overflow:hidden; }

        /* ══════════════════════════════
           COLUMNA IZQUIERDA
           ══════════════════════════════ */
        .wa-left { width:340px; min-width:280px; display:flex; flex-direction:column; border-right:1px solid #e0e0e0; background:#fff; flex-shrink:0; }

        /* Header verde WhatsApp */
        .wa-hdr { display:flex; align-items:center; gap:8px; height:50px; padding:0 12px; background:#075e54; color:#fff; flex-shrink:0; }
        .wa-hdr-icon { display:flex; align-items:center; }
        .wa-hdr-title { font-size:15px; font-weight:600; flex:1; }
        .wa-hdr-count { font-size:11px; background:rgba(255,255,255,.2); padding:2px 8px; border-radius:10px; }
        .wa-hdr-btn { background:none; border:none; color:rgba(255,255,255,.8); cursor:pointer; padding:5px; display:flex; border-radius:4px; transition:background .15s; }
        .wa-hdr-btn:hover { background:rgba(255,255,255,.15); }

        /* Búsqueda */
        .wa-search { display:flex; align-items:center; height:38px; padding:0 10px; background:#f6f6f6; border-bottom:1px solid #e0e0e0; flex-shrink:0; gap:8px; }
        .wa-search input { flex:1; border:none; background:#fff; padding:6px 10px; border-radius:6px; font-size:13px; outline:none; font-family:inherit; }

        /* Filtros compactos */
        .wa-filters { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:5px 10px; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
        .wa-fsel { width:100%; padding:4px 6px; border:1px solid #d1d5db; border-radius:6px; background:#f9fafb; color:#374151; font-size:11.5px; cursor:pointer; appearance:auto; font-family:inherit; }
        .wa-fsel:focus { outline:none; border-color:#25d366; box-shadow:0 0 0 2px rgba(37,211,102,.15); }

        /* Lista de leads */
        .wa-list { flex:1; overflow-y:auto; }

        /* Lead card */
        .wa-item { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; cursor:pointer; border-bottom:1px solid #f0f0f0; transition:background .12s; }
        .wa-item:hover { background:#f5f5f5; }
        .wa-item.sel { background:#e8f5e9; border-left:3px solid #25d366; }
        .wa-item.human { border-left:3px solid #ff9800; }
        .wa-item.sel.human { border-left:3px solid #ff9800; background:#fff3e0; }

        .wa-av { position:relative; width:42px; height:42px; border-radius:50%; background:#dfe5e7; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; color:#fff; }
        .wa-av-badge { position:absolute; bottom:-2px; right:-2px; background:#ff9800; color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:700; border:2px solid #fff; }

        .wa-info { flex:1; min-width:0; overflow:hidden; }
        .wa-row1 { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px; }
        .wa-name { font-weight:600; font-size:14px; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .wa-time { font-size:11px; color:#999; white-space:nowrap; margin-left:6px; flex-shrink:0; }
        .wa-prev { font-size:12.5px; color:#667; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; display:flex; align-items:center; justify-content:space-between; }
        .wa-prev-text { overflow:hidden; text-overflow:ellipsis; }
        .wa-unread { background:#25D366; color:#fff; font-size:10px; font-weight:700; min-width:18px; height:18px; border-radius:9px; display:flex; align-items:center; justify-content:center; padding:0 4px; flex-shrink:0; }
        .wa-meta { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
        .wa-badge { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:700; white-space:nowrap; }
        .wa-agent { font-size:10px; color:#999; display:flex; align-items:center; gap:3px; }

        /* ══════════════════════════════
           COLUMNA DERECHA — Chat
           ══════════════════════════════ */
        .wa-right { flex:1; display:flex; flex-direction:column; overflow:hidden;
          background:#e5ddd5;
          background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d5cec4' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        /* Chat header */
        .wa-ch-head { background:#fff; padding:8px 14px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .wa-ch-info { flex:1; min-width:0; }
        .wa-ch-name { font-size:14px; font-weight:700; color:#0f172a; }
        .wa-ch-sub { font-size:11px; color:#64748b; }
        .wa-ch-acts { display:flex; gap:5px; align-items:center; flex-wrap:wrap; }
        .wa-ch-btn { padding:4px 9px; border:1px solid #e2e8f0; border-radius:6px; font-size:11.5px; font-weight:500; background:#fff; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:4px; color:#334155; transition:all .15s; white-space:nowrap; }
        .wa-ch-btn:hover { border-color:#25D366; color:#25D366; background:#f0fdf4; }
        .wa-ch-btn:disabled { opacity:.5; cursor:not-allowed; }
        .wa-ch-btn.on { background:#25D366; color:#fff; border-color:#25D366; }
        .wa-ch-btn.on:hover { background:#128C7E; }
        .wa-ch-btn.blk:hover { border-color:#ef4444; color:#ef4444; background:#fef2f2; }
        .wa-ch-btn.unblk { background:#fef2f2; color:#dc2626; border-color:#fca5a5; }
        .wa-ch-sel { padding:4px 7px; border:1px solid #e2e8f0; border-radius:6px; font-size:11.5px; font-family:inherit; background:#fff; color:#334155; cursor:pointer; }

        /* 24h warning */
        .wa-warn { background:#fef3c7; color:#92400e; padding:6px 14px; font-size:11.5px; font-weight:500; display:flex; align-items:center; gap:6px; flex-shrink:0; border-bottom:1px solid #fde68a; }

        /* Messages */
        .wa-msgs { flex:1; overflow-y:auto; padding:8px 12px; display:flex; flex-direction:column; gap:4px; }
        .wa-m {
          max-width:80%; padding:8px 12px; border-radius:8px; font-size:0.88rem;
          line-height:1.35; word-wrap:break-word; overflow-wrap:break-word;
          box-shadow:0 1px 1px rgba(0,0,0,.1); min-width:80px; position:relative;
          white-space:pre-wrap; word-break:break-word; color:#111;
        }
        .wa-m.u {
          align-self:flex-start; background:#fff;
          border-top-left-radius:2px;
        }
        .wa-m.a {
          align-self:flex-end; background:#dcf8c6;
          border-top-right-radius:2px;
        }
        .wa-m.t {
          align-self:flex-end;
          background:linear-gradient(135deg, #e8f5e9, #c8e6c9);
          border:1px dashed #66bb6a;
          border-top-right-radius:2px; font-style:italic;
        }
        .wa-m-sender { font-size:0.7rem; font-weight:600; color:#075e54; margin-bottom:2px; }
        .wa-m.u .wa-m-sender { color:#6b7c85; }
        .wa-m.t .wa-m-sender { color:#2e7d32; font-style:italic; }
        .wa-m-foot { display:flex; align-items:center; justify-content:flex-end; gap:3px; margin-top:4px; }
        .wa-m-foot span { font-size:0.65rem; color:#888; }
        .wa-ddiv { text-align:center; padding:8px 0; }
        .wa-ddiv span { background:#e2ddd5; padding:4px 12px; border-radius:8px; font-size:10.5px; color:#54656f; font-weight:500; display:inline-block; }

        /* Input */
        .wa-input { background:#f0f2f5; padding:7px 12px; display:flex; gap:8px; align-items:center; flex-shrink:0; }
        .wa-input input { flex:1; border:none; border-radius:8px; padding:9px 13px; font-size:13px; font-family:inherit; outline:none; background:#fff; color:#0f172a; }
        .wa-sbtn { background:#25D366; color:#fff; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
        .wa-sbtn:hover { background:#128C7E; }
        .wa-sbtn:disabled { background:#cbd5e1; cursor:not-allowed; }
        .wa-tpl-btn { background:#fff; color:#64748b; border:1px solid #e2e8f0; border-radius:8px; padding:9px 11px; cursor:pointer; display:flex; align-items:center; transition:all .15s; flex-shrink:0; }
        .wa-tpl-btn:hover { border-color:#25D366; color:#25D366; }

        /* Empty / loading */
        .wa-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#94a3b8; text-align:center; padding:20px; }
        .wa-empty-ic { width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,.6); display:flex; align-items:center; justify-content:center; }
        .wa-spin { width:26px; height:26px; border:3px solid #e2e8f0; border-top-color:#25D366; border-radius:50%; animation:wa-sp .7s linear infinite; }
        @keyframes wa-sp { to { transform:rotate(360deg); } }
        .wa-nodata { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; text-align:center; color:#64748b; gap:8px; }

        /* Responsive */
        @media(max-width:768px) {
          .wa-left { display:${selectedLead ? 'none' : 'flex'}; width:100%; }
          .wa-right { display:${selectedLead ? 'flex' : 'none'}; width:100%; }
          .wa-filters { grid-template-columns:1fr; }
          .wa-ch-acts { flex-wrap:wrap; gap:4px; }
          .wa-ch-btn { font-size:11px; padding:4px 8px; }
          .wa-m { max-width:90%; }
          .wa-back-btn { display:flex !important; }
        }
      `}</style>

      <div className="wa">

        {/* ══════════════════════════════
            COLUMNA IZQUIERDA
            ══════════════════════════════ */}
        <div className="wa-left">

          {/* Header verde */}
          <div className="wa-hdr">
            <span className="wa-hdr-icon"><MessageCircle size={20} /></span>
            <span className="wa-hdr-title">WhatsApp</span>
            {(st.total || leads.length) > 0 && (
              <span className="wa-hdr-count">{st.total || leads.length}</span>
            )}
            <button className="wa-hdr-btn" onClick={() => { loadLeads(false); loadStats(); }} title="Actualizar">
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Búsqueda */}
          <div className="wa-search">
            <Search size={14} color="#999" />
            <input placeholder="Buscar por nombre, teléfono..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          {/* Filtros */}
          <div className="wa-filters">
            <select className="wa-fsel" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
              <option value="todos">Estado: Todos ({leads.length})</option>
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="en_proceso">En proceso</option>
              <option value="convertido">Convertido</option>
              <option value="descartado">Descartado</option>
            </select>
            {agents.length > 0 ? (
              <select className="wa-fsel" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
                <option value="todos">Agente: Todos</option>
                {agents.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <select className="wa-fsel" disabled><option>Agente: Todos</option></select>
            )}
          </div>

          {/* Lista de leads */}
          <div className="wa-list">
            {loading && <div style={{ display:'flex', justifyContent:'center', padding:20 }}><div className="wa-spin" /></div>}
            {!loading && leads.length === 0 && (
              <div className="wa-nodata">
                <MessageCircle size={32} color="#cbd5e1" />
                <p style={{ margin:0, fontSize:13 }}>Sin conversaciones</p>
              </div>
            )}
            {leads.map(lead => {
              const ec  = EC[lead.estado] || EC.nuevo;
              const sel = selectedLead?.wa_id === lead.wa_id;
              const unr = lead.unread_count > 0;
              return (
                <div
                  key={lead.wa_id}
                  className={`wa-item${sel ? ' sel' : ''}${lead.modo_humano ? ' human' : ''}`}
                  onClick={() => selectLead(lead)}
                >
                  <div className="wa-av" style={{ background: avColor(lead.contact_name) }}>
                    {(lead.contact_name || '?')[0].toUpperCase()}
                    {lead.modo_humano && <span className="wa-av-badge">H</span>}
                  </div>
                  <div className="wa-info">
                    <div className="wa-row1">
                      <span className="wa-name">{lead.contact_name || lead.wa_id}</span>
                      <span className="wa-time">{fmt(lead.updated_at)}</span>
                    </div>
                    <div className="wa-prev">
                      <span className="wa-prev-text">{lead.lastMessage || lead.last_message || ''}</span>
                      {unr && <span className="wa-unread">{lead.unread_count}</span>}
                    </div>
                    <div className="wa-meta">
                      <span className="wa-badge" style={{ background: ec.bg, color: ec.text }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:ec.dot, display:'inline-block' }} />
                        {ec.label || lead.estado || 'nuevo'}
                      </span>
                      {lead.assigned_to && (
                        <span className="wa-agent">
                          <Users size={9} /> {lead.assigned_to}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════
            COLUMNA DERECHA — Chat
            ══════════════════════════════ */}
        <div className="wa-right">
          {!selectedLead ? (
            <div className="wa-empty">
              <div className="wa-empty-ic">
                <MessageCircle size={44} color="#25D366" />
              </div>
              <p style={{ margin:0, fontSize:15, fontWeight:600, color:'#0f172a' }}>Selecciona una conversación</p>
              <p style={{ margin:0, fontSize:13, color:'#64748b', maxWidth:260 }}>Elige un contacto de la lista para ver los mensajes</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="wa-ch-head">
                <button className="wa-back-btn" onClick={() => setSelectedLead(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#075e54', padding:4, display:'none' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                </button>
                <div className="wa-av" style={{ background: avColor(chatData?.contact_name || selectedLead.contact_name), width:38, height:38, flexShrink:0 }}>
                  {(chatData?.contact_name || selectedLead.contact_name || '?')[0].toUpperCase()}
                </div>
                <div className="wa-ch-info">
                  <div className="wa-ch-name">{chatData?.contact_name || selectedLead.contact_name || selectedLead.wa_id}</div>
                  <div className="wa-ch-sub">{chatData?.wa_id || selectedLead.wa_id}{chatData?.assigned_to && ` · ${chatData.assigned_to}`}</div>
                </div>
                <div className="wa-ch-acts">
                  <select className="wa-ch-sel" value={chatData?.estado || 'nuevo'} onChange={e => handleEstadoChange(selectedLead.wa_id, e.target.value)}>
                    <option value="nuevo">Nuevo</option><option value="contactado">Contactado</option><option value="en_proceso">En proceso</option><option value="convertido">Convertido</option><option value="descartado">Descartado</option>
                  </select>
                  {!chatData?.assigned_to && <button className="wa-ch-btn" onClick={() => handleClaim(selectedLead.wa_id)}><Zap size={12} /> Reclamar</button>}
                  <button className={`wa-ch-btn${chatData?.modo_humano ? ' on' : ''}`} onClick={handleToggleHuman} disabled={togglingHuman}>{chatData?.modo_humano ? '👤 Humano' : '🤖 AI'}</button>
                  <button className={`wa-ch-btn${chatData?.blocked ? ' unblk' : ' blk'}`} onClick={handleToggleBlock} disabled={togglingBlock}><Ban size={12} /> {chatData?.blocked ? 'Desbloquear' : 'Bloquear'}</button>
                </div>
              </div>

              {expired && (
                <div className="wa-warn">
                  <AlertCircle size={14} /> Ventana de 24h expirada — usa una plantilla.
                  <button className="wa-ch-btn" style={{ marginLeft:'auto', padding:'3px 8px', fontSize:11 }} onClick={() => setShowTemplates(true)}><FileText size={11} /> Plantillas</button>
                </div>
              )}

              {/* Messages */}
              <div className="wa-msgs">
                {!chatData ? (
                  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', flex:1 }}><div className="wa-spin" /></div>
                ) : hist.length === 0 ? (
                  <div className="wa-nodata"><MessageCircle size={28} color="#cbd5e1" /><p style={{ margin:0, fontSize:13 }}>Sin mensajes</p></div>
                ) : (
                  Object.entries(groupedHist).map(([day, msgs]) => (
                    <div key={day} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <div className="wa-ddiv"><span>{day}</span></div>
                      {msgs.map((msg, i) => {
                        const isOut = msg.role === 'admin' || msg.direction === 'outbound' || msg.direction === 'sent' || msg.from_me;
                        const isTpl = msg.type === 'template';
                        const senderName = isOut ? (msg.sender || 'SofIA') : chatData.contact_name;
                        return (
                          <div key={i} className={`wa-m${isTpl ? ' t' : isOut ? ' a' : ' u'}`}>
                            {!isOut && <div className="wa-m-sender">{senderName}</div>}
                            {isOut && msg.sender && <div className="wa-m-sender" style={{ color: '#53bdeb' }}>{msg.sender}</div>}
                            <div>{msg.body || msg.text || msg.message || (msg.type && `[${msg.type}]`)}</div>
                            <div className="wa-m-foot"><span>{fmt(msg.timestamp || msg.created_at)}</span>{isOut && (MSI[msg.status] || MSI.sent)}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="wa-input">
                <button className="wa-tpl-btn" onClick={() => setShowTemplates(true)} title="Plantillas"><FileText size={16} /></button>
                <input value={messageText} onChange={e => setMessageText(e.target.value)} placeholder={expired ? 'Ventana expirada — usa plantilla' : 'Escribe un mensaje...'} disabled={expired || sending} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                <button className="wa-sbtn" onClick={handleSend} disabled={!messageText.trim() || sending || expired}><Send size={16} /></button>
              </div>
            </>
          )}
        </div>
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onSend={handleTemplate} />}
    </>
  );
}
