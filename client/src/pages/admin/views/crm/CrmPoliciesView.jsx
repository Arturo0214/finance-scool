/**
 * CrmPoliciesView — Pólizas de toda la cartera
 * Filtros por estatus/asesor, alta y edición rápida.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Plus, X, Trash2, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { getCrmCSS, ESTATUS_POLIZA, estatusPoliza, PLANES, fmtMoney, fmtDate } from './crmShared';

const EMPTY = { client_id: '', poliza: '', plan: PLANES[0], tipo: 'nueva', prima: '', forma_pago: 'anual', suma_asegurada: '', fecha_emision: '', fecha_pago: '', fecha_renovacion: '', estatus: 'en_tramite', notas: '' };

export default function CrmPoliciesView({ isAgency }) {
  const [policies, setPolicies] = useState([]);
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todas');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState(() => { const s = sessionStorage.getItem('crm_polizas_search') || ''; sessionStorage.removeItem('crm_polizas_search'); return s; });
  const [sort, setSort] = useState({ key: '', dir: 'desc' });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortTh = ({ k, children }) => (
    <th onClick={() => toggleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }} title="Ordenar">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {children}
        {sort.key === k ? (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    </th>
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, a] = await Promise.all([api.crmGetPolicies(), api.crmGetClients(), api.crmGetAgents()]);
      setPolicies(p.policies || []); setClients(c.clients || []); setAgents(a.agents || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.client_id) return alert('Selecciona un cliente');
    setSaving(true);
    try {
      const body = { ...form, prima: Number(form.prima) || 0, suma_asegurada: Number(form.suma_asegurada) || null };
      if (form.id) await api.crmUpdatePolicy(form.id, body);
      else await api.crmCreatePolicy(body);
      setForm(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar esta póliza?')) return;
    try { await api.crmDeletePolicy(form.id); setForm(null); load(); }
    catch (e) { alert(e.message); }
  };

  const filtered = policies.filter(p => {
    if (statusFilter !== 'todas' && p.estatus !== statusFilter) return false;
    if (agentFilter && String(p.agent_id) !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.plan, p.poliza, p.crm_clients?.nombre, p.crm_agents?.nombre].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const fechaRef = (p) => p.fecha_pago || p.fecha_renovacion || p.fecha_emision || '';
  const sorted = sort.key ? [...filtered].sort((a, b) => {
    let va, vb;
    if (sort.key === 'prima') { va = Number(a.prima) || 0; vb = Number(b.prima) || 0; }
    else if (sort.key === 'cliente') { va = a.crm_clients?.nombre || ''; vb = b.crm_clients?.nombre || ''; }
    else if (sort.key === 'fecha') { va = fechaRef(a); vb = fechaRef(b); }
    else { va = a[sort.key] || ''; vb = b[sort.key] || ''; }
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
    return sort.dir === 'asc' ? c : -c;
  }) : filtered;

  const totalPrima = filtered.reduce((s, p) => s + (Number(p.prima) || 0), 0);

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando pólizas...</p></div></>;

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Pólizas</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>{filtered.length} pólizas · prima total {fmtMoney(totalPrima)}</p>
        </div>
        <div className="crm-toolbar-right">
          <div className="crm-search-wrap">
            <Search size={15} />
            <input className="crm-search" placeholder="Buscar póliza, plan o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="">Todos los asesores</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={16} /> Nueva póliza</button>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 18 }}>
        <button className={`f-tab${statusFilter === 'todas' ? ' active' : ''}`} onClick={() => setStatusFilter('todas')}>Todas</button>
        {ESTATUS_POLIZA.map(s => (
          <button key={s.id} className={`f-tab${statusFilter === s.id ? ' active' : ''}`} onClick={() => setStatusFilter(s.id)}>
            {s.label} ({policies.filter(p => p.estatus === s.id).length})
          </button>
        ))}
      </div>

      {/* Desktop */}
      <div className="tbl-wrap desktop-only-table">
        <table>
          <thead>
            <tr><SortTh k="plan">Póliza / Plan</SortTh><SortTh k="cliente">Cliente</SortTh>{isAgency && <th>Asesor</th>}<SortTh k="tipo">Tipo</SortTh><SortTh k="prima">Prima</SortTh><SortTh k="fecha">Pago / Renovación</SortTh><SortTh k="estatus">Estatus</SortTh></tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={7} className="empty">Sin pólizas con estos filtros</td></tr>}
            {sorted.map(p => {
              const s = estatusPoliza(p.estatus);
              return (
                <tr key={p.id} className="crm-rank-row" onClick={() => setForm({ ...EMPTY, ...p })}>
                  <td><b>{p.plan || '—'}</b>{p.poliza && <><br /><span style={{ fontSize: 11.5, color: C.textMuted }}>{p.poliza}</span></>}</td>
                  <td>{p.crm_clients?.nombre || '—'}</td>
                  {isAgency && <td style={{ fontSize: 12.5 }}>{p.crm_agents?.nombre || '—'}</td>}
                  <td style={{ textTransform: 'capitalize' }}>{p.tipo === 'renovacion' ? 'Renovación' : 'Nueva'}</td>
                  <td><b>{fmtMoney(p.prima)}</b><br /><span style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize' }}>{p.forma_pago}</span></td>
                  <td style={{ fontSize: 12.5 }}>{p.fecha_pago ? `Pagada ${fmtDate(p.fecha_pago)}` : p.fecha_renovacion ? `Renueva ${fmtDate(p.fecha_renovacion)}` : fmtDate(p.fecha_emision)}</td>
                  <td><span className="badge" style={{ background: s.bg, color: s.text }}>{s.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="mobile-only-cards" style={{ flexDirection: 'column' }}>
        {sorted.length === 0 && <p className="empty">Sin pólizas con estos filtros</p>}
        {sorted.map(p => {
          const s = estatusPoliza(p.estatus);
          return (
            <div key={p.id} className="crm-mobile-card" onClick={() => setForm({ ...EMPTY, ...p })}>
              <div className="crm-mc-top">
                <div>
                  <div className="crm-mc-name">{p.plan || 'Póliza'}</div>
                  <span style={{ fontSize: 11.5, color: C.textMuted }}>{p.crm_clients?.nombre}</span>
                </div>
                <span className="badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
              </div>
              <div className="crm-mc-row"><span>Prima ({p.forma_pago})</span><b>{fmtMoney(p.prima)}</b></div>
              <div className="crm-mc-row"><span>{p.tipo === 'renovacion' ? 'Renovación' : 'Nueva'}</span><b>{p.fecha_pago ? `Pagada ${fmtDate(p.fecha_pago)}` : p.fecha_renovacion ? `Renueva ${fmtDate(p.fecha_renovacion)}` : '—'}</b></div>
            </div>
          );
        })}
      </div>

      {/* Modal alta/edición */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{form.id ? 'Editar póliza' : 'Nueva póliza'}</h2>
              <button className="close-btn" onClick={() => setForm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Cliente *</label>
                <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} disabled={!!form.id}>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0 14px' }}>
                <div className="field"><label>No. de póliza</label><input value={form.poliza ?? ''} onChange={e => setForm({ ...form, poliza: e.target.value })} /></div>
                <div className="field"><label>Plan</label><select value={form.plan ?? ''} onChange={e => setForm({ ...form, plan: e.target.value })}>{PLANES.map(p => <option key={p}>{p}</option>)}</select></div>
                <div className="field"><label>Tipo</label><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="nueva">Nueva</option><option value="renovacion">Renovación</option></select></div>
                <div className="field"><label>Prima anual (MXN)</label><input type="number" value={form.prima ?? ''} onChange={e => setForm({ ...form, prima: e.target.value })} /></div>
                <div className="field"><label>Forma de pago</label><select value={form.forma_pago} onChange={e => setForm({ ...form, forma_pago: e.target.value })}>{['anual', 'semestral', 'trimestral', 'mensual'].map(f => <option key={f}>{f}</option>)}</select></div>
                <div className="field"><label>Suma asegurada</label><input type="number" value={form.suma_asegurada ?? ''} onChange={e => setForm({ ...form, suma_asegurada: e.target.value })} /></div>
                <div className="field"><label>Fecha emisión</label><input type="date" value={form.fecha_emision ?? ''} onChange={e => setForm({ ...form, fecha_emision: e.target.value })} /></div>
                <div className="field"><label>Fecha de pago</label><input type="date" value={form.fecha_pago ?? ''} onChange={e => setForm({ ...form, fecha_pago: e.target.value })} /></div>
                <div className="field"><label>Fecha renovación</label><input type="date" value={form.fecha_renovacion ?? ''} onChange={e => setForm({ ...form, fecha_renovacion: e.target.value })} /></div>
                <div className="field"><label>Estatus</label><select value={form.estatus} onChange={e => setForm({ ...form, estatus: e.target.value })}>{ESTATUS_POLIZA.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
              </div>
              <div className="field"><label>Notas</label><textarea rows={2} value={form.notas ?? ''} onChange={e => setForm({ ...form, notas: e.target.value })} /></div>
            </div>
            <div className="modal-foot" style={{ justifyContent: form.id ? 'space-between' : 'flex-end' }}>
              {form.id && <button className="btn-secondary" style={{ color: C.red, borderColor: `${C.red}40` }} onClick={remove}><Trash2 size={14} style={{ marginRight: 5 }} />Eliminar</button>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
                <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
