/**
 * FSCConversationsView — Finance S Cool
 * Two-tab view:
 *   Tab 1: "Conversaciones SofIA" — lead list + chat detail
 *   Tab 2: "Pipeline HubSpot"     — kanban-style deal board
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Search, RefreshCw, Phone, User, Filter,
  BarChart3, Clock, ChevronRight, Briefcase, Target, CalendarDays,
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import { api } from '../../../utils/api';

/* ── Colors ── */
const PRIMARY = '#6366F1';
const PRIMARY_DARK = '#4F46E5';
const SECONDARY = '#8B5CF6';
const BG_CHAT = '#EEF2FF';

const STATUS_COLORS = {
  en_calificacion: { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', label: 'En calificacion' },
  cita_agendada:   { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'Cita agendada' },
  no_calificado:   { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'No calificado' },
  nuevo:           { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Nuevo' },
  calificado:      { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6', label: 'Calificado' },
};

const FILTRO_STEPS = [
  'Saludo', 'Regimen', 'Ingreso', 'Edad', 'Objetivo',
  'Prioridad', 'Contacto', 'Cierre',
];

const PIPELINE_STAGES = [
  { key: 'calificado',      label: 'Calificado',      color: '#8B5CF6' },
  { key: 'cita_agendada',   label: 'Cita agendada',   color: '#10B981' },
  { key: 'analisis',        label: 'Analisis',         color: '#3B82F6' },
  { key: 'propuesta',       label: 'Propuesta',        color: '#F59E0B' },
  { key: 'seguimiento',     label: 'Seguimiento',      color: '#6366F1' },
  { key: 'solicitud',       label: 'Solicitud',        color: '#EC4899' },
  { key: 'cerrada_ganada',  label: 'Cerrada ganada',   color: '#059669' },
  { key: 'cerrada_perdida', label: 'Cerrada perdida',  color: '#EF4444' },
];

const AVATAR_COLORS = ['#6366F1','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6'];
const avColor = (name) => AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length];

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Status badge component ── */
function StatusBadge({ status, size = 'normal' }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.nuevo;
  const isSmall = size === 'small';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: isSmall ? '1px 6px' : '2px 8px',
      borderRadius: 10,
      fontSize: isSmall ? 9.5 : 11,
      fontWeight: 700,
      background: sc.bg,
      color: sc.text,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: isSmall ? 5 : 6, height: isSmall ? 5 : 6, borderRadius: '50%', background: sc.dot }} />
      {sc.label || status}
    </span>
  );
}

