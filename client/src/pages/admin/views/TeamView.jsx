import { useState, useEffect } from 'react';
import { C } from '../constants';
import { Users, UserCheck, Settings, Plus, AlertCircle, X } from 'lucide-react';
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
          <div className="field"><label>Contraseña</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
          <div className="field">
            <label>Rol</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="asesor">Asesor (ventas / atención)</option>
              {isAgency && <option value="admin">Admin Finance SCool</option>}
              {isAgency && <option value="agencia">Agencia (marketing / analytics)</option>}
            </select>
            <small className="help-text">
              {form.role === 'asesor'  && 'Puede ver leads, calendario, chat y WhatsApp'}
              {form.role === 'admin'   && 'Puede ver todo lo operativo + gestionar el equipo de asesores'}
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

export default function TeamView({ userRole }) {
  const [users, setUsers]             = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedback, setFeedback]       = useState(null);
  const isAgency = isAgencyRole(userRole);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Error loading users:', err); }
    finally { setLoadingUsers(false); }
  };

  const handleAddUser = async (formData) => {
    try {
      await api.register(formData);
      setFeedback({ type: 'success', msg: `Usuario "${formData.name}" creado exitosamente` });
      setShowAddModal(false);
      loadUsers();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al crear usuario' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="view">
      <h1 className="view-title">Gestión del Equipo</h1>
      <p className="view-subtitle">{isAgency ? 'Administra todos los usuarios del sistema' : 'Administra los asesores de Finance SCool'}</p>

      {feedback && (
        <div className="info-box" style={{ marginBottom: 16, background: feedback.type === 'success' ? C.greenBg : C.redBg, borderColor: feedback.type === 'success' ? `${C.green}40` : `${C.red}40`, color: feedback.type === 'success' ? C.green : C.red }}>
          {feedback.type === 'success' ? <UserCheck size={16} /> : <AlertCircle size={16} />}
          <p>{feedback.msg}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="stats-grid" style={{ flex: 1, marginBottom: 0, marginRight: 16 }}>
          <div className="stat-card"><div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Users size={22} /></div><div><p className="stat-label">Total Usuarios</p><p className="stat-value">{users.length}</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><UserCheck size={22} /></div><div><p className="stat-label">Asesores</p><p className="stat-value">{users.filter(u => u.role === 'asesor').length}</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Settings size={22} /></div><div><p className="stat-label">Admins</p><p className="stat-value">{users.filter(u => u.role === 'admin').length}</p></div></div>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ whiteSpace: 'nowrap', height: 'fit-content' }}>
          <Plus size={16} /> Agregar Usuario
        </button>
      </div>

      <div className="section">
        <h2 className="section-title">Usuarios del Sistema</h2>
        <div className="tbl-wrap">
          {loadingUsers ? (
            <div className="loading-wrap" style={{ minHeight: 120 }}><div className="spinner" /></div>
          ) : (
            <table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Creado</th></tr></thead>
              <tbody>
                {users.map(u => {
                  const rc = ROLE_COLORS[u.role] || { bg: C.bg, text: C.textMuted };
                  return (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className="badge" style={{ backgroundColor: rc.bg, color: rc.text }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                      <td>{new Date(u.created_at || Date.now()).toLocaleDateString('es-MX')}</td>
                    </tr>
                  );
                })}
                {users.length === 0 && <tr><td colSpan={4} className="empty">No hay usuarios registrados</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onSubmit={handleAddUser} isAgency={isAgency} />}
    </div>
  );
}
