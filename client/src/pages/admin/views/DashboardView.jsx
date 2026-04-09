import { C, SPANISH_LABELS, STATUS_COLORS } from '../constants';
import { Users, AlertCircle, Clock, TrendingUp, Search } from 'lucide-react';

function SimpleBarChart({ data }) {
  const items = (data || []).map(d => ({ source: d.source || 'Directo', count: d.count || 0 }));
  if (items.length === 0) return <p className="empty">No hay datos de fuentes</p>;
  const maxCount = Math.max(...items.map(d => d.count), 1);
  return (
    <div className="chart-bars">
      {items.map(item => (
        <div key={item.source} className="chart-row">
          <div className="chart-label">{item.source}</div>
          <div className="chart-track">
            <div className="chart-fill" style={{ width: `${(item.count / maxCount) * 100}%`, background: `linear-gradient(90deg,${C.primary},${C.accent})` }}>
              <span className="chart-val">{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardView({ stats, leads, events }) {
  const statCards = [
    { label: SPANISH_LABELS.totalLeads, value: stats.totalLeads || 0,  icon: Users,        color: C.primary, bg: C.blueBg  },
    { label: SPANISH_LABELS.newLeads,   value: stats.newLeads || 0,    icon: AlertCircle,  color: C.amber,   bg: C.amberBg },
    { label: SPANISH_LABELS.inProgress, value: stats.inProgress || 0, icon: Clock,         color: '#EA580C', bg: '#FFF7ED' },
    { label: SPANISH_LABELS.converted,  value: stats.converted || 0,  icon: TrendingUp,    color: C.green,   bg: C.greenBg },
  ];

  return (
    <div className="view">
      <h1 className="view-title">Panel de Control</h1>
      <p className="view-subtitle">Resumen operativo de leads y actividad</p>

      <div className="stats-grid">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}><Icon size={22} /></div>
              <div>
                <p className="stat-label">{s.label}</p>
                <p className="stat-value">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="two-col">
        <div className="section">
          <h2 className="section-title">Leads por Fuente</h2>
          <SimpleBarChart data={stats.leadsBySource} />
        </div>
        <div className="section">
          <h2 className="section-title">{SPANISH_LABELS.todayEvents}</h2>
          <div className="events-list">
            {events.length === 0 ? <p className="empty">{SPANISH_LABELS.noEvents}</p> : (
              events.map(event => (
                <div key={event.id} className="event-card">
                  <div>
                    <h3>{event.title}</h3>
                    <span className="ev-time"><Clock size={13} /> {event.time || 'Sin hora'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">{SPANISH_LABELS.recentLeads}</h2>
        <div className="tbl-wrap">
          {leads.length === 0 ? <p className="empty">{SPANISH_LABELS.noLeads}</p> : (
            <table>
              <thead><tr>
                <th>{SPANISH_LABELS.name}</th><th>{SPANISH_LABELS.phone}</th>
                <th>{SPANISH_LABELS.service}</th><th>{SPANISH_LABELS.status}</th>
              </tr></thead>
              <tbody>
                {leads.slice(0, 5).map(lead => {
                  const sc = STATUS_COLORS[lead.status] || { bg: C.bg, text: C.textMuted };
                  return (
                    <tr key={lead.id}>
                      <td>{lead.name}</td><td>{lead.phone}</td><td>{lead.service || 'PPR'}</td>
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
  );
}
