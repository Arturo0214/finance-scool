/**
 * CrmClientsView — Cartera de clientes del CRM
 * Lista con filtros por etapa/asesor/búsqueda + expediente por cliente:
 * datos, pólizas, archivos (Cloudinary) y recordatorios.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Search, Plus, X, Trash2, Upload, FileText, ExternalLink, Phone, Mail, Pencil } from 'lucide-react';
import {
  getCrmCSS, ETAPAS, etapaInfo, estatusPoliza, ESTATUS_POLIZA, PLANES,
  TIPOS_RECORDATORIO, tipoRecordatorio, fmtMoney, fmtDate,
} from './crmShared';

const EMPTY_CLIENT = { nombre: '', email: '', telefono: '', rfc: '', fecha_nacimiento: '', ocupacion: '', empresa: '', direccion: '', etapa: 'prospecto', origen: 'referido', notas: '', agent_id: '' };
const EMPTY_POLICY = { poliza: '', plan: PLANES[0], tipo: 'nueva', prima: '', forma_pago: 'anual', suma_asegurada: '', fecha_emision: '', fecha_pago: '', fecha_renovacion: '', estatus: 'en_tramite', notas: '' };
const EMPTY_REMINDER = { titulo: '', descripcion: '', tipo: 'seguimiento', fecha: '', hora: '' };
const CATEGORIAS_ARCHIVO = ['general', 'identificacion', 'solicitud', 'poliza', 'comprobante'];

export default function CrmClientsView({ isAgency }) {
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etapaFilter, setEtapaFilter] = useState('todas');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState('');

  /* Expediente */
  const [detail, setDetail] = useState(null); // { client, policies, reminders, files }
  const [tab, setTab] = useState('info');
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  /* Alta de cliente */
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_CLIENT);

  /* Sub-formularios del expediente */
  const [policyForm, setPolicyForm] = useState(null);
  const [reminderForm, setReminderForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileCategoria, setFileCategoria] = useState('general');
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([api.crmGetClients(), api.crmGetAgents()]);
      setClients(c.clients || []);
      setAgents(a.agents || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const openDetail = async (id) => {
    try {
      const d = await api.crmGetClient(id);
      setDetail(d); setEditForm({ ...EMPTY_CLIENT, ...d.client }); setTab('info');
      setPolicyForm(null); setReminderForm(null);
    } catch (e) { console.error(e); }
  };
  const refreshDetail = async () => { if (detail) openDetail(detail.client.id); };

  const saveClient = async () => {
    setSaving(true);
    try {
      await api.crmUpdateClient(detail.client.id, editForm);
      flash('Cliente actualizado ✓'); load(); refreshDetail();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const createClient = async () => {
    if (!newForm.nombre) return alert('El nombre es requerido');
    if (isAgency && !newForm.agent_id) return alert('Selecciona un asesor');
    setSaving(true);
    try {
      await api.crmCreateClient(newForm);
      setShowNew(false); setNewForm(EMPTY_CLIENT); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const deleteClient = async () => {
    if (!confirm(`¿Eliminar a ${detail.client.nombre}? Se borran sus pólizas, archivos y recordatorios.`)) return;
    try { await api.crmDeleteClient(detail.client.id); setDetail(null); load(); }
    catch (e) { alert(e.message); }
  };

  const savePolicy = async () => {
    setSaving(true);
    try {
      const body = { ...policyForm, client_id: detail.client.id, prima: Number(policyForm.prima) || 0, suma_asegurada: Number(policyForm.suma_asegurada) || null };
      if (policyForm.id) await api.crmUpdatePolicy(policyForm.id, body);
      else await api.crmCreatePolicy(body);
      setPolicyForm(null); refreshDetail();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const saveReminder = async () => {
    if (!reminderForm.titulo || !reminderForm.fecha) return alert('Título y fecha son requeridos');
    setSaving(true);
    try {
      const body = { ...reminderForm, client_id: detail.client.id, agent_id: detail.client.agent_id };
      if (reminderForm.id) await api.crmUpdateReminder(reminderForm.id, body);
      else await api.crmCreateReminder(body);
      setReminderForm(null); refreshDetail();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await api.crmUploadFile(file, { client_id: detail.client.id, categoria: fileCategoria });
      flash('Archivo subido ✓'); refreshDetail();
    } catch (e) { alert(e.message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const filtered = clients.filter(c => {
    if (etapaFilter !== 'todas' && c.etapa !== etapaFilter) return false;
    if (agentFilter && String(c.agent_id) !== agentFilter) return false;
    if (search && !c.nombre.toLowerCase().includes(search.toLowerCase()) && !(c.telefono || '').includes(search)) return false;
    return true;
  });

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando clientes...</p></div></>;

  const inputRow = (form, setForm, fields) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0 14px' }}>
      {fields.map(f => (
        <div className="field" key={f.key}>
          <label>{f.label}</label>
          {f.type === 'select' ? (
            <select value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
              {f.options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea rows={2} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          ) : (
            <input type={f.type || 'text'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
    </div>
  );

  const clientFields = [
    { key: 'nombre', label: 'Nombre completo *' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Correo', type: 'email' },
    { key: 'rfc', label: 'RFC' },
    { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' },
    { key: 'ocupacion', label: 'Ocupación' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'etapa', label: 'Etapa', type: 'select', options: ETAPAS.map(e => ({ value: e.id, label: e.label })) },
    { key: 'origen', label: 'Origen', type: 'select', options: ['referido', 'frio', 'campania', 'evento', 'otro'] },
  ];

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Clientes</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>{filtered.length} de {clients.length} en cartera</p>
        </div>
        <div className="crm-toolbar-right">
          <div className="crm-search-wrap">
            <Search size={15} />
            <input className="crm-search" placeholder="Buscar por nombre o teléfono..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="">Todos los asesores</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={() => { setNewForm({ ...EMPTY_CLIENT, agent_id: agents[0]?.id || '' }); setShowNew(true); }}>
            <Plus size={16} /> Nuevo cliente
          </button>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 18 }}>
        <button className={`f-tab${etapaFilter === 'todas' ? ' active' : ''}`} onClick={() => setEtapaFilter('todas')}>Todas</button>
        {ETAPAS.map(e => (
          <button key={e.id} className={`f-tab${etapaFilter === e.id ? ' active' : ''}`} onClick={() => setEtapaFilter(e.id)}>
            {e.label} ({clients.filter(c => c.etapa === e.id).length})
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="tbl-wrap desktop-only-table">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Contacto</th><th>Etapa</th><th>Origen</th>{isAgency && <th>Asesor</th>}<th>Alta</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="empty">Sin clientes con estos filtros</td></tr>}
            {filtered.map(c => {
              const e = etapaInfo(c.etapa);
              return (
                <tr key={c.id} className="crm-rank-row" onClick={() => openDetail(c.id)}>
                  <td><b>{c.nombre}</b>{c.ocupacion && <><br /><span style={{ fontSize: 11.5, color: C.textMuted }}>{c.ocupacion}{c.empresa ? ` · ${c.empresa}` : ''}</span></>}</td>
                  <td style={{ fontSize: 12.5 }}>{c.telefono || '—'}<br /><span style={{ color: C.textMuted }}>{c.email || ''}</span></td>
                  <td><span className="badge" style={{ background: `${e.color}1A`, color: e.color }}>{e.label}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{c.origen || '—'}</td>
                  {isAgency && <td style={{ fontSize: 12.5 }}>{c.crm_agents?.nombre || '—'}</td>}
                  <td style={{ fontSize: 12.5, color: C.textMuted }}>{fmtDate(c.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mobile-only-cards" style={{ flexDirection: 'column' }}>
        {filtered.length === 0 && <p className="empty">Sin clientes con estos filtros</p>}
        {filtered.map(c => {
          const e = etapaInfo(c.etapa);
          return (
            <div key={c.id} className="crm-mobile-card" onClick={() => openDetail(c.id)}>
              <div className="crm-mc-top">
                <div className="crm-mc-name">{c.nombre}</div>
                <span className="badge" style={{ background: `${e.color}1A`, color: e.color }}>{e.label}</span>
              </div>
              {c.telefono && <div className="crm-mc-row"><span><Phone size={11} style={{ marginRight: 4 }} />{c.telefono}</span></div>}
              {isAgency && c.crm_agents?.nombre && <div className="crm-mc-row"><span>Asesor</span><b>{c.crm_agents.nombre}</b></div>}
            </div>
          );
        })}
      </div>

      {/* ══ Modal alta de cliente ══ */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h2>Nuevo cliente</h2><button className="close-btn" onClick={() => setShowNew(false)}><X size={20} /></button></div>
            <div className="modal-body">
              {isAgency && (
                <div className="field">
                  <label>Asesor *</label>
                  <select value={newForm.agent_id} onChange={e => setNewForm({ ...newForm, agent_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.clave})</option>)}
                  </select>
                </div>
              )}
              {inputRow(newForm, setNewForm, clientFields)}
              <div className="field"><label>Notas</label><textarea rows={2} value={newForm.notas} onChange={e => setNewForm({ ...newForm, notas: e.target.value })} /></div>
            </div>
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={createClient}>{saving ? 'Guardando...' : 'Crear cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Expediente del cliente ══ */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{detail.client.nombre}</h2>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12.5, color: C.textMuted, flexWrap: 'wrap' }}>
                  {detail.client.telefono && <a href={`https://wa.me/${detail.client.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>WhatsApp ↗</a>}
                  {detail.client.email && <a href={`mailto:${detail.client.email}`} style={{ color: C.primary, textDecoration: 'none' }}><Mail size={11} style={{ marginRight: 3 }} />{detail.client.email}</a>}
                </div>
              </div>
              <button className="close-btn" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {msg && <div className="info-box" style={{ marginBottom: 14 }}><p>{msg}</p></div>}

              <div className="crm-detail-tabs">
                {[['info', 'Información'], ['polizas', `Pólizas (${detail.policies.length})`], ['archivos', `Archivos (${detail.files.length})`], ['recordatorios', `Recordatorios (${detail.reminders.length})`]].map(([id, label]) => (
                  <button key={id} className={`crm-dtab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>

              {/* ── Tab: Información ── */}
              {tab === 'info' && editForm && (
                <>
                  {inputRow(editForm, setEditForm, clientFields)}
                  <div className="field"><label>Notas</label><textarea rows={3} value={editForm.notas ?? ''} onChange={e => setEditForm({ ...editForm, notas: e.target.value })} /></div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button className="btn-secondary" style={{ color: C.red, borderColor: `${C.red}40` }} onClick={deleteClient}><Trash2 size={14} style={{ marginRight: 5 }} />Eliminar</button>
                    <button className="btn-primary" disabled={saving} onClick={saveClient}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
                  </div>
                </>
              )}

              {/* ── Tab: Pólizas ── */}
              {tab === 'polizas' && (
                <>
                  {!policyForm && (
                    <button className="btn-primary" style={{ marginBottom: 14 }} onClick={() => setPolicyForm({ ...EMPTY_POLICY })}><Plus size={15} /> Agregar póliza</button>
                  )}
                  {policyForm && (
                    <div className="config-panel" style={{ marginBottom: 16 }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>{policyForm.id ? 'Editar póliza' : 'Nueva póliza'}</h3>
                      {inputRow(policyForm, setPolicyForm, [
                        { key: 'poliza', label: 'No. de póliza' },
                        { key: 'plan', label: 'Plan', type: 'select', options: PLANES },
                        { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'nueva', label: 'Nueva' }, { value: 'renovacion', label: 'Renovación' }] },
                        { key: 'prima', label: 'Prima anual (MXN)', type: 'number' },
                        { key: 'forma_pago', label: 'Forma de pago', type: 'select', options: ['anual', 'semestral', 'trimestral', 'mensual'] },
                        { key: 'suma_asegurada', label: 'Suma asegurada', type: 'number' },
                        { key: 'fecha_emision', label: 'Fecha emisión', type: 'date' },
                        { key: 'fecha_pago', label: 'Fecha de pago', type: 'date' },
                        { key: 'fecha_renovacion', label: 'Fecha renovación', type: 'date' },
                        { key: 'estatus', label: 'Estatus', type: 'select', options: ESTATUS_POLIZA.map(s => ({ value: s.id, label: s.label })) },
                      ])}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={() => setPolicyForm(null)}>Cancelar</button>
                        <button className="btn-primary" disabled={saving} onClick={savePolicy}>{saving ? '...' : 'Guardar'}</button>
                      </div>
                    </div>
                  )}
                  {detail.policies.length === 0 && !policyForm && <p className="empty">Sin pólizas registradas</p>}
                  {detail.policies.map(p => {
                    const s = estatusPoliza(p.estatus);
                    return (
                      <div key={p.id} className="crm-file-row" style={{ cursor: 'pointer' }} onClick={() => setPolicyForm({ ...EMPTY_POLICY, ...p })}>
                        <div style={{ flex: 1 }}>
                          <div className="fname">{p.plan} {p.poliza ? `· ${p.poliza}` : ''} <Pencil size={11} style={{ color: C.textLight }} /></div>
                          <div className="fmeta">
                            {p.tipo === 'renovacion' ? 'Renovación' : 'Nueva'} · Prima {fmtMoney(p.prima)}
                            {p.fecha_pago ? ` · Pagada ${fmtDate(p.fecha_pago)}` : p.fecha_renovacion ? ` · Renueva ${fmtDate(p.fecha_renovacion)}` : ''}
                          </div>
                        </div>
                        <span className="badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── Tab: Archivos ── */}
              {tab === 'archivos' && (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="crm-select" value={fileCategoria} onChange={e => setFileCategoria(e.target.value)}>
                      {CATEGORIAS_ARCHIVO.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div
                    className="crm-upload-zone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
                    onDragLeave={e => e.currentTarget.classList.remove('drag')}
                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag'); uploadFile(e.dataTransfer.files[0]); }}
                  >
                    <Upload size={22} style={{ marginBottom: 6 }} />
                    <div>{uploading ? 'Subiendo...' : 'Arrastra un archivo o haz clic (PDF, imagen, Excel — máx 15MB)'}</div>
                  </div>
                  <input ref={fileInputRef} type="file" hidden onChange={e => uploadFile(e.target.files[0])} />
                  {detail.files.length === 0 && <p className="empty">Sin archivos en el expediente</p>}
                  {detail.files.map(f => (
                    <div key={f.id} className="crm-file-row">
                      <FileText size={18} style={{ color: C.primary, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="fname">{f.nombre}</div>
                        <div className="fmeta" style={{ textTransform: 'capitalize' }}>{f.categoria} · {f.bytes ? `${(f.bytes / 1024).toFixed(0)} KB · ` : ''}{fmtDate(f.created_at)}</div>
                      </div>
                      <a className="crm-icon-btn" href={f.url} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={14} /></a>
                      <button className="crm-icon-btn del" title="Eliminar" onClick={async () => { if (confirm('¿Eliminar archivo?')) { await api.crmDeleteFile(f.id); refreshDetail(); } }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </>
              )}

              {/* ── Tab: Recordatorios ── */}
              {tab === 'recordatorios' && (
                <>
                  {!reminderForm && (
                    <button className="btn-primary" style={{ marginBottom: 14 }} onClick={() => setReminderForm({ ...EMPTY_REMINDER })}><Plus size={15} /> Nuevo recordatorio</button>
                  )}
                  {reminderForm && (
                    <div className="config-panel" style={{ marginBottom: 16 }}>
                      {inputRow(reminderForm, setReminderForm, [
                        { key: 'titulo', label: 'Título *' },
                        { key: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_RECORDATORIO.map(t => ({ value: t.id, label: `${t.emoji} ${t.label}` })) },
                        { key: 'fecha', label: 'Fecha *', type: 'date' },
                        { key: 'hora', label: 'Hora', type: 'time' },
                      ])}
                      <div className="field"><label>Descripción</label><textarea rows={2} value={reminderForm.descripcion ?? ''} onChange={e => setReminderForm({ ...reminderForm, descripcion: e.target.value })} /></div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={() => setReminderForm(null)}>Cancelar</button>
                        <button className="btn-primary" disabled={saving} onClick={saveReminder}>{saving ? '...' : 'Guardar'}</button>
                      </div>
                    </div>
                  )}
                  {detail.reminders.length === 0 && !reminderForm && <p className="empty">Sin recordatorios para este cliente</p>}
                  {detail.reminders.map(r => {
                    const t = tipoRecordatorio(r.tipo);
                    return (
                      <div key={r.id} className={`crm-rem-card${r.estatus === 'completado' ? ' done' : ''}`}>
                        <div className="crm-rem-emoji" style={{ background: `${t.color}18` }}>{t.emoji}</div>
                        <div className="crm-rem-body">
                          <p className="crm-rem-title">{r.titulo}</p>
                          {r.descripcion && <p className="crm-rem-desc">{r.descripcion}</p>}
                          <div className="crm-rem-meta"><span>{fmtDate(r.fecha)}{r.hora ? ` · ${String(r.hora).slice(0, 5)}` : ''}</span></div>
                        </div>
                        <div className="crm-rem-actions">
                          {r.estatus !== 'completado' && (
                            <button className="crm-icon-btn ok" title="Completar" onClick={async () => { await api.crmUpdateReminder(r.id, { estatus: 'completado' }); refreshDetail(); }}>✓</button>
                          )}
                          <button className="crm-icon-btn del" title="Eliminar" onClick={async () => { await api.crmDeleteReminder(r.id); refreshDetail(); }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
