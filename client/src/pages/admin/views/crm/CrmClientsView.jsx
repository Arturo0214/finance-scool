/**
 * CrmClientsView — Cartera de clientes del CRM
 * Lista con filtros por etapa/asesor/búsqueda + expediente por cliente:
 * datos, pólizas, archivos (Cloudinary) y recordatorios.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Search, Plus, X, Trash2, Upload, FileText, ExternalLink, Phone, Mail, Pencil, Link2, Sparkles, StickyNote, CheckSquare, History } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip } from 'recharts';
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

  /* Timeline, notas/tareas, portal y copiloto */
  const [timeline, setTimeline] = useState(null);
  const [notes, setNotes] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteTipo, setNoteTipo] = useState('nota');
  const [noteDue, setNoteDue] = useState('');
  const [portalBusy, setPortalBusy] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotQ, setCopilotQ] = useState('');
  const [copilotR, setCopilotR] = useState('');
  const [consultaTxt, setConsultaTxt] = useState('');
  const [extractBusy, setExtractBusy] = useState(false);
  const [ffKey, setFfKey] = useState('');

  const loadTimeline = async (cid) => { try { const d = await api.crmGetTimeline(cid); setTimeline(d.timeline); } catch (e) { console.error(e); } };
  const loadNotes = async (cid) => { try { const d = await api.crmGetNotes(cid); setNotes(d.notes); } catch (e) { console.error(e); } };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.crmCreateNote({ client_id: detail.client.id, tipo: noteTipo, texto: noteText.trim(), due_date: noteTipo === 'tarea' ? (noteDue || null) : null });
      setNoteText(''); setNoteDue('');
      loadNotes(detail.client.id);
    } catch (e) { alert(e.message); }
  };

  const sharePortal = async () => {
    setPortalBusy(true);
    try {
      const { url } = await api.crmPortalLink(detail.client.id);
      await navigator.clipboard.writeText(url).catch(() => {});
      const tel = (detail.client.telefono || '').replace(/\D/g, '');
      const waText = encodeURIComponent(`Hola ${detail.client.nombre.split(' ')[0]}, aquí puedes consultar tus pólizas y documentos con Finance SCool (enlace válido 30 días): ${url}`);
      flash('🔗 Enlace del portal copiado al portapapeles (válido 30 días)');
      if (tel && window.confirm('Enlace copiado. ¿Enviarlo también por WhatsApp al cliente?')) {
        window.open(`https://wa.me/${tel}?text=${waText}`, '_blank');
      }
    } catch (e) { alert(e.message); }
    finally { setPortalBusy(false); }
  };

  const askCopilot = async (pregunta) => {
    setCopilotBusy(true); setCopilotR('');
    try { const d = await api.crmCopilot(detail.client.id, pregunta); setCopilotR(d.respuesta); }
    catch (e) { setCopilotR('⚠️ ' + e.message); }
    finally { setCopilotBusy(false); }
  };

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

  // Deep-link desde el buscador global ⌘K
  useEffect(() => {
    const id = sessionStorage.getItem('crm_open_client');
    if (id && !loading) { sessionStorage.removeItem('crm_open_client'); openDetail(Number(id)); }
  }, [loading]); // eslint-disable-line

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const openDetail = async (id) => {
    try {
      const d = await api.crmGetClient(id);
      setDetail(d); setEditForm({ ...EMPTY_CLIENT, ...d.client }); setTab('info');
      setPolicyForm(null); setReminderForm(null);
      setTimeline(null); setNotes(null); setCopilotOpen(false); setCopilotR(''); setCopilotQ('');
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

      {/* Estado vacío para cartera nueva */}
      {clients.length === 0 && (
        <div className="crm-chart-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
          <h3 style={{ marginBottom: 6 }}>Tu cartera empieza aquí</h3>
          <p className="sub" style={{ maxWidth: 420, margin: '0 auto 18px' }}>
            Registra a tu primer prospecto y el CRM te acompaña con su expediente, pipeline, recordatorios y cotizaciones.
          </p>
          <button className="btn-primary" onClick={() => { setNewForm({ ...EMPTY_CLIENT, agent_id: agents[0]?.id || '' }); setShowNew(true); }}>
            <Plus size={16} /> Crear mi primer cliente
          </button>
        </div>
      )}

      {/* Desktop table */}
      {clients.length > 0 && (
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
      )}

      {/* Mobile cards */}
      {clients.length > 0 && (
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
      )}

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
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12.5, color: C.textMuted, flexWrap: 'wrap', alignItems: 'center' }}>
                  {detail.client.telefono && <a href={`https://wa.me/${detail.client.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>WhatsApp ↗</a>}
                  {detail.client.email && <a href={`mailto:${detail.client.email}`} style={{ color: C.primary, textDecoration: 'none' }}><Mail size={11} style={{ marginRight: 3 }} />{detail.client.email}</a>}
                  <button className="btn-secondary" disabled={portalBusy} onClick={sharePortal} title="Generar enlace del portal del cliente (30 días)"
                    style={{ padding: '3px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Link2 size={12} /> {portalBusy ? '...' : 'Portal del cliente'}
                  </button>
                  <button className="btn-secondary" onClick={() => setCopilotOpen(o => !o)} title="Copiloto IA"
                    style={{ padding: '3px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4, color: copilotOpen ? '#8B5CF6' : undefined, borderColor: copilotOpen ? '#8B5CF680' : undefined }}>
                    <Sparkles size={12} /> Copiloto
                  </button>
                </div>
              </div>
              <button className="close-btn" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {msg && <div className="info-box" style={{ marginBottom: 14 }}><p>{msg}</p></div>}

              {/* ── Copiloto IA ── */}
              {copilotOpen && (
                <div className="config-panel" style={{ marginBottom: 16, border: '1px solid #8B5CF640', background: 'linear-gradient(180deg,#FBFAFF,#F6F4FD)' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <button className="f-tab" disabled={copilotBusy} onClick={() => askCopilot('Prepárame para mi siguiente llamada o reunión con este cliente.')}>📞 Preparar llamada</button>
                    <button className="f-tab" disabled={copilotBusy} onClick={() => askCopilot('¿Cuál es la siguiente mejor acción con este cliente y por qué?')}>🎯 Siguiente acción</button>
                    <button className="f-tab" disabled={copilotBusy} onClick={() => askCopilot('Redáctame un mensaje corto de WhatsApp para dar seguimiento a este cliente, cálido y profesional.')}>💬 Redactar seguimiento</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="crm-search" style={{ flex: 1, minWidth: 0, paddingLeft: 13 }} placeholder="O pregúntale algo sobre este cliente..." value={copilotQ}
                      onChange={e => setCopilotQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && copilotQ.trim()) askCopilot(copilotQ.trim()); }} />
                    <button className="btn-primary" disabled={copilotBusy || !copilotQ.trim()} onClick={() => askCopilot(copilotQ.trim())}><Sparkles size={14} /></button>
                  </div>
                  {copilotBusy && <p style={{ fontSize: 12.5, color: '#8B5CF6', margin: '10px 0 0' }}>Pensando...</p>}
                  {copilotR && <div style={{ marginTop: 12, fontSize: 13, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.55, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>{copilotR}</div>}
                </div>
              )}

              <div className="crm-detail-tabs">
                {[['info', 'Información'], ['consulta', '🎯 Consultoría'], ['timeline', 'Timeline'], ['notas', 'Notas & Tareas'], ['polizas', `Pólizas (${detail.policies.length})`], ['archivos', `Archivos (${detail.files.length})`], ['recordatorios', `Recordatorios (${detail.reminders.length})`]].map(([id, label]) => (
                  <button key={id} className={`crm-dtab${tab === id ? ' active' : ''}`}
                    onClick={() => {
                      setTab(id);
                      if (id === 'timeline' && !timeline) loadTimeline(detail.client.id);
                      if (id === 'notas' && !notes) loadNotes(detail.client.id);
                    }}>{label}</button>
                ))}
              </div>

              {/* ── Tab: Consultoría ── */}
              {tab === 'consulta' && editForm && (() => {
                const n = (v) => Number(v) || 0;
                const ingreso = n(editForm.ingreso_mensual), gasto = n(editForm.gasto_mensual);
                const ahorro = Math.max(ingreso - gasto, 0);
                const edad = editForm.fecha_nacimiento ? Math.floor((Date.now() - new Date(editForm.fecha_nacimiento)) / 31557600000) : null;
                const pieData = ingreso > 0 ? [
                  { name: 'Gasto mensual', value: Math.min(gasto, ingreso), color: C.amber },
                  { name: 'Capacidad de ahorro', value: ahorro, color: C.green },
                ] : [];
                const numField = (k, label) => (
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>{label}</label>
                    <input type="number" value={editForm[k] ?? ''} onChange={e => setEditForm({ ...editForm, [k]: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                );
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0 14px' }}>
                      {numField('ingreso_mensual', 'Ingreso mensual (MXN)')}
                      {numField('gasto_mensual', 'Gasto mensual (MXN)')}
                      {numField('saldo_afore', 'Saldo en Afore')}
                      {numField('retiro_deseado', 'Retiro mensual deseado')}
                      {numField('edad_retiro_deseada', 'Edad de retiro deseada')}
                      <div className="field" style={{ marginBottom: 12 }}>
                        <label>Edad actual</label>
                        <input value={edad != null ? `${edad} años (nació ${fmtDate(editForm.fecha_nacimiento)})` : 'Captura fecha de nacimiento en Información'} disabled />
                      </div>
                    </div>

                    {ingreso > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: '#FBFCFD', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                        <ResponsiveContainer width={130} height={130}>
                          <PieChart>
                            <Pie data={pieData} dataKey="value" innerRadius={38} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                              {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
                            </Pie>
                            <ReTooltip formatter={(v, nm) => [fmtMoney(v), nm]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex: 1, minWidth: 180, fontSize: 13 }}>
                          <div style={{ padding: '3px 0' }}>💰 Capacidad de ahorro: <b style={{ color: C.green }}>{fmtMoney(ahorro)}/mes</b> ({ingreso > 0 ? Math.round(ahorro / ingreso * 100) : 0}% del ingreso)</div>
                          {n(editForm.retiro_deseado) > 0 && <div style={{ padding: '3px 0' }}>🎯 Desea retirarse con <b>{fmtMoney(editForm.retiro_deseado)}/mes</b>{n(editForm.edad_retiro_deseada) ? ` a los ${editForm.edad_retiro_deseada}` : ''}</div>}
                          {n(editForm.saldo_afore) > 0 && <div style={{ padding: '3px 0' }}>🏦 Afore actual: <b>{fmtMoney(editForm.saldo_afore)}</b></div>}
                          <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => {
                            sessionStorage.setItem('ppr_prefill', JSON.stringify({
                              nombre: detail.client.nombre, edad: edad || 35,
                              edadRetiro: n(editForm.edad_retiro_deseada) || 65,
                              aportMensual: ahorro > 0 ? Math.round(ahorro / 2 / 100) * 100 : 5000,
                              ingresoAnual: ingreso * 12,
                            }));
                            window.location.href = '/admin/crm-cotizador';
                          }}>📊 Cotizar PPR con estos datos</button>
                        </div>
                      </div>
                    )}

                    <div className="config-panel" style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>🎙 Transcripción de la consultoría</label>
                      <p style={{ fontSize: 11.5, color: C.textMuted, margin: '0 0 8px' }}>Pega la transcripción (Fireflies u otra) y la IA llena los campos. Revisa y guarda.</p>
                      <textarea rows={3} style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}
                        placeholder="Pega aquí la conversación transcrita..." value={consultaTxt} onChange={e => setConsultaTxt(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button className="btn-primary" disabled={extractBusy || consultaTxt.length < 40} onClick={async () => {
                          setExtractBusy(true);
                          try {
                            const { extract } = await api.crmConsultaExtract(detail.client.id, consultaTxt);
                            const patch = {};
                            for (const k of ['fecha_nacimiento', 'ingreso_mensual', 'gasto_mensual', 'saldo_afore', 'retiro_deseado', 'edad_retiro_deseada', 'ocupacion']) if (extract[k] != null) patch[k] = extract[k];
                            if (extract.notas_gastos) patch.notas = `${editForm.notas ? editForm.notas + '\n' : ''}💬 Gastos: ${extract.notas_gastos}`;
                            setEditForm(f => ({ ...f, ...patch }));
                            flash('✓ Datos extraídos — revísalos y pulsa Guardar');
                          } catch (e) { alert(e.message); }
                          setExtractBusy(false);
                        }}><Sparkles size={14} /> {extractBusy ? 'Extrayendo...' : 'Extraer con IA'}</button>
                        <input className="crm-search" style={{ flex: 1, minWidth: 160, paddingLeft: 13 }} type="password" placeholder="Fireflies API key del asesor (opcional)"
                          value={ffKey} onChange={e => setFfKey(e.target.value)} />
                        <button className="btn-secondary" disabled={!ffKey || !detail.client.agent_id} onClick={async () => {
                          try { await api.crmUpdateAgent(detail.client.agent_id, { fireflies_api_key: ffKey }); setFfKey(''); flash('✓ Fireflies key guardada para el asesor'); }
                          catch (e) { alert(e.message); }
                        }}>Guardar key</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn-primary" disabled={saving} onClick={saveClient}>{saving ? 'Guardando...' : 'Guardar consultoría'}</button>
                    </div>
                  </>
                );
              })()}

              {/* ── Tab: Timeline ── */}
              {tab === 'timeline' && (
                !timeline ? <div className="loading-wrap" style={{ minHeight: 120 }}><div className="spinner" /></div> :
                timeline.length === 0 ? <p className="empty">Sin actividad registrada</p> : (
                  <div style={{ position: 'relative', paddingLeft: 18 }}>
                    <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: `linear-gradient(180deg, ${C.gold}55, ${C.border})`, borderRadius: 2 }} />
                    {timeline.map((ev, i) => {
                      const dot = { actividad: C.textLight, nota: '#8B5CF6', tarea: C.amber, recordatorio: C.blue, poliza: C.primary, pago: C.green, archivo: C.gold }[ev.tipo] || C.textLight;
                      return (
                        <div key={i} style={{ position: 'relative', marginBottom: 14 }}>
                          <span style={{ position: 'absolute', left: -18, top: 5, width: 10, height: 10, borderRadius: '50%', background: dot, boxShadow: `0 0 0 3px ${dot}22` }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{ev.titulo}</div>
                          {ev.detalle && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{ev.detalle}</div>}
                          <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{new Date(ev.ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* ── Tab: Notas & Tareas ── */}
              {tab === 'notas' && (
                <>
                  <div className="config-panel" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <button className={`f-tab${noteTipo === 'nota' ? ' active' : ''}`} onClick={() => setNoteTipo('nota')}><StickyNote size={12} style={{ marginRight: 4 }} />Nota</button>
                      <button className={`f-tab${noteTipo === 'tarea' ? ' active' : ''}`} onClick={() => setNoteTipo('tarea')}><CheckSquare size={12} style={{ marginRight: 4 }} />Tarea</button>
                      {noteTipo === 'tarea' && <input type="date" className="crm-select" value={noteDue} onChange={e => setNoteDue(e.target.value)} title="Fecha límite" />}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea rows={2} style={{ flex: 1, padding: '9px 12px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                        placeholder={noteTipo === 'tarea' ? 'Describe la tarea...' : 'Escribe una nota sobre este cliente...'}
                        value={noteText} onChange={e => setNoteText(e.target.value)} />
                      <button className="btn-primary" disabled={!noteText.trim()} onClick={addNote}><Plus size={15} /></button>
                    </div>
                  </div>
                  {!notes ? <div className="loading-wrap" style={{ minHeight: 100 }}><div className="spinner" /></div> :
                    notes.length === 0 ? <p className="empty">Sin notas ni tareas</p> :
                    notes.map(n => (
                      <div key={n.id} className="crm-file-row" style={{ alignItems: 'flex-start', opacity: n.done ? 0.55 : 1 }}>
                        {n.tipo === 'tarea' ? (
                          <button className="crm-icon-btn ok" title={n.done ? 'Reabrir' : 'Completar'} style={{ flexShrink: 0 }}
                            onClick={async () => { await api.crmUpdateNote(n.id, { done: !n.done }); loadNotes(detail.client.id); }}>
                            {n.done ? '↺' : '✓'}
                          </button>
                        ) : <StickyNote size={16} style={{ color: '#8B5CF6', flexShrink: 0, marginTop: 8 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="fname" style={{ textDecoration: n.done ? 'line-through' : 'none' }}>{n.texto}</div>
                          <div className="fmeta">
                            {n.tipo === 'tarea' ? '📋 Tarea' : '📝 Nota'} · {n.user_name || ''} · {fmtDate(n.created_at)}
                            {n.due_date && !n.done && <b style={{ color: new Date(n.due_date) < new Date() ? C.red : C.amber }}> · vence {fmtDate(n.due_date)}</b>}
                          </div>
                        </div>
                        <button className="crm-icon-btn del" onClick={async () => { if (confirm('¿Eliminar?')) { await api.crmDeleteNote(n.id); loadNotes(detail.client.id); } }}><Trash2 size={13} /></button>
                      </div>
                    ))}
                </>
              )}

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
