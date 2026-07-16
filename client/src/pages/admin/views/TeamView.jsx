import { useState, useEffect, useRef } from 'react';
import { C } from '../constants';
import { Users, UserCheck, Settings, Plus, AlertCircle, X, Mail, Calendar, KeyRound, Activity, Contact, FileText, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../../utils/api';

const isAgencyRole = (role) => ['superadmin', 'agencia'].includes(role);

const ROLE_LABELS = {
  superadmin: 'Agencia (Super)',
  agencia:    'Agencia',
  admin:      'Admin FS',
  asesor:     'Asesor',
};
const ROLE_COLORS = {
  superadmin: { bg: '#F3E8FF', text: '#8B5CF6' },
  agencia:    { bg: C.blueBg,  text: C.accent  },
  admin:      { bg: C.amberBg, text: C.amber   },
  asesor:     { bg: C.greenBg, text: C.green   },
};

const ACTION_LABELS = {
  crear: 'creó', editar: 'editó', eliminar: 'eliminó', subir: 'subió',
  login: 'inició sesión', reset_password: 'reseteó contraseña de',
};
const ENTITY_LABELS = {
  cliente: 'cliente', poliza: 'póliza', recordatorio: 'recordatorio', asesor: 'asesor',
  archivo: 'archivo', metas: 'metas', sesion: '', usuario: 'usuario',
};
const ACTION_COLORS = {
  crear: C.green, editar: C.blue, eliminar: C.red, subir: C.amber,
  login: C.textMuted, reset_password: '#8B5CF6',
};

const mxn = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function genPassword(name) {
  const base = (name || 'User').split(' ')[0].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '') || 'User';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let rand = '';
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 8; i++) rand += chars[buf[i] % chars.length];
  return `${base}.${rand}!`;
}

