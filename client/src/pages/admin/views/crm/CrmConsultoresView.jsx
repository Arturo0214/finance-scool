/**
 * CrmConsultoresView — Tablero de consultores por aseguradora
 * Cada consultor con sus dos carteras (Prudential migrada e Insignia Life),
 * pólizas vigentes por aseguradora, actividad, última venta y alta real en la
 * promotoría. Incluye pólizas huérfanas (asesores sin actividad), catálogo de
 * productos y la cartera de clientes completa como pestañas.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  Search, RefreshCw, Plus, X, Trash2, Users, ShieldCheck,
  AlertTriangle, Pencil, CheckCircle2, CircleOff, BellRing,
} from 'lucide-react';
import { getCrmCSS, fmtMoney, fmtDate } from './crmShared';
import CrmClientsView from './CrmClientsView';

const ASEG = {
  PRU: { label: 'Prudential', corto: 'PRU', color: '#003DA5', bg: 'rgba(0,61,165,.09)' },
  IL:  { label: 'Insignia Life', corto: 'IL', color: '#0E7C6B', bg: 'rgba(14,124,107,.10)' },
};

/* Clasificación comercial de 3 estados. Los inactivos CON producción conservan
   cartera y SÍ reciben recordatorios de venta — por eso su color propio (ámbar). */
const CLASIF = {
  activo:                  { label: 'Activo',                     corto: 'Activo',        color: C.green,     bg: C.greenBg,            icon: CheckCircle2, hint: 'Produce actualmente' },
  inactivo_con_produccion: { label: 'Inactivo · con producción',  corto: 'Inact. c/prod', color: '#B45309',   bg: 'rgba(180,83,9,.12)', icon: BellRing,     hint: 'Tiene pólizas: mandarle recordatorios de venta' },
  inactivo_sin_produccion: { label: 'Inactivo · sin producción',  corto: 'Inact. s/prod', color: C.textMuted, bg: 'rgba(11,27,51,.08)', icon: CircleOff,    hint: 'Sin cartera: no se le recuerda' },
};
const clasifInfo = (c) => CLASIF[c] || CLASIF.activo;

const mesesSinVenta = (fecha) => {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(`${String(fecha).slice(0, 10)}T12:00:00`)) / (30.44 * 86400000));
};

function AsegBadge({ aseg, activo, fecha }) {
  const a = ASEG[aseg];
  if (!activo) return <span className="badge" style={{ background: 'rgba(11,27,51,.06)', color: C.textLight }}>—</span>;
  return (
    <span className="badge" style={{ background: a.bg, color: a.color }} title={fecha ? `Alta: ${fmtDate(fecha)}` : 'Registrado'}>
      ✓ {a.corto}{fecha ? ` · ${fmtDate(fecha)}` : ''}
    </span>
  );
}

