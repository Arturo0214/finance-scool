/**
 * CrmCalendariosView — Calendario de los socios (Arturo · Ingrid · Flavio).
 * Esquema portado de Tesipedia-F (AdminCalendars): tarjetas de conexión por
 * socio, calendario de mes, chips de evento por color, modal de día con línea
 * de tiempo por hora y modal de crear/editar evento con Google Meet.
 * Re-tematizado a la paleta clara "banca privada" de FSC.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, RefreshCw, X, Link2, Unlink,
  Edit2, Trash2, Video, Copy, Check,
} from 'lucide-react';

const SOCIOS = [
  { key: 'arturo', label: 'Arturo', color: '#8A6A34' },
  { key: 'ingrid', label: 'Ingrid', color: '#7C3AED' },
  { key: 'flavio', label: 'Flavio', color: '#0891B2' },
];
const socioInfo = (k) => SOCIOS.find(s => s.key === k) || SOCIOS[0];

const hexToRgba = (hex, a) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return `rgba(148,163,184,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
};

// Color del evento: Meet = azul; si no, hereda el color de SU calendario de Google
function getEventStyle(calendarColor, hasMeet) {
  if (hasMeet) return { bg: C.blueBg, border: C.blue, text: '#0A4FA0' };
  const c = calendarColor || C.gold;
  return { bg: hexToRgba(c, 0.14), border: c, text: C.ink };
}

// Google manda eventos de todo el día como "YYYY-MM-DD"; new Date() los lee en
// UTC y en México se pintaban un día antes → parsear a local.
const parseEventDate = (ev) => {
  if (ev.start?.dateTime) return new Date(ev.start.dateTime);
  const [y, m, d] = String(ev.start?.date || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};
const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const CAL_CSS = `
  .cal { --gold:${C.gold}; --ink:${C.ink}; --hair:#E4E8F0; }
  @keyframes calRise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  .cal-plaque { position:relative; overflow:hidden; display:flex; align-items:center; gap:14px; margin-bottom:16px; padding:18px 24px; border-radius:16px; background:radial-gradient(130% 170% at 8% 0%, #14315E 0%, ${C.ink} 55%, #081324 100%); box-shadow:0 14px 36px -22px rgba(4,12,26,.6); animation:calRise .5s ease backwards; }
  .cal-plaque h1 { font-family:'Fraunces',Georgia,serif; font-size:25px; font-weight:600; margin:0; color:#F2E4C8; display:flex; align-items:center; gap:10px; }
  .cal-plaque p { font-size:12px; color:rgba(233,240,250,.6); margin:3px 0 0; }

  .cal-socios { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-bottom:18px; }
  .cal-socio { background:#fff; border:1px solid var(--hair); border-radius:14px; padding:14px 15px; cursor:pointer; transition:all .2s; border-top:3px solid var(--sc); }
  .cal-socio.sel { box-shadow:0 0 0 2px var(--sc), 0 10px 24px -16px rgba(0,43,117,.3); }
  .cal-socio:hover { transform:translateY(-2px); }
  .cal-socio-top { display:flex; align-items:center; gap:10px; }
  .cal-avatar { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',Georgia,serif; font-weight:700; color:#fff; background:var(--sc); flex-shrink:0; }
  .cal-socio-info strong { display:block; font-size:14px; color:var(--ink); }
  .cal-socio-mail { font-size:10.5px; color:${C.textMuted}; display:flex; align-items:center; gap:4px; margin-top:2px; }
  .cal-socio-off { font-size:11px; color:${C.textLight}; }
  .cal-socio-act { margin-top:11px; display:flex; gap:7px; }
  .cal-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:inherit; font-size:11.5px; font-weight:700; border-radius:9px; padding:7px 12px; cursor:pointer; border:1px solid var(--hair); background:#fff; color:${C.textMuted}; transition:all .18s; }
  .cal-btn:hover { border-color:var(--gold); color:#8A6A34; }
  .cal-btn.connect { background:linear-gradient(180deg,#C8A066,#A87F45); color:#fff; border-color:transparent; }
  .cal-btn.gold { background:linear-gradient(180deg,#C8A066,#A87F45); color:#fff; border-color:transparent; }
  .cal-btn.danger { color:${C.red}; }
  .cal-btn.danger:hover { background:${C.redBg}; border-color:${C.red}; }
  .cal-btn:disabled { opacity:.5; cursor:default; }

  .cal-section { background:#fff; border:1px solid var(--hair); border-radius:16px; padding:16px 18px; animation:calRise .5s .05s ease backwards; }
  .cal-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px; }
  .cal-head h2 { margin:0; font-size:16px; font-weight:700; color:var(--ink); }
  .cal-nav { display:flex; align-items:center; gap:10px; }
  .cal-nav button { width:30px; height:30px; border-radius:8px; border:1px solid var(--hair); background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; color:${C.textMuted}; }
  .cal-nav button:hover { border-color:var(--gold); color:#8A6A34; }
  .cal-month { font-size:14px; font-weight:700; color:var(--ink); text-transform:capitalize; min-width:150px; text-align:center; }
  .cal-actions { display:flex; gap:7px; }

  .cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; }
  .cal-dow { text-align:center; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:${C.textMuted}; font-weight:700; padding:4px 0; }
  .cal-day { min-height:92px; background:#FBFCFE; border:1px solid #EEF1F6; border-radius:9px; padding:5px 5px 3px; cursor:pointer; display:flex; flex-direction:column; transition:all .15s; overflow:hidden; }
  .cal-day:hover { border-color:rgba(193,151,91,.5); background:#fff; }
  .cal-day.empty { background:transparent; border:none; cursor:default; }
  .cal-day.today { border-color:var(--gold); box-shadow:inset 0 0 0 1px var(--gold); }
  .cal-day-num { font-size:11.5px; font-weight:700; color:${C.textMuted}; align-self:flex-end; }
  .cal-day.today .cal-day-num { color:#8A6A34; }
  .cal-day-evs { display:flex; flex-direction:column; gap:3px; margin-top:2px; overflow:hidden; }
  .cal-chip { display:flex; align-items:center; gap:4px; border-radius:5px; padding:2px 5px; font-size:10px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; }
  .cal-chip em { font-style:normal; opacity:.7; font-size:9px; margin-right:1px; }
  .cal-count { font-size:9.5px; color:${C.textLight}; align-self:flex-start; margin-top:1px; }

  .cal-legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:12px; font-size:11px; color:${C.textMuted}; align-items:center; }
  .cal-legend .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; vertical-align:-1px; }
  .cal-legend-total { margin-left:auto; color:${C.textLight}; }

  .cal-empty { background:#fff; border:1px dashed var(--hair); border-radius:16px; padding:36px 20px; text-align:center; color:${C.textMuted}; }
  .cal-empty svg { color:${C.textLight}; margin-bottom:10px; }

  .cal-overlay { position:fixed; inset:0; background:rgba(5,16,36,.4); backdrop-filter:blur(2px); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; }
  .cal-modal { background:var(--porcelain, #F7F9FC); border-radius:16px; width:min(560px, 96vw); max-height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 70px -30px rgba(4,12,26,.6); border:1px solid rgba(193,151,91,.35); animation:calRise .25s ease; }
  .cal-modal-h { display:flex; align-items:center; justify-content:space-between; padding:15px 20px; background:radial-gradient(140% 180% at 10% 0%, #14315E 0%, ${C.ink} 60%); color:#F2E4C8; }
  .cal-modal-h h3 { margin:0; font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:600; display:flex; align-items:center; gap:9px; text-transform:capitalize; }
  .cal-modal-h button { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); color:#E9DFC8; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .cal-modal-b { padding:16px 20px; overflow-y:auto; }
  .cal-modal-f { display:flex; gap:9px; align-items:center; padding:13px 20px; border-top:1px solid var(--hair); background:#fff; }

  .cal-tl-row { display:flex; gap:10px; border-top:1px solid #EEF1F6; min-height:38px; }
  .cal-tl-hour { font-size:10.5px; color:${C.textLight}; width:46px; flex-shrink:0; padding-top:6px; font-variant-numeric:tabular-nums; }
  .cal-tl-slot { flex:1; padding:4px 0; cursor:pointer; display:flex; flex-direction:column; gap:4px; }
  .cal-tl-slot:hover { background:rgba(193,151,91,.05); }
  .cal-tl-ev { border-radius:8px; padding:7px 10px; cursor:pointer; }
  .cal-tl-ev-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .cal-tl-ev-head strong { font-size:12.5px; }
  .cal-tl-ev-time { font-size:10.5px; color:${C.textMuted}; white-space:nowrap; }
  .cal-tl-ev-body { margin-top:7px; font-size:12px; color:${C.text}; }
  .cal-tl-ev-body p { margin:4px 0; }
  .cal-ev-actions { display:flex; gap:7px; margin-top:8px; }

  .cal-fg { margin-bottom:12px; }
  .cal-fg label { display:block; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#8A6A34; font-weight:800; margin-bottom:5px; }
  .cal-fg input, .cal-fg textarea { width:100%; padding:9px 11px; border:1px solid var(--hair); border-radius:9px; font-size:13px; font-family:inherit; outline:none; background:#fff; color:${C.text}; box-sizing:border-box; }
  .cal-fg input:focus, .cal-fg textarea:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(193,151,91,.14); }
  .cal-fg-row { display:flex; gap:10px; }
  .cal-fg-row .cal-fg { flex:1; }
  .cal-meet-check { display:flex; align-items:center; gap:8px; font-size:12.5px; color:${C.text}; cursor:pointer; margin-bottom:12px; }
  .cal-meet-link { display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:${C.blueBg}; border:1px solid ${C.blue}; border-radius:9px; padding:9px 12px; margin-bottom:12px; }
  .cal-meet-link a { color:#0A4FA0; font-size:12px; font-weight:700; text-decoration:none; word-break:break-all; }
  .cal-hint { font-size:11px; color:${C.textMuted}; margin-top:4px; }
  .cal-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:${C.ink}; color:#F2E4C8; padding:11px 20px; border-radius:11px; font-size:13px; font-weight:600; z-index:3000; box-shadow:0 14px 36px -16px rgba(0,0,0,.5); animation:calRise .25s ease; }
`;

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CrmCalendariosView() {
  const [conectados, setConectados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState('arturo');
  const [events, setEvents] = useState([]);
  const [calendarios, setCalendarios] = useState([]);
  const [evLoading, setEvLoading] = useState(false);
  const [mes, setMes] = useState(new Date());
  const [toast, setToast] = useState('');
  const [dayDetail, setDayDetail] = useState(null);
  const [expandedEv, setExpandedEv] = useState(null);
  const [editEvent, setEditEvent] = useState(null); // event | 'new'
  const [form, setForm] = useState({ summary: '', description: '', date: '', time: '', endTime: '', attendees: '', meet: false });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const isConnected = (k) => conectados.some(c => c.socioKey === k);
  const infoDe = (k) => conectados.find(c => c.socioKey === k);

  const cargarSocios = useCallback(async () => {
    try { setConectados(await api.calSocios()); } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { cargarSocios(); }, [cargarSocios]);

  const cargarEventos = useCallback(async () => {
    if (!isConnected(sel)) { setEvents([]); return; }
    setEvLoading(true);
    try {
      const y = mes.getFullYear(), m = mes.getMonth();
      const tMin = new Date(y, m, 1).toISOString();
      const tMax = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
      const { items, calendarios: cals } = await api.calSocioEvents(sel, tMin, tMax);
      setEvents(items || []); setCalendarios(cals || []);
    } catch { setEvents([]); }
    finally { setEvLoading(false); }
  }, [sel, mes, conectados]); // eslint-disable-line

  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  const conectar = async () => {
    try { const { url } = await api.getGoogleAuthUrl(); window.location.href = url; }
    catch { flash('No se pudo iniciar la conexión'); }
  };

  const openNew = (date, time = '10:00') => {
    const [h, mm] = time.split(':');
    const endTime = `${String(Math.min(23, Number(h) + 1)).padStart(2, '0')}:${mm}`;
    setForm({ summary: '', description: '', date: toYMD(date || new Date()), time, endTime, attendees: '', meet: false });
    setEditEvent('new');
  };
  const openEdit = (ev) => {
    const start = ev.start?.dateTime || ev.start?.date || '';
    const end = ev.end?.dateTime || ev.end?.date || '';
    const allDay = !!ev.start?.date;
    setForm({
      summary: ev.summary || '', description: ev.description || '',
      date: allDay ? start : start.split('T')[0],
      time: allDay ? '' : start.split('T')[1]?.slice(0, 5) || '',
      endTime: allDay ? '' : end.split('T')[1]?.slice(0, 5) || '',
      attendees: (ev.attendees || []).map(a => a.email).filter(Boolean).join(', '), meet: false,
    });
    setEditEvent(ev);
  };

  const guardar = async () => {
    if (!form.summary || !form.date) { flash('Título y fecha requeridos'); return; }
    setSaving(true);
    try {
      const payload = {
        socio: sel, summary: form.summary, description: form.description,
        startDate: form.date, endDate: form.date,
        startTime: form.time || undefined, endTime: form.endTime || undefined,
        attendees: form.attendees, meet: form.meet,
      };
      if (editEvent === 'new') {
        const r = await api.calCreateEvent(payload);
        if (r.hangoutLink) { flash('Reunión creada con Meet 🎥'); setEditEvent({ ...payload, id: r.id, hangoutLink: r.hangoutLink }); cargarEventos(); setSaving(false); return; }
        flash('Evento creado');
      } else {
        await api.calUpdateEvent(editEvent.id, { ...payload, calendarId: editEvent.calendarId || 'primary' });
        flash('Evento actualizado');
      }
      setEditEvent(null); cargarEventos();
    } catch (e) { flash(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };
  const borrar = async (ev) => {
    try { await api.calDeleteEvent(ev.id, sel, ev.calendarId || 'primary'); flash('Evento eliminado'); setEditEvent(null); setDayDetail(null); cargarEventos(); }
    catch { flash('Error al eliminar'); }
  };
  const copiarMeet = (link) => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); };

  // Grid
  const y = mes.getFullYear(), m = mes.getMonth();
  const startDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(y, m, i));

  return (
    <div className="cal">
      <style>{CAL_CSS}</style>

      <div className="cal-plaque">
        <div>
          <h1><CalendarDays size={22} /> Calendarios</h1>
          <p>Agenda de los socios · conecta tu Google, agenda reuniones con Meet y ve la disponibilidad de todos</p>
        </div>
      </div>

      {/* Tarjetas de conexión */}
      <div className="cal-socios">
        {SOCIOS.map(s => {
          const conn = isConnected(s.key);
          const info = infoDe(s.key);
          return (
            <div key={s.key} className={`cal-socio${sel === s.key ? ' sel' : ''}`} style={{ '--sc': s.color }}
              onClick={() => conn && setSel(s.key)}>
              <div className="cal-socio-top">
                <div className="cal-avatar">{s.label[0]}</div>
                <div className="cal-socio-info">
                  <strong>{s.label}</strong>
                  {conn ? <span className="cal-socio-mail">● {info?.googleEmail}</span> : <span className="cal-socio-off">No conectado</span>}
                </div>
              </div>
              <div className="cal-socio-act">
                {conn
                  ? <button className="cal-btn danger" onClick={(e) => { e.stopPropagation(); flash('Para desconectar, hazlo desde la cuenta de Google del socio.'); }}><Unlink size={12} /> Conectado</button>
                  : <button className="cal-btn connect" onClick={(e) => { e.stopPropagation(); conectar(); }}><Link2 size={12} /> Conectar</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendario */}
      {isConnected(sel) ? (
        <div className="cal-section">
          <div className="cal-head">
            <h2>Calendario de {socioInfo(sel).label}</h2>
            <div className="cal-nav">
              <button onClick={() => setMes(new Date(y, m - 1))}><ChevronLeft size={16} /></button>
              <span className="cal-month">{mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setMes(new Date(y, m + 1))}><ChevronRight size={16} /></button>
            </div>
            <div className="cal-actions">
              <button className="cal-btn gold" onClick={() => openNew(null)}><Plus size={13} /> Evento</button>
              <button className="cal-btn" onClick={cargarEventos} disabled={evLoading}><RefreshCw size={13} className={evLoading ? 'spin' : ''} /></button>
            </div>
          </div>

          <div className="cal-grid">
            {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="cal-day empty" />;
              const isToday = day.toDateString() === new Date().toDateString();
              const dayEvs = events.filter(e => parseEventDate(e).toDateString() === day.toDateString());
              return (
                <div key={idx} className={`cal-day${isToday ? ' today' : ''}`}
                  onClick={() => dayEvs.length ? setDayDetail({ date: day, events: dayEvs }) : openNew(day)}>
                  <span className="cal-day-num">{day.getDate()}</span>
                  <div className="cal-day-evs">
                    {dayEvs.slice(0, 4).map((ev, i) => {
                      const st = getEventStyle(ev.calendarColor, !!ev.hangoutLink);
                      const hora = ev.start?.dateTime ? ev.start.dateTime.split('T')[1]?.slice(0, 5) : '';
                      return (
                        <div key={i} className="cal-chip" title={`${hora ? hora + ' · ' : ''}${ev.summary || ''}`}
                          style={{ background: st.bg, borderLeft: `3px solid ${st.border}`, color: st.text }}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev); }}>
                          {hora && <em>{hora}</em>}{ev.summary || '(sin título)'}
                        </div>
                      );
                    })}
                    {dayEvs.length > 4 && <span className="cal-count">+{dayEvs.length - 4} más</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cal-legend">
            <span><span className="dot" style={{ background: C.blue }} /> Reuniones Meet</span>
            {calendarios.filter(c => !c.primary).slice(0, 6).map(c => (
              <span key={c.id}><span className="dot" style={{ background: c.color }} /> {c.nombre}</span>
            ))}
            <span className="cal-legend-total">{events.length} eventos este mes</span>
          </div>
        </div>
      ) : !loading && (
        <div className="cal-empty">
          <CalendarDays size={40} />
          <p>Conecta el Google de <b>{socioInfo(sel).label}</b> para ver y agendar eventos.<br />Cada socio entra con su usuario y conecta su propia cuenta.</p>
          <button className="cal-btn connect" style={{ margin: '12px auto 0' }} onClick={conectar}><Link2 size={13} /> Conectar Google Calendar</button>
        </div>
      )}

      {/* MODAL DÍA */}
      {dayDetail && (() => {
        const allDay = dayDetail.events.filter(e => !e.start?.dateTime);
        const timed = dayDetail.events.filter(e => e.start?.dateTime).sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
        let minH = 7, maxH = 21;
        for (const e of timed) { const h = new Date(e.start.dateTime).getHours(); if (h < minH) minH = h; if (h + 1 > maxH) maxH = Math.min(23, h + 1); }
        const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
        const renderEv = (ev) => {
          const st = getEventStyle(ev.calendarColor, !!ev.hangoutLink);
          const id = `${ev.id}-${ev.calendarId || ''}`;
          const open = expandedEv === id;
          const ini = ev.start?.dateTime ? ev.start.dateTime.split('T')[1].slice(0, 5) : '';
          const fin = ev.end?.dateTime ? ev.end.dateTime.split('T')[1].slice(0, 5) : '';
          return (
            <div key={id} className="cal-tl-ev" style={{ background: st.bg, borderLeft: `3px solid ${st.border}` }}
              onClick={(e) => { e.stopPropagation(); setExpandedEv(open ? null : id); }}>
              <div className="cal-tl-ev-head"><strong style={{ color: st.text }}>{ev.summary || '(sin título)'}</strong>
                <span className="cal-tl-ev-time">{ini ? `${ini}–${fin}` : 'Todo el día'}</span></div>
              {open && (
                <div className="cal-tl-ev-body" onClick={(e) => e.stopPropagation()}>
                  {ev.calendarSummary && <p style={{ color: st.border, fontWeight: 700, fontSize: 11 }}>{ev.calendarSummary}</p>}
                  {ev.description && <p>{ev.description}</p>}
                  {ev.attendees?.length > 0 && <p>👥 {ev.attendees.map(a => a.email).join(', ')}</p>}
                  <div className="cal-ev-actions">
                    {ev.hangoutLink && <a className="cal-btn" href={ev.hangoutLink} target="_blank" rel="noreferrer"><Video size={12} /> Meet</a>}
                    <button className="cal-btn" onClick={() => { setDayDetail(null); openEdit(ev); }}><Edit2 size={12} /> Editar</button>
                    <button className="cal-btn danger" onClick={() => borrar(ev)}><Trash2 size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          );
        };
        return (
          <div className="cal-overlay" onClick={() => { setDayDetail(null); setExpandedEv(null); }}>
            <div className="cal-modal" onClick={e => e.stopPropagation()}>
              <div className="cal-modal-h">
                <h3><CalendarDays size={17} /> {dayDetail.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <button onClick={() => { setDayDetail(null); setExpandedEv(null); }}><X size={15} /></button>
              </div>
              <div className="cal-modal-b">
                {allDay.length > 0 && <div style={{ marginBottom: 10 }}>{allDay.map(renderEv)}</div>}
                {hours.map(h => {
                  const evs = timed.filter(e => new Date(e.start.dateTime).getHours() === h);
                  return (
                    <div key={h} className="cal-tl-row">
                      <span className="cal-tl-hour">{String(h).padStart(2, '0')}:00</span>
                      <div className="cal-tl-slot" onClick={() => { setDayDetail(null); openNew(dayDetail.date, `${String(h).padStart(2, '0')}:00`); }}>
                        {evs.map(renderEv)}
                      </div>
                    </div>
                  );
                })}
                <button className="cal-btn gold" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={() => { setDayDetail(null); openNew(dayDetail.date); }}><Plus size={13} /> Nuevo evento este día</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CREAR/EDITAR */}
      {editEvent && (
        <div className="cal-overlay" onClick={() => setEditEvent(null)}>
          <div className="cal-modal" onClick={e => e.stopPropagation()}>
            <div className="cal-modal-h">
              <h3>{editEvent === 'new' ? <><Plus size={17} /> Nuevo evento</> : <><Edit2 size={16} /> Editar evento</>}</h3>
              <button onClick={() => setEditEvent(null)}><X size={15} /></button>
            </div>
            <div className="cal-modal-b">
              <div className="cal-fg"><label>Título *</label>
                <input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Ej: Reunión con prospecto…" autoFocus /></div>
              <div className="cal-fg-row">
                <div className="cal-fg"><label>Fecha *</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div className="cal-fg"><label>Inicio</label><input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                <div className="cal-fg"><label>Fin</label><input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
              </div>
              <div className="cal-fg"><label>Invitados (correos, por coma)</label>
                <input value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })} placeholder="cliente@gmail.com, ingrid@…" />
                <p className="cal-hint">Google les envía la invitación automáticamente.</p></div>
              {editEvent === 'new' && (
                <label className="cal-meet-check"><input type="checkbox" checked={form.meet} onChange={e => setForm({ ...form, meet: e.target.checked })} /> 🎥 Crear link de Google Meet</label>
              )}
              {editEvent !== 'new' && editEvent?.hangoutLink && (
                <div className="cal-meet-link">
                  <Video size={14} style={{ color: C.blue }} />
                  <a href={editEvent.hangoutLink} target="_blank" rel="noreferrer">{editEvent.hangoutLink.replace(/^https?:\/\//, '')}</a>
                  <button className="cal-btn" onClick={() => copiarMeet(editEvent.hangoutLink)}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
                </div>
              )}
              <div className="cal-fg"><label>Descripción</label>
                <textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Notas, teléfono, detalles…" /></div>
            </div>
            <div className="cal-modal-f">
              {editEvent !== 'new' && <button className="cal-btn danger" onClick={() => borrar(editEvent)}><Trash2 size={12} /> Eliminar</button>}
              <div style={{ flex: 1 }} />
              <button className="cal-btn" onClick={() => setEditEvent(null)}>Cancelar</button>
              <button className="cal-btn gold" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : editEvent === 'new' ? 'Crear' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cal-toast">{toast}</div>}
    </div>
  );
}
