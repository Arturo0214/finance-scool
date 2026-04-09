import { C } from '../constants';
import { Megaphone, BarChart2, Users, Target, AlertCircle } from 'lucide-react';

export default function CampaignsView() {
  return (
    <div className="view">
      <h1 className="view-title">Campañas</h1>
      <p className="view-subtitle">Seguimiento de campañas de marketing y rendimiento publicitario</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg,  color: C.primary }}><Megaphone size={22} /></div>
          <div><p className="stat-label">Campañas Activas</p><p className="stat-value">0</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><BarChart2 size={22} /></div>
          <div><p className="stat-label">Gasto Total</p><p className="stat-value">$0</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Users size={22} /></div>
          <div><p className="stat-label">Leads Generados</p><p className="stat-value">0</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F3E8FF', color: '#8B5CF6' }}><Target size={22} /></div>
          <div><p className="stat-label">CPL Promedio</p><p className="stat-value">$0</p></div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Detalle de Campañas</h2>
        <p className="empty">No hay campañas configuradas. Conecta Meta Business API y Google Ads desde la sección Workflow AI para importar campañas automáticamente.</p>
      </div>

      <div className="info-box">
        <AlertCircle size={16} />
        <p>Las métricas se actualizarán automáticamente al conectar Meta Business API y Google Ads. Configúralo desde Workflow AI.</p>
      </div>
    </div>
  );
}
