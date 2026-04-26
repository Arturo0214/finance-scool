import { useState, useEffect, useCallback } from 'react';
import { C } from '../constants';
import { Users, Percent, Target, Phone, Clock, AlertCircle, TrendingUp, UserCheck, Activity, ArrowRight, ArrowDown, Play, Eye, Zap, Mail, Calendar, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../../utils/api';

const FUNNEL_STAGES = [
  { filtro: 1, name: 'Saludo', desc: 'Respondió al botón inicial', color: '#94a3b8', icon: MessageCircle },
  { filtro: 2, name: 'Nombre', desc: 'Dio su nombre', color: '#60a5fa', icon: Users },
  { filtro: 3, name: 'Ingreso mensual', desc: 'Indicó rango de ingreso', color: '#f59e0b', icon: Percent },
  { filtro: 4, name: 'Objetivo', desc: 'Reducir impuestos, retiro o ambos', color: '#818cf8', icon: Target },
  { filtro: 5, name: 'Email', desc: 'Compartió correo electrónico', color: '#a78bfa', icon: Mail },
  { filtro: 6, name: 'Agendar cita', desc: 'Seleccionando horario', color: '#10b981', icon: Calendar },
];

export default function FunnelView() {
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followUpPreview, setFollowUpPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [followUpResult, setFollowUpResult] = useState(null);
  const [citaCount, setCitaCount] = useState(0);
  const [allConversations, setAllConversations] = useState([]);
  const [stageModal, setStageModal] = useState(null); // { filtro, name, leads }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, previewResp] = await Promise.all([
        api.getFSCStats(),
        fetch('/api/whatsapp/follow-up/preview?minHours=6', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('fsc_token')}` },
        }).then(r => r.json()).catch(() => null),
      ]);

      // Contar leads por filtro
      const filtroCounts = {};
      let total = 0;
      let citas = 0;

      if (statsResp) {
        // Stats viene del endpoint /api/fsc/stats
        citas = statsResp.cita_agendada || 0;
        setCitaCount(citas);
        total = Object.values(statsResp).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      }

      // Obtener conteo real por filtro desde fsc_conversations
      try {
        const convResp = await fetch('/api/fsc?limit=500', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('fsc_token')}` },
        });
        const convData = await convResp.json();
        const conversations = convData.conversations || convData || [];

        setAllConversations(conversations);
        for (const c of conversations) {
          if (c.lead_status === 'cita_agendada') { citas++; continue; }
          const f = c.filtro_actual || 1;
          filtroCounts[f] = (filtroCounts[f] || 0) + 1;
          total++;
        }
        setCitaCount(citas);
      } catch { /* use stats fallback */ }

      setFunnelData({ filtroCounts, total, citas });
      if (previewResp) setFollowUpPreview(previewResp);
    } catch (err) {
      console.error('Funnel data error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFollowUp = async () => {
    setSending(true);
    try {
      const resp = await fetch('/api/whatsapp/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('fsc_token')}` },
        body: JSON.stringify({ max: 30, minHours: 6 }),
      });
      const data = await resp.json();
      setFollowUpResult(data);
      fetchData(); // Refresh
    } catch (err) {
      setFollowUpResult({ error: err.message });
    }
    setSending(false);
  };

  if (loading) return <div className="view"><p style={{ textAlign: 'center', padding: 40, color: C.textLight }}>Cargando embudo...</p></div>;

  const { filtroCounts = {}, total = 0, citas = 0 } = funnelData || {};
  const conversionRate = total > 0 ? ((citas / (total + citas)) * 100).toFixed(1) : 0;
  const hotLeads = followUpPreview?.hot || 0;
  const warmLeads = followUpPreview?.warm || 0;

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 className="view-title">Embudo de Conversión</h1>
          <p className="view-subtitle">Recorrido del lead desde el primer mensaje hasta la cita agendada</p>
        </div>
        <button
          onClick={handleFollowUp}
          disabled={sending}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: sending ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          <Zap size={18} /> {sending ? 'Enviando...' : `Activar Follow-Up (${followUpPreview?.total || 0} leads)`}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Users size={22} /></div>
          <div><p className="stat-label">En Calificación</p><p className="stat-value">{total}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><UserCheck size={22} /></div>
          <div><p className="stat-label">Citas Agendadas</p><p className="stat-value">{citaCount}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Percent size={22} /></div>
          <div><p className="stat-label">Tasa de Conversión</p><p className="stat-value">{conversionRate}%</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><Zap size={22} /></div>
          <div><p className="stat-label">Leads HOT (filtro 5+)</p><p className="stat-value" style={{ color: '#ef4444' }}>{hotLeads + warmLeads}</p></div>
        </div>
      </div>

      {/* Funnel Stages */}
      <div className="section">
        <h2 className="section-title">Etapas del Embudo</h2>
        <div className="funnel-wrap">
          {FUNNEL_STAGES.map((stage, idx) => {
            const count = filtroCounts[stage.filtro] || 0;
            const prevCount = idx > 0 ? (filtroCounts[FUNNEL_STAGES[idx - 1].filtro] || 0) : total;
            const dropOff = idx > 0 ? prevCount - count : 0;
            const dropPct = idx > 0 && prevCount > 0 ? ((dropOff / prevCount) * 100).toFixed(0) : 0;
            const widthPct = Math.max(100 - idx * 10, 30);
            const Icon = stage.icon;

            return (
              <div key={stage.filtro}>
                {idx > 0 && dropOff > 0 && (
                  <div style={{ textAlign: 'center', padding: '4px 0', width: `${widthPct + 5}%`, margin: '0 auto' }}>
                    <ArrowDown size={14} style={{ color: C.textLight }} />
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginLeft: 4 }}>-{dropOff} ({dropPct}%)</span>
                  </div>
                )}
                <div className="funnel-stage" style={{ background: `linear-gradient(135deg,${stage.color},${stage.color}CC)`, width: `${widthPct}%`, cursor: count > 0 ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (count === 0) return;
                    const stageLeads = allConversations.filter(c => (c.filtro_actual || 1) === stage.filtro && c.lead_status !== 'cita_agendada');
                    setStageModal({ filtro: stage.filtro, name: stage.name, color: stage.color, leads: stageLeads });
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={18} color="#fff" />
                    <div className="funnel-count">{count}</div>
                  </div>
                  <div className="funnel-info">
                    <div className="funnel-name">Paso {stage.filtro}: {stage.name}</div>
                    <div className="funnel-pct">{stage.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Cita Agendada — etapa final */}
          <div style={{ textAlign: 'center', padding: '4px 0', width: '25%', margin: '0 auto' }}>
            <ArrowDown size={14} style={{ color: C.textLight }} />
          </div>
          <div className="funnel-stage" style={{ background: `linear-gradient(135deg, #10b981, #059669)`, width: '25%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={20} color="#fff" />
              <div className="funnel-count">{citaCount}</div>
            </div>
            <div className="funnel-info">
              <div className="funnel-name">CITA AGENDADA</div>
              <div className="funnel-pct">Meta alcanzada</div>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Preview */}
      {followUpPreview && followUpPreview.total > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowPreview(!showPreview)}>
            <h2 className="section-title" style={{ margin: 0 }}>Leads para Follow-Up ({followUpPreview.total})</h2>
            {showPreview ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          {showPreview && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  🔥 HOT (filtro 5-6): {followUpPreview.hot}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: '#fef9c3', color: '#ca8a04', fontSize: 13, fontWeight: 600 }}>
                  🟡 WARM (filtro 3-4): {followUpPreview.warm}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
                  ❄️ COLD (filtro 1-2): {followUpPreview.cold}
                </span>
              </div>
              <div style={{ maxHeight: 300, overflow: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Lead</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Paso</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Inactivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followUpPreview.leads?.slice(0, 30).map((l, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 12px' }}>{l.nombre || l.phone}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                            background: l.filtro >= 8 ? '#fef2f2' : l.filtro >= 5 ? '#fef9c3' : '#f1f5f9',
                            color: l.filtro >= 8 ? '#ef4444' : l.filtro >= 5 ? '#ca8a04' : '#64748b',
                          }}>{l.filtro}</span>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#94a3b8' }}>{l.hoursInactive}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow-up Result */}
      {followUpResult && (
        <div className="section">
          <div className="info-box" style={{ background: followUpResult.error ? C.redBg : C.greenBg, borderColor: followUpResult.error ? `${C.red}40` : `${C.green}40`, color: followUpResult.error ? C.red : C.green }}>
            {followUpResult.error ? (
              <><AlertCircle size={16} /><p><strong>Error:</strong> {followUpResult.error}</p></>
            ) : (
              <><TrendingUp size={16} /><p><strong>Follow-up enviado:</strong> {followUpResult.sent} mensajes ({followUpResult.breakdown?.hot || 0} HOT, {followUpResult.breakdown?.warm || 0} WARM, {followUpResult.breakdown?.cold || 0} COLD)</p></>
            )}
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      <div className="section">
        <h2 className="section-title">Insights</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(filtroCounts[8] || 0) > 0 && (
            <div className="info-box" style={{ background: '#fef2f2', borderColor: '#ef444440', color: '#ef4444' }}>
              <Zap size={16} />
              <p><strong>{filtroCounts[8]} leads están en el paso 8</strong> — a punto de agendar cita. Un follow-up puede convertirlos inmediatamente.</p>
            </div>
          )}
          {(filtroCounts[1] || 0) > 50 && (
            <div className="info-box" style={{ background: C.amberBg, borderColor: `${C.amber}40`, color: C.amber }}>
              <AlertCircle size={16} />
              <p><strong>{filtroCounts[1]} leads se quedaron en el paso 1.</strong> La mayoría no pasó del saludo. Considera ajustar el mensaje inicial.</p>
            </div>
          )}
          <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
            <TrendingUp size={16} />
            <p><strong>Conversión:</strong> {conversionRate}% de leads agendan cita. {parseFloat(conversionRate) >= 10 ? '¡Excelente!' : parseFloat(conversionRate) >= 5 ? 'Buen ritmo.' : 'Hay espacio para mejorar con follow-ups.'}</p>
          </div>
        </div>
      </div>

      {/* Modal: leads de una etapa */}
      {stageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setStageModal(null)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${stageModal.color}, ${stageModal.color}CC)` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>Paso {stageModal.filtro}: {stageModal.name}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{stageModal.leads.length} leads en esta etapa</p>
              </div>
              <button onClick={() => setStageModal(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 18 }}>✕</button>
            </div>

            {/* Sugerencia contextual */}
            <div style={{ padding: '10px 20px', background: '#fffbeb', borderBottom: '1px solid #fef3c7', fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Zap size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{
                stageModal.filtro === 1 ? 'Estos leads solo respondieron al saludo. Un follow-up rápido tipo "¿Tienes un minuto?" puede reactivarlos.' :
                stageModal.filtro === 2 ? 'Ya declararon impuestos o no. Los que SÍ declaran son más valiosos — priorízalos.' :
                stageModal.filtro === 3 ? 'Ya indicaron su régimen. Están comprometidos — un mensaje personalizado por régimen aumenta conversión.' :
                stageModal.filtro <= 5 ? 'Estos leads ya dieron datos personales. Están interesados — un follow-up con beneficio concreto los mueve.' :
                stageModal.filtro <= 7 ? 'Leads avanzados con objetivo claro. Están a pasos de agendar — ofréceles horario directo.' :
                'A punto de agendar. Solo les falta email o confirmación. Un mensaje directo los convierte YA.'
              }</span>
            </div>

            {/* Lista de leads */}
            <div style={{ overflowY: 'auto', maxHeight: 'calc(80vh - 140px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Lead</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Teléfono</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Prioridad</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {stageModal.leads.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).map((lead, i) => {
                    const name = lead.nombre_lead || lead.contact_name || 'Sin nombre';
                    const phone = lead.whatsapp_number || lead.wa_id || '';
                    const prio = lead.prioridad || '';
                    const updated = lead.updated_at ? new Date(lead.updated_at) : null;
                    const hoursAgo = updated ? Math.round((Date.now() - updated.getTime()) / (1000 * 60 * 60)) : null;

                    return (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{name}</div>
                          {lead.objetivo && <div style={{ fontSize: 11, color: '#64748b' }}>🎯 {lead.objetivo}</div>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {phone && <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontSize: 12, textDecoration: 'none' }}>📱 {phone.slice(-10)}</a>}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {prio && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: prio.toLowerCase().includes('alta') ? '#fef2f2' : prio.toLowerCase().includes('media') ? '#fef9c3' : '#f1f5f9', color: prio.toLowerCase().includes('alta') ? '#dc2626' : prio.toLowerCase().includes('media') ? '#ca8a04' : '#64748b' }}>{prio}</span>}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: hoursAgo && hoursAgo > 48 ? '#ef4444' : '#94a3b8' }}>
                          {hoursAgo !== null ? (hoursAgo < 1 ? 'Hace minutos' : hoursAgo < 24 ? `${hoursAgo}h` : `${Math.round(hoursAgo / 24)}d`) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stageModal.leads.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No hay leads en esta etapa</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
