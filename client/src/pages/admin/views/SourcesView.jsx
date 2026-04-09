import { C } from '../constants';
import { Globe, TrendingUp } from 'lucide-react';
import { SourceBars } from './AgencyDashboardView';

export default function SourcesView({ stats, leads }) {
  const s = stats || {};
  const total = s.totalLeads || leads.length || 1;
  const sourceData = s.sourcePerformance || s.leadsBySource || [];
  const colors = [C.primary, C.accent, '#059669', '#D97706', '#DC2626', '#8B5CF6'];

  const sourceMap = {};
  leads.forEach(lead => {
    const src = lead.source || 'directo';
    if (!sourceMap[src]) sourceMap[src] = { total: 0, nuevo: 0, contactado: 0, en_proceso: 0, convertido: 0 };
    sourceMap[src].total++;
    const st = (lead.status || 'nuevo').toLowerCase();
    if (sourceMap[src][st] !== undefined) sourceMap[src][st]++;
  });

  const detailedSources = Object.entries(sourceMap).map(([name, data]) => ({
    name, ...data,
    convRate: data.total > 0 ? ((data.convertido / data.total) * 100).toFixed(1) : '0.0',
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="view">
      <h1 className="view-title">Fuentes de Leads</h1>
      <p className="view-subtitle">Análisis de rendimiento por canal de adquisición</p>

      <div className="section">
        <h2 className="section-title">Distribución por Fuente</h2>
        <SourceBars
          data={sourceData.length ? sourceData : detailedSources.map(s => ({ source: s.name, total: s.total, percentage: (s.total / total * 100).toFixed(1) }))}
          total={total}
        />
      </div>

      <div className="section">
        <h2 className="section-title">Rendimiento Detallado</h2>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Fuente</th><th>Total</th><th>Nuevos</th><th>Contactados</th><th>En Proceso</th><th>Convertidos</th><th>Tasa Conv.</th></tr>
            </thead>
            <tbody>
              {detailedSources.map((src, idx) => (
                <tr key={src.name}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[idx % colors.length], display: 'inline-block' }} />
                      <strong>{src.name}</strong>
                    </span>
                  </td>
                  <td><strong>{src.total}</strong></td>
                  <td>{src.nuevo}</td>
                  <td>{src.contactado}</td>
                  <td>{src.en_proceso}</td>
                  <td><span style={{ color: C.green, fontWeight: 700 }}>{src.convertido}</span></td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: parseFloat(src.convRate) >= 10 ? C.greenBg : parseFloat(src.convRate) >= 5 ? C.amberBg : C.redBg,
                      color: parseFloat(src.convRate) >= 10 ? C.green : parseFloat(src.convRate) >= 5 ? C.amber : C.red,
                    }}>{src.convRate}%</span>
                  </td>
                </tr>
              ))}
              {detailedSources.length === 0 && <tr><td colSpan={7} className="empty">No hay datos de fuentes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Insights de Canales</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="info-box">
            <Globe size={16} />
            <p>Tienes <strong>{detailedSources.length}</strong> fuentes activas. Diversificar canales reduce el riesgo de dependencia.</p>
          </div>
          {detailedSources.some(s => parseFloat(s.convRate) > 15) && (
            <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
              <TrendingUp size={16} />
              <p><strong>Alta conversión:</strong> {detailedSources.filter(s => parseFloat(s.convRate) > 15).map(s => s.name).join(', ')} superan el 15%.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
