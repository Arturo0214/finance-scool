import { useState } from 'react';
import { C, SPANISH_LABELS } from '../constants';
import { AlertCircle } from 'lucide-react';

export default function HubSpotView({ hubspotPortal, setHubspotPortal }) {
  const [portalInput, setPortalInput] = useState(hubspotPortal);
  return (
    <>
      <style>{`
        .hs-placeholder { background:#f8fafc; padding:36px; border-radius:8px; text-align:center; color:#64748b; }
      `}</style>
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.hubspot}</h1>
      <div className="section">
        <h2 className="section-title">{SPANISH_LABELS.hubspotConfig}</h2>
        <div className="config-panel">
          <div className="field">
            <label>{SPANISH_LABELS.hubspotPortal}</label>
            <input type="text" value={portalInput} onChange={e => setPortalInput(e.target.value)} placeholder="XXXXXXXX" />
            <small className="help-text">Tu ID de portal está disponible en Configuración de HubSpot</small>
          </div>
          <button className="btn-primary" onClick={() => setHubspotPortal(portalInput)}>{SPANISH_LABELS.configure}</button>
        </div>
      </div>
      {hubspotPortal && (
        <div className="section">
          <h2 className="section-title">Widget de HubSpot</h2>
          <div className="hs-placeholder"><p>Cargando widget de HubSpot...</p><small>Portal ID: {hubspotPortal}</small></div>
        </div>
      )}
      {!hubspotPortal && (
        <div className="info-box">
          <AlertCircle size={16} />
          <p>Configura tu ID de portal de HubSpot para integrar reuniones, tickets y otras herramientas de CRM.</p>
        </div>
      )}
    </div>
    </>
  );
}
