import { C } from '../constants';
import { Users, Percent, Target, Phone, Clock, AlertCircle, TrendingUp, UserCheck, Activity, ArrowRight } from 'lucide-react';

export default function FunnelView({ stats }) {
  const s = stats || {};
  const total = s.totalLeads || 1;
  const stages = [
    { name: 'Nuevo',      count: s.newLeads || 0,                      desc: 'Leads que acaban de entrar al sistema',         color: C.amber,    icon: AlertCircle },
    { name: 'Contactado', count: s.contactados || 0,                   desc: 'Primer contacto realizado por el asesor',       color: C.blue,     icon: Phone       },
    { name: 'En Proceso', count: s.enProceso || s.inProgress || 0,     desc: 'Negociación activa, posible cierre',            color: '#EA580C',  icon: Clock       },
    { name: 'Convertido', count: s.converted || 0,                     desc: 'Lead convertido a cliente PPR',                 color: C.green,    icon: UserCheck   },
  ];

  return (
    <div className="view">
      <h1 className="view-title">Embudo de Conversión</h1>
      <p className="view-subtitle">Análisis detallado del recorrido del lead hasta la conversión</p>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Users size={22} /></div>
          <div><p className="stat-label">Total en Embudo</p><p className="stat-value">{total}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Percent size={22} /></div>
          <div><p className="stat-label">Tasa de Conversión</p><p className="stat-value">{s.conversionRate || ((s.converted || 0) / total * 100).toFixed(1)}%</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Target size={22} /></div>
          <div><p className="stat-label">Tasa de Contacto</p><p className="stat-value">{s.contactRate || 0}%</p></div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Etapas del Embudo</h2>
        <div className="funnel-wrap">
          {stages.map((stage, idx) => {
            const widthPct = 100 - idx * 18;
            const dropOff = idx > 0 ? stages[idx - 1].count - stage.count : 0;
            const dropPct = idx > 0 && stages[idx - 1].count > 0 ? ((dropOff / stages[idx - 1].count) * 100).toFixed(0) : 0;
            const Icon = stage.icon;
            return (
              <div key={stage.name}>
                {idx > 0 && (
                  <div style={{ textAlign: 'center', padding: '6px 0', width: `${widthPct + 9}%`, margin: '0 auto' }}>
                    <ArrowRight size={16} style={{ transform: 'rotate(90deg)', color: C.textLight }} />
                    {dropOff > 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 600, marginLeft: 6 }}>-{dropOff} ({dropPct}% caída)</span>}
                  </div>
                )}
                <div className="funnel-stage" style={{ background: `linear-gradient(135deg,${stage.color},${stage.color}CC)`, width: `${widthPct}%` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={20} color="#fff" />
                    <div className="funnel-count">{stage.count}</div>
                  </div>
                  <div className="funnel-info">
                    <div className="funnel-name">{stage.name}</div>
                    <div className="funnel-pct">{stage.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Recomendaciones</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(s.newLeads || 0) > (s.contactados || 0) * 2 && (
            <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red }}>
              <AlertCircle size={16} />
              <p><strong>Alerta:</strong> Hay {s.newLeads || 0} leads sin contactar vs {s.contactados || 0} contactados.</p>
            </div>
          )}
          <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
            <TrendingUp size={16} />
            <p><strong>Objetivo:</strong> Reduce el tiempo entre "Nuevo" y "Contactado". Los leads se enfrían después de 48 horas.</p>
          </div>
          <div className="info-box">
            <Activity size={16} />
            <p><strong>Benchmark:</strong> La tasa de conversión promedio en servicios financieros es 5-8%. {parseFloat(s.conversionRate || 0) >= 5 ? '¡Vas por buen camino!' : 'Hay espacio para mejorar.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