export default function CrmConsultoresView({ isAgency }) {
  // Si el buscador global (⌘K) dejó un cliente pendiente de abrir, entra directo a la cartera
  const [tab, setTab] = useState(() => (sessionStorage.getItem('crm_open_client') ? 'clientes' : 'tablero'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [fAseg, setFAseg] = useState('todas');       // todas | PRU | IL | ambas
  const [fActividad, setFActividad] = useState('todos'); // todos | activos | sin_actividad
  const [fVenta, setFVenta] = useState('');           // '' | 3 | 6 | 12 meses sin vender
  const [detail, setDetail] = useState(null);         // consultor seleccionado
  const [editAgent, setEditAgent] = useState(null);   // patch editable del modal
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newClient, setNewClient] = useState(null);   // { aseguradora } mini-alta

  /* Productos */
  const [products, setProducts] = useState([]);
  const [prodForm, setProdForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api.crmConsultoresOverview();
      setData(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadProducts = useCallback(async () => {
    try { const d = await api.crmGetProducts({ activo: 'todos' }); setProducts(d.products || []); }
    catch (e) { console.error(e); }
  }, []);
  useEffect(() => { if (tab === 'productos') loadProducts(); }, [tab, loadProducts]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const consultores = data?.consultores || [];
  const filtered = consultores.filter(c => {
    if (search && !`${c.nombre} ${c.clave || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (fAseg === 'PRU' && !c.registrado_pru) return false;
    if (fAseg === 'IL' && !c.registrado_il) return false;
    if (fAseg === 'ambas' && !(c.registrado_pru && c.registrado_il)) return false;
    if (fActividad !== 'todos' && (c.clasificacion || 'activo') !== fActividad) return false;
    if (fVenta) {
      const m = mesesSinVenta(c.ultima_venta);
      if (m !== null && m < Number(fVenta)) return false;
    }
    return true;
  });

  const kpis = {
    total: consultores.length,
    activos: consultores.filter(c => (c.clasificacion || 'activo') === 'activo').length,
    inactConProd: consultores.filter(c => c.clasificacion === 'inactivo_con_produccion').length,
    inactSinProd: consultores.filter(c => c.clasificacion === 'inactivo_sin_produccion').length,
    huerfanas: data?.huerfanas?.total || 0,
  };

  const openDetail = (c) => {
    setDetail(c);
    setEditAgent({ alta_pru: c.alta_pru || '', alta_il: c.alta_il || '', clasificacion: c.clasificacion || 'activo' });
    setNewClient(null);
  };

  const saveAgent = async () => {
    setSaving(true);
    try {
      await api.crmUpdateAgent(detail.id, {
        alta_pru: editAgent.alta_pru || null,
        alta_il: editAgent.alta_il || null,
        clasificacion: editAgent.clasificacion,
        activo_fsc: editAgent.clasificacion === 'activo',
      });
      flash('Consultor actualizado ✓'); setDetail(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const togglePermiso = async (c) => {
    try {
      const d = await api.crmSetEditPermission(c.id, !c.puede_editar);
      flash(d.crm_can_edit ? `${c.nombre} ahora puede editar datos` : `${c.nombre} quedó en solo lectura`);
      load();
    } catch (e) { alert(e.message); }
  };

  const createClient = async () => {
    if (!newClient.nombre) return alert('El nombre es requerido');
    setSaving(true);
    try {
      await api.crmCreateClient({
        nombre: newClient.nombre, telefono: newClient.telefono, email: newClient.email,
        agent_id: detail.id, aseguradora: newClient.aseguradora, origen: 'referido',
      });
      flash(`Cliente creado en cartera ${ASEG[newClient.aseguradora].label} ✓`);
      setNewClient(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const saveProduct = async () => {
    if (!prodForm.nombre) return alert('El nombre es requerido');
    setSaving(true);
    try {
      if (prodForm.id) await api.crmUpdateProduct(prodForm.id, prodForm);
      else await api.crmCreateProduct(prodForm);
      setProdForm(null); loadProducts();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (loading && tab === 'tablero') return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando consultores...</p></div></>;

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Consultores</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>Carteras Prudential e Insignia Life por consultor</p>
        </div>
        {tab === 'tablero' && (
          <div className="crm-toolbar-right">
            <div className="crm-search-wrap">
              <Search size={15} />
              <input className="crm-search" placeholder="Buscar consultor o clave..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
          </div>
        )}
      </div>

      {msg && <div className="info-box" style={{ marginBottom: 14 }}><p>{msg}</p></div>}
      {err && <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red, marginBottom: 16 }}><p>{err}</p></div>}

      <div className="crm-detail-tabs">
        <button className={`crm-dtab${tab === 'tablero' ? ' active' : ''}`} onClick={() => setTab('tablero')}>Tablero</button>
        <button className={`crm-dtab${tab === 'clientes' ? ' active' : ''}`} onClick={() => setTab('clientes')}>Cartera de clientes</button>
        <button className={`crm-dtab${tab === 'productos' ? ' active' : ''}`} onClick={() => setTab('productos')}>Productos</button>
      </div>

      {/* ═══════════ TAB CARTERA DE CLIENTES ═══════════ */}
      {tab === 'clientes' && <CrmClientsView isAgency={isAgency} embedded />}

      {/* ═══════════ TAB PRODUCTOS ═══════════ */}
      {tab === 'productos' && (
        <>
          {isAgency && !prodForm && (
            <button className="btn-primary" style={{ marginBottom: 14 }} onClick={() => setProdForm({ aseguradora: 'PRU', nombre: '', tipo: '', moneda: 'MXN', activo: true })}>
              <Plus size={15} /> Nuevo producto
            </button>
          )}
          {prodForm && (
            <div className="config-panel" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>{prodForm.id ? 'Editar producto' : 'Nuevo producto'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0 14px' }}>
                <div className="field"><label>Aseguradora</label>
                  <select value={prodForm.aseguradora} onChange={e => setProdForm({ ...prodForm, aseguradora: e.target.value })}>
                    <option value="PRU">Prudential</option><option value="IL">Insignia Life</option>
                  </select>
                </div>
                <div className="field"><label>Nombre *</label><input value={prodForm.nombre} onChange={e => setProdForm({ ...prodForm, nombre: e.target.value })} /></div>
                <div className="field"><label>Tipo</label><input placeholder="Vida, Retiro, GMM..." value={prodForm.tipo ?? ''} onChange={e => setProdForm({ ...prodForm, tipo: e.target.value })} /></div>
                <div className="field"><label>Moneda</label>
                  <select value={prodForm.moneda ?? 'MXN'} onChange={e => setProdForm({ ...prodForm, moneda: e.target.value })}>
                    <option>MXN</option><option>USD</option><option>UDI</option>
                  </select>
                </div>
                {prodForm.id != null && (
                  <div className="field"><label>Activo</label>
                    <select value={prodForm.activo ? '1' : '0'} onChange={e => setProdForm({ ...prodForm, activo: e.target.value === '1' })}>
                      <option value="1">Sí</option><option value="0">No</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setProdForm(null)}>Cancelar</button>
                <button className="btn-primary" disabled={saving} onClick={saveProduct}>{saving ? '...' : 'Guardar'}</button>
              </div>
            </div>
          )}
          <div className="two-col" style={{ alignItems: 'start' }}>
            {['PRU', 'IL'].map(aseg => (
              <div key={aseg} className="crm-chart-card" style={{ marginBottom: 0 }}>
                <h3><ShieldCheck size={16} style={{ verticalAlign: -2, color: ASEG[aseg].color }} /> {ASEG[aseg].label}</h3>
                <p className="sub">{products.filter(p => p.aseguradora === aseg).length} productos</p>
                {products.filter(p => p.aseguradora === aseg).map(p => (
                  <div key={p.id} className="crm-file-row" style={{ cursor: isAgency ? 'pointer' : 'default', opacity: p.activo ? 1 : 0.5 }}
                    onClick={() => isAgency && setProdForm({ ...p })}>
                    <div style={{ flex: 1 }}>
                      <div className="fname">{p.nombre} {isAgency && <Pencil size={11} style={{ color: C.textLight }} />}</div>
                      <div className="fmeta">{p.tipo || '—'} · {p.moneda}{p.activo ? '' : ' · inactivo'}</div>
                    </div>
                    {isAgency && (
                      <button className="crm-icon-btn del" onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar ${p.nombre}?`)) { await api.crmDeleteProduct(p.id); loadProducts(); }
                      }}><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════════ TAB TABLERO ═══════════ */}
      {tab === 'tablero' && data && (
        <>
          {/* KPIs */}
          <div className="crm-kpi-detail">
            <div className="crm-kpi-box"><div className="k-label"><Users size={12} style={{ verticalAlign: -2 }} /> Consultores</div><div className="k-value">{kpis.total}</div></div>
            <div className="crm-kpi-box"><div className="k-label"><CheckCircle2 size={12} style={{ verticalAlign: -2, color: C.green }} /> Activos</div><div className="k-value" style={{ color: C.green }}>{kpis.activos}</div><div className="k-sub">con producción</div></div>
            <div className="crm-kpi-box"><div className="k-label"><BellRing size={12} style={{ verticalAlign: -2, color: '#B45309' }} /> Inactivos c/producción</div><div className="k-value" style={{ color: '#B45309' }}>{kpis.inactConProd}</div><div className="k-sub">mandarles recordatorio de ventas</div></div>
            <div className="crm-kpi-box"><div className="k-label"><CircleOff size={12} style={{ verticalAlign: -2 }} /> Inactivos s/producción</div><div className="k-value" style={{ color: C.textMuted }}>{kpis.inactSinProd}</div><div className="k-sub">sin cartera, sin recordatorios</div></div>
            <div className="crm-kpi-box"><div className="k-label">Pólizas huérfanas</div><div className="k-value" style={{ color: kpis.huerfanas ? C.amber : C.ink }}>{kpis.huerfanas}</div><div className="k-sub">de consultores inactivos</div></div>
          </div>

          {/* Filtros */}
          <div className="filter-tabs" style={{ marginBottom: 8 }}>
            {[['todas', 'Todos'], ['PRU', 'En PRU'], ['IL', 'En IL'], ['ambas', 'En ambas']].map(([id, label]) => (
              <button key={id} className={`f-tab${fAseg === id ? ' active' : ''}`} onClick={() => setFAseg(id)}>{label}</button>
            ))}
          </div>
          <div className="filter-tabs" style={{ marginBottom: 18, gap: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['todos', 'Todos'],
              ['activo', `Activos (${kpis.activos})`],
              ['inactivo_con_produccion', `Inactivos c/producción (${kpis.inactConProd})`],
              ['inactivo_sin_produccion', `Inactivos s/producción (${kpis.inactSinProd})`],
            ].map(([id, label]) => (
              <button key={id} className={`f-tab${fActividad === id ? ' active' : ''}`} onClick={() => setFActividad(id)}>{label}</button>
            ))}
            <select className="crm-select" style={{ padding: '6px 10px', fontSize: 12.5 }} value={fVenta} onChange={e => setFVenta(e.target.value)}>
              <option value="">Última venta: todas</option>
              <option value="3">Sin vender 3+ meses</option>
              <option value="6">Sin vender 6+ meses</option>
              <option value="12">Sin vender 12+ meses</option>
            </select>
          </div>

          {/* Tabla */}
          <div className="tbl-wrap desktop-only-table" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Consultor</th><th>PRU</th><th>IL</th>
                  <th>Pólizas PRU</th><th>Pólizas IL</th>
                  <th>Estatus</th><th>Última venta</th><th>Alta promotoría</th>
                  {isAgency && <th>Permiso edición</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={9} className="empty">Sin consultores con estos filtros</td></tr>}
                {filtered.map(c => {
                  const meses = mesesSinVenta(c.ultima_venta);
                  const cl = clasifInfo(c.clasificacion);
                  const ClIcon = cl.icon;
                  return (
                    <tr key={c.id} className="crm-rank-row" onClick={() => openDetail(c)}
                      style={c.clasificacion === 'inactivo_con_produccion' ? { background: 'rgba(180,83,9,.045)' } : c.clasificacion === 'inactivo_sin_produccion' ? { opacity: .72 } : undefined}>
                      <td><b>{c.nombre}</b><br /><span style={{ fontSize: 11, color: C.textMuted }}>{c.clave || 'sin clave'} {c.cuaderno ? `· ${c.cuaderno}` : ''}</span></td>
                      <td><AsegBadge aseg="PRU" activo={c.registrado_pru} fecha={c.alta_pru} /></td>
                      <td><AsegBadge aseg="IL" activo={c.registrado_il} fecha={c.alta_il} /></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}><b>{c.polizas.pru.vigentes}</b> <span style={{ fontSize: 11, color: C.textMuted }}>vigentes de {c.polizas.pru.total}</span></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}><b>{c.polizas.il.vigentes}</b> <span style={{ fontSize: 11, color: C.textMuted }}>vigentes de {c.polizas.il.total}</span></td>
                      <td>
                        <span className="badge" style={{ background: cl.bg, color: cl.color }} title={cl.hint}>
                          <ClIcon size={10} style={{ verticalAlign: -1 }} /> {cl.label}
                        </span>
                        {c.clasificacion === 'inactivo_con_produccion' && <div style={{ fontSize: 10, color: '#B45309', marginTop: 2, fontWeight: 700 }}>→ recordarle ventas</div>}
                        {c.estatus_pru && /INACTIVO/i.test(c.estatus_pru) && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>PRU: sin ventas nuevas</div>}
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {c.ultima_venta ? fmtDate(c.ultima_venta) : '—'}
                        {meses != null && meses >= 3 && <div style={{ fontSize: 10.5, color: meses >= 6 ? C.red : C.amber }}>hace {meses} meses</div>}
                      </td>
                      <td style={{ fontSize: 12.5, color: C.textMuted }}>{fmtDate(c.alta_pru)}</td>
                      {isAgency && (
                        <td onClick={e => e.stopPropagation()}>
                          {c.tiene_usuario ? (
                            <button className={`f-tab${c.puede_editar ? ' active' : ''}`} style={{ fontSize: 11 }} title="Solo el admin decide quién edita datos"
                              onClick={() => togglePermiso(c)}>
                              {c.puede_editar ? '✓ Puede editar' : 'Solo lectura'}
                            </button>
                          ) : <span style={{ fontSize: 11, color: C.textLight }}>sin usuario</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="mobile-only-cards" style={{ flexDirection: 'column' }}>
            {filtered.map(c => (
              <div key={c.id} className="crm-mobile-card" onClick={() => openDetail(c)}>
                <div className="crm-mc-top">
                  <div className="crm-mc-name">{c.nombre}</div>
                  <span className="badge" style={{ background: clasifInfo(c.clasificacion).bg, color: clasifInfo(c.clasificacion).color }}>
                    {clasifInfo(c.clasificacion).corto}
                  </span>
                </div>
                <div className="crm-mc-row"><span>Carteras</span><b><AsegBadge aseg="PRU" activo={c.registrado_pru} /> <AsegBadge aseg="IL" activo={c.registrado_il} /></b></div>
                <div className="crm-mc-row"><span>Pólizas vigentes</span><b>PRU {c.polizas.pru.vigentes} · IL {c.polizas.il.vigentes}</b></div>
                <div className="crm-mc-row"><span>Última venta</span><b>{c.ultima_venta ? fmtDate(c.ultima_venta) : '—'}</b></div>
              </div>
            ))}
          </div>

          {/* Pólizas huérfanas */}
          {(data.huerfanas?.detalle || []).length > 0 && (
            <div className="crm-chart-card">
              <h3><AlertTriangle size={16} style={{ verticalAlign: -2, color: C.amber }} /> Pólizas huérfanas — consultores sin actividad</h3>
              <p className="sub">Cartera vigente en manos de consultores que ya no operan en FSC. Reasígnalas o toma una decisión con cada uno.</p>
              {data.huerfanas.detalle.map(d => (
                <div key={d.agent_id} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '8px 0' }}>
                  <span><b>{d.nombre}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{d.clave} · última venta {d.ultima_venta ? fmtDate(d.ultima_venta) : 'sin registro'}</span></span>
                  <b>{d.polizas} pólizas · {fmtMoney(d.prima)}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ Modal del consultor ══ */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{detail.nombre}</h2>
                <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3 }}>
                  {detail.clave || 'sin clave'} · alta en promotoría {fmtDate(detail.alta_pru)}
                  {detail.ultima_venta && <> · última venta {fmtDate(detail.ultima_venta)}</>}
                </div>
              </div>
              <button className="close-btn" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {/* Carteras */}
              <div className="two-col" style={{ marginBottom: 16, alignItems: 'stretch' }}>
                {['PRU', 'IL'].map(aseg => {
                  const p = detail.polizas[aseg.toLowerCase()];
                  const registrado = aseg === 'PRU' ? detail.registrado_pru : detail.registrado_il;
                  return (
                    <div key={aseg} className="crm-chart-card" style={{ marginBottom: 0, borderTop: `3px solid ${ASEG[aseg].color}` }}>
                      <h3 style={{ fontSize: 15 }}>{ASEG[aseg].label}</h3>
                      {registrado ? (
                        <>
                          <p className="sub" style={{ marginBottom: 8 }}>
                            {p.vigentes} pólizas vigentes · {p.total} en total
                            {aseg === 'IL' && ` · ${p.clientes} clientes`}
                          </p>
                          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12.5 }}
                            onClick={() => setNewClient({ aseguradora: aseg, nombre: '', telefono: '', email: '' })}>
                            <Plus size={13} /> Nuevo cliente {ASEG[aseg].corto}
                          </button>
                        </>
                      ) : (
                        <p className="sub">Sin alta en {ASEG[aseg].label}.{isAgency && aseg === 'IL' ? ' Captura la fecha de alta abajo para registrarlo.' : ''}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mini-alta de cliente */}
              {newClient && (
                <div className="config-panel" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Nuevo cliente — cartera {ASEG[newClient.aseguradora].label}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0 14px' }}>
                    <div className="field"><label>Nombre *</label><input value={newClient.nombre} onChange={e => setNewClient({ ...newClient, nombre: e.target.value })} /></div>
                    <div className="field"><label>Teléfono</label><input value={newClient.telefono} onChange={e => setNewClient({ ...newClient, telefono: e.target.value })} /></div>
                    <div className="field"><label>Correo</label><input value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setNewClient(null)}>Cancelar</button>
                    <button className="btn-primary" disabled={saving} onClick={createClient}>{saving ? '...' : 'Crear cliente'}</button>
                  </div>
                </div>
              )}

              {/* Datos del consultor (solo admin) */}
              {isAgency && editAgent && (
                <div className="config-panel">
                  <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Registro y actividad</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0 14px' }}>
                    <div className="field"><label>Alta Prudential</label>
                      <input type="date" value={editAgent.alta_pru || ''} onChange={e => setEditAgent({ ...editAgent, alta_pru: e.target.value })} />
                    </div>
                    <div className="field"><label>Alta Insignia Life</label>
                      <input type="date" value={editAgent.alta_il || ''} onChange={e => setEditAgent({ ...editAgent, alta_il: e.target.value })} />
                    </div>
                    <div className="field"><label>Clasificación</label>
                      <select value={editAgent.clasificacion} onChange={e => setEditAgent({ ...editAgent, clasificacion: e.target.value })}>
                        <option value="activo">Activo (con producción)</option>
                        <option value="inactivo_con_produccion">Inactivo con producción — recordarle ventas</option>
                        <option value="inactivo_sin_produccion">Inactivo sin producción</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-primary" disabled={saving} onClick={saveAgent}>{saving ? 'Guardando...' : 'Guardar'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
