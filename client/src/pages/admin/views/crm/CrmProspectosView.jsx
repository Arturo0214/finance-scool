/**
 * CrmProspectosView — Prospección LinkedIn (Patrimonio/PPR/50+ · PyME Fiscal · Médicos)
 * Sección EXCLUSIVA de los 3 socios (Arturo, Ingrid, Flavio) — whitelist por correo.
 *
 *  - Asignación directa de cada prospecto a un socio
 *  - Árbol de referidos (referido_de): de quién viene cada lead y referido del referido
 *  - Flag "Representante" (Rap): prospecto que funge como referidor del esquema
 *  - Seguimiento CRM: estado + bitácora de notas (mismo motor que Mejores Leads)
 *  - Tab Calendarios: agendas Google de los 3 conectadas en una sola vista
 */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  Search, Linkedin, ChevronDown, RefreshCw, GitBranch, Crown,
  CalendarDays, Video, Plus, X, UserCheck,
} from 'lucide-react';

const CAMPANAS = [
  { id: 'linkedin-patrimonio', label: 'Patrimonio · PPR · 50+', color: '#B97F1E' },
  { id: 'linkedin-pyme',       label: 'PyME Fiscal',            color: '#0E8A63' },
  { id: 'linkedin-medicos',    label: 'Médicos PPR',            color: '#2563EB' },
];
const campanaInfo = (b) => CAMPANAS.find(c => c.id === b) || { label: b, color: '#64748B' };

const SOCIOS = ['Arturo', 'Ingrid', 'Flavio'];
const SOCIO_COLOR = { Arturo: '#B97F1E', Ingrid: '#7C3AED', Flavio: '#0891B2' };

const SEG_STATUSES = [
  { id: 'pendiente',  label: 'Pendiente',  color: '#B97F1E' },
  { id: 'contactado', label: 'Contactado', color: '#2563EB' },
  { id: 'interesado', label: 'Interesado', color: '#7C3AED' },
  { id: 'negociando', label: 'Negociando', color: '#0891B2' },
  { id: 'convertido', label: 'Convertido', color: '#0E8A63' },
  { id: 'descartado', label: 'Descartado', color: '#C93A3A' },
];
const segInfo = (id) => SEG_STATUSES.find(s => s.id === id) || SEG_STATUSES[0];

