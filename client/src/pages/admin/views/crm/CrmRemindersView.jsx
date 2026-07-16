/**
 * CrmRemindersView — Recordatorios de clientes
 * Agrupados por urgencia (vencidos / hoy / semana / próximos) con
 * acción rápida de WhatsApp usando los datos del cliente.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Plus, X, Trash2, Check, MessageCircle } from 'lucide-react';
import { getCrmCSS, TIPOS_RECORDATORIO, tipoRecordatorio, fmtDate } from './crmShared';

const EMPTY = { titulo: '', descripcion: '', tipo: 'seguimiento', fecha: '', hora: '', client_id: '', agent_id: '' };

function groupKey(fecha) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return 'vencidos';
  if (diff === 0) return 'hoy';
  if (diff <= 7) return 'semana';
  return 'proximos';
}
const GROUPS = [
  { id: 'vencidos', label: '⚠️ Vencidos', color: C.red },
  { id: 'hoy', label: '🔔 Hoy', color: C.amber },
  { id: 'semana', label: 'Esta semana', color: C.primary },
  { id: 'proximos', label: 'Próximos', color: C.textMuted },
];

export default function CrmRemindersView({ isAgency }) {
  const [reminders, setReminders] = useState([]);
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, a] = await Promise.all([api.crmGetReminders(), api.crmGetClients(), api.crmGetAgents()]);
      setReminders(r.reminders || []); setClients(c.clients || []); setAgents(a.agents || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.titulo || !form.fecha) return alert('Título y fecha son requeridos');
    setSaving(true);
    try {
      const body = { ...form };
      if (body.client_id) {
        const cl = clients.find(c => String(c.id) === String(body.client_id));
        if (cl) body.agent_id = cl.agent_id;
      }
      if (!body.agent_id && agents.length) body.agent_id = agents[0].id;
      if (form.id) await api.crmUpdateReminder(form.id, body);
      else await api.crmCreateReminder(body);
      setForm(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const complete = async (r) => { await api.crmUpdateReminder(r.id, { estatus: 'completado' }); load(); };
  const remove = async (r) => { if (confirm('¿Eliminar recordatorio?')) { await api.crmDeleteReminder(r.id); load(); } };

  const visible = reminders.filter(r => {
    if (!showDone && r.estatus === 'completado') return false;
    if (tipoFilter !== 'todos' && r.tipo !== tipoFilter) return false;
    return true;
  });
  const grouped = GROUPS.map(g => ({ ...g, items: visible.filter(r => groupKey(r.fecha) === g.id) })).filter(g => g.items.length);

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando recordatorios...</p></div></>;

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Recordatorios</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>{visible.length} pendientes — pagos, renovaciones, citas y seguimientos</p>
        </div>
        <div className="crm-toolbar-right">
          <button className="btn-secondary" onClick={() => setShowDone(s => !s)}>{showDone ? 'Ocultar completados' : 'Ver completados'}</button>
          <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={16} /> Nuevo recordatorio</button>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        <button className={`f-tab${tipoFilter === 'todos' ? ' active' : ''}`} onClick={() => setTipoFilter('todos')}>Todos</button>
        {TIPOS_RECORDATORIO.map(t => (
          <button key={t.id} className={`f-tab${tipoFilter === t.id ? ' active' : ''}`} onClick={() => setTipoFilter(t.id)}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 && <p className="empty">🎉 Sin recordatorios pendientes</p>}

      {grouped.map(g => (
        <div key={g.id} className="crm-rem-group">
          <h4 style={{ color: g.color }}>{g.label} ({g.items.length})</h4>
          {g.items.map(r => {
            const t = tipoRecordatorio(r.tipo);
            const tel = r.crm_clients?.telefono?.replace(/\D/g, '');
            const done = r.estatus === 'completado';
            return (
              <div key={r.id} className={`crm-rem-card${done ? ' done' : ''}`}>
                <div className="crm-rem-emoji" style={{ background: `${t.color}18` }}>{t.emoji}</div>
                <div className="crm-rem-body">
                  <p className="crm-rem-title">{r.titulo}</p>
                  {r.descripcion && <p className="crm-rem-desc">{r.descripcion}</p>}
                  <div className="crm-rem-meta">
                    <span className="badge" style={{ background: `${t.color}18`, color: t.color }}>{t.label}</span>
                    <span><b>{fmtDate(r.fecha)}</b>{r.hora ? ` · ${String(r.hora).slice(0, 5)}` : ''}</span>
                    {r.crm_clients?.nombre && <span>· {r.crm_clients.nombre}</span>}
                    {isAgency && r.crm_agents?.nombre && <span>· 👤 {r.crm_agents.nombre}</span>}
                  </div>
                </div>
                <div className="crm-rem-actions">
                  {tel && (
                    <a className="crm-icon-btn wa" title="WhatsApp al cliente" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">
                      <MessageCircle size={14} />
                    </a>
                  )}
                  {!done && <button className="crm-icon-btn ok" title="Completar" onClick={() => complete(r)}><Check size={14} /></button>}
                  <button className="crm-icon-btn del" title="Eliminar" onClick={() => remove(r)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Modal */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{form.id ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h2>
              <button className="close-btn" onClick={() => setForm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="field"><label>Título *</label><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></div>
              <div className="field">
                <label>Cliente (opcional)</label>
                <select value={form.client_id ?? ''} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Sin cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <div className="field">
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPOS_RECORDATORIO.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <div className="field"><label>Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
              </div>
              <div className="field"><label>Hora</label><input type="time" value={form.hora ?? ''} onChange={e => setForm({ ...form, hora: e.target.value })} /></div>
              <div className="field"><label>Descripción</label><textarea rows={3} value={form.descripcion ?? ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
            </div>
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
