/**
 * CrmEntregasView — Entregas (pendientes administrativos de los socios).
 * Tablero estilo Tesipedia re-tematizado a la paleta clara de FSC: KPIs
 * semáforo, filtro por socio, tabla densa con urgencia que escala, y una
 * página de detalle por entrega con evidencias (Cloudinary) + notas.
 * Cada entrega puede crear un EVENTO REAL en el Google Calendar del socio.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../utils/api';
import { useAuth } from '../../../../hooks/useAuth';
import { C } from '../../constants';
import {
  CheckSquare, Plus, Search, RefreshCw, X, Flag, Pencil, Trash2, Check,
  PlayCircle, RotateCcw, ArrowLeft, Paperclip, MessageSquare, Upload, FileText,
  Download, Send, CalendarDays, Video, Link2, ChevronLeft, ChevronRight, List,
} from 'lucide-react';

const SOCIOS = [
  { key: 'arturo', label: 'Arturo', color: '#8A6A34' },
  { key: 'ingrid', label: 'Ingrid', color: '#7C3AED' },
  { key: 'flavio', label: 'Flavio', color: '#0891B2' },
];
const socioInfo = (k) => SOCIOS.find(s => s.key === k) || SOCIOS[0];
const SOCIO_POR_EMAIL = {
  'admin@financescool.com': 'arturo', 'osvaldosuarezcruz@gmail.com': 'arturo',
  'ingrid.escobar@grupointegraccion.com': 'ingrid',
  'flavio.r@grupointegraccion.com': 'flavio', 'flavio.rodriguez@grupointegraccion.com': 'flavio',
};

// ── Urgencia (se calcula al render → vencida escala sola cada día) ──
const parseLocal = (s) => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
  const d = new Date(s); return isNaN(d) ? null : d;
};
const diasHasta = (s) => {
  const f = parseLocal(s); if (!f) return null;
  const h = new Date(); h.setHours(0, 0, 0, 0); f.setHours(0, 0, 0, 0);
  return Math.round((f - h) / 86400000);
};
const esActiva = (e) => e.estado === 'pendiente' || e.estado === 'en_proceso';
function urg(e) {
  const d = diasHasta(e.fecha_entrega);
  if (e.estado === 'cancelado') return { key: 'cancelado', label: 'Cancelada', dias: d, sort: 90000 };
  if (e.estado === 'entregado') return { key: 'entregado', label: 'Entregada', dias: d, sort: 80000 };
  if (d == null) return { key: 'sinfecha', label: 'Sin fecha', dias: null, sort: 50000 };
  if (d < 0) { const ov = -d; return { key: 'urgente', overdue: ov, dias: d, label: `URGENTE · vencida hace ${ov} día${ov > 1 ? 's' : ''}`, sort: -ov }; }
  if (d === 0) return { key: 'hoy', label: 'Vence hoy', dias: 0, sort: 1 };
  if (d <= 3) return { key: 'pronto', label: `Vence en ${d} día${d > 1 ? 's' : ''}`, dias: d, sort: 100 + d };
  return { key: 'futuro', label: `En ${d} días`, dias: d, sort: 1000 + d };
}
function urgStyle(u) {
  switch (u.key) {
    case 'urgente': return { bar: C.red, bg: C.redBg, tx: C.red };
    case 'hoy': return { bar: C.amber, bg: C.amberBg, tx: C.amber };
    case 'pronto': return { bar: C.gold, bg: C.goldBg, tx: C.amber };
    case 'futuro': return { bar: C.blue, bg: C.blueBg, tx: C.blue };
    case 'entregado': return { bar: C.green, bg: C.greenBg, tx: C.green };
    default: return { bar: C.textLight, bg: '#EEF1F6', tx: C.textMuted };
  }
}
const ESTADO_LABEL = { pendiente: 'Pendiente', en_proceso: 'En proceso', entregado: 'Entregada', cancelado: 'Cancelada' };
const PRIORIDADES = [{ v: 'high', t: 'Alta' }, { v: 'normal', t: 'Normal' }, { v: 'low', t: 'Baja' }];
const fmtFecha = (s) => { const d = parseLocal(s); return d ? d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'; };
const fmtDateTime = (ts) => ts ? new Date(ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const fmtBytes = (n) => { if (!n && n !== 0) return ''; if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`; return `${(n / 1048576).toFixed(1)} MB`; };
const relTxt = (d) => d == null ? '' : d < 0 ? `hace ${-d}d` : d === 0 ? 'hoy' : `en ${d}d`;
const emptyForm = (socio) => ({ id: null, titulo: '', descripcion: '', fecha_entrega: '', prioridad: 'normal', socio, crearEvento: true, meet: false, startTime: '', endTime: '' });

export default function CrmEntregasView() {
  const { user } = useAuth();
  const miSocio = SOCIO_POR_EMAIL[String(user?.email || '').toLowerCase()] || 'arturo';

  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(null);
  const [socioF, setSocioF] = useState('todos');
  const [estadoF, setEstadoF] = useState('activas');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selId, setSelId] = useState(null);
  const [vista, setVista] = useState('lista'); // 'lista' | 'cal'

  const toast = (msg, type = 'ok') => { setFlash({ msg, type }); setTimeout(() => setFlash(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api.crmEntregas('todos'); setEntregas(d.entregas || []); }
    catch (e) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── acciones ──
  async function cambiarEstado(e, estado) {
    setEntregas(prev => prev.map(x => x.id === e.id ? { ...x, estado, completed_at: estado === 'entregado' ? new Date().toISOString() : null } : x));
    try { await api.crmEntregaActualizar(e.id, { estado }); } catch (err) { toast(err.message, 'err'); load(); }
  }
  async function borrar(e) {
    if (!window.confirm(`¿Borrar la entrega "${e.titulo}"?`)) return;
    const prev = entregas; setEntregas(p => p.filter(x => x.id !== e.id));
    try {
      if (e.evento_google_id) await api.calDeleteEvent(e.evento_google_id, e.socio, e.evento_calendar_id || 'primary').catch(() => {});
      await api.crmEntregaBorrar(e.id); toast('Entrega borrada');
    } catch (err) { toast(err.message, 'err'); setEntregas(prev); }
  }

  async function guardar() {
    if (!form.titulo.trim()) return toast('Ponle un título', 'err');
    if (!form.fecha_entrega) return toast('Falta la fecha de entrega', 'err');
    setSaving(true);
    try {
      const payload = { titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null, fecha_entrega: form.fecha_entrega, prioridad: form.prioridad, socio: form.socio };
      let entregaId = form.id;
      if (form.id) {
        await api.crmEntregaActualizar(form.id, payload);
      } else {
        const r = await api.crmEntregaCrear(payload); entregaId = r.entrega.id;
      }
      // Evento real de Google Calendar
      if (form.crearEvento && entregaId) {
        const evPayload = { socio: form.socio, summary: payload.titulo, description: payload.descripcion || '', startDate: form.fecha_entrega, endDate: form.fecha_entrega, startTime: form.startTime || undefined, endTime: form.endTime || undefined, attendees: '', meet: !!form.meet };
        try {
          const existing = entregas.find(x => x.id === form.id);
          if (existing?.evento_google_id) {
            await api.calUpdateEvent(existing.evento_google_id, evPayload);
          } else {
            const ev = await api.calCreateEvent(evPayload);
            if (ev?.id) await api.crmEntregaActualizar(entregaId, { evento_google_id: ev.id, meet_link: ev.hangoutLink || null });
          }
        } catch (err) {
          toast('Entrega guardada, pero el evento de Google no se creó (¿socio conectado?): ' + err.message, 'warn');
        }
      }
      setForm(null); toast(form.id ? 'Entrega actualizada' : 'Entrega agregada'); load();
    } catch (e) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  }

  // ── derivados ──
  const universo = entregas
    .filter(e => socioF === 'todos' || e.socio === socioF)
    .filter(e => { const t = q.trim().toLowerCase(); if (!t) return true; return `${e.titulo} ${e.descripcion || ''}`.toLowerCase().includes(t); })
    .map(e => ({ ...e, _u: urg(e) }));

  const kpi = (() => {
    const act = universo.filter(esActiva);
    const names = (arr) => [...new Set(arr.map(e => socioInfo(e.socio).label))].slice(0, 3).join(' · ');
    const b = (p) => act.filter(p);
    return [
      { key: 'vencidas', label: 'Atrasadas', n: b(e => e._u.key === 'urgente'), tone: C.red },
      { key: 'hoy', label: 'Hoy', n: b(e => e._u.key === 'hoy'), tone: C.amber },
      { key: 'manana', label: 'Mañana', n: b(e => e._u.dias === 1), tone: C.amber },
      { key: 'prox7', label: 'Próx. 7 días', n: b(e => e._u.dias >= 2 && e._u.dias <= 7), tone: C.blue },
      { key: 'en_proceso', label: 'En proceso', n: b(e => e.estado === 'en_proceso'), tone: C.ink },
      { key: 'entregadas', label: 'Entregadas', n: universo.filter(e => e.estado === 'entregado'), tone: C.green },
    ].map(k => ({ ...k, count: k.n.length, sub: names(k.n) }));
  })();

  const filas = universo.filter(e => {
    switch (estadoF) {
      case 'todas': return true;
      case 'activas': return esActiva(e);
      case 'vencidas': return esActiva(e) && e._u.key === 'urgente';
      case 'hoy': return esActiva(e) && e._u.key === 'hoy';
      case 'manana': return esActiva(e) && e._u.dias === 1;
      case 'prox7': return esActiva(e) && e._u.dias >= 2 && e._u.dias <= 7;
      case 'en_proceso': return e.estado === 'en_proceso';
      case 'entregadas': return e.estado === 'entregado';
      default: return esActiva(e);
    }
  }).sort((a, b) => {
    if (esActiva(a) !== esActiva(b)) return esActiva(a) ? -1 : 1;
    if (esActiva(a)) return a._u.sort - b._u.sort;
    return (b.completed_at || '').localeCompare(a.completed_at || '');
  });

  const CHIPS = [
    { k: 'activas', t: 'Activas' }, { k: 'vencidas', t: 'Atrasadas' }, { k: 'hoy', t: 'Hoy' },
    { k: 'prox7', t: 'Próx. 7 días' }, { k: 'en_proceso', t: 'En proceso' }, { k: 'entregadas', t: 'Entregadas' }, { k: 'todas', t: 'Todas' },
  ];

  if (selId) return <EntregaDetalle id={selId} onBack={() => { setSelId(null); load(); }} miSocio={miSocio} toast={toast} onEdit={(e) => setForm({ id: e.id, titulo: e.titulo, descripcion: e.descripcion || '', fecha_entrega: e.fecha_entrega?.slice(0, 10) || '', prioridad: e.prioridad, socio: e.socio, crearEvento: !!e.evento_google_id, meet: false, startTime: '', endTime: '' })} />;

  return (
    <div className="ent">
      <style>{ENT_CSS}</style>

      <div className="ent-plaque">
        <div>
          <h1><CheckSquare size={22} /> Entregas</h1>
          <p>Pendientes administrativos de los socios · con evidencias y evento en Google Calendar</p>
        </div>
        <div className="ent-head-actions">
          <div className="ent-seg">
            <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}><List size={14} /> Lista</button>
            <button className={vista === 'cal' ? 'on' : ''} onClick={() => setVista('cal')}><CalendarDays size={14} /> Calendario</button>
          </div>
          <button className="ent-btn-primary" onClick={() => setForm(emptyForm(miSocio))}><Plus size={15} /> Entrega</button>
          <button className="ent-icon-btn" onClick={load} title="Actualizar"><RefreshCw size={15} className={loading ? 'ent-spin' : ''} /></button>
        </div>
      </div>

      {flash && <div className={`ent-flash ent-flash-${flash.type}`}>{flash.msg}</div>}

      {/* KPIs semáforo */}
      <div className="ent-kpis">
        {kpi.map(k => (
          <button key={k.key} className={`ent-kpi ${estadoF === k.key ? 'on' : ''}`} onClick={() => setEstadoF(k.key)}>
            <div className="ent-kpi-label">{k.label}</div>
            <div className="ent-kpi-n" style={{ color: k.count ? k.tone : C.textLight }}>{k.count}</div>
            <div className="ent-kpi-sub">{k.sub || '—'}</div>
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      {vista === 'lista' && (
        <div className="ent-search">
          <Search size={15} color={C.textLight} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar entrega o detalle…" />
          {q && <button onClick={() => setQ('')}><X size={14} color={C.textLight} /></button>}
        </div>
      )}

      {/* Filtros socio (+ estado solo en lista) */}
      <div className="ent-chips">
        <button className={`ent-chip ${socioF === 'todos' ? 'on' : ''}`} onClick={() => setSocioF('todos')}>Todos</button>
        {SOCIOS.map(s => (
          <button key={s.key} className={`ent-chip ${socioF === s.key ? 'on' : ''}`} onClick={() => setSocioF(s.key)}>
            <span className="ent-dot" style={{ background: s.color }} />{s.label}{s.key === miSocio ? ' (yo)' : ''}
          </button>
        ))}
        {vista === 'lista' && <>
          <span className="ent-sep" />
          {CHIPS.map(c => <button key={c.k} className={`ent-chip subtle ${estadoF === c.k ? 'on' : ''}`} onClick={() => setEstadoF(c.k)}>{c.t}</button>)}
        </>}
      </div>

      {vista === 'cal' && <CalendarioEntregas entregas={universo} socioF={socioF} onOpen={setSelId} />}

      {/* Tabla */}
      {vista === 'lista' && (loading ? (
        <div className="ent-loading"><span className="ent-spinner" /> Cargando…</div>
      ) : filas.length === 0 ? (
        <div className="ent-empty">
          <CalendarDays size={34} color={C.textLight} />
          <p>No hay entregas con estos filtros.</p>
          <button onClick={() => setForm(emptyForm(miSocio))}>+ Agregar entrega</button>
        </div>
      ) : (
        <div className="ent-tbl-wrap">
          <table className="ent-tbl">
            <thead><tr><th>Entrega</th><th>Socio</th><th>Estatus</th><th>Fecha de entrega</th><th></th><th></th></tr></thead>
            <tbody>
              {filas.map(e => {
                const u = e._u, s = urgStyle(u), si = socioInfo(e.socio);
                const cerrada = e.estado === 'entregado' || e.estado === 'cancelado';
                const relCls = u.dias < 0 ? C.red : u.dias === 0 ? C.amber : C.textMuted;
                return (
                  <tr key={e.id} className="ent-row" onClick={() => setSelId(e.id)}>
                    <td>
                      <div className="ent-row-main">
                        <span className="ent-bar" style={{ background: s.bar }} />
                        <div>
                          <div className="ent-title-line">
                            {e.prioridad === 'high' && <Flag size={12} color={C.red} />}
                            {esActiva(e) && (u.key === 'urgente' || u.key === 'hoy') && (
                              <span className="ent-chip-badge" style={{ background: s.bg, color: s.tx }}>{u.key === 'urgente' ? 'URGENTE' : 'HOY'}</span>
                            )}
                            <span className="ent-title" style={cerrada ? { textDecoration: 'line-through', color: C.textLight } : {}}>{e.titulo}</span>
                          </div>
                          {e.descripcion && <div className="ent-desc">{e.descripcion}</div>}
                          <div className="ent-meta">
                            {e.n_evidencias > 0 && <span><Paperclip size={11} /> {e.n_evidencias}</span>}
                            {e.n_notas > 0 && <span><MessageSquare size={11} /> {e.n_notas}</span>}
                            {e.evento_google_id && <span style={{ color: C.blue }}><CalendarDays size={11} /> Google</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="ent-owner" style={{ color: si.color }}><span className="ent-dot" style={{ background: si.color }} />{si.label}{e.socio === miSocio ? ' · tú' : ''}</span></td>
                    <td><span className="ent-status">{ESTADO_LABEL[e.estado]}</span></td>
                    <td>
                      <div className="ent-fecha">{fmtFecha(e.fecha_entrega)}</div>
                      <div className="ent-rel" style={{ color: relCls }}>{esActiva(e) ? (u.key === 'urgente' ? `vencida ${relTxt(u.dias)}` : relTxt(u.dias)) : ESTADO_LABEL[e.estado]}</div>
                    </td>
                    <td onClick={ev => ev.stopPropagation()} className="ent-actions">
                      {!cerrada && e.estado === 'pendiente' && <button title="En proceso" onClick={() => cambiarEstado(e, 'en_proceso')}><PlayCircle size={16} /></button>}
                      {!cerrada && <button title="Marcar entregada" className="green" onClick={() => cambiarEstado(e, 'entregado')}><Check size={16} /></button>}
                      {cerrada && <button title="Reabrir" onClick={() => cambiarEstado(e, 'pendiente')}><RotateCcw size={15} /></button>}
                      <button title="Editar" onClick={() => setForm({ id: e.id, titulo: e.titulo, descripcion: e.descripcion || '', fecha_entrega: e.fecha_entrega?.slice(0, 10) || '', prioridad: e.prioridad, socio: e.socio, crearEvento: !!e.evento_google_id, meet: false, startTime: '', endTime: '' })}><Pencil size={15} /></button>
                      <button title="Borrar" className="red" onClick={() => borrar(e)}><Trash2 size={15} /></button>
                    </td>
                    <td className="ent-chev" onClick={() => setSelId(e.id)}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {form && <FormModal form={form} setForm={setForm} saving={saving} miSocio={miSocio} onClose={() => setForm(null)} onSave={guardar} />}
    </div>
  );
}

// ══════════════════ DETALLE ══════════════════
function EntregaDetalle({ id, onBack, miSocio, toast, onEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.crmEntregaDetalle(id)); } catch (e) { toast(e.message, 'err'); } finally { setLoading(false); }
  }, [id, toast]);
  useEffect(() => { load(); }, [load]);

  async function subir(files) {
    if (!files?.length) return;
    setBusy(true);
    try { for (const f of files) { const r = await api.crmEntregaSubirEvidencia(id, f); setData(d => ({ ...d, evidencias: [r.evidencia, ...d.evidencias] })); } toast('Evidencia subida'); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function borrarEvid(ev) {
    if (!window.confirm(`¿Borrar "${ev.nombre}"?`)) return;
    const prev = data.evidencias; setData(d => ({ ...d, evidencias: d.evidencias.filter(x => x.id !== ev.id) }));
    try { await api.crmEntregaBorrarEvidencia(id, ev.id); } catch (e) { toast(e.message, 'err'); setData(d => ({ ...d, evidencias: prev })); }
  }
  async function addNota() {
    const t = nota.trim(); if (!t) return;
    try { const r = await api.crmEntregaAgregarNota(id, t); setData(d => ({ ...d, notas: [...d.notas, r.nota] })); setNota(''); } catch (e) { toast(e.message, 'err'); }
  }
  async function borrarNota(n) {
    const prev = data.notas; setData(d => ({ ...d, notas: d.notas.filter(x => x.id !== n.id) }));
    try { await api.crmEntregaBorrarNota(id, n.id); } catch (e) { toast(e.message, 'err'); setData(d => ({ ...d, notas: prev })); }
  }

  if (loading) return <div className="ent"><style>{ENT_CSS}</style><div className="ent-loading"><span className="ent-spinner" /> Cargando…</div></div>;
  if (!data?.entrega) return <div className="ent"><style>{ENT_CSS}</style><div className="ent-empty"><p>Entrega no encontrada.</p><button onClick={onBack}>← Volver</button></div></div>;

  const e = data.entrega, u = urg(e), s = urgStyle(u), si = socioInfo(e.socio);
  const cerrada = e.estado === 'entregado' || e.estado === 'cancelado';

  return (
    <div className="ent">
      <style>{ENT_CSS}</style>
      <button className="ent-back" onClick={onBack}><ArrowLeft size={16} /> Entregas</button>

      <div className="ent-detail-head">
        <span className="ent-bar lg" style={{ background: s.bar }} />
        <div className="ent-detail-body">
          <div className="ent-title-line">
            {e.prioridad === 'high' && <Flag size={15} color={C.red} />}
            <span className="ent-chip-badge" style={{ background: s.bg, color: s.tx }}>{u.label}</span>
            <span className="ent-chip-badge" style={{ background: '#EEF1F6', color: C.textMuted }}>{ESTADO_LABEL[e.estado]}</span>
          </div>
          <h1 style={cerrada ? { textDecoration: 'line-through', color: C.textLight } : {}}>{e.titulo}</h1>
          {e.descripcion && <p className="ent-detail-desc">{e.descripcion}</p>}
          <div className="ent-detail-meta">
            <span><CalendarDays size={13} /> {fmtFecha(e.fecha_entrega)}</span>
            <span className="ent-owner" style={{ color: si.color }}><span className="ent-dot" style={{ background: si.color }} />{si.label}</span>
            {e.meet_link && <a href={e.meet_link} target="_blank" rel="noopener" style={{ color: C.blue }}><Video size={13} /> Meet</a>}
            {e.evento_google_id && <span style={{ color: C.blue }}><CalendarDays size={13} /> En Google Calendar</span>}
          </div>
        </div>
        <div className="ent-detail-actions">
          <button onClick={() => onEdit(e)} className="ent-icon-btn"><Pencil size={15} /></button>
        </div>
      </div>

      <div className="ent-detail-grid">
        {/* EVIDENCIAS */}
        <div className="ent-card">
          <div className="ent-card-head"><Paperclip size={16} color={C.gold} /> Evidencias <span>({data.evidencias.length})</span>
            <button className="ent-mini" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? '…' : <><Upload size={13} /> Subir</>}</button>
            <input ref={fileRef} type="file" multiple hidden onChange={ev => subir([...ev.target.files])} />
          </div>
          <div className="ent-drop" onClick={() => fileRef.current?.click()} onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); subir([...(ev.dataTransfer?.files || [])]); }}>
            <Upload size={20} color={C.textLight} /><span>Arrastra archivos o haz clic para subir</span>
          </div>
          {data.evidencias.length === 0 ? <p className="ent-muted">Aún no hay evidencias.</p> : (
            <div className="ent-evid-list">
              {data.evidencias.map(ev => (
                <div key={ev.id} className="ent-evid">
                  {(ev.resource_type === 'image' || /^image\//.test(ev.formato || '')) ? (
                    <a href={ev.url} target="_blank" rel="noopener"><img src={ev.url} alt={ev.nombre} /></a>
                  ) : <div className="ent-evid-ic"><FileText size={17} color={C.blue} /></div>}
                  <div className="ent-evid-info"><div className="ent-evid-name">{ev.nombre}</div><div className="ent-evid-sub">{fmtBytes(ev.bytes)} · {(ev.uploaded_by_name || '').split(' ')[0]} · {fmtDateTime(ev.created_at)}</div></div>
                  <a href={ev.url} target="_blank" rel="noopener" download title="Descargar"><Download size={15} /></a>
                  <button title="Borrar" onClick={() => borrarEvid(ev)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NOTAS */}
        <div className="ent-card">
          <div className="ent-card-head"><MessageSquare size={16} color={C.gold} /> Notas <span>({data.notas.length})</span></div>
          <div className="ent-notas">
            {data.notas.length === 0 ? <p className="ent-muted">Sin notas todavía.</p> : data.notas.map(n => (
              <div key={n.id} className="ent-nota">
                <div className="ent-nota-head"><strong>{(n.usuario_name || 'Admin').split(' ')[0]}</strong><span>{fmtDateTime(n.created_at)} <button onClick={() => borrarNota(n)}><X size={12} /></button></span></div>
                <p>{n.texto}</p>
              </div>
            ))}
          </div>
          <div className="ent-nota-add">
            <textarea value={nota} onChange={ev => setNota(ev.target.value)} rows={2} placeholder="Escribe una nota…" onKeyDown={ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) addNota(); }} />
            <button onClick={addNota} disabled={!nota.trim()}><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════ MODAL FORM ══════════════════
function FormModal({ form, setForm, saving, miSocio, onClose, onSave }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="ent-modal-bg" onClick={onClose}>
      <div className="ent-modal" onClick={e => e.stopPropagation()}>
        <div className="ent-modal-head"><h2>{form.id ? 'Editar entrega' : 'Nueva entrega'}</h2><button onClick={onClose}><X size={18} /></button></div>
        <label>Título *</label>
        <input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej. Enviar reporte al consejo" autoFocus />
        <label>Descripción</label>
        <textarea rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Detalle (opcional)" />
        <div className="ent-modal-row">
          <div><label>Fecha de entrega *</label><input type="date" value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} /></div>
          <div><label>Prioridad</label><select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>{PRIORIDADES.map(p => <option key={p.v} value={p.v}>{p.t}</option>)}</select></div>
        </div>
        <label>Responsable (socio)</label>
        <select value={form.socio} onChange={e => set('socio', e.target.value)}>{SOCIOS.map(s => <option key={s.key} value={s.key}>{s.label}{s.key === miSocio ? ' (yo)' : ''}</option>)}</select>

        <label className="ent-check"><input type="checkbox" checked={form.crearEvento} onChange={e => set('crearEvento', e.target.checked)} /> Crear evento en el Google Calendar de {socioInfo(form.socio).label}</label>
        {form.crearEvento && (
          <div className="ent-modal-row">
            <div><label>Hora inicio (opcional)</label><input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} /></div>
            <div><label>Hora fin (opcional)</label><input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} /></div>
            <label className="ent-check sm"><input type="checkbox" checked={form.meet} onChange={e => set('meet', e.target.checked)} /> Añadir Google Meet</label>
          </div>
        )}

        <div className="ent-modal-foot">
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button className="ent-btn-primary" onClick={onSave} disabled={saving}>{saving ? '…' : (form.id ? 'Guardar' : 'Agregar')}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════ CALENDARIO (entregas + agenda real de Google) ══════════════════
const CAL_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CAL_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const evDate = (ev) => ev.start?.dateTime ? new Date(ev.start.dateTime) : parseLocal(ev.start?.date);

function CalendarioEntregas({ entregas, socioF, onOpen }) {
  const [cur, setCur] = useState(new Date());
  const [gev, setGev] = useState([]);
  const [gloading, setGloading] = useState(false);
  const [gerror, setGerror] = useState('');
  const [sel, setSel] = useState(null);
  const year = cur.getFullYear(), month = cur.getMonth();

  useEffect(() => {
    let cancel = false;
    (async () => {
      setGloading(true); setGerror('');
      const timeMin = new Date(year, month, 1 - 7).toISOString();
      const timeMax = new Date(year, month + 1, 7).toISOString();
      const socios = socioF === 'todos' ? SOCIOS.map(s => s.key) : [socioF];
      const all = []; let anyErr = false;
      await Promise.all(socios.map(async k => {
        try { const r = await api.calSocioEvents(k, timeMin, timeMax); (r.items || []).forEach(ev => all.push({ ...ev, socio: k })); }
        catch { anyErr = true; }
      }));
      if (cancel) return;
      setGev(all); setGloading(false);
      if (anyErr) setGerror('Algún calendario de Google no se pudo leer (¿socio conectado en Calendarios?).');
    })();
    return () => { cancel = true; };
  }, [year, month, socioF]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const entregasDia = (d) => entregas.filter(e => { const f = parseLocal(e.fecha_entrega); return f && f.getFullYear() === year && f.getMonth() === month && f.getDate() === d; });
  const googleDia = (d) => gev.filter(ev => { const f = evDate(ev); return f && f.getFullYear() === year && f.getMonth() === month && f.getDate() === d; });
  const selEnt = sel ? entregasDia(sel) : [];
  const selGoogle = sel ? googleDia(sel).sort((a, b) => evDate(a) - evDate(b)) : [];

  return (
    <div className="ent-cal-wrap">
      <div className="ent-cal">
        <div className="ent-cal-head">
          <h3>{CAL_MONTHS[month]} {year}</h3>
          <div className="ent-cal-nav">
            {gloading && <span className="ent-spinner" />}
            <button onClick={() => setCur(new Date(year, month - 1, 1))}><ChevronLeft size={18} /></button>
            <button onClick={() => setCur(new Date(year, month + 1, 1))}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="ent-cal-grid ent-cal-dow">{CAL_DAYS.map(d => <div key={d}>{d}</div>)}</div>
        <div className="ent-cal-grid">
          {Array.from({ length: firstDay }).map((_, i) => <div key={'x' + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1; const ents = entregasDia(d); const gs = googleDia(d);
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            const owners = socioF === 'todos' ? [...new Set([...ents.map(e => e.socio), ...gs.map(g => g.socio)])] : [];
            return (
              <button key={d} className={`ent-cal-day ${isToday ? 'today' : ''} ${sel === d ? 'sel' : ''}`} onClick={() => setSel(d === sel ? null : d)}>
                <span>{d}</span>
                <div className="ent-cal-dots">
                  {socioF === 'todos'
                    ? owners.slice(0, 3).map(o => <i key={o} style={{ background: socioInfo(o).color }} />)
                    : <>
                      {ents.slice(0, 2).map((e, j) => <i key={'e' + j} style={{ background: urgStyle(urg(e)).bar }} />)}
                      {gs.length > 0 && <i style={{ background: C.textLight }} />}
                    </>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="ent-cal-legend">
          {socioF === 'todos'
            ? SOCIOS.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)
            : <span><i style={{ background: C.textLight }} /> Eventos Google &nbsp; <i style={{ background: C.red }} /> entrega vencida</span>}
          {gerror && <span className="ent-cal-err">{gerror}</span>}
        </div>
      </div>

      <div className="ent-cal-side">
        <div className="ent-card">
          <div className="ent-card-head"><CalendarDays size={16} color={C.gold} /> {sel ? `${sel} de ${CAL_MONTHS[month]}` : 'Selecciona un día'}</div>
          {!sel ? <p className="ent-muted">Haz clic en un día para ver sus entregas y la agenda real.</p> : (
            <>
              <div className="ent-cal-block-title">Entregas</div>
              {selEnt.length === 0 ? <p className="ent-muted">Sin entregas este día.</p> : selEnt.map(e => (
                <div key={e.id} className="ent-cal-item" onClick={() => onOpen(e.id)} role="button">
                  <span className="ent-bar" style={{ background: urgStyle(urg(e)).bar }} />
                  <div><div className="ent-cal-item-t">{e.titulo}</div><div className="ent-cal-item-s"><span className="ent-dot" style={{ background: socioInfo(e.socio).color }} />{socioInfo(e.socio).label} · {ESTADO_LABEL[e.estado]}</div></div>
                </div>
              ))}
              <div className="ent-cal-block-title">Agenda real · Google</div>
              {selGoogle.length === 0 ? <p className="ent-muted">Sin eventos este día.</p> : selGoogle.map((ev, idx) => (
                <div key={idx} className="ent-cal-item">
                  <span className="ent-bar" style={{ background: socioInfo(ev.socio).color }} />
                  <div><div className="ent-cal-item-t">{ev.summary || '(sin título)'}</div><div className="ent-cal-item-s">{ev.start?.dateTime ? evDate(ev).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Todo el día'} · {socioInfo(ev.socio).label}{ev.hangoutLink ? ' · Meet' : ''}</div></div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const ENT_CSS = `
.ent { max-width:1180px; margin:0 auto; font-family:'Inter',system-ui,sans-serif; color:${C.text}; }
.ent-seg { display:flex; gap:2px; padding:3px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); border-radius:10px; }
.ent-seg button { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border:none; background:none; color:rgba(242,228,200,.65); font-size:12.5px; font-weight:600; border-radius:7px; cursor:pointer; }
.ent-seg button.on { background:rgba(242,228,200,.16); color:#F2E4C8; }
.ent-cal-wrap { display:grid; grid-template-columns:1fr 320px; gap:16px; }
@media(max-width:900px){ .ent-cal-wrap { grid-template-columns:1fr; } }
.ent-cal { background:#fff; border:1px solid ${C.border}; border-radius:16px; padding:18px 20px; }
.ent-cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.ent-cal-head h3 { font-family:'Fraunces',Georgia,serif; font-size:18px; color:${C.ink}; margin:0; }
.ent-cal-nav { display:flex; align-items:center; gap:6px; }
.ent-cal-nav button { background:none; border:1px solid ${C.border}; border-radius:8px; padding:5px; color:${C.textMuted}; cursor:pointer; display:flex; }
.ent-cal-nav button:hover { background:${C.bg}; }
.ent-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
.ent-cal-dow div { text-align:center; font-size:10.5px; font-weight:700; color:${C.textLight}; text-transform:uppercase; padding:4px 0; }
.ent-cal-day { position:relative; min-height:48px; border:1px solid transparent; border-radius:10px; background:none; cursor:pointer; font-size:13px; color:${C.text}; padding:5px; display:flex; flex-direction:column; align-items:center; gap:3px; }
.ent-cal-day:hover { background:${C.bg}; } .ent-cal-day.today { background:${C.blueBg}; color:${C.blue}; font-weight:700; } .ent-cal-day.sel { border-color:${C.primary}; background:${C.blueBg}; }
.ent-cal-dots { display:flex; gap:2px; flex-wrap:wrap; justify-content:center; }
.ent-cal-dots i { width:6px; height:6px; border-radius:50%; display:block; }
.ent-cal-legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:14px; padding-top:12px; border-top:1px solid ${C.border}; font-size:11.5px; color:${C.textMuted}; }
.ent-cal-legend span { display:inline-flex; align-items:center; gap:5px; } .ent-cal-legend i { width:9px; height:9px; border-radius:50%; display:inline-block; }
.ent-cal-err { color:${C.amber}; flex-basis:100%; }
.ent-cal-side .ent-card { position:sticky; top:12px; }
.ent-cal-block-title { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:${C.textLight}; margin:12px 0 8px; }
.ent-cal-item { display:flex; gap:9px; padding:8px; border:1px solid ${C.border}; border-radius:10px; margin-bottom:7px; cursor:pointer; }
.ent-cal-item:hover { background:${C.bg}; }
.ent-cal-item-t { font-size:13px; color:${C.text}; font-weight:500; }
.ent-cal-item-s { font-size:11px; color:${C.textMuted}; display:flex; align-items:center; gap:5px; margin-top:2px; }
.ent-plaque { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:16px; padding:18px 24px; border-radius:16px; background:radial-gradient(130% 170% at 8% 0%, #14315E 0%, ${C.ink} 55%, #081324 100%); box-shadow:0 14px 36px -22px rgba(4,12,26,.6); }
.ent-plaque h1 { font-family:'Fraunces',Georgia,serif; font-size:25px; font-weight:600; margin:0; color:#F2E4C8; display:flex; align-items:center; gap:10px; }
.ent-plaque p { font-size:12px; color:rgba(233,240,250,.6); margin:3px 0 0; }
.ent-head-actions { display:flex; gap:8px; }
.ent-btn-primary { display:inline-flex; align-items:center; gap:6px; padding:9px 15px; border-radius:10px; border:none; font-size:13px; font-weight:600; color:#fff; background:${C.primary}; cursor:pointer; }
.ent-btn-primary:hover { background:${C.primaryDark}; } .ent-btn-primary:disabled { opacity:.6; }
.ent-icon-btn { display:inline-flex; align-items:center; justify-content:center; padding:9px; border-radius:10px; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.08); color:#F2E4C8; cursor:pointer; }
.ent-spin { animation:entSpin 1s linear infinite; } @keyframes entSpin { to { transform:rotate(360deg); } }

.ent-flash { padding:10px 14px; border-radius:10px; font-size:13px; margin-bottom:12px; }
.ent-flash-ok { background:${C.greenBg}; color:${C.green}; } .ent-flash-err { background:${C.redBg}; color:${C.red}; } .ent-flash-warn { background:${C.amberBg}; color:${C.amber}; }

.ent-kpis { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:14px; }
@media(max-width:900px){ .ent-kpis { grid-template-columns:repeat(3,1fr); } }
.ent-kpi { text-align:left; padding:12px 14px; border-radius:14px; background:#fff; border:1px solid ${C.border}; cursor:pointer; transition:all .15s; }
.ent-kpi:hover { box-shadow:0 8px 22px -16px rgba(0,43,117,.3); } .ent-kpi.on { border-color:${C.primary}; box-shadow:0 0 0 1px ${C.primary}; }
.ent-kpi-label { font-size:10px; letter-spacing:.05em; text-transform:uppercase; color:${C.textMuted}; font-weight:700; }
.ent-kpi-n { font-family:'Fraunces',Georgia,serif; font-size:27px; font-weight:700; line-height:1.1; margin-top:2px; }
.ent-kpi-sub { font-size:10.5px; color:${C.textLight}; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.ent-search { display:flex; align-items:center; gap:10px; padding:11px 15px; border-radius:12px; background:#fff; border:1px solid ${C.border}; margin-bottom:12px; }
.ent-search input { flex:1; border:none; outline:none; font-size:14px; color:${C.text}; background:transparent; }
.ent-search button { background:none; border:none; cursor:pointer; display:flex; }

.ent-chips { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:14px; }
.ent-chip { display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:999px; border:1px solid ${C.border}; background:#fff; color:${C.textMuted}; font-size:12px; font-weight:600; cursor:pointer; }
.ent-chip.on { background:${C.primary}; color:#fff; border-color:${C.primary}; } .ent-chip.subtle.on { background:${C.blueBg}; color:${C.blue}; border-color:${C.blue}; }
.ent-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.ent-sep { width:1px; height:20px; background:${C.border}; margin:0 4px; }

.ent-tbl-wrap { border:1px solid ${C.border}; border-radius:16px; overflow:hidden; background:#fff; }
.ent-tbl { width:100%; border-collapse:collapse; }
.ent-tbl thead th { text-align:left; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:${C.textMuted}; font-weight:700; padding:11px 14px; border-bottom:1px solid ${C.border}; background:${C.bg}; }
.ent-row { cursor:pointer; } .ent-row td { padding:11px 14px; border-bottom:1px solid ${C.border}; vertical-align:middle; }
.ent-row:last-child td { border-bottom:none; } .ent-row:hover { background:${C.bg}; }
.ent-row-main { display:flex; gap:12px; align-items:stretch; }
.ent-bar { width:3px; border-radius:3px; flex-shrink:0; min-height:34px; } .ent-bar.lg { width:5px; }
.ent-title-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ent-title { font-weight:600; color:${C.text}; font-size:14px; }
.ent-chip-badge { font-size:9.5px; font-weight:700; letter-spacing:.03em; padding:2px 8px; border-radius:999px; }
.ent-desc { font-size:12px; color:${C.textMuted}; margin-top:2px; max-width:46ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ent-meta { display:flex; gap:12px; margin-top:4px; font-size:11px; color:${C.textLight}; }
.ent-meta span { display:inline-flex; align-items:center; gap:3px; }
.ent-owner { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; }
.ent-status { font-size:11.5px; font-weight:600; color:${C.textMuted}; padding:3px 10px; border-radius:999px; background:${C.bg}; white-space:nowrap; }
.ent-fecha { font-size:13px; color:${C.text}; } .ent-rel { font-size:11px; }
.ent-actions { white-space:nowrap; } .ent-actions button { background:none; border:none; padding:6px; border-radius:8px; color:${C.textMuted}; cursor:pointer; }
.ent-actions button:hover { background:${C.bg}; color:${C.text}; } .ent-actions button.green:hover { color:${C.green}; } .ent-actions button.red:hover { color:${C.red}; }
.ent-chev { font-size:22px; color:${C.textLight}; text-align:center; width:24px; }

.ent-loading, .ent-empty { text-align:center; padding:50px 20px; color:${C.textMuted}; }
.ent-empty p { margin:10px 0; } .ent-empty button, .ent-loading { font-size:14px; }
.ent-empty button { background:none; border:none; color:${C.primary}; font-weight:600; cursor:pointer; }
.ent-spinner { display:inline-block; width:18px; height:18px; border:2px solid ${C.border}; border-top-color:${C.primary}; border-radius:50%; animation:entSpin .8s linear infinite; vertical-align:middle; margin-right:6px; }

/* Detalle */
.ent-back { display:inline-flex; align-items:center; gap:6px; background:none; border:none; color:${C.textMuted}; font-size:13px; cursor:pointer; margin-bottom:14px; }
.ent-back:hover { color:${C.text}; }
.ent-detail-head { display:flex; gap:0; background:#fff; border:1px solid ${C.border}; border-radius:16px; overflow:hidden; margin-bottom:16px; }
.ent-detail-body { flex:1; padding:20px 22px; } .ent-detail-body h1 { font-family:'Fraunces',Georgia,serif; font-size:24px; font-weight:600; color:${C.ink}; margin:6px 0 0; }
.ent-detail-desc { font-size:13px; color:${C.textMuted}; margin:8px 0 0; white-space:pre-wrap; }
.ent-detail-meta { display:flex; gap:14px; margin-top:12px; font-size:12px; color:${C.textMuted}; flex-wrap:wrap; }
.ent-detail-meta span, .ent-detail-meta a { display:inline-flex; align-items:center; gap:5px; text-decoration:none; }
.ent-detail-actions { padding:18px; } .ent-detail-actions .ent-icon-btn { background:${C.bg}; border:1px solid ${C.border}; color:${C.textMuted}; }
.ent-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media(max-width:820px){ .ent-detail-grid { grid-template-columns:1fr; } }
.ent-card { background:#fff; border:1px solid ${C.border}; border-radius:16px; padding:18px 20px; }
.ent-card-head { display:flex; align-items:center; gap:8px; font-family:'Fraunces',Georgia,serif; font-size:17px; color:${C.ink}; margin-bottom:14px; }
.ent-card-head span { font-size:13px; color:${C.textLight}; font-family:'Inter',sans-serif; }
.ent-mini { margin-left:auto; display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; padding:6px 11px; border-radius:9px; border:none; background:${C.primary}; color:#fff; cursor:pointer; }
.ent-drop { display:flex; flex-direction:column; align-items:center; gap:6px; padding:18px; border:2px dashed ${C.border}; border-radius:12px; color:${C.textLight}; font-size:12px; cursor:pointer; margin-bottom:12px; text-align:center; }
.ent-drop:hover { border-color:${C.primary}; }
.ent-muted { text-align:center; color:${C.textLight}; font-size:13px; padding:12px 0; }
.ent-evid-list { display:flex; flex-direction:column; gap:8px; }
.ent-evid { display:flex; align-items:center; gap:10px; padding:8px; border:1px solid ${C.border}; border-radius:10px; }
.ent-evid img { width:42px; height:42px; border-radius:7px; object-fit:cover; display:block; }
.ent-evid-ic { width:42px; height:42px; border-radius:7px; background:${C.blueBg}; display:flex; align-items:center; justify-content:center; }
.ent-evid-info { flex:1; min-width:0; } .ent-evid-name { font-size:13px; color:${C.text}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ent-evid-sub { font-size:11px; color:${C.textLight}; }
.ent-evid a, .ent-evid button { background:none; border:none; color:${C.textMuted}; cursor:pointer; padding:5px; border-radius:7px; }
.ent-evid a:hover, .ent-evid button:hover { background:${C.bg}; color:${C.text}; }
.ent-notas { display:flex; flex-direction:column; gap:10px; min-height:90px; margin-bottom:12px; }
.ent-nota { background:${C.bg}; border-radius:10px; padding:10px 12px; }
.ent-nota-head { display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px; } .ent-nota-head strong { color:${C.primary}; }
.ent-nota-head span { color:${C.textLight}; display:inline-flex; align-items:center; gap:6px; } .ent-nota-head button { background:none; border:none; color:${C.textLight}; cursor:pointer; }
.ent-nota p { font-size:13px; color:${C.text}; margin:0; white-space:pre-wrap; }
.ent-nota-add { display:flex; gap:8px; align-items:flex-end; }
.ent-nota-add textarea { flex:1; border:1px solid ${C.border}; border-radius:10px; padding:9px 11px; font-size:13px; resize:none; outline:none; font-family:inherit; }
.ent-nota-add button { background:${C.primary}; color:#fff; border:none; border-radius:10px; padding:10px; cursor:pointer; } .ent-nota-add button:disabled { opacity:.4; }

/* Modal */
.ent-modal-bg { position:fixed; inset:0; background:rgba(10,23,48,.45); display:flex; align-items:center; justify-content:center; padding:16px; z-index:1100; }
.ent-modal { background:#fff; border-radius:18px; width:100%; max-width:520px; padding:24px; max-height:92vh; overflow:auto; }
.ent-modal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; } .ent-modal-head h2 { font-family:'Fraunces',Georgia,serif; font-size:19px; color:${C.ink}; margin:0; } .ent-modal-head button { background:none; border:none; cursor:pointer; color:${C.textMuted}; }
.ent-modal label { display:block; font-size:12.5px; font-weight:600; color:${C.textMuted}; margin:12px 0 4px; }
.ent-modal input, .ent-modal textarea, .ent-modal select { width:100%; border:1px solid ${C.border}; border-radius:10px; padding:9px 11px; font-size:14px; outline:none; font-family:inherit; color:${C.text}; box-sizing:border-box; }
.ent-modal input:focus, .ent-modal textarea:focus, .ent-modal select:focus { border-color:${C.primary}; }
.ent-modal-row { display:flex; gap:10px; flex-wrap:wrap; } .ent-modal-row > div { flex:1; min-width:120px; }
.ent-check { display:flex; align-items:center; gap:8px; margin-top:14px; font-weight:500; color:${C.text}; cursor:pointer; } .ent-check input { width:auto; } .ent-check.sm { font-size:12px; align-self:flex-end; margin-top:0; }
.ent-modal-foot { display:flex; justify-content:flex-end; gap:8px; margin-top:20px; }
.ent-modal-foot .ghost { background:none; border:none; color:${C.textMuted}; font-size:14px; padding:9px 14px; cursor:pointer; }
`;