const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function CrmProspectosView() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('todos'); // todos | <bucket> | reps | calendarios
  const [fEstado, setFEstado] = useState('');
  const [fSocio, setFSocio] = useState('');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [nota, setNota] = useState('');
  const [refForm, setRefForm] = useState(null); // { parentId, nombre, whatsapp, perfil, linkedin_url }
  // Calendarios
  const [connections, setConnections] = useState([]);
  const [calendars, setCalendars] = useState(null);
  const [calLoading, setCalLoading] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const { leads: data } = await api.crmGetProspectos();
      setLeads(data || []);
    } catch (e) { setError(e.message || 'No se pudo cargar'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function loadCalendars() {
    setCalLoading(true);
    try {
      const [{ connections: conns }, now] = [await api.getCalendarConnections(), new Date()];
      setConnections(conns || []);
      const tMax = new Date(now.getTime() + 14 * 86400000).toISOString();
      const { calendars: cals } = await api.getCalendarEventsAll(now.toISOString(), tMax);
      setCalendars(cals || []);
    } catch { setCalendars([]); }
    finally { setCalLoading(false); }
  }
  useEffect(() => { if (tab === 'calendarios' && calendars === null) loadCalendars(); }, [tab]); // eslint-disable-line

  async function patch(lead, data) {
    setSavingId(lead.id);
    try {
      const { lead: act } = await api.crmUpdateMejorLead(lead.id, data);
      setLeads(prev => prev.map(l => (l.id === act.id ? act : l)));
    } catch (e) { alert(e.message || 'No se pudo guardar'); }
    finally { setSavingId(null); }
  }

  async function crearReferido() {
    const f = refForm;
    if (!f?.nombre?.trim()) return;
    setSavingId(f.parentId);
    try {
      const { lead } = await api.crmAddReferidoProspecto(f.parentId, f);
      setLeads(prev => [...prev, lead]);
      setRefForm(null);
    } catch (e) { alert(e.message || 'No se pudo crear el referido'); }
    finally { setSavingId(null); }
  }

  /* ── Árbol de referidos ── */
  const hijosDe = useMemo(() => {
    const m = new Map();
    for (const l of leads) {
      if (!l.referido_de) continue;
      if (!m.has(l.referido_de)) m.set(l.referido_de, []);
      m.get(l.referido_de).push(l);
    }
    return m;
  }, [leads]);
  const padreDe = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

  const pasaFiltros = (l) => {
    if (tab === 'reps' && !l.representante) return false;
    if (tab !== 'todos' && tab !== 'reps' && l.bucket !== tab) return false;
    if (fEstado && (l.seg_status || 'pendiente') !== fEstado) return false;
    if (fSocio === 'sin' ? (l.seg_assigned_to || '') !== '' : (fSocio && l.seg_assigned_to !== fSocio)) return false;
    if (q) {
      const t = `${l.nombre} ${l.perfil || ''} ${l.notas_origen || ''}`.toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  };

  // Raíces visibles: sin padre, o cuyo padre no pasa filtros (para no perder hijos)
  const visibles = leads.filter(pasaFiltros);
  const visibleIds = new Set(visibles.map(l => l.id));
  const raices = visibles.filter(l => !l.referido_de || !visibleIds.has(l.referido_de));

  const stats = useMemo(() => {
    const porSocio = Object.fromEntries(SOCIOS.map(s => [s, 0]));
    let sinAsignar = 0, reps = 0, refs = 0;
    for (const l of leads) {
      if (l.seg_assigned_to && porSocio[l.seg_assigned_to] !== undefined) porSocio[l.seg_assigned_to]++;
      else sinAsignar++;
      if (l.representante) reps++;
      if (l.referido_de) refs++;
    }
    return { porSocio, sinAsignar, reps, refs };
  }, [leads]);

  /* ── Row de prospecto (recursivo para el árbol) ── */
  function Row({ l, depth = 0 }) {
    const camp = campanaInfo(l.bucket);
    const st = segInfo(l.seg_status || 'pendiente');
    const hijos = (hijosDe.get(l.id) || []);
    const abierto = expanded === l.id;
    const padre = l.referido_de ? padreDe.get(l.referido_de) : null;
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          marginLeft: depth * 26, borderLeft: depth ? `2px solid ${camp.color}55` : 'none',
          background: abierto ? '#0E2238' : '#0B1C2E', borderRadius: 10, marginBottom: 6,
          border: '1px solid rgba(255,255,255,.06)',
        }}>
          {depth > 0 && <GitBranch size={13} color={camp.color} title={`Referido de ${padre?.nombre || '#' + l.referido_de}`} />}
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { setExpanded(abierto ? null : l.id); setNota(''); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color: '#EDE6D6', fontSize: 13.5 }}>{l.nombre}</strong>
              {l.representante && (
                <span style={{ fontSize: 10, background: '#B97F1E22', color: '#E3B458', border: '1px solid #B97F1E55', borderRadius: 20, padding: '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Crown size={10} /> Representante
                </span>
              )}
              <span style={{ fontSize: 10, color: camp.color, border: `1px solid ${camp.color}66`, borderRadius: 20, padding: '1px 8px' }}>{camp.label}</span>
              {typeof l.score === 'number' && <span style={{ fontSize: 10.5, opacity: .6 }}>score {Math.round(l.score)}</span>}
            </div>
            <div style={{ fontSize: 11.5, opacity: .65, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {l.perfil || (l.notas_origen || '').slice(0, 90)}
              {padre && <em style={{ color: camp.color, marginLeft: 6 }}>· viene de {padre.nombre}</em>}
              {hijos.length > 0 && <em style={{ marginLeft: 6 }}>· {hijos.length} referido{hijos.length > 1 ? 's' : ''}</em>}
            </div>
          </div>
          {l.linkedin_url && (
            <a href={l.linkedin_url} target="_blank" rel="noreferrer" title="Abrir LinkedIn"
              style={{ color: '#5CA8FF', display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
              <Linkedin size={16} />
            </a>
          )}
          <select value={l.seg_assigned_to || ''} disabled={savingId === l.id}
            onChange={e => patch(l, { seg_assigned_to: e.target.value })}
            style={{ background: '#122A42', color: l.seg_assigned_to ? SOCIO_COLOR[l.seg_assigned_to] : '#8CA3B8', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '4px 6px', fontSize: 11.5 }}>
            <option value="">Sin asignar</option>
            {SOCIOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={l.seg_status || 'pendiente'} disabled={savingId === l.id}
            onChange={e => patch(l, { seg_status: e.target.value })}
            style={{ background: '#122A42', color: st.color, border: `1px solid ${st.color}66`, borderRadius: 8, padding: '4px 6px', fontSize: 11.5 }}>
            {SEG_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <ChevronDown size={15} style={{ opacity: .5, transform: abierto ? 'rotate(180deg)' : 'none', cursor: 'pointer' }}
            onClick={() => { setExpanded(abierto ? null : l.id); setNota(''); }} />
        </div>

        {abierto && (
          <div style={{ marginLeft: depth * 26 + 16, marginBottom: 10, padding: '12px 14px', background: '#0A1828', borderRadius: 10, border: '1px solid rgba(255,255,255,.05)', fontSize: 12 }}>
            <div style={{ opacity: .75, marginBottom: 8 }}>{l.notas_origen}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button onClick={() => patch(l, { representante: !l.representante })} disabled={savingId === l.id}
                style={{ background: l.representante ? '#B97F1E' : 'transparent', color: l.representante ? '#0A1828' : '#E3B458', border: '1px solid #B97F1E', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <UserCheck size={12} /> {l.representante ? 'Es representante (Rap)' : 'Marcar como representante'}
              </button>
              <button onClick={() => setRefForm({ parentId: l.id, nombre: '', whatsapp: '', perfil: '', linkedin_url: '' })}
                style={{ background: 'transparent', color: '#5CA8FF', border: '1px solid #2563EB88', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Plus size={12} /> Agregar referido
              </button>
            </div>

            {refForm?.parentId === l.id && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                {['nombre', 'whatsapp', 'perfil', 'linkedin_url'].map(k => (
                  <input key={k} placeholder={k === 'linkedin_url' ? 'LinkedIn (opcional)' : k[0].toUpperCase() + k.slice(1) + (k === 'nombre' ? ' *' : ' (opcional)')}
                    value={refForm[k]} onChange={e => setRefForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ background: '#122A42', color: '#EDE6D6', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '5px 8px', fontSize: 11.5, width: k === 'nombre' ? 170 : 140 }} />
                ))}
                <button onClick={crearReferido} disabled={!refForm.nombre.trim() || savingId === l.id}
                  style={{ background: '#0E8A63', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11.5, cursor: 'pointer' }}>Guardar</button>
                <button onClick={() => setRefForm(null)} style={{ background: 'transparent', color: '#8CA3B8', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            )}

            {/* Bitácora */}
            {(Array.isArray(l.seg_notes_log) ? l.seg_notes_log : []).slice().reverse().map((n, i) => (
              <div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid rgba(255,255,255,.04)' : 'none', opacity: .8 }}>
                <span style={{ color: '#E3B458' }}>{n.by}</span> · <span style={{ opacity: .6 }}>{fmtFechaHora(n.at)}</span>
                <div>{n.text}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input placeholder="Agregar nota de seguimiento…" value={nota} onChange={e => setNota(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && nota.trim()) { patch(l, { nota }); setNota(''); } }}
                style={{ flex: 1, background: '#122A42', color: '#EDE6D6', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} />
              <button onClick={() => { if (nota.trim()) { patch(l, { nota }); setNota(''); } }}
                style={{ background: C.gold, color: '#0A1828', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11.5, cursor: 'pointer' }}>Nota</button>
            </div>
          </div>
        )}

        {hijos.map(h => <Row key={h.id} l={h} depth={depth + 1} />)}
      </>
    );
  }

  /* ── Calendarios ── */
  function Calendarios() {
    const porDia = useMemo(() => {
      const m = new Map();
      for (const cal of calendars || []) {
        for (const e of cal.events) {
          const dia = String(e.start).slice(0, 10);
          if (!m.has(dia)) m.set(dia, []);
          m.get(dia).push({ ...e, owner: cal.owner });
        }
      }
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [calendars]);
    const ownerColor = (email) => {
      const i = (calendars || []).findIndex(c => c.owner === email);
      return ['#B97F1E', '#7C3AED', '#0891B2', '#0E8A63'][i % 4];
    };
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {(connections || []).map(c => (
            <span key={c.google_email} style={{ fontSize: 11.5, background: '#0E2238', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '4px 12px', color: ownerColor(c.google_email) }}>
              ● {c.google_email}
            </span>
          ))}
          <button onClick={async () => { const { url } = await api.getGoogleAuthUrl(); window.location.href = url; }}
            style={{ background: C.gold, color: '#0A1828', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            Conectar mi Google Calendar
          </button>
          <button onClick={loadCalendars} style={{ background: 'transparent', color: '#8CA3B8', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
            <RefreshCw size={13} />
          </button>
        </div>
        <p style={{ fontSize: 11.5, opacity: .6, marginBottom: 14 }}>
          Cada socio conecta su Google una vez con el botón (inicia sesión con SU cuenta). Aquí se ven las agendas de todos los conectados — próximos 14 días.
        </p>
        {calLoading && <p style={{ opacity: .6 }}>Cargando agendas…</p>}
        {!calLoading && porDia.length === 0 && <p style={{ opacity: .6 }}>Sin eventos en los próximos 14 días (o nadie ha conectado su calendario).</p>}
        {porDia.map(([dia, evs]) => (
          <div key={dia} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, color: '#E3B458', marginBottom: 6 }}>
              {new Date(`${dia}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {evs.sort((a, b) => String(a.start).localeCompare(String(b.start))).map(e => (
              <div key={`${e.owner}|${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#0B1C2E', borderRadius: 8, marginBottom: 4, border: '1px solid rgba(255,255,255,.05)', fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: ownerColor(e.owner), flexShrink: 0 }} title={e.owner} />
                <span style={{ opacity: .65, width: 90 }}>{e.all_day ? 'Todo el día' : new Date(e.start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ flex: 1 }}>{e.title}</span>
                <span style={{ fontSize: 10.5, opacity: .5 }}>{(e.owner || '').split('@')[0]}</span>
                {e.meet && <a href={e.meet} target="_blank" rel="noreferrer" style={{ color: '#5CA8FF', display: 'inline-flex' }}><Video size={14} /></a>}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div style={{ color: '#D7E3EE' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ margin: 0, color: '#EDE6D6', fontSize: 22 }}>Prospectos</h2>
        <span style={{ fontSize: 12, opacity: .6 }}>LinkedIn · PPR, fiscal y patrimonio — solo socios</span>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'transparent', color: '#8CA3B8', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}><RefreshCw size={13} /></button>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, opacity: .8, marginBottom: 14 }}>
        <span>{leads.length} prospectos</span>
        {SOCIOS.map(s => <span key={s} style={{ color: SOCIO_COLOR[s] }}>{s}: {stats.porSocio[s]}</span>)}
        <span>Sin asignar: {stats.sinAsignar}</span>
        <span style={{ color: '#E3B458' }}><Crown size={11} style={{ verticalAlign: '-1px' }} /> Raps: {stats.reps}</span>
        <span><GitBranch size={11} style={{ verticalAlign: '-1px' }} /> Referidos: {stats.refs}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[{ id: 'todos', label: 'Todos' }, ...CAMPANAS, { id: 'reps', label: 'Representantes' }, { id: 'calendarios', label: 'Calendarios', icon: CalendarDays }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? C.gold : 'transparent', color: tab === t.id ? '#0A1828' : '#B9C9D8',
              border: '1px solid ' + (tab === t.id ? C.gold : 'rgba(255,255,255,.15)'), borderRadius: 20,
              padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: tab === t.id ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            {t.icon && <t.icon size={13} />}{t.label}
            {t.id !== 'calendarios' && <span style={{ opacity: .6, fontSize: 10.5 }}>
              {t.id === 'todos' ? leads.length : t.id === 'reps' ? stats.reps : leads.filter(l => l.bucket === t.id).length}
            </span>}
          </button>
        ))}
      </div>

      {tab === 'calendarios' ? <Calendarios /> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: 9, opacity: .5 }} />
              <input placeholder="Buscar nombre, perfil…" value={q} onChange={e => setQ(e.target.value)}
                style={{ background: '#0E2238', color: '#EDE6D6', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 10px 6px 28px', fontSize: 12, width: 210 }} />
            </div>
            <select value={fSocio} onChange={e => setFSocio(e.target.value)} style={{ background: '#0E2238', color: '#B9C9D8', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="">Asignado: todos</option>
              {SOCIOS.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="sin">Sin asignar</option>
            </select>
            <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={{ background: '#0E2238', color: '#B9C9D8', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="">Estado: todos</option>
              {SEG_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {error && <p style={{ color: '#F08989' }}>{error}</p>}
          {loading ? <p style={{ opacity: .6 }}>Cargando prospectos…</p> : (
            raices.length === 0 ? <p style={{ opacity: .6 }}>Sin prospectos con estos filtros.</p>
              : raices.map(l => <Row key={l.id} l={l} />)
          )}
        </>
      )}
    </div>
  );
}