function AddUserModal({ onClose, onSubmit, isAgency }) {
  const [form, setForm]   = useState({ name: '', email: '', password: '', role: 'asesor' });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.password) { setError('Todos los campos son obligatorios'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Agregar Usuario</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red, marginBottom: 16 }}>
              <AlertCircle size={16} /><p>{error}</p>
            </div>
          )}
          <div className="field"><label>Nombre completo</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Juan Pérez" /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="juan@financescool.com" /></div>
          <div className="field">
            <label>Contraseña</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" style={{ flex: 1 }} />
              <button className="btn-secondary" type="button" onClick={() => setForm(f => ({ ...f, password: genPassword(f.name) }))} title="Generar contraseña segura"><KeyRound size={14} /></button>
            </div>
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="asesor">Asesor / Consultor (ventas / atención)</option>
              {isAgency && <option value="admin">Admin Finance SCool</option>}
              {isAgency && <option value="agencia">Agencia (marketing / analytics)</option>}
            </select>
            <small className="help-text">
              {form.role === 'asesor'  && 'Ve su propia cartera del CRM, leads, calendario, chat y WhatsApp'}
              {form.role === 'admin'   && 'Ve el CRM completo de todos los consultores + gestiona el equipo'}
              {form.role === 'agencia' && 'Acceso completo: marketing analytics + operativo + gestión'}
            </small>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={handleSubmit}><Plus size={16} /> Crear Usuario</button>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSubmit, isAgency }) {
  const [form, setForm]   = useState({ name: user.name || '', email: user.email || '', role: user.role });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name || !form.email) { setError('Nombre y email son obligatorios'); return; }
    onSubmit(user, form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Editar Usuario</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red, marginBottom: 16 }}>
              <AlertCircle size={16} /><p>{error}</p>
            </div>
          )}
          <div className="field"><label>Nombre completo</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field">
            <label>Rol</label>
            {user.role === 'superadmin' ? (
              <input type="text" value="Superadmin (no se puede cambiar)" disabled />
            ) : (
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="asesor">Asesor / Consultor</option>
                {isAgency && <option value="admin">Admin Finance SCool</option>}
                {isAgency && <option value="agencia">Agencia</option>}
              </select>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={handleSubmit}><Pencil size={16} /> Guardar Cambios</button>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Feed de actividad en vivo (se actualiza cada 10 s) ── */
function ActivityFeed({ activity }) {
  return (
    <div className="section">
      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Activity size={18} color={C.green} /> Actividad en vivo
        <span style={{ fontSize: 11, fontWeight: 500, color: C.textLight }}>· se actualiza cada 30 s</span>
      </h2>
      {activity.length === 0 ? (
        <p className="empty">Sin actividad registrada todavía</p>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activity.map(a => {
            const color = ACTION_COLORS[a.action] || C.textMuted;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 10px', borderRadius: 8, background: C.card, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, alignSelf: 'center' }} />
                <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0 }}>
                  <strong>{a.user_name}</strong>{' '}
                  <span style={{ color }}>{ACTION_LABELS[a.action] || a.action}</span>{' '}
                  {ENTITY_LABELS[a.entity] ?? a.entity ?? ''}
                  {a.entity_id && a.entity !== 'sesion' ? ` #${a.entity_id}` : ''}
                  {a.detail ? <span style={{ color: C.textMuted }}> — {a.detail}</span> : null}
                </span>
                <span style={{ fontSize: 11, color: C.textLight, whiteSpace: 'nowrap' }}>{timeAgo(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TeamView({ userRole, currentUserId }) {
  const [users, setUsers]               = useState([]);
  const [activity, setActivity]         = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser]   = useState(null);
  const [feedback, setFeedback]         = useState(null);
  const [resetting, setResetting]       = useState(null);
  const pollRef = useRef(null);
  const lastTsRef = useRef(null); // created_at del evento más reciente (polling incremental)
  const isAgency = isAgencyRole(userRole);

  // Un admin solo gestiona asesores; solo un superadmin toca a otro superadmin
  const canManage = (u) => (isAgency || u.role === 'asesor') && (u.role !== 'superadmin' || userRole === 'superadmin');

  /* Polling ligero: cada 30 s pide solo los eventos NUEVOS (param `since` →
     respuesta de ~15 bytes si no hay nada). La lista de usuarios solo se
     refresca cuando hubo actividad nueva, y todo se pausa si la pestaña
     está oculta — evita quemar egress de Railway/Supabase. */
  useEffect(() => {
    loadUsers();
    loadActivity();
    pollRef.current = setInterval(() => { if (!document.hidden) loadActivity(); }, 30000);
    return () => clearInterval(pollRef.current);
  }, []); // eslint-disable-line

  const loadUsers = async (silent) => {
    try {
      if (!silent) setLoadingUsers(true);
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Error loading users:', err); }
    finally { if (!silent) setLoadingUsers(false); }
  };

  const loadActivity = async () => {
    try {
      const since = lastTsRef.current;
      const data = await api.getCrmActivity({ limit: 60, ...(since ? { since } : {}) });
      const rows = data.activity || [];
      if (!since) {
        setActivity(rows);
        if (rows[0]) lastTsRef.current = rows[0].created_at;
      } else if (rows.length) {
        setActivity(prev => [...rows, ...prev].slice(0, 100));
        lastTsRef.current = rows[0].created_at;
        loadUsers(true); // hubo movimiento → refrescar carteras/última actividad
      }
    } catch { /* asesores no ven actividad */ }
  };

  const handleAddUser = async (formData) => {
    try {
      await api.register(formData);
      setFeedback({ type: 'success', msg: `Usuario "${formData.name}" creado — contraseña: ${formData.password}` });
      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al crear usuario' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleEditUser = async (u, form) => {
    try {
      await api.updateUser(u.id, form);
      setFeedback({ type: 'success', msg: `Usuario "${form.name}" actualizado` });
      setEditingUser(null);
      loadUsers(); loadActivity();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al actualizar usuario' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${u.name} (${u.email})? Perderá el acceso al sistema. Su cartera del CRM se conserva.`)) return;
    try {
      await api.deleteUser(u.id);
      setFeedback({ type: 'success', msg: `Usuario "${u.name}" eliminado` });
      loadUsers(); loadActivity();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al eliminar usuario' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleResetPassword = async (u) => {
    const pass = genPassword(u.name);
    if (!window.confirm(`¿Generar nueva contraseña para ${u.name} (${u.email})? La actual dejará de funcionar.`)) return;
    setResetting(u.id);
    try {
      await api.resetUserPassword(u.id, pass);
      setFeedback({ type: 'success', msg: `Nueva contraseña de ${u.name}: ${pass} — cópiala ahora, no se volverá a mostrar` });
      loadActivity();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al resetear contraseña' });
      setTimeout(() => setFeedback(null), 6000);
    }
    setResetting(null);
  };

  const asesores = users.filter(u => u.role === 'asesor');

  return (
    <div className="view">
      <h1 className="view-title">Usuarios</h1>
      <p className="view-subtitle">{isAgency ? 'Administra todos los usuarios, consultores y su actividad' : 'Administra los consultores de Finance SCool y su actividad'}</p>

      {feedback && (
        <div className="info-box" style={{ marginBottom: 16, background: feedback.type === 'success' ? C.greenBg : C.redBg, borderColor: feedback.type === 'success' ? `${C.green}40` : `${C.red}40`, color: feedback.type === 'success' ? C.green : C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
          {feedback.type === 'success' ? <UserCheck size={16} /> : <AlertCircle size={16} />}
          <p style={{ flex: 1, userSelect: 'all' }}>{feedback.msg}</p>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Agregar Usuario
          </button>
        </div>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Users size={22} /></div><div><p className="stat-label">Total Usuarios</p><p className="stat-value">{users.length}</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><UserCheck size={22} /></div><div><p className="stat-label">Consultores</p><p className="stat-value">{asesores.length}</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Settings size={22} /></div><div><p className="stat-label">Admins</p><p className="stat-value">{users.filter(u => ['admin', 'agencia', 'superadmin'].includes(u.role)).length}</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: '#F3E8FF', color: '#8B5CF6' }}><Activity size={22} /></div><div><p className="stat-label">Acciones hoy</p><p className="stat-value">{activity.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length}</p></div></div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Usuarios del Sistema</h2>
        {loadingUsers ? (
          <div className="loading-wrap" style={{ minHeight: 120 }}><div className="spinner" /></div>
        ) : (
          <>
            <div className="tbl-wrap desktop-only-table">
              <table>
                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Cartera CRM</th><th>Última actividad</th><th>Creado</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => {
                    const rc = ROLE_COLORS[u.role] || { bg: C.bg, text: C.textMuted };
                    return (
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong>{u.crm?.clave ? <span style={{ color: C.textLight, fontSize: 11 }}> · {u.crm.clave}</span> : null}</td>
                        <td>{u.email}</td>
                        <td><span className="badge" style={{ backgroundColor: rc.bg, color: rc.text }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                        <td>
                          {u.crm ? (
                            <span style={{ display: 'inline-flex', gap: 10, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>
                              <span title="Clientes"><Contact size={12} style={{ verticalAlign: -2 }} /> {u.crm.clientes}</span>
                              <span title="Pólizas"><FileText size={12} style={{ verticalAlign: -2 }} /> {u.crm.polizas}</span>
                              <span title="Prima pagada" style={{ color: C.green, fontWeight: 600 }}><DollarSign size={12} style={{ verticalAlign: -2 }} />{mxn(u.crm.prima_pagada)}</span>
                            </span>
                          ) : <span style={{ color: C.textLight, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>
                          {u.ultima_actividad ? `${timeAgo(u.ultima_actividad.fecha)} · ${ACTION_LABELS[u.ultima_actividad.action] || u.ultima_actividad.action} ${ENTITY_LABELS[u.ultima_actividad.entity] ?? ''}` : '—'}
                        </td>
                        <td>{new Date(u.created_at || Date.now()).toLocaleDateString('es-MX')}</td>
                        <td>
                          {canManage(u) && (
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button className="btn-secondary" onClick={() => setEditingUser(u)} title="Editar usuario" style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Pencil size={12} />
                              </button>
                              <button className="btn-secondary" disabled={resetting === u.id} onClick={() => handleResetPassword(u)} title="Generar nueva contraseña" style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <KeyRound size={12} /> {resetting === u.id ? '...' : ''}
                              </button>
                              {u.id !== currentUserId && (
                                <button className="btn-secondary" onClick={() => handleDeleteUser(u)} title="Eliminar usuario" style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: C.red }}>
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && <tr><td colSpan={7} className="empty">No hay usuarios registrados</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mobile-lead-cards mobile-only-cards">
              {users.length === 0 ? <p className="empty">No hay usuarios registrados</p> :
                users.map(u => {
                  const rc = ROLE_COLORS[u.role] || { bg: C.bg, text: C.textMuted };
                  return (
                    <div key={u.id} className="mobile-lead-card">
                      <div className="mlc-top">
                        <span className="mlc-name">{u.name}</span>
                        <span className="badge" style={{ backgroundColor: rc.bg, color: rc.text }}>{ROLE_LABELS[u.role] || u.role}</span>
                      </div>
                      <div className="mlc-row"><Mail size={14} color={C.textLight} /> {u.email}</div>
                      {u.crm && (
                        <div className="mlc-row" style={{ fontSize: 12, color: C.textMuted }}>
                          <Contact size={12} /> {u.crm.clientes} clientes · <FileText size={12} /> {u.crm.polizas} pólizas · <span style={{ color: C.green, fontWeight: 600 }}>{mxn(u.crm.prima_pagada)}</span>
                        </div>
                      )}
                      {u.ultima_actividad && (
                        <div className="mlc-row" style={{ fontSize: 12, color: C.textMuted }}>
                          <Activity size={12} /> {timeAgo(u.ultima_actividad.fecha)} · {ACTION_LABELS[u.ultima_actividad.action] || u.ultima_actividad.action} {ENTITY_LABELS[u.ultima_actividad.entity] ?? ''}
                        </div>
                      )}
                      <div className="mlc-bottom">
                        <span className="mlc-row" style={{ fontSize: 12 }}>
                          <Calendar size={12} color={C.textLight} />
                          {new Date(u.created_at || Date.now()).toLocaleDateString('es-MX')}
                        </span>
                        {canManage(u) && (
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            <button className="btn-secondary" onClick={() => setEditingUser(u)} style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Pencil size={12} /> Editar
                            </button>
                            <button className="btn-secondary" disabled={resetting === u.id} onClick={() => handleResetPassword(u)} style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <KeyRound size={12} /> Reset
                            </button>
                            {u.id !== currentUserId && (
                              <button className="btn-secondary" onClick={() => handleDeleteUser(u)} style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: C.red }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </>
        )}
      </div>

      <ActivityFeed activity={activity} />

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onSubmit={handleAddUser} isAgency={isAgency} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSubmit={handleEditUser} isAgency={isAgency} />}
    </div>
  );
}
