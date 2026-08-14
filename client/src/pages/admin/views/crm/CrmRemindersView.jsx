/**
 * CrmRemindersView — Recordatorios de clientes
 * Agrupados por urgencia (vencidos / hoy / semana / próximos) con
 * acción rápida de WhatsApp usando los datos del cliente.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Plus, X, Trash2, Check, MessageCircle, RotateCcw, CalendarHeart, BellRing } from 'lucide-react';
import { getCrmCSS, TIPOS_RECORDATORIO, tipoRecordatorio, fmtDate } from './crmShared';

/* Próxima ocurrencia de un aniversario (cumpleaños): este año o el siguiente */
function proximoAniversario(fechaStr) {
  const f = new Date(`${String(fechaStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(f.getTime())) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  let p = new Date(hoy.getFullYear(), f.getMonth(), f.getDate());
  if (p < hoy) p = new Date(hoy.getFullYear() + 1, f.getMonth(), f.getDate());
  return p;
}
const iso = (d) => d.toISOString().slice(0, 10);
const diasA = (d) => Math.round((d - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);

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
  const [agentFilter, setAgentFilter] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [agendaOpen, setAgendaOpen] = useState(true);
  const [activando, setActivando] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, a, p] = await Promise.all([
        api.crmGetReminders(), api.crmGetClients(), api.crmGetAgents(),
        api.crmGetPolicies().catch(() => ({ policies: [] })),
      ]);
      setReminders(r.reminders || []); setClients(c.clients || []); setAgents(a.agents || []);
      setPolicies(p.policies || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* ── Agenda de la cartera: todas las fechas clave derivadas de los datos
     del cliente y sus pólizas (cumpleaños del cliente, del cónyuge, de
     beneficiarios, y renovaciones) con activación de recordatorio ── */
  const agenda = useMemo(() => {
    const eventos = [];
    const porCliente = new Map(clients.map(c => [c.id, c]));
    for (const c of clients) {
      if (agentFilter && String(c.agent_id) !== agentFilter) continue;
      if (c.fecha_nacimiento) {
        const p = proximoAniversario(c.fecha_nacimiento);
        if (p) eventos.push({ tipo: 'cumpleanos', quien: c.nombre, detalle: 'Cumpleaños del cliente', cliente: c, fecha: p });
      }
      if (c.fecha_nacimiento_conyuge) {
        const p = proximoAniversario(c.fecha_nacimiento_conyuge);
        if (p) eventos.push({ tipo: 'cumpleanos', quien: `Cónyuge de ${c.nombre}`, detalle: 'Cumpleaños del cónyuge', cliente: c, fecha: p });
      }
    }
    for (const pol of policies) {
      const c = porCliente.get(pol.client_id);
      if (!c) continue;
      if (agentFilter && String(pol.agent_id) !== agentFilter) continue;
      if (pol.fecha_renovacion) {
        const f = new Date(`${String(pol.fecha_renovacion).slice(0, 10)}T12:00:00`);
        if (!Number.isNaN(f.getTime()) && diasA(f) >= 0 && pol.estatus !== 'cancelada') {
          eventos.push({ tipo: 'renovacion', quien: c.nombre, detalle: `Renovación póliza ${pol.poliza || ''} ${pol.plan ? `(${pol.plan})` : ''}`, cliente: c, fecha: f });
        }
      }
      let bens = [];
      try { bens = JSON.parse(pol.beneficiarios || '[]'); } catch { bens = []; }
      for (const b of bens) {
        if (!b.fecha_nacimiento) continue;
        const p = proximoAniversario(b.fecha_nacimiento);
        if (p) eventos.push({ tipo: 'cumpleanos', quien: b.nombre || 'Beneficiario', detalle: `Cumpleaños de beneficiario (${b.relacion || 's/r'}) · póliza ${pol.poliza || ''}`, cliente: c, fecha: p });
      }
    }
    /* ¿ya tiene recordatorio activado? (mismo cliente + fecha + tipo) */
    const claveRem = new Set(reminders.map(r => `${r.client_id}|${String(r.fecha).slice(0, 10)}|${r.tipo}`));
    return eventos
      .map(e => ({ ...e, dias: diasA(e.fecha), activado: claveRem.has(`${e.cliente.id}|${iso(e.fecha)}|${e.tipo}`) }))
      .sort((a, b) => a.dias - b.dias);
  }, [clients, policies, reminders, agentFilter]);

  const activar = async (e) => {
    setActivando(`${e.cliente.id}|${iso(e.fecha)}|${e.tipo}`);
    try {
      await api.crmCreateReminder({
        titulo: e.tipo === 'cumpleanos' ? `🎂 ${e.quien}` : `🔄 ${e.detalle}`,
        descripcion: `${e.detalle} — generado desde la agenda de la cartera`,
        tipo: e.tipo, fecha: iso(e.fecha),
        client_id: e.cliente.id, agent_id: e.cliente.agent_id,
      });
      load();
    } catch (err) { alert(err.message); }
    finally { setActivando(''); }
  };

  const activarProximos = async (dias) => {
    const pend = agenda.filter(e => !e.activado && e.dias <= dias);
    if (!pend.length) return alert(`No hay fechas sin recordatorio en los próximos ${dias} días`);
    if (!confirm(`¿Activar ${pend.length} recordatorios de los próximos ${dias} días?`)) return;
    for (const e of pend) {
      try {
        await api.crmCreateReminder({
          titulo: e.tipo === 'cumpleanos' ? `🎂 ${e.quien}` : `🔄 ${e.detalle}`,
          descripcion: `${e.detalle} — generado desde la agenda de la cartera`,
          tipo: e.tipo, fecha: iso(e.fecha), client_id: e.cliente.id, agent_id: e.cliente.agent_id,
        });
      } catch { /* sigue con el resto */ }
    }
    load();
  };

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
  const reopen = async (r) => { await api.crmUpdateReminder(r.id, { estatus: 'pendiente' }); load(); };
  const remove = async (r) => { if (confirm('¿Eliminar recordatorio?')) { await api.crmDeleteReminder(r.id); load(); } };

  const visible = reminders.filter(r => {
    if (!showDone && r.estatus === 'completado') return false;
    if (tipoFilter !== 'todos' && r.tipo !== tipoFilter) return false;
    if (agentFilter && String(r.agent_id) !== agentFilter) return false;
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
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="">Todos los asesores</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
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

      {/* ══ Agenda de la cartera: fechas clave derivadas de los datos del
          cliente y sus pólizas, con activación de recordatorios ══ */}
      <div className="crm-chart-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}><CalendarHeart size={16} style={{ verticalAlign: -2, color: C.gold }} /> Agenda de la cartera ({agenda.length} fechas)</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => activarProximos(30)}>
              <BellRing size={13} /> Activar próximos 30 días
            </button>
            <button className="f-tab" onClick={() => setAgendaOpen(o => !o)}>{agendaOpen ? 'Ocultar' : 'Mostrar'}</button>
          </div>
        </div>
        <p className="sub" style={{ margin: '4px 0 12px' }}>
          Cumpleaños del cliente, del cónyuge y de beneficiarios (según sus pólizas) más renovaciones — captura las fechas en el expediente y en los beneficiarios de cada póliza para que aparezcan aquí.
        </p>
        {agendaOpen && (
          <>
            {agenda.length === 0 && <p className="empty">Sin fechas clave aún — llena fecha de nacimiento, cónyuge y beneficiarios en los expedientes.</p>}
            {agenda.slice(0, 40).map(e => {
              const key = `${e.cliente.id}|${iso(e.fecha)}|${e.tipo}`;
              const tel = (e.cliente.telefono || '').replace(/\D/g, '');
              return (
                <div key={`${key}|${e.quien}`} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '7px 0', gap: 8 }}>
                  <span style={{ minWidth: 0 }}>
                    <b>{e.tipo === 'cumpleanos' ? '🎂' : '🔄'} {e.quien}</b>
                    <span style={{ fontSize: 11.5, color: C.textMuted }}> — {e.detalle}</span>
                    <br /><span style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(iso(e.fecha))} · {e.dias === 0 ? '¡hoy!' : `en ${e.dias} días`} · cliente: {e.cliente.nombre}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {tel && (
                      <a className="crm-icon-btn wa" title="WhatsApp" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /></a>
                    )}
                    {e.activado
                      ? <span className="badge" style={{ background: C.greenBg, color: C.green }}>✓ Activado</span>
                      : <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11.5 }} disabled={activando === key} onClick={() => activar(e)}>
                          {activando === key ? '...' : 'Activar recordatorio'}
                        </button>}
                  </span>
                </div>
              );
            })}
            {agenda.length > 40 && <p className="sub" style={{ marginTop: 8 }}>…y {agenda.length - 40} fechas más (las más lejanas).</p>}
          </>
        )}
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
                  {done && <button className="crm-icon-btn" title="Reabrir" onClick={() => reopen(r)}><RotateCcw size={14} /></button>}
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
