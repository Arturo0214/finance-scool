/**
 * CrmPipelineView — Kanban del pipeline por asesor
 * Arrastra clientes entre etapas (desktop) o cambia etapa desde la tarjeta
 * (móvil). Admin elige el asesor; cada asesor ve solo su tablero.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Phone, GripVertical, RefreshCw } from 'lucide-react';
import { getCrmCSS, ETAPAS, fmtMoney } from './crmShared';

const KANBAN_CSS = `
  .kb-board { display:flex; gap:12px; overflow-x:auto; padding-bottom:14px; align-items:flex-start; -webkit-overflow-scrolling:touch; }
  .kb-col { min-width:230px; width:230px; flex-shrink:0; background:${C.bg}; border-radius:12px; border:1px solid ${C.border}; display:flex; flex-direction:column; max-height:calc(100vh - 300px); }
  .kb-col.drag-over { border-color:${C.primary}; background:${C.blueBg}; box-shadow:0 0 0 2px ${C.primary}30; }
  .kb-col-head { padding:12px 14px; display:flex; align-items:center; gap:8px; border-bottom:1px solid ${C.border}; position:sticky; top:0; }
  .kb-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .kb-col-title { font-size:13px; font-weight:700; color:${C.text}; flex:1; }
  .kb-count { font-size:11.5px; font-weight:700; color:${C.textMuted}; background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:1px 8px; }
  .kb-col-body { padding:10px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; min-height:60px; }
  .kb-card { background:${C.white}; border:1px solid ${C.border}; border-radius:10px; padding:10px 12px; cursor:grab; transition:box-shadow .15s, transform .15s, opacity .15s; }
  .kb-card:hover { box-shadow:0 4px 12px rgba(0,61,165,.1); }
  .kb-card.dragging { opacity:.45; transform:rotate(1.5deg); }
  .kb-card-name { font-size:13px; font-weight:700; color:${C.text}; display:flex; align-items:center; gap:6px; }
  .kb-card-sub { font-size:11px; color:${C.textMuted}; margin-top:2px; }
  .kb-card-meta { display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:6px; }
  .kb-prima { font-size:11.5px; font-weight:700; color:${C.green}; }
  .kb-move { display:none; }
  .kb-empty { font-size:11.5px; color:${C.textLight}; text-align:center; padding:14px 6px; border:1.5px dashed ${C.border}; border-radius:8px; }
  @media(max-width:768px){
    .kb-col { min-width:78vw; width:78vw; max-height:none; }
    .kb-board { scroll-snap-type:x mandatory; }
    .kb-col { scroll-snap-align:start; }
    .kb-card { cursor:default; }
    .kb-move { display:block; width:100%; margin-top:8px; padding:6px 8px; border:1px solid ${C.border}; border-radius:8px; font-size:12px; font-family:inherit; background:${C.bg}; color:${C.text}; }
  }
`;

export default function CrmPipelineView({ isAgency }) {
  const [clients, setClients] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [agentFilter, setAgentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, a] = await Promise.all([api.crmGetClients(), api.crmGetPolicies(), api.crmGetAgents()]);
      setClients(c.clients || []); setPolicies(p.policies || []); setAgents(a.agents || []);
      if (!agentFilter && (a.agents || []).length) setAgentFilter(String(a.agents[0].id));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [agentFilter]);
  useEffect(() => { load(); }, []); // eslint-disable-line

  const primaByClient = useMemo(() => {
    const m = {};
    for (const p of policies) {
      if (p.estatus === 'cancelada') continue;
      m[p.client_id] = (m[p.client_id] || 0) + (Number(p.prima) || 0);
    }
    return m;
  }, [policies]);

  const visible = clients.filter(c => !isAgency || !agentFilter || String(c.agent_id) === agentFilter);
  const currentAgent = agents.find(a => String(a.id) === agentFilter);

  const moveClient = async (clientId, etapa) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || client.etapa === etapa) return;
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, etapa } : c)); // optimista
    try { await api.crmUpdateClient(clientId, { etapa }); }
    catch (e) { alert(e.message); load(); }
  };

  if (loading) return <><style>{getCrmCSS()}{KANBAN_CSS}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando pipeline...</p></div></>;

  return (
    <div className="view">
      <style>{getCrmCSS()}{KANBAN_CSS}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Pipeline</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            {isAgency && currentAgent ? `Kanban de ${currentAgent.nombre}` : 'Arrastra tus clientes entre etapas'}
          </p>
        </div>
        <div className="crm-toolbar-right">
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.clave})</option>)}
              <option value="">— Todos los asesores —</option>
            </select>
          )}
          <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="kb-board">
        {ETAPAS.map(etapa => {
          const items = visible.filter(c => c.etapa === etapa.id);
          const totalPrima = items.reduce((s, c) => s + (primaByClient[c.id] || 0), 0);
          return (
            <div
              key={etapa.id}
              className={`kb-col${overCol === etapa.id ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setOverCol(etapa.id); }}
              onDragLeave={() => setOverCol(o => (o === etapa.id ? null : o))}
              onDrop={e => { e.preventDefault(); setOverCol(null); if (dragId) moveClient(dragId, etapa.id); setDragId(null); }}
            >
              <div className="kb-col-head" style={{ background: `${etapa.color}0D`, borderRadius: '12px 12px 0 0' }}>
                <span className="kb-dot" style={{ background: etapa.color }} />
                <span className="kb-col-title">{etapa.label}</span>
                <span className="kb-count">{items.length}</span>
              </div>
              <div className="kb-col-body">
                {totalPrima > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '0 2px' }}>Prima: {fmtMoney(totalPrima)}</div>}
                {items.length === 0 && <div className="kb-empty">Suelta aquí</div>}
                {items.map(c => (
                  <div
                    key={c.id}
                    className={`kb-card${dragId === c.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  >
                    <div className="kb-card-name"><GripVertical size={12} style={{ color: C.textLight, flexShrink: 0 }} />{c.nombre}</div>
                    {(c.ocupacion || c.empresa) && <div className="kb-card-sub">{c.ocupacion}{c.empresa ? ` · ${c.empresa}` : ''}</div>}
                    {isAgency && !agentFilter && c.crm_agents?.nombre && <div className="kb-card-sub">👤 {c.crm_agents.nombre}</div>}
                    <div className="kb-card-meta">
                      {primaByClient[c.id] ? <span className="kb-prima">{fmtMoney(primaByClient[c.id])}</span> : <span className="kb-card-sub" style={{ textTransform: 'capitalize' }}>{c.origen || ''}</span>}
                      {c.telefono && (
                        <a href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          style={{ color: '#25D366', display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
                          <Phone size={13} />
                        </a>
                      )}
                    </div>
                    {/* Móvil: mover con selector */}
                    <select className="kb-move" value={c.etapa} onChange={e => moveClient(c.id, e.target.value)}>
                      {ETAPAS.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
