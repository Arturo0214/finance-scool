import { useState, useEffect, useCallback } from 'react';
import { C } from '../constants';
import { Users, Percent, Target, Phone, Clock, AlertCircle, TrendingUp, UserCheck, Activity, ArrowRight, ArrowDown, Play, Eye, Zap, Mail, Calendar, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../../utils/api';

const FUNNEL_STAGES = [
  { filtro: 1, name: 'Primer contacto', desc: 'Respondió al saludo inicial', color: '#94a3b8', icon: MessageCircle },
  { filtro: 2, name: 'Declara impuestos', desc: 'Respondió si declara o no', color: '#60a5fa', icon: Users },
  { filtro: 3, name: 'Situación fiscal', desc: 'Indicó su régimen/situación', color: '#818cf8', icon: Target },
  { filtro: 4, name: 'Edad', desc: 'Compartió su edad', color: '#a78bfa', icon: Users },
  { filtro: 5, name: 'Ingreso mensual', desc: 'Indicó rango de ingreso', color: '#f59e0b', icon: Percent },
  { filtro: 6, name: 'Situación laboral', desc: 'Asalariado, honorarios, empresario', color: '#f97316', icon: Activity },
  { filtro: 7, name: 'Objetivo', desc: 'Reducir impuestos, retiro o ambos', color: '#ef4444', icon: TrendingUp },
  { filtro: 8, name: 'Agendar cita', desc: 'Seleccionando horario y email', color: '#10b981', icon: Calendar },
];

export default function FunnelView() {
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followUpPreview, setFollowUpPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [followUpResult, setFollowUpResult] = useState(null);
  const [citaCount, setCitaCount] = useState(0);

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
                <div className="funnel-stage" style={{ background: `linear-gradient(135deg,${stage.color},${stage.color}CC)`, width: `${widthPct}%` }}>
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
                  🔥 HOT (filtro 8): {followUpPreview.hot}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: '#fef9c3', color: '#ca8a04', fontSize: 13, fontWeight: 600 }}>
                  🟡 WARM (filtro 5-7): {followUpPreview.warm}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
                  ❄️ COLD (filtro 1-4): {followUpPreview.cold}
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
    </div>
  );
}