/* ── Filtro progress component ── */
function FiltroProgress({ step, compact = false }) {
  const current = typeof step === 'number' ? step : 0;
  const total = FILTRO_STEPS.length;
  const pct = Math.round((current / total) * 100);
  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, color: '#6366F1', fontWeight: 600,
      }}>
        <span style={{
          width: 28, height: 4, borderRadius: 2, background: '#E0E7FF',
          position: 'relative', overflow: 'hidden',
        }}>
          <span style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${pct}%`, background: '#6366F1', borderRadius: 2,
          }} />
        </span>
        {current}/{total}
      </span>
    );
  }
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1E1B4B' }}>
          Progreso de calificacion
        </span>
        <span style={{ fontSize: 11, color: PRIMARY, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {FILTRO_STEPS.map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 6, borderRadius: 3,
              background: i < current ? PRIMARY : '#E0E7FF',
              transition: 'background .3s',
            }} />
            <div style={{
              fontSize: 8.5, color: i < current ? PRIMARY : '#94A3B8',
              marginTop: 3, fontWeight: i < current ? 600 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════ */
export default function FSCConversationsView() {
  const [activeTab, setActiveTab] = useState('conversations');
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [pipeline, setPipeline] = useState([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const chatEndRef = useRef(null);
  const pollRef = useRef(null);

  /* ── Data loading ── */
  const loadLeads = useCallback(async () => {
    try {
      const data = await api.get('/fsc');
      setLeads(Array.isArray(data) ? data : data.leads || []);
    } catch (e) { console.error('FSC leads error:', e); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get('/fsc/stats');
      setStats(data);
    } catch (e) { console.error('FSC stats error:', e); }
  }, []);

  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const data = await api.get('/fsc/hubspot-pipeline');
      setPipeline(Array.isArray(data) ? data : data.deals || data.stages || []);
    } catch (e) { console.error('FSC pipeline error:', e); }
    setPipelineLoading(false);
  }, []);

  const selectLead = async (lead) => {
    setSelectedLead(lead);
    setChatData(null);
    setChatLoading(true);
    try {
      const phone = lead.phone || lead.telefono || lead.wa_id;
      const data = await api.get(`/fsc/${phone}`);
      setChatData(data);
    } catch (e) { console.error('FSC lead detail error:', e); }
    setChatLoading(false);
  };

  /* ── Initial load + polling ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadLeads(), loadStats()]);
      setLoading(false);
    })();
    pollRef.current = setInterval(() => {
      loadLeads();
      loadStats();
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'pipeline') loadPipeline();
  }, [activeTab, loadPipeline]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData]);

  /* ── Filtering ── */
  const filteredLeads = leads.filter(lead => {
    const name = (lead.name || lead.nombre || lead.contact_name || '').toLowerCase();
    const phone = (lead.phone || lead.telefono || lead.wa_id || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || name.includes(term) || phone.includes(term);
    const status = lead.lead_status || lead.estado || 'nuevo';
    const matchesFilter = filterStatus === 'todos' || status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  /* ── Stats summary ── */
  const statusCounts = {};
  leads.forEach(l => {
    const s = l.lead_status || l.estado || 'nuevo';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  /* ── Chat history ── */
  const hist = chatData?.historial_chat || chatData?.messages || chatData?.conversation || [];

  /* ── Pipeline grouping ── */
  const pipelineByStage = {};
  PIPELINE_STAGES.forEach(s => { pipelineByStage[s.key] = []; });
  (Array.isArray(pipeline) ? pipeline : []).forEach(deal => {
    const stage = (deal.stage || deal.dealstage || deal.pipeline_stage || '').toLowerCase().replace(/\s+/g, '_');
    const matchedStage = PIPELINE_STAGES.find(s =>
      s.key === stage || s.label.toLowerCase().replace(/\s+/g, '_') === stage || stage.includes(s.key)
    );
    if (matchedStage) {
      pipelineByStage[matchedStage.key].push(deal);
    } else {
      // Put unmatched deals in first column
      pipelineByStage[PIPELINE_STAGES[0].key].push(deal);
    }
  });

  /* ── Group messages by day ── */
  const groupedHist = hist.reduce((acc, msg) => {
    const ts = msg.timestamp || msg.created_at || msg.date;
    const day = ts
      ? new Date(ts).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      : 'Sin fecha';
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  const leadName = (lead) => lead?.name || lead?.nombre || lead?.contact_name || lead?.phone || lead?.telefono || 'Sin nombre';
  const leadPhone = (lead) => lead?.phone || lead?.telefono || lead?.wa_id || '';
  const leadStatus = (lead) => lead?.lead_status || lead?.estado || 'nuevo';
  const leadFiltro = (lead) => lead?.filtro_actual ?? lead?.step ?? 0;
  const leadLastMsg = (lead) => lead?.lastMessage || lead?.last_message || lead?.ultimo_mensaje || '';

  /* ═══════════════════════════════════
     RENDER
     ═══════════════════════════════════ */
  return (
    <>
    <style>{`
      @media(max-width:768px) {
        .fsc-wrap { height: 100% !important; }
        .fsc-two-col { flex-direction: column !important; }
        .fsc-left { width: 100% !important; min-width: auto !important; max-height: 45% !important; border-right: none !important; border-bottom: 1px solid #E2E8F0; }
        .fsc-right { flex: 1 !important; min-height: 0; }
        .fsc-pipeline { grid-template-columns: 1fr !important; overflow-x: auto; }
      }
    `}</style>
    <div className="fsc-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC', overflow: 'hidden' }}>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '0 16px', flexShrink: 0,
      }}>
        {[
          { key: 'conversations', label: 'Conversaciones SofIA', icon: <MessageCircle size={16} /> },
          { key: 'pipeline', label: 'Pipeline HubSpot', icon: <Briefcase size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 18px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
              color: activeTab === tab.key ? PRIMARY : '#64748B',
              borderBottom: `2px solid ${activeTab === tab.key ? PRIMARY : 'transparent'}`,
              transition: 'all .15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'conversations' ? (
        <div className="fsc-two-col" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ══════════════════════════════
              LEFT COLUMN — Lead list
              ══════════════════════════════ */}
          <div className="fsc-left" style={{
            width: 360, minWidth: 300, display: 'flex', flexDirection: 'column',
            borderRight: '1px solid #E2E8F0', background: '#fff', flexShrink: 0,
          }}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 50, padding: '0 14px',
              background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`,
              color: '#fff', flexShrink: 0,
            }}>
              <MessageCircle size={20} />
              <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>SofIA Bot</span>
              <span style={{
                fontSize: 11, background: 'rgba(255,255,255,.2)',
                padding: '2px 8px', borderRadius: 10,
              }}>{leads.length}</span>
              <button
                onClick={() => { loadLeads(); loadStats(); }}
                title="Actualizar"
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,.8)',
                  cursor: 'pointer', padding: 5, display: 'flex', borderRadius: 4,
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', height: 40,
              padding: '0 10px', background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0', gap: 8, flexShrink: 0,
            }}>
              <Search size={14} color="#94A3B8" />
              <input
                placeholder="Buscar por nombre, telefono..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  flex: 1, border: 'none', background: '#fff', padding: '6px 10px',
                  borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Filter */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
            }}>
              <Filter size={12} color="#94A3B8" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{
                  flex: 1, padding: '4px 6px', border: '1px solid #D1D5DB',
                  borderRadius: 6, background: '#F9FAFB', color: '#374151',
                  fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <option value="todos">Todos los estados ({leads.length})</option>
                {Object.entries(STATUS_COLORS).map(([key, sc]) => (
                  <option key={key} value={key}>{sc.label} ({statusCounts[key] || 0})</option>
                ))}
              </select>
            </div>

            {/* Stats bar */}
            {stats && (
              <div style={{
                display: 'flex', gap: 0, padding: '6px 10px',
                borderBottom: '1px solid #E2E8F0', flexShrink: 0, overflowX: 'auto',
              }}>
                {Object.entries(STATUS_COLORS).map(([key, sc]) => {
                  const count = stats[key] ?? statusCounts[key] ?? 0;
                  if (!count) return null;
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', fontSize: 10, fontWeight: 600,
                      color: sc.text, whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
                      {count}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lead list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
                  <div style={{
                    width: 28, height: 28, border: '3px solid #E0E7FF',
                    borderTopColor: PRIMARY, borderRadius: '50%',
                    animation: 'fsc-spin .7s linear infinite',
                  }} />
                </div>
              )}
              {!loading && filteredLeads.length === 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: 32, gap: 8, color: '#94A3B8',
                }}>
                  <MessageCircle size={32} color="#CBD5E1" />
                  <p style={{ margin: 0, fontSize: 13 }}>Sin conversaciones</p>
                </div>
              )}
              {filteredLeads.map(lead => {
                const sel = selectedLead && (leadPhone(selectedLead) === leadPhone(lead));
                return (
                  <div
                    key={leadPhone(lead) || lead._id}
                    onClick={() => selectLead(lead)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid #F1F5F9',
                      background: sel ? '#EEF2FF' : 'transparent',
                      borderLeft: sel ? `3px solid ${PRIMARY}` : '3px solid transparent',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: avColor(leadName(lead)),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {leadName(lead)[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                        <span style={{
                          fontWeight: 600, fontSize: 13.5, color: '#0F172A',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {leadName(lead)}
                        </span>
                        <span style={{ fontSize: 10.5, color: '#94A3B8', whiteSpace: 'nowrap', marginLeft: 6, flexShrink: 0 }}>
                          {fmt(lead.updated_at || lead.updatedAt || lead.created_at)}
                        </span>
                      </div>

                      {/* Last message preview */}
                      <div style={{
                        fontSize: 12, color: '#64748B',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        marginBottom: 4,
                      }}>
                        {leadLastMsg(lead) || 'Sin mensajes'}
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <StatusBadge status={leadStatus(lead)} size="small" />
                        <FiltroProgress step={leadFiltro(lead)} compact />
                        <span style={{ fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Phone size={9} />
                          {leadPhone(lead)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══════════════════════════════
              RIGHT COLUMN — Chat detail
              ══════════════════════════════ */}
          <div className="fsc-right" style={{
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: BG_CHAT,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c7d2fe' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}>
            {!selectedLead ? (
              /* Empty state */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                color: '#94A3B8', padding: 32,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(99,102,241,.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageCircle size={36} color={PRIMARY} />
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#475569' }}>Conversaciones SofIA</p>
                <p style={{ margin: 0, fontSize: 13 }}>Selecciona un lead para ver su conversacion</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div style={{
                  background: '#fff', padding: '10px 16px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                }}>
                  {/* Mobile back button */}
                  <button
                    onClick={() => { setSelectedLead(null); setChatData(null); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: PRIMARY, padding: 4, display: 'none',
                    }}
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: avColor(leadName(selectedLead)),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {leadName(selectedLead)[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                        {leadName(selectedLead)}
                      </span>
                      <StatusBadge status={leadStatus(selectedLead)} />
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Phone size={10} /> {leadPhone(selectedLead)}
                      </span>
                      {/* Qualification data from chatData */}
                      {chatData?.regimen && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Briefcase size={10} /> {chatData.regimen}
                        </span>
                      )}
                      {chatData?.ingreso && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <BarChart3 size={10} /> ${chatData.ingreso}
                        </span>
                      )}
                      {chatData?.edad && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <User size={10} /> {chatData.edad} anios
                        </span>
                      )}
                      {chatData?.objetivo && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Target size={10} /> {chatData.objetivo}
                        </span>
                      )}
                      {chatData?.prioridad && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertTriangle size={10} /> {chatData.prioridad}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Filtro progress bar */}
                <div style={{
                  background: '#fff', padding: '8px 16px',
                  borderBottom: '1px solid #E2E8F0', flexShrink: 0,
                }}>
                  <FiltroProgress step={chatData?.filtro_actual ?? leadFiltro(selectedLead)} />
                </div>

                {/* Chat messages */}
                <div style={{
                  flex: 1, overflowY: 'auto', padding: '12px 18px',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  {chatLoading && (
                    <div style={{
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      flex: 1, padding: 30,
                    }}>
                      <div style={{
                        width: 28, height: 28, border: '3px solid #E0E7FF',
                        borderTopColor: PRIMARY, borderRadius: '50%',
                        animation: 'fsc-spin .7s linear infinite',
                      }} />
                    </div>
                  )}
                  {!chatLoading && hist.length === 0 && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', flex: 1, gap: 8, color: '#94A3B8',
                    }}>
                      <MessageCircle size={28} color="#CBD5E1" />
                      <p style={{ margin: 0, fontSize: 13 }}>Sin mensajes en esta conversacion</p>
                    </div>
                  )}
                  {Object.entries(groupedHist).map(([day, msgs]) => (
                    <div key={day}>
                      {/* Day divider */}
                      <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <span style={{
                          background: 'rgba(99,102,241,.1)', padding: '4px 14px',
                          borderRadius: 8, fontSize: 10.5, color: '#6366F1',
                          fontWeight: 500, display: 'inline-block',
                        }}>{day}</span>
                      </div>
                      {msgs.map((msg, i) => {
                        const isUser = msg.role === 'user' || msg.sender === 'user' || msg.direction === 'inbound' || msg.from === 'user';
                        const isBot = !isUser;
                        const text = msg.content || msg.text || msg.body || msg.message || '';
                        const time = fmt(msg.timestamp || msg.created_at || msg.date);
                        return (
                          <div
                            key={msg._id || i}
                            style={{
                              display: 'flex',
                              justifyContent: isBot ? 'flex-end' : 'flex-start',
                              marginBottom: 3,
                            }}
                          >
                            <div style={{
                              maxWidth: '65%',
                              padding: '7px 11px 4px',
                              borderRadius: 8,
                              borderTopLeftRadius: isUser ? 0 : 8,
                              borderTopRightRadius: isBot ? 0 : 8,
                              fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                              background: isBot
                                ? `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`
                                : '#fff',
                              color: isBot ? '#fff' : '#1E293B',
                              boxShadow: '0 1px 2px rgba(0,0,0,.06)',
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2, opacity: 0.8 }}>
                                {isBot ? 'SofIA' : leadName(selectedLead)}
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
                              <div style={{
                                display: 'flex', justifyContent: 'flex-end',
                                marginTop: 2, opacity: 0.7,
                              }}>
                                <span style={{ fontSize: 9.5 }}>{time}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════
           TAB 2 — Pipeline HubSpot
           ══════════════════════════════ */
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Pipeline header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', background: '#fff',
            borderBottom: '1px solid #E2E8F0', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={18} color={PRIMARY} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Pipeline de Ventas</span>
              <span style={{
                fontSize: 11, background: '#EEF2FF', color: PRIMARY,
                padding: '2px 8px', borderRadius: 10, fontWeight: 600,
              }}>
                {pipeline.length} deals
              </span>
            </div>
            <button
              onClick={loadPipeline}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', border: '1px solid #E2E8F0',
                borderRadius: 8, background: '#fff', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, color: '#475569', fontFamily: 'inherit',
              }}
            >
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {/* Kanban board */}
          <div style={{
            flex: 1, overflowX: 'auto', overflowY: 'hidden',
            padding: '16px 12px', display: 'flex', gap: 12,
          }}>
            {pipelineLoading ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 32, height: 32, border: '3px solid #E0E7FF',
                  borderTopColor: PRIMARY, borderRadius: '50%',
                  animation: 'fsc-spin .7s linear infinite',
                }} />
              </div>
            ) : (
              PIPELINE_STAGES.map(stage => {
                const deals = pipelineByStage[stage.key] || [];
                return (
                  <div key={stage.key} style={{
                    minWidth: 240, width: 240, flexShrink: 0,
                    display: 'flex', flexDirection: 'column',
                    background: '#fff', borderRadius: 10,
                    border: '1px solid #E2E8F0', overflow: 'hidden',
                  }}>
                    {/* Column header */}
                    <div style={{
                      padding: '10px 12px', flexShrink: 0,
                      borderBottom: `3px solid ${stage.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                        {stage.label}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: stage.color,
                        background: `${stage.color}15`, padding: '1px 7px',
                        borderRadius: 8,
                      }}>
                        {deals.length}
                      </span>
                    </div>

                    {/* Deal cards */}
                    <div style={{
                      flex: 1, overflowY: 'auto', padding: 8,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      {deals.length === 0 && (
                        <div style={{
                          textAlign: 'center', padding: '20px 10px',
                          color: '#CBD5E1', fontSize: 12,
                        }}>
                          Sin deals en esta etapa
                        </div>
                      )}
                      {deals.map((deal, i) => (
                        <div key={deal.id || deal._id || i} style={{
                          background: '#F8FAFC', borderRadius: 8,
                          border: '1px solid #E2E8F0', padding: '10px 12px',
                          transition: 'box-shadow .15s', cursor: 'default',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,.12)'; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: '#0F172A',
                            marginBottom: 4, lineHeight: 1.3,
                          }}>
                            {deal.dealname || deal.name || deal.title || 'Sin nombre'}
                          </div>
                          {(deal.description || deal.notes) && (
                            <div style={{
                              fontSize: 11.5, color: '#64748B', lineHeight: 1.4,
                              marginBottom: 6, overflow: 'hidden',
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}>
                              {deal.description || deal.notes}
                            </div>
                          )}
                          {deal.amount && (
                            <div style={{
                              fontSize: 12, fontWeight: 700, color: PRIMARY,
                              marginBottom: 4,
                            }}>
                              ${Number(deal.amount).toLocaleString('es-MX')}
                            </div>
                          )}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 10.5, color: '#94A3B8',
                          }}>
                            <CalendarDays size={10} />
                            {fmtDate(deal.createdate || deal.created_at || deal.createdAt)}
                            {deal.contact_name && (
                              <>
                                <span style={{ margin: '0 2px' }}>|</span>
                                <User size={10} />
                                {deal.contact_name}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Keyframe animation ── */}
      <style>{`
        @keyframes fsc-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
    </>
  );
}
