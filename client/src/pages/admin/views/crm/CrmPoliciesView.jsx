/**
 * CrmPoliciesView — Pólizas de toda la cartera
 * Filtros por estatus/asesor, alta y edición rápida.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Plus, X, Trash2, Search, ChevronUp, ChevronDown, Upload, Download } from 'lucide-react';
import { getCrmCSS, ESTATUS_POLIZA, estatusPoliza, PLANES, fmtMoney, fmtDate, partirAgentes } from './crmShared';

const EMPTY = { client_id: '', poliza: '', plan: PLANES[0], tipo: 'nueva', prima: '', forma_pago: 'anual', suma_asegurada: '', fecha_emision: '', fecha_pago: '', fecha_renovacion: '', estatus: 'en_tramite', notas: '', aseguradora: 'PRU' };

const ASEGURADORAS = [
  { id: 'PRU', label: 'Prudential', color: '#003DA5', bg: 'rgba(0,61,165,.09)' },
  { id: 'IL', label: 'Insignia Life', color: '#0E7C6B', bg: 'rgba(14,124,107,.10)' },
];
const asegInfo = (id) => ASEGURADORAS.find(a => a.id === id) || ASEGURADORAS[0];

export default function CrmPoliciesView({ isAgency }) {
  const [policies, setPolicies] = useState([]);
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Multi-selección de estatus: [] = todas; clic = toggle (se pueden combinar)
  const [statusFilter, setStatusFilter] = useState([]);
  const toggleStatus = (id) => setStatusFilter(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState(() => { const s = sessionStorage.getItem('crm_polizas_search') || ''; sessionStorage.removeItem('crm_polizas_search'); return s; });
  /* Filtros por columna (fila bajo los encabezados) */
  const [fPlan, setFPlan] = useState('');
  const [fAseg, setFAseg] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fPrimaMin, setFPrimaMin] = useState('');
  const [fFecha, setFFecha] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'desc' });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ultimaImport, setUltimaImport] = useState(null);
  const [importando, setImportando] = useState(false);
  const importRef = useRef(null);

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
      const [p, c, a, pr] = await Promise.all([api.crmGetPolicies(), api.crmGetClients(), api.crmGetAgents(), api.crmGetProducts().catch(() => ({ products: [] }))]);
      setPolicies(p.policies || []); setClients(c.clients || []); setAgents(a.agents || []); setProducts(pr.products || []);
      setUltimaImport(p.ultimaImportacion || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Los contenedores "Cartera Prudential/Insignia — asesor" agrupan la base
     migrada; el Excel no trae nombre de cliente (dato sensible), así que aquí
     se captura el real: se crea el cliente y se le reasigna la póliza. */
  const esCartera = (c) => c && (c.origen === 'Prudential' || c.origen === 'Insignia');
  const clienteActual = (f) => clients.find(c => String(c.id) === String(f.client_id));

  const save = async () => {
    if (!form.client_id && !String(form.cliente_nombre || '').trim()) return alert('Selecciona un cliente o captura su nombre');
    setSaving(true);
    try {
      const body = { ...form, prima: Number(form.prima) || 0, suma_asegurada: Number(form.suma_asegurada) || null };
      const nombreNuevo = String(form.cliente_nombre || '').trim();
      const actual = clienteActual(form);
      delete body.cliente_nombre;

      if (nombreNuevo && actual && nombreNuevo !== actual.nombre) {
        if (esCartera(actual)) {
          // El cliente real no existía: se crea en la misma cartera y se reasigna la póliza
          const { client } = await api.crmCreateClient({
            nombre: nombreNuevo, agent_id: actual.agent_id, etapa: 'postventa',
            origen: 'otro', aseguradora: form.aseguradora || actual.aseguradora || 'PRU',
            notas: 'Capturado desde Pólizas (la base migrada no traía nombre de cliente).',
          });
          body.client_id = client.id;
        } else {
          await api.crmUpdateClient(actual.id, { nombre: nombreNuevo });
        }
      }
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

  /* Filtros SIN el de estatus: los contadores de las pestañas deben reflejar
     lo que el usuario ya filtró (asesor, búsqueda, plan…) — no toda la base */
  const matchBase = (p) => {
    if (agentFilter && String(p.agent_id) !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.plan, p.poliza, p.crm_clients?.nombre, p.crm_agents?.nombre].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fPlan && p.plan !== fPlan) return false;
    if (fAseg && (p.aseguradora || 'PRU') !== fAseg) return false;
    if (fCliente && !(p.crm_clients?.nombre || '').toLowerCase().includes(fCliente.toLowerCase())) return false;
    if (fTipo && (p.tipo || 'nueva') !== fTipo) return false;
    if (fPrimaMin && (Number(p.prima) || 0) < Number(fPrimaMin)) return false;
    if (fFecha === 'pagada' && !p.fecha_pago) return false;
    if (fFecha === 'renueva' && !(p.fecha_renovacion && !p.fecha_pago)) return false;
    if (fFecha === 'sin_fecha' && (p.fecha_pago || p.fecha_renovacion || p.fecha_emision)) return false;
    return true;
  };
  const filteredBase = policies.filter(matchBase);
  const filtered = filteredBase.filter(p => statusFilter.length === 0 || statusFilter.includes(p.estatus));

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
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            {filtered.length} pólizas · prima total {fmtMoney(totalPrima)}
            {ultimaImport && (
              <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                Última actualización del reporte: {new Date(ultimaImport.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {ultimaImport.usuario ? ` por ${ultimaImport.usuario}` : ''}
                {ultimaImport.resumen ? ` · ${ultimaImport.resumen.insertadas || 0} nuevas, ${ultimaImport.resumen.canceladas || 0} canceladas` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="crm-toolbar-right">
          <div className="crm-search-wrap">
            <Search size={15} />
            <input className="crm-search" placeholder="Buscar póliza, plan o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="">Todos los asesores</option>
              <optgroup label="Activos">
                {partirAgentes(agents).activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </optgroup>
              {partirAgentes(agents).inactivos.length > 0 && (
                <optgroup label="Inactivos (con/sin producción)">
                  {partirAgentes(agents).inactivos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </optgroup>
              )}
            </select>
          )}
          {isAgency && (
            <>
              <input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                setImportando(true);
                try {
                  const { resumen } = await api.crmImportPolizas(f);
                  alert(`Reporte cargado ✓\n${resumen.filas} filas · ${resumen.insertadas} nuevas · ${resumen.actualizadas} actualizadas · ${resumen.canceladas} canceladas · ${resumen.revividas} revividas · ${resumen.clientesNuevos} clientes nuevos`);
                  load();
                } catch (err) { alert(err.message); }
                finally { setImportando(false); if (importRef.current) importRef.current.value = ''; }
              }} />
              <button className="btn-secondary" disabled={importando} onClick={() => importRef.current?.click()} title="Cargar el Reporte de pólizas Prudential (actualiza sin duplicar)">
                <Upload size={15} /> {importando ? 'Cargando...' : 'Cargar reporte'}
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={() => api.crmExportPolizas().catch(e => alert(e.message))} title="Descargar Excel con la información de esta página">
            <Download size={15} /> Exportar
          </button>
          <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={16} /> Nueva póliza</button>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 18 }}>
        <button className={`f-tab${statusFilter.length === 0 ? ' active' : ''}`} onClick={() => setStatusFilter([])}>Todas ({filteredBase.length})</button>
        {ESTATUS_POLIZA.map(s => (
          <button key={s.id} className={`f-tab${statusFilter.includes(s.id) ? ' active' : ''}`} onClick={() => toggleStatus(s.id)}
            title="Clic para combinar varios estatus">
            {s.label} ({filteredBase.filter(p => p.estatus === s.id).length})
          </button>
        ))}
      </div>

      {/* Desktop */}
      <div className="tbl-wrap desktop-only-table">
        <table>
          <thead>
            <tr><SortTh k="plan">Póliza / Plan</SortTh><SortTh k="aseguradora">Aseg.</SortTh><SortTh k="cliente">Cliente</SortTh>{isAgency && <th>Asesor</th>}<SortTh k="tipo">Tipo</SortTh><SortTh k="prima">Prima</SortTh><SortTh k="fecha">Pago / Renovación</SortTh><SortTh k="estatus">Estatus</SortTh></tr>
            {(() => {
              const fs = { width: '100%', minWidth: 0, padding: '4px 6px', fontSize: 11.5, border: '1px solid rgba(11,27,51,.12)', borderRadius: 7, fontFamily: 'inherit', background: '#fff', color: C.text, outline: 'none' };
              return (
                <tr style={{ background: '#FAFBFC' }}>
                  <th style={{ padding: '6px 10px' }}>
                    <select style={fs} value={fPlan} onChange={e => setFPlan(e.target.value)}>
                      <option value="">Todos los planes</option>
                      {PLANES.map(pl => <option key={pl}>{pl}</option>)}
                    </select>
                  </th>
                  <th style={{ padding: '6px 10px' }}>
                    <select style={fs} value={fAseg} onChange={e => setFAseg(e.target.value)}>
                      <option value="">Ambas</option>
                      {ASEGURADORAS.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
                    </select>
                  </th>
                  <th style={{ padding: '6px 10px' }}><input style={fs} placeholder="Filtrar cliente..." value={fCliente} onChange={e => setFCliente(e.target.value)} /></th>
                  {isAgency && (
                    <th style={{ padding: '6px 10px' }}>
                      <select style={fs} value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
                        <option value="">Todos</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </th>
                  )}
                  <th style={{ padding: '6px 10px' }}>
                    <select style={fs} value={fTipo} onChange={e => setFTipo(e.target.value)}>
                      <option value="">Todos</option><option value="nueva">Nueva</option><option value="renovacion">Renovación</option>
                    </select>
                  </th>
                  <th style={{ padding: '6px 10px' }}><input style={fs} type="number" placeholder="Prima ≥" value={fPrimaMin} onChange={e => setFPrimaMin(e.target.value)} /></th>
                  <th style={{ padding: '6px 10px' }}>
                    <select style={fs} value={fFecha} onChange={e => setFFecha(e.target.value)}>
                      <option value="">Todas</option><option value="pagada">Con pago</option><option value="renueva">Por renovar</option><option value="sin_fecha">Sin fechas</option>
                    </select>
                  </th>
                  <th style={{ padding: '6px 10px' }}>
                    <select style={fs} value={statusFilter.length === 1 ? statusFilter[0] : 'todas'} onChange={e => setStatusFilter(e.target.value === 'todas' ? [] : [e.target.value])}>
                      <option value="todas">{statusFilter.length > 1 ? `${statusFilter.length} estatus` : 'Todas'}</option>
                      {ESTATUS_POLIZA.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </th>
                </tr>
              );
            })()}
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={9} className="empty">Sin pólizas con estos filtros</td></tr>}
            {sorted.map(p => {
              const s = estatusPoliza(p.estatus);
              const a = asegInfo(p.aseguradora);
              const nombreCliente = p.crm_clients?.nombre || '';
              const sinNombre = !nombreCliente || nombreCliente.startsWith('Cartera Prudential') || nombreCliente.startsWith('Cartera Insignia');
              return (
                <tr key={p.id} className="crm-rank-row" onClick={() => setForm({ ...EMPTY, ...p })}>
                  <td><b>{p.plan || '—'}</b>{p.poliza && <><br /><span style={{ fontSize: 11.5, color: C.textMuted }}>{p.poliza}</span></>}</td>
                  <td><span className="badge" style={{ background: a.bg, color: a.color }}>{a.id}</span></td>
                  <td>{sinNombre
                    ? <span style={{ color: C.textLight, fontSize: 12 }} title="La base migrada no trae nombre de cliente — haz clic para capturarlo">✎ Capturar nombre</span>
                    : nombreCliente}</td>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0 14px' }}>
                <div className="field">
                  <label>Cliente *</label>
                  <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, cliente_nombre: '' })}>
                    <option value="">Seleccionar...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Nombre real del cliente {esCartera(clienteActual(form)) ? '(la base migrada no lo trae — captúralo aquí)' : '(editable)'}</label>
                  <input placeholder={esCartera(clienteActual(form)) ? 'Escribe el nombre y guarda' : (clienteActual(form)?.nombre || '')}
                    value={form.cliente_nombre ?? ''} onChange={e => setForm({ ...form, cliente_nombre: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0 14px' }}>
                <div className="field"><label>Aseguradora</label>
                  <select value={form.aseguradora ?? 'PRU'} onChange={e => setForm({ ...form, aseguradora: e.target.value })}>
                    {ASEGURADORAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
                <div className="field"><label>No. de póliza</label><input value={form.poliza ?? ''} onChange={e => setForm({ ...form, poliza: e.target.value })} /></div>
                <div className="field"><label>Plan</label>
                  <select value={form.plan ?? ''} onChange={e => setForm({ ...form, plan: e.target.value })}>
                    {[...new Set([...(products.filter(p => p.aseguradora === (form.aseguradora || 'PRU')).map(p => p.nombre)), ...PLANES, ...(form.plan ? [form.plan] : [])])].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field"><label>Tipo</label><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="nueva">Nueva</option><option value="renovacion">Renovación</option></select></div>
                <div className="field"><label>Prima anual (MXN)</label><input type="number" value={form.prima ?? ''} onChange={e => setForm({ ...form, prima: e.target.value })} /></div>
                <div className="field"><label>Forma de pago</label><select value={form.forma_pago} onChange={e => setForm({ ...form, forma_pago: e.target.value })}>{['anual', 'semestral', 'trimestral', 'mensual'].map(f => <option key={f}>{f}</option>)}</select></div>
                <div className="field"><label>Suma asegurada</label><input type="number" value={form.suma_asegurada ?? ''} onChange={e => setForm({ ...form, suma_asegurada: e.target.value })} /></div>
                <div className="field"><label>Fecha emisión</label><input type="date" value={form.fecha_emision ?? ''} onChange={e => setForm({ ...form, fecha_emision: e.target.value })} /></div>
                <div className="field"><label>Fecha de pago</label><input type="date" value={form.fecha_pago ?? ''} onChange={e => setForm({ ...form, fecha_pago: e.target.value })} /></div>
                <div className="field"><label>Fecha renovación</label><input type="date" value={form.fecha_renovacion ?? ''} onChange={e => setForm({ ...form, fecha_renovacion: e.target.value })} /></div>
                <div className="field"><label>Estatus</label><select value={form.estatus} onChange={e => setForm({ ...form, estatus: e.target.value })}>{ESTATUS_POLIZA.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
              </div>
              {/* ── Beneficiarios (alimentan la agenda de cumpleaños en Recordatorios) ── */}
              {(() => {
                let bens = [];
                try { bens = JSON.parse(form.beneficiarios || '[]'); } catch { bens = []; }
                const setBens = (arr) => setForm({ ...form, beneficiarios: JSON.stringify(arr) });
                return (
                  <div className="config-panel" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                      Beneficiarios ({bens.length}) — sus cumpleaños aparecen en la agenda de Recordatorios
                    </label>
                    {bens.map((b, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.6fr 1.2fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input placeholder="Nombre" value={b.nombre || ''} onChange={e => setBens(bens.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                          style={{ padding: '7px 10px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                        <select value={b.relacion || ''} onChange={e => setBens(bens.map((x, j) => j === i ? { ...x, relacion: e.target.value } : x))}
                          style={{ padding: '7px 8px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }}>
                          <option value="">Relación...</option>
                          {['Esposo/a', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a', 'Otro'].map(r => <option key={r}>{r}</option>)}
                        </select>
                        <input type="number" placeholder="%" title="Porcentaje" value={b.pct ?? ''} onChange={e => setBens(bens.map((x, j) => j === i ? { ...x, pct: e.target.value } : x))}
                          style={{ padding: '7px 8px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                        <input type="date" title="Fecha de nacimiento" value={b.fecha_nacimiento || ''} onChange={e => setBens(bens.map((x, j) => j === i ? { ...x, fecha_nacimiento: e.target.value } : x))}
                          style={{ padding: '7px 8px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                        <button className="crm-icon-btn del" title="Quitar" onClick={() => setBens(bens.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                      </div>
                    ))}
                    <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }}
                      onClick={() => setBens([...bens, { nombre: '', relacion: '', pct: '', fecha_nacimiento: '' }])}>
                      <Plus size={13} /> Agregar beneficiario
                    </button>
                  </div>
                );
              })()}
              <div className="field">
                <label>¿Por qué compró? (motivo original — la herramienta para retener si un día quiere cancelar)</label>
                <textarea rows={2} placeholder='Ej. "Quería un retiro de 4 MDP a los 65" — al querer cancelar, recuérdale su meta.' value={form.motivo_compra ?? ''} onChange={e => setForm({ ...form, motivo_compra: e.target.value })} />
              </div>
              {form.motivo_compra && (
                <div className="info-box" style={{ marginBottom: 12, background: 'rgba(193,151,91,.08)', borderColor: 'rgba(193,151,91,.35)' }}>
                  <p>🛡 <b>Argumento de retención:</b> {form.motivo_compra}</p>
                </div>
              )}
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
