import { useState } from 'react';
import { C, SPANISH_LABELS } from '../constants';
import { MessageCircle, Zap, AlertCircle } from 'lucide-react';

export default function WorkflowAIView({ metaToken, setMetaToken }) {
  const [tokenInput, setTokenInput] = useState(metaToken);
  return (
    <>
      <style>{`
        .wf-diagram { display:flex; align-items:center; gap:10px; overflow-x:auto; margin-bottom:20px; padding:8px 0; }
        .wf-stage { flex:1; min-width:180px; }
        .wf-box { padding:16px; border-radius:10px; color:#fff; text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; font-size:13px; font-weight:600; }
        .wf-box small { font-weight:400; opacity:.85; }
        .wf-arrow { font-size:22px; color:#0088E0; font-weight:bold; min-width:28px; text-align:center; }
        .wf-branches { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:20px; }
        .branch-box { background:#fff; padding:16px; border-radius:8px; border-left:4px solid #003DA5; border:1px solid #e2e8f0; }
        .branch-box h4 { font-size:14px; margin:0 0 8px; }
        .branch-box ul { margin:0; padding-left:18px; font-size:13px; color:#64748b; line-height:1.8; }
        .pipeline-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; }
        .pipeline-card { background:#fff; padding:14px; border-radius:8px; display:flex; align-items:center; gap:10px; border:1px solid #e2e8f0; }
        .tpl-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:20px; }
        .tpl-card { background:#fff; padding:18px; border-radius:10px; border:1px solid #e2e8f0; transition:box-shadow .2s; }
        .tpl-card:hover { box-shadow:0 4px 12px rgba(0,61,165,.06); }
        .tpl-card h3 { font-size:14px; font-weight:600; color:#0f172a; margin:0 0 8px; }
        .tpl-card p { font-size:13px; color:#64748b; margin:0; line-height:1.5; }
      `}</style>
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.metaWorkflow}</h1>

      <div className="section">
        <h2 className="section-title">Configuración de Meta Business API</h2>
        <div className="config-panel">
          <div className="field">
            <label>Token de Meta Business API</label>
            <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Ingresa tu token de API..." />
            <small className="help-text">Tu token se encuentra en Meta Business Suite → Configuración</small>
          </div>
          <button className="btn-primary" onClick={() => setMetaToken(tokenInput)}>Guardar Configuración</button>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Flujo de Automatización</h2>
        <div className="wf-diagram">
          <div className="wf-stage">
            <div className="wf-box" style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryLight})` }}>
              <MessageCircle size={20} /><p>Lead entra desde Meta</p><small>Facebook / Instagram Ads</small>
            </div>
          </div>
          <div className="wf-arrow">&rarr;</div>
          <div className="wf-stage">
            <div className="wf-box" style={{ background: `linear-gradient(135deg,${C.accent},#00B4D8)` }}>
              <Zap size={20} /><p>AI Agent Califica</p><small>Messenger / WhatsApp</small>
            </div>
          </div>
          <div className="wf-arrow">&rarr;</div>
          <div className="wf-stage">
            <div className="wf-box" style={{ background: `linear-gradient(135deg,${C.amber},#F59E0B)` }}>
              <AlertCircle size={20} /><p>Auto-clasificación</p><small>Hot / Warm / Cold</small>
            </div>
          </div>
        </div>

        <div className="wf-branches">
          <div className="branch-box" style={{ borderLeftColor: C.red }}>
            <h4 style={{ color: C.red }}>Lead Caliente</h4>
            <ul><li>Notificación inmediata</li><li>Reserva de calendario automática</li><li>Asignación a agente</li><li>Llamada de seguimiento en 1 hora</li></ul>
          </div>
          <div className="branch-box" style={{ borderLeftColor: C.amber }}>
            <h4 style={{ color: C.amber }}>Lead Tibio</h4>
            <ul><li>Secuencia de educación</li><li>Contenido sobre PPR</li><li>Follow-up cada 3 días</li><li>Oferta especial a 7 días</li></ul>
          </div>
          <div className="branch-box" style={{ borderLeftColor: C.blue }}>
            <h4 style={{ color: C.blue }}>Lead Frío</h4>
            <ul><li>Secuencia de retargeting</li><li>Anuncios personalizados</li><li>Contenido de valor</li><li>Re-engagement a 30 días</li></ul>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Plantillas de Conversación del AI Agent</h2>
        <div className="tpl-grid">
          <div className="tpl-card"><h3>Saludo Inicial</h3><p>"¡Hola! Soy tu asistente de Finance SCool. ¿Cuál es tu nombre?"</p></div>
          <div className="tpl-card"><h3>Calificación</h3><p>"¿Cuál es tu edad y cuál es tu objetivo principal para la jubilación?"</p></div>
          <div className="tpl-card"><h3>Propuesta de Valor</h3><p>"Nuestro Plan Personal de Retiro te ayuda a maximizar tu futuro financiero. ¿Te interesa conocer más?"</p></div>
          <div className="tpl-card"><h3>Cierre Conversación</h3><p>"Perfecto, un asesor se contactará contigo en las próximas 24 horas. ¿Es correcto tu número?"</p></div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Estadísticas del Pipeline</h2>
        <p className="empty">Las estadísticas del pipeline se mostrarán al conectar Meta Business API y comenzar a recibir leads automáticamente.</p>
      </div>
    </div>
    </>
  );
}
