import { C, STATUS_COLORS } from '../constants';
import { Users, Percent, AlertCircle, Clock, TrendingUp, Phone, Activity, ArrowRight, Globe } from 'lucide-react';

/* ── Mini Funnel ── */
function FunnelMini({ stats }) {
  const s = stats || {};
  const funnel = s.funnel || [
    { stage: 'Nuevos',            count: s.newLeads || 0,                     color: C.amber },
    { stage: 'En calificación',   count: s.enProceso || s.inProgress || 0,    color: C.blue  },
    { stage: 'Citas agendadas',   count: s.converted || 0,                    color: C.green },
  ];
  const maxCount = Math.max(...funnel.map(f => f.count), 1);
  return (
    <div className="funnel-wrap">
      {funnel.map((stage, idx) => {
        const widthPct = 100 - idx * 15;
        return (
          <div key={stage.stage}>
            <div className="funnel-stage" style={{ background: `linear-gradient(135deg,${stage.color},${stage.color}CC)`, width: `${widthPct}%` }}>
              <div className="funnel-count">{stage.count}</div>
              <div className="funnel-info">
                <div className="funnel-name">{stage.stage}</div>
                <div className="funnel-pct">{((stage.count / Math.max(maxCount, 1)) * 100).toFixed(0)}% del total</div>
              </div>
            </div>
            {idx < funnel.length - 1 && (
              <div className="funnel-arrow" style={{ width: `${widthPct - 7}%`, margin: '0 auto' }}>
                <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Source Bars ── */
export function SourceBars({ data, total }) {
  const colors = [C.primary, C.accent, '#059669', '#D97706', '#DC2626', '#8B5CF6', '#EC4899'];
  const items = (data || []).map((item, idx) => ({
    name: item.source || item.name || 'Directo',
    count: item.total || item.count || 0,
    pct: item.percentage || ((item.total || item.count || 0) / Math.max(total, 1) * 100).toFixed(1),
    color: colors[idx % colors.length],
  }));
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div>
      {items.map(item => (
        <div className="source-bar" key={item.name}>
          <div className="source-name">{item.name}</div>
          <div className="source-track">
            <div className="source-fill" style={{ width: `${(item.count / maxCount) * 100}%`, background: `linear-gradient(90deg,${item.color},${item.color}BB)` }}>
              {item.count > 0 && <span className="source-count">{item.count}</span>}
            </div>
          </div>
          <div className="source-pct">{item.pct}%</div>
        </div>
      ))}
      {items.length === 0 && <p className="empty">No hay datos de fuentes</p>}
    </div>
  );
}

const KPI_CSS = `
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:28px; }
  .kpi-card { background:#fff; padding:20px; border-radius:12px; border:1px solid #e2e8f0; position:relative; overflow:hidden; }
  .kpi-card::after { content:''; position:absolute; top:0; left:0; width:4px; height:100%; border-radius:4px 0 0 4px; }
  .kpi-card.blue::after   { background:#003DA5; }
  .kpi-card.green::after  { background:#10B981; }
  .kpi-card.amber::after  { background:#F59E0B; }
  .kpi-card.red::after    { background:#EF4444; }
  .kpi-card.cyan::after   { background:#0088E0; }
  .kpi-top   { display:flex; justify-content:space-between; align-items:flex-start; }
  .kpi-val   { font-size:32px; font-weight:800; color:#0f172a; margin:0; line-height:1; }
  .kpi-label { font-size:12px; color:#64748b; margin:6px 0 0; font-weight:500; }
  .kpi-icon  { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
  @media(max-width:768px) {
    .kpi-grid { grid-template-columns:repeat(2,1fr) !important; gap:10px; }
    .kpi-card { padding:14px; }
    .kpi-val { font-size:24px; }
    .kpi-label { font-size:11px; }
    .kpi-icon { width:34px; height:34px; }
  }
  @media(max-width:480px) {
    .kpi-grid { grid-template-columns:1fr !important; }
    .kpi-val { font-size:22px; }
  }
`;

export default function AgencyDashboardView({ stats, leads }) {
  const s = stats || {};
  const total = s.totalLeads || 0;
  const convRate = s.conversionRate || ((s.converted || 0) / Math.max(total, 1) * 100).toFixed(1);
  const sourceData = s.sourcePerformance || s.leadsBySource || [];
  const sortedSources = [...sourceData].sort((a, b) => (b.total || b.count || 0) - (a.total || a.count || 0));
  const bestSource = sortedSources[0];
  const worstSource = sortedSources[sortedSources.length - 1];

  const kpis = [
    { label: 'Leads Totales',           value: total,                icon: Users,       color: C.primary, bg: C.blueBg,  cls: 'blue'  },
    { label: 'Tasa de Conversión',       value: `${convRate}%`,       icon: Percent,     color: C.green,   bg: C.greenBg, cls: 'green' },
    { label: 'Nuevos',                   value: s.newLeads || 0,      icon: AlertCircle, color: C.amber,   bg: C.amberBg, cls: 'amber' },
    { label: 'En calificación',          value: s.enProceso || s.inProgress || 0, icon: Clock, color: '#EA580C', bg: '#FFF7ED', cls: 'amber' },
    { label: 'Citas agendadas',          value: s.converted || 0,     icon: TrendingUp,  color: C.green,   bg: C.greenBg, cls: 'green' },
    { label: 'Por WhatsApp',             value: s.contactados || 0,   icon: Phone,       color: C.accent,  bg: C.blueBg,  cls: 'cyan'  },
  ];

  return (
    <>
      <style>{KPI_CSS}</style>
    <div className="view">
      <h1 className="view-title">Marketing Analytics</h1>
      <p className="view-subtitle">Métricas de rendimiento de marketing y adquisición de leads — Vista de Agencia</p>

      <div className="kpi-grid">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div className={`kpi-card ${k.cls}`} key={k.label}>
              <div className="kpi-top">
                <div>
                  <p className="kpi-val">{k.value}</p>
                  <p className="kpi-label">{k.label}</p>
                </div>
                <div className="kpi-icon" style={{ background: k.bg, color: k.color }}><Icon size={20} /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="two-col">
        <div className="section">
          <h2 className="section-title">Embudo de Conversión</h2>
          <p className="section-subtitle">Progresión de leads por etapa</p>
          <FunnelMini stats={s} />
        </div>
        <div className="section">
          <h2 className="section-title">Rendimiento por Fuente</h2>
          <p className="section-subtitle">¿De dónde vienen tus leads?</p>
          <SourceBars data={sourceData} total={total} />
        </div>
      </div>

      {/* HubSpot Pipeline */}
      {s.hubspotPipeline && s.hubspotPipeline.length > 0 && (
        <div className="section" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Pipeline HubSpot</h2>
          <p className="section-subtitle">{s.hubspotDeals || 0} deals en total</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
            {s.hubspotPipeline.map(p => (
              <div key={p.stage} style={{ background:'#f8fafc', borderRadius:10, padding:'14px 16px', border:'1px solid #e2e8f0', textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:800, color:'#0f172a' }}>{p.count}</div>
                <div style={{ fontSize:11, color:'#64748b', fontWeight:500, marginTop:4 }}>{p.stage}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="section">
          <h2 className="section-title">Insights</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bestSource && (
              <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
                <TrendingUp size={16} />
                <p><strong>Mejor fuente:</strong> {bestSource.source || bestSource.name} con {bestSource.total || bestSource.count} leads</p>
              </div>
            )}
            {worstSource && sortedSources.length > 1 && (
              <div className="info-box" style={{ background: C.amberBg, borderColor: `${C.amber}40`, color: C.amber }}>
                <AlertCircle size={16} />
                <p><strong>Oportunidad:</strong> {worstSource.source || worstSource.name} solo genera {worstSource.total || worstSource.count} leads.</p>
              </div>
            )}
            <div className="info-box">
              <Activity size={16} />
              <p><strong>Tasa de contacto:</strong> {s.contactRate || 0}% de leads fueron contactados.</p>
            </div>
          </div>
        </div>
        <div className="section">
          <h2 className="section-title">Últimos Leads</h2>
          <div className="tbl-wrap">
            {leads.length === 0 ? <p className="empty">No hay leads</p> : (
              <table>
                <thead><tr><th>Nombre</th><th>Fuente</th><th>Estado</th></tr></thead>
                <tbody>
                  {leads.slice(0, 8).map(lead => {
                    const sc = STATUS_COLORS[lead.status] || { bg: C.bg, text: C.textMuted };
                    return (
                      <tr key={lead.id}>
                        <td>{lead.name}</td>
                        <td>{lead.source || 'Directo'}</td>
                        <td><span className="badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{lead.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
