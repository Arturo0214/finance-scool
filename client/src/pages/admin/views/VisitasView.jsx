import { useState, useEffect } from 'react';
import { C } from '../constants';
import { Eye, Activity, Users, Clock, Calendar, User, Briefcase } from 'lucide-react';
import { api } from '../../../utils/api';

export default function VisitasView() {
  const [visitStats, setVisitStats]   = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('analytics');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [vs, ap] = await Promise.all([
          api.getVisitStats().catch(() => null),
          api.getAppointments().catch(() => []),
        ]);
        setVisitStats(vs);
        setAppointments(Array.isArray(ap) ? ap : []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="loading-wrap"><div className="spinner" /><p>Cargando...</p></div>;

  const vs = visitStats || {};

  return (
    <div className="view">
      <h1 className="view-title">Visitas</h1>
      <p className="view-subtitle">Analítica web y registro de citas</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button className={`f-tab${tab === 'analytics' ? ' active' : ''}`} onClick={() => setTab('analytics')}>Analítica Web</button>
        <button className={`f-tab${tab === 'citas'    ? ' active' : ''}`} onClick={() => setTab('citas')}>Citas / Appointments</button>
      </div>

      {tab === 'analytics' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Eye size={22} /></div><div><p className="stat-label">Visitas Totales</p><p className="stat-value">{vs.totalVisits || 0}</p></div></div>
            <div className="stat-card"><div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Activity size={22} /></div><div><p className="stat-label">Visitas Hoy</p><p className="stat-value">{vs.todayVisits || 0}</p></div></div>
            <div className="stat-card"><div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Users size={22} /></div><div><p className="stat-label">Visitantes Únicos</p><p className="stat-value">{vs.uniqueVisitors || 0}</p></div></div>
            <div className="stat-card"><div className="stat-icon" style={{ background: '#F3E8FF', color: '#8B5CF6' }}><Clock size={22} /></div><div><p className="stat-label">Duración Promedio</p><p className="stat-value">{vs.avgSessionDuration || '0:00'}</p></div></div>
          </div>

          <div className="two-col">
            <div className="section">
              <h2 className="section-title">Páginas más visitadas</h2>
              {(vs.pageViews || []).length === 0 ? <p className="empty">No hay datos de páginas</p> : (
                <div className="chart-bars">
                  {vs.pageViews.map(p => {
                    const max = Math.max(...vs.pageViews.map(x => x.views), 1);
                    return (
                      <div key={p.page} className="chart-row">
                        <div className="chart-label" style={{ width: 120 }}>{p.page}</div>
                        <div className="chart-track">
                          <div className="chart-fill" style={{ width: `${(p.views / max) * 100}%`, background: `linear-gradient(90deg,${C.primary},${C.accent})` }}>
                            <span className="chart-val">{p.views}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="section">
              <h2 className="section-title">Fuentes de tráfico</h2>
              {(vs.sourceData || []).length === 0 ? <p className="empty">No hay datos de fuentes</p> : (
                <div className="chart-bars">
                  {vs.sourceData.map(s => {
                    const max = Math.max(...vs.sourceData.map(x => x.count), 1);
                    return (
                      <div key={s.source} className="chart-row">
                        <div className="chart-label" style={{ width: 120 }}>{s.source}</div>
                        <div className="chart-track">
                          <div className="chart-fill" style={{ width: `${(s.count / max) * 100}%`, background: `linear-gradient(90deg,${C.green},${C.accent})` }}>
                            <span className="chart-val">{s.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'citas' && (
        <div className="section">
          <h2 className="section-title">Registro de Citas</h2>
          {appointments.length === 0 ? <p className="empty">No hay citas registradas</p> : (
            <>
              <div className="tbl-wrap desktop-only-table">
                <table>
                  <thead><tr><th>Fecha</th><th>Hora</th><th>Lead</th><th>Asesor</th><th>Tipo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {appointments.map(a => (
                      <tr key={a.id}>
                        <td>{new Date(a.date).toLocaleDateString('es-MX')}</td>
                        <td>{a.time || '—'}</td>
                        <td>{a.lead_name || '—'}</td>
                        <td>{a.advisor_name || '—'}</td>
                        <td>{a.type || 'consulta'}</td>
                        <td>
                          <span className="badge" style={{
                            backgroundColor: a.status === 'completada' ? C.greenBg : C.amberBg,
                            color: a.status === 'completada' ? C.green : C.amber,
                          }}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-lead-cards mobile-only-cards">
                {appointments.map(a => (
                  <div key={a.id} className="mobile-lead-card">
                    <div className="mlc-top">
                      <span className="mlc-name">{a.lead_name || '—'}</span>
                      <span className="badge" style={{
                        backgroundColor: a.status === 'completada' ? C.greenBg : C.amberBg,
                        color: a.status === 'completada' ? C.green : C.amber,
                      }}>{a.status}</span>
                    </div>
                    <div className="mlc-row"><Calendar size={14} color={C.textLight} /> {new Date(a.date).toLocaleDateString('es-MX')} — {a.time || 'Sin hora'}</div>
                    <div className="mlc-row"><User size={14} color={C.textLight} /> {a.advisor_name || '—'}</div>
                    <div className="mlc-bottom">
                      <span className="mlc-service"><Briefcase size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{a.type || 'consulta'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
