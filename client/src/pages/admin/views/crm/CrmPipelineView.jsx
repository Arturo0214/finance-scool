/**
 * CrmPipelineView — Kanban del pipeline por asesor
 * Arrastra clientes entre etapas (desktop) o cambia etapa desde la tarjeta
 * (móvil). Admin elige el asesor; cada asesor ve solo su tablero.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Phone, GripVertical, RefreshCw, Search } from 'lucide-react';
import { getCrmCSS, ETAPAS, fmtMoney } from './crmShared';

const KANBAN_CSS = `
  .kb-board { display:flex; gap:14px; overflow-x:auto; padding-bottom:16px; align-items:flex-start; -webkit-overflow-scrolling:touch; }
  .kb-col { min-width:238px; width:238px; flex-shrink:0; background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(246,248,251,.92)); border-radius:16px; border:1px solid rgba(11,27,51,.08); display:flex; flex-direction:column; max-height:calc(100vh - 300px); box-shadow:0 1px 2px rgba(11,27,51,.03); }
  .kb-col.drag-over { border-color:${C.gold}; background:${C.goldBg}; box-shadow:0 0 0 3px rgba(193,151,91,.25), 0 12px 28px -18px rgba(11,27,51,.35); }
  .kb-col-head { padding:13px 15px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(11,27,51,.07); position:sticky; top:0; z-index:1; }
  .kb-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; box-shadow:0 0 0 3px rgba(11,27,51,.06); }
  .kb-col-title { font-size:11.5px; font-weight:700; color:${C.ink}; flex:1; text-transform:uppercase; letter-spacing:1.2px; }
  .kb-count { font-size:11.5px; font-weight:700; color:${C.textMuted}; background:${C.white}; border:1px solid rgba(11,27,51,.1); border-radius:12px; padding:1px 8px; font-variant-numeric:tabular-nums; }
  .kb-col-total { font-size:11px; font-weight:700; color:${C.green}; padding:8px 4px 0; font-variant-numeric:tabular-nums; }
  .kb-col-body { padding:10px; overflow-y:auto; display:flex; flex-direction:column; gap:9px; min-height:60px; }
  .kb-card { background:linear-gradient(180deg,#fff,#FDFDFB); border:1px solid rgba(11,27,51,.09); border-radius:12px; padding:11px 13px; cursor:grab; transition:box-shadow .18s, transform .18s, opacity .15s, border-color .18s; box-shadow:0 1px 2px rgba(11,27,51,.04); }
  .kb-card:hover { transform:translateY(-2px); border-color:rgba(11,27,51,.16); box-shadow:0 12px 24px -14px rgba(0,43,117,.4); }
  .kb-card:active { cursor:grabbing; }
  .kb-card.dragging { opacity:.45; transform:rotate(1.5deg) scale(.98); }
  .kb-card-name { font-size:13px; font-weight:700; color:${C.ink}; display:flex; align-items:center; gap:6px; }
  .kb-card-sub { font-size:11px; color:${C.textMuted}; margin-top:2px; }
  .kb-card-meta { display:flex; justify-content:space-between; align-items:center; margin-top:9px; gap:6px; }
  .kb-prima { font-size:11.5px; font-weight:700; color:${C.green}; font-variant-numeric:tabular-nums; }
  .kb-move { display:none; }
  .kb-empty { font-size:11.5px; color:${C.textLight}; text-align:center; padding:16px 6px; border:1.5px dashed rgba(11,27,51,.15); border-radius:10px; font-style:italic; }
  @media(max-width:768px){
    .kb-col { min-width:78vw; width:78vw; max-height:none; }
    .kb-board { scroll-snap-type:x mandatory; }
    .kb-col { scroll-snap-align:start; }
    .kb-card { cursor:default; }
    .kb-move { display:block; width:100%; margin-top:8px; padding:7px 8px; border:1px solid rgba(11,27,51,.14); border-radius:8px; font-size:12px; font-family:inherit; background:${C.white}; color:${C.text}; }
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
  const [search, setSearch] = useState('');

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

  const visible = clients.filter(c =>
    (!isAgency || !agentFilter || String(c.agent_id) === agentFilter) &&
    (!search || (c.nombre || '').toLowerCase().includes(search.toLowerCase()))
  );
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
          <div className="crm-search-wrap">
            <Search size={15} />
            <input className="crm-search" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
              <div className="kb-col-head" style={{ background: `${etapa.color}0D`, borderRadius: '16px 16px 0 0' }}>
                <span className="kb-dot" style={{ background: etapa.color }} />
                <span className="kb-col-title">{etapa.label}</span>
                <span className="kb-count">{items.length}</span>
              </div>
              <div className="kb-col-body">
                {totalPrima > 0 && <div className="kb-col-total">Prima: {fmtMoney(totalPrima)}</div>}
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
