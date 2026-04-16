import { useState, useEffect, useCallback } from 'react';
import { C, SPANISH_LABELS } from '../constants';
import { Plus, X, Clock, Link2, Unlink, RefreshCw, MapPin, Calendar, ChevronRight, Trash2, Pencil, ExternalLink, Video } from 'lucide-react';
import { api } from '../../../utils/api';

/* ── Event Modal (Create) ─────────────────────────────────── */
function EventModal({ onClose, onSubmit, googleConnected }) {
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    duration: 30,
    description: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    meeting_link: '',
    syncToGoogle: googleConnected,
    addMeet: true,
  });

  // Auto-generar descripción con datos del cliente
  const buildDescription = () => {
    const parts = [];
    if (formData.clientName) parts.push(`Cliente: ${formData.clientName}`);
    if (formData.clientPhone) parts.push(`Teléfono: ${formData.clientPhone}`);
    if (formData.clientPhone) parts.push(`WhatsApp: https://wa.me/${formData.clientPhone.replace(/\D/g, '')}`);
    if (formData.clientEmail) parts.push(`Email: ${formData.clientEmail}`);
    if (formData.description) parts.push(`\nNotas: ${formData.description}`);
    return parts.join('\n');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{SPANISH_LABELS.addEvent}</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          <div className="field"><label>{SPANISH_LABELS.eventTitle}</label><input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ej: Cita con Juan Pérez" /></div>
          <div className="edit-row">
            <div className="field" style={{ flex: 1 }}><label>{SPANISH_LABELS.eventDate}</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label>{SPANISH_LABELS.eventTime}</label><input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} /></div>
            <div className="field" style={{ flex: '0 0 100px' }}><label>Duración</label>
              <select value={formData.duration} onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hora</option>
              </select>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0', paddingTop: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>Datos del cliente</label>
            <div className="edit-row">
              <div className="field" style={{ flex: 1 }}><label>Nombre</label><input type="text" value={formData.clientName} onChange={e => setFormData({ ...formData, clientName: e.target.value })} placeholder="Nombre del cliente" /></div>
              <div className="field" style={{ flex: 1 }}><label>Teléfono</label><input type="tel" value={formData.clientPhone} onChange={e => setFormData({ ...formData, clientPhone: e.target.value })} placeholder="+52 55 1234 5678" /></div>
            </div>
            <div className="field"><label>Email</label><input type="email" value={formData.clientEmail} onChange={e => setFormData({ ...formData, clientEmail: e.target.value })} placeholder="cliente@email.com" /></div>
          </div>
          <div className="field"><label>Notas</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Notas adicionales..." /></div>
          {googleConnected && (
            <>
              <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="syncGoogle" checked={formData.syncToGoogle} onChange={e => setFormData({ ...formData, syncToGoogle: e.target.checked })} />
                <label htmlFor="syncGoogle" style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Sincronizar con Google Calendar</label>
              </div>
              {formData.syncToGoogle && (
                <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="addMeet" checked={formData.addMeet} onChange={e => setFormData({ ...formData, addMeet: e.target.checked })} style={{ accentColor: '#00897B' }} />
                  <label htmlFor="addMeet" style={{ margin: 0, fontSize: 13, color: '#00897B', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Video size={14} /> Agregar Google Meet
                  </label>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={() => onSubmit({ ...formData, description: buildDescription() })}>{SPANISH_LABELS.save}</button>
          <button className="btn-secondary" onClick={onClose}>{SPANISH_LABELS.cancel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Event Modal ─────────────────────────────────────── */
function EditEventModal({ event, onClose, onSave, onDelete, googleConnected }) {
  const isGoogle = event.source === 'google';
  const evDate = event.start_date ? new Date(event.start_date) : new Date();
  const dateStr = evDate.toISOString().split('T')[0];
  const timeStr = event.time || (evDate.getHours() === 0 && evDate.getMinutes() === 0 ? '14:00'
    : `${String(evDate.getHours()).padStart(2,'0')}:${String(evDate.getMinutes()).padStart(2,'0')}`);

  const [formData, setFormData] = useState({
    title: event.title || '',
    date: dateStr,
    time: timeStr,
    description: event.description || '',
    meeting_link: event.meeting_link || '',
    addMeet: !!event.conferenceData || false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meetLink, setMeetLink] = useState(
    event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || event.meeting_link || ''
  );

  const handleSave = async () => {
    setSaving(true);

    // Si es evento local y quieren Meet, crear en Google Calendar primero
    if (!isGoogle && formData.addMeet && googleConnected) {
      try {
        const result = await api.createGoogleEvent({
          title: formData.title,
          description: formData.description,
          start_date: formData.date,
          time: formData.time,
          duration: 30,
          addMeet: true,
        });
        if (result?.meetLink) {
          setMeetLink(result.meetLink);
          formData.meeting_link = result.meetLink;
        }
      } catch (err) {
        console.error('Error creating Meet:', err);
      }
    }

    await onSave(event, {
      title: formData.title,
      description: formData.description,
      start_date: formData.date,
      time: formData.time,
      end_date: event.end_date || null,
      color: event.color || '#C9A84C',
      meeting_link: formData.meeting_link,
      addMeet: formData.addMeet,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    await onDelete(event);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2>Editar Evento</h2>
            <span className={`event-source-badge ${isGoogle ? 'badge-google' : 'badge-local'}`}>
              {isGoogle ? 'Google' : 'Local'}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Título</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="edit-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Hora</label>
              <input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Notas / Descripción</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4} placeholder="Agrega notas sobre este evento..." />
          </div>
          {googleConnected && (
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.addMeet}
                  onChange={e => setFormData({ ...formData, addMeet: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#00897B' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Video size={16} style={{ color: '#00897B' }} />
                  Agregar Google Meet
                  {!isGoogle && <span style={{ fontSize: 11, color: '#94a3b8' }}>(se crea en Google Calendar)</span>}
                </span>
              </label>
              {meetLink && (
                <a href={meetLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#00897B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Video size={13} /> {meetLink} <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
          {!formData.addMeet && (
            <div className="field">
              <label>Link de reunión (manual)</label>
              <input type="url" placeholder="https://zoom.us/j/... o meet.google.com/..." value={formData.meeting_link} onChange={e => setFormData({ ...formData, meeting_link: e.target.value })} />
            </div>
          )}
          {isGoogle && event.htmlLink && (
            <div className="field">
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="ddm-event-link" style={{ marginTop: 0 }}>
                Ver en Google Calendar <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
        <div className="modal-foot edit-foot">
          <div className="edit-foot-left">
            {!confirmDelete ? (
              <button className="btn-danger-outline" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Eliminar
              </button>
            ) : (
              <div className="confirm-delete">
                <span>¿Estás seguro?</span>
                <button className="btn-danger" onClick={handleDelete}>Sí, eliminar</button>
                <button className="btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            )}
          </div>
          <div className="edit-foot-right">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.title.trim()}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Day Detail Modal ─────────────────────────────────────── */
function DayDetailModal({ date, localEvents, googleEvents, onClose, googleConnected, onEditEvent }) {
  const dayLabel = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const allDayEvents = [
    ...localEvents.map(e => ({ ...e, source: 'local' })),
    ...googleEvents.map(e => ({ ...e, source: 'google' })),
  ].sort((a, b) => {
    const tA = a.time || (a.start_date ? new Date(a.start_date).toTimeString().slice(0, 5) : '99:99');
    const tB = b.time || (b.start_date ? new Date(b.start_date).toTimeString().slice(0, 5) : '99:99');
    return tA.localeCompare(tB);
  });

  const formatTime = (event) => {
    if (event.all_day) return 'Todo el día';
    if (event.time) return event.time;
    if (event.start_date) {
      const d = new Date(event.start_date);
      if (d.getHours() === 0 && d.getMinutes() === 0) return 'Todo el día';
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  };

  const formatEndTime = (event) => {
    if (event.end_date && !event.all_day) {
      const d = new Date(event.end_date);
      if (d.getHours() === 0 && d.getMinutes() === 0) return '';
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="day-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="ddm-header">
          <div>
            <h2 className="ddm-title">{date.getDate()}</h2>
            <p className="ddm-subtitle">{dayLabel}</p>
          </div>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>

        <div className="ddm-body">
          {allDayEvents.length === 0 ? (
            <div className="ddm-empty">
              <Calendar size={40} strokeWidth={1.2} color="#cbd5e1" />
              <p>No hay eventos para este día</p>
            </div>
          ) : (
            <div className="ddm-events">
              {allDayEvents.map((event, i) => {
                const time = formatTime(event);
                const endTime = formatEndTime(event);
                const isGoogle = event.source === 'google';
                return (
                  <div key={`${event.source}-${event.id}-${i}`} className={`ddm-event ${isGoogle ? 'ddm-event-google' : 'ddm-event-local'}`}>
                    <div className="ddm-event-time-col">
                      <span className="ddm-event-time">{time}</span>
                      {endTime && <span className="ddm-event-end-time">{endTime}</span>}
                    </div>
                    <div className="ddm-event-content">
                      <div className="ddm-event-title-row">
                        <h4 className="ddm-event-title">{event.title}</h4>
                        <span className={`event-source-badge ${isGoogle ? 'badge-google' : 'badge-local'}`}>
                          {isGoogle ? 'Google' : 'Local'}
                        </span>
                        <button className="ddm-edit-btn" onClick={(e) => { e.stopPropagation(); onEditEvent(event); }} title="Editar evento">
                          <Pencil size={13} />
                        </button>
                      </div>
                      {event.description && (
                        <p className="ddm-event-desc">{event.description}</p>
                      )}
                      {event.meeting_link && (
                        <a href={event.meeting_link} target="_blank" rel="noopener noreferrer" className="ddm-meeting-link">
                          <Video size={12} /> Unirse a reunión <ExternalLink size={10} />
                        </a>
                      )}
                      {event.htmlLink && (
                        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="ddm-event-link">
                          Ver en Google Calendar <ChevronRight size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Calendar View ───────────────────────────────────── */
export default function CalendarView({ events, showEventModal, setShowEventModal, onAddEvent, onUpdateEvent, onDeleteEvent }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay   = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName  = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // Check Google connection status on mount & URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      setGoogleConnected(true);
      setGoogleEmail(decodeURIComponent(params.get('email') || ''));
      window.history.replaceState({}, '', window.location.pathname);
    }
    checkGoogleStatus();
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const status = await api.getGoogleConnectionStatus();
      setGoogleConnected(status.connected);
      if (status.email) setGoogleEmail(status.email);
    } catch (err) {
      console.error('Google status check error:', err);
    }
  };

  // Fetch Google events when connected or month changes
  const fetchGoogleEvents = useCallback(async () => {
    if (!googleConnected) return;
    try {
      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const gEvents = await api.getGoogleEvents(timeMin, timeMax);
      setGoogleEvents(Array.isArray(gEvents) ? gEvents : []);
    } catch (err) {
      console.error('Fetch Google events error:', err);
    }
  }, [googleConnected, currentDate]);

  useEffect(() => { fetchGoogleEvents(); }, [fetchGoogleEvents]);

  const handleConnectGoogle = async () => {
    try {
      const { url } = await api.getGoogleAuthUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Connect Google error:', err);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await api.disconnectGoogle();
      setGoogleConnected(false);
      setGoogleEmail('');
      setGoogleEvents([]);
    } catch (err) {
      console.error('Disconnect Google error:', err);
    }
  };

  const handleSyncRefresh = async () => {
    setSyncing(true);
    await fetchGoogleEvents();
    setTimeout(() => setSyncing(false), 500);
  };

  // Enhanced add event handler — also creates in Google if opted
  const handleAddEventWithGoogle = async (formData) => {
    await onAddEvent({
      title: formData.title,
      start_date: `${formData.date}T${formData.time}:00`,
      description: formData.description,
      time: formData.time,
      meeting_link: formData.meeting_link || null,
    });
    if (formData.syncToGoogle && googleConnected) {
      try {
        const result = await api.createGoogleEvent({
          title: formData.title,
          description: formData.description,
          start_date: formData.date,
          time: formData.time,
          duration: formData.duration || 30,
          addMeet: formData.addMeet,
          attendeeEmail: formData.clientEmail || undefined,
        });
        if (result?.meetLink) {
          alert(`Google Meet creado:\n${result.meetLink}`);
        }
        fetchGoogleEvents();
      } catch (err) {
        console.error('Sync to Google failed:', err);
      }
    }
  };

  // Edit & Delete handlers for local AND Google events
  const handleEditEvent = (event) => {
    setSelectedDay(null); // close day modal
    setEditingEvent(event);
  };

  const handleSaveEdit = async (event, data) => {
    if (event.source === 'google') {
      try {
        await api.updateGoogleEvent(event.id, {
          title: data.title,
          description: data.description,
          start_date: data.start_date,
          time: data.time,
          addMeet: data.addMeet,
        });
        fetchGoogleEvents();
      } catch (err) {
        console.error('Update Google event error:', err);
      }
    } else {
      await onUpdateEvent(event.id, {
        ...data,
        start_date: `${data.start_date}T${data.time}:00`,
      });
    }
  };

  const handleDeleteEvent = async (event) => {
    if (event.source === 'google') {
      try {
        await api.deleteGoogleEvent(event.id);
        fetchGoogleEvents();
      } catch (err) {
        console.error('Delete Google event error:', err);
      }
    } else {
      await onDeleteEvent(event.id);
    }
    setEditingEvent(null);
  };

  // Merge local + Google events for a given day
  const getEventsForDay = day => {
    if (!day) return { local: [], google: [] };
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toDateString();
    const local = events.filter(e => new Date(e.start_date || e.date).toDateString() === dateStr);
    const google = googleEvents.filter(e => new Date(e.start_date).toDateString() === dateStr);
    return { local, google };
  };

  // Helper: format time for calendar cell preview
  const cellTime = (event) => {
    if (event.all_day) return '';
    if (event.time) {
      const [h, m] = event.time.split(':');
      return `${h}:${m}`;
    }
    if (event.start_date) {
      const d = new Date(event.start_date);
      if (d.getHours() === 0 && d.getMinutes() === 0) return '';
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  };

  // All events merged for "Próximos Eventos"
  const allEvents = [
    ...events.map(e => ({ ...e, source: 'local' })),
    ...googleEvents,
  ].sort((a, b) => new Date(a.start_date || a.date) - new Date(b.start_date || b.date));

  // Filter only upcoming events
  const now = new Date();
  const upcomingEvents = allEvents.filter(e => new Date(e.start_date || e.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  const today = new Date();

  const handleDayClick = (day) => {
    if (!day) return;
    setSelectedDay(day);
  };

  return (
    <>
      <style>{`
        .cal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
        .cal-nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
        .cal-nav button { background:none; border:1px solid #e2e8f0; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:14px; color:#64748b; transition:all .2s; }
        .cal-nav button:hover { border-color:#003DA5; color:#003DA5; }
        .cal-nav h2 { font-size:18px; font-weight:600; color:#0f172a; text-transform:capitalize; margin:0; }
        .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:#e2e8f0; border-radius:8px; overflow:hidden; }
        .cal-dh { background:#003DA5; color:#fff; padding:10px; text-align:center; font-size:12px; font-weight:600; }
        .cal-day { background:#fff; min-height:100px; cursor:pointer; transition: background .15s; display:flex; flex-direction:column; overflow:hidden; }
        .cal-day:hover { background:#f1f5f9; }
        .cal-day.empty { background:#f8fafc; cursor:default; }
        .cal-day.empty:hover { background:#f8fafc; }
        .cal-day.today { background:#eff6ff; border:2px solid #003DA5; }
        .cal-day.today:hover { background:#dbeafe; }
        .cal-day-top { display:flex; align-items:center; justify-content:space-between; padding:6px 8px 2px; }
        .cal-day-num { font-size:13px; font-weight:600; color:#0f172a; }
        .cal-day.today .cal-day-num { background:#003DA5; color:#fff; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; }
        .cal-event-count { font-size:10px; color:#94a3b8; font-weight:500; }
        .cal-events-list { padding:2px 6px 6px; display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden; }
        .cal-event-chip { font-size:11px; padding:2px 5px; border-radius:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.4; cursor:pointer; }
        .cal-event-chip.local { background:#dbeafe; color:#1e40af; border-left:2px solid #3b82f6; }
        .cal-event-chip.google { background:#dcfce7; color:#166534; border-left:2px solid #22c55e; }
        .cal-event-chip-time { font-weight:600; margin-right:3px; }
        .cal-more { font-size:10px; color:#64748b; padding:0 5px 4px; cursor:pointer; font-weight:500; }
        .cal-more:hover { color:#003DA5; }

        /* Google bar */
        .google-bar { display:flex; align-items:center; gap:12px; padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; margin-bottom:16px; flex-wrap:wrap; }
        .google-bar.disconnected { background:#fef2f2; border-color:#fecaca; }
        .google-bar .status { font-size:13px; color:#166534; flex:1; }
        .google-bar.disconnected .status { color:#991b1b; }
        .google-bar button { font-size:12px; padding:6px 12px; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:4px; border:1px solid; transition:all .2s; }
        .btn-google-connect { background:#003DA5; color:#fff; border-color:#003DA5; }
        .btn-google-connect:hover { background:#002d7a; }
        .btn-google-disconnect { background:#fff; color:#dc2626; border-color:#fecaca; }
        .btn-google-disconnect:hover { background:#fef2f2; }
        .btn-google-sync { background:#fff; color:#003DA5; border-color:#bfdbfe; }
        .btn-google-sync:hover { background:#eff6ff; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .event-source-badge { font-size:10px; padding:2px 6px; border-radius:4px; font-weight:600; }
        .badge-local { background:#dbeafe; color:#1e40af; }
        .badge-google { background:#dcfce7; color:#166534; }

        /* Day Detail Modal */
        .day-detail-modal { background:#fff; border-radius:12px; width:520px; max-width:90vw; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
        .ddm-header { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 24px 16px; border-bottom:1px solid #e2e8f0; }
        .ddm-title { font-size:32px; font-weight:700; color:#003DA5; margin:0; line-height:1; }
        .ddm-subtitle { font-size:13px; color:#64748b; margin:4px 0 0; text-transform:capitalize; }
        .ddm-body { flex:1; overflow-y:auto; padding:16px 24px 24px; }
        .ddm-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px; }
        .ddm-empty p { color:#94a3b8; font-size:14px; margin:0; }
        .ddm-events { display:flex; flex-direction:column; gap:12px; }
        .ddm-event { display:flex; gap:14px; padding:12px; border-radius:8px; border:1px solid #e2e8f0; transition:all .15s; }
        .ddm-event:hover { box-shadow:0 2px 8px rgba(0,0,0,.06); }
        .ddm-event-local { border-left:3px solid #3b82f6; }
        .ddm-event-google { border-left:3px solid #22c55e; }
        .ddm-event-time-col { min-width:52px; display:flex; flex-direction:column; align-items:flex-end; padding-top:2px; }
        .ddm-event-time { font-size:13px; font-weight:600; color:#0f172a; }
        .ddm-event-end-time { font-size:11px; color:#94a3b8; }
        .ddm-event-content { flex:1; min-width:0; }
        .ddm-event-title-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .ddm-event-title { font-size:14px; font-weight:600; color:#0f172a; margin:0; }
        .ddm-event-desc { font-size:13px; color:#64748b; margin:6px 0 0; line-height:1.4; }
        .ddm-event-link { font-size:12px; color:#003DA5; text-decoration:none; display:inline-flex; align-items:center; gap:2px; margin-top:6px; }
        .ddm-event-link:hover { text-decoration:underline; }
        .ddm-edit-btn { background:none; border:1px solid #e2e8f0; border-radius:4px; padding:3px 6px; cursor:pointer; color:#64748b; transition:all .15s; display:inline-flex; align-items:center; }
        .ddm-edit-btn:hover { border-color:#003DA5; color:#003DA5; background:#eff6ff; }
        .ddm-meeting-link { font-size:12px; color:#7c3aed; text-decoration:none; display:inline-flex; align-items:center; gap:4px; margin-top:6px; padding:4px 8px; background:#f5f3ff; border-radius:4px; font-weight:500; transition:all .15s; }
        .ddm-meeting-link:hover { background:#ede9fe; text-decoration:none; }

        /* Edit Modal */
        .edit-modal { width:520px; max-width:90vw; }
        .edit-row { display:flex; gap:12px; }
        .edit-foot { justify-content:space-between !important; flex-wrap:wrap; gap:8px; }
        .edit-foot-left { display:flex; align-items:center; }
        .edit-foot-right { display:flex; align-items:center; gap:8px; }
        .btn-danger-outline { background:none; border:1px solid #fecaca; color:#dc2626; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:4px; transition:all .15s; }
        .btn-danger-outline:hover { background:#fef2f2; border-color:#f87171; }
        .btn-danger { background:#dc2626; border:none; color:#fff; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px; transition:all .15s; }
        .btn-danger:hover { background:#b91c1c; }
        .btn-sm { padding:4px 10px !important; font-size:12px !important; }
        .confirm-delete { display:flex; align-items:center; gap:8px; }
        .confirm-delete span { font-size:13px; color:#dc2626; font-weight:500; }

        /* Upcoming events section */
        .upcoming-section { margin-top:24px; }
        .upcoming-event { display:flex; align-items:center; gap:14px; padding:12px 16px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; transition:all .15s; cursor:pointer; }
        .upcoming-event:hover { box-shadow:0 2px 8px rgba(0,0,0,.05); border-color:#cbd5e1; }
        .upcoming-date-box { min-width:48px; text-align:center; }
        .upcoming-date-day { font-size:20px; font-weight:700; color:#003DA5; line-height:1; }
        .upcoming-date-month { font-size:10px; color:#64748b; text-transform:uppercase; font-weight:600; }
        .upcoming-info { flex:1; min-width:0; }
        .upcoming-title { font-size:14px; font-weight:600; color:#0f172a; margin:0; display:flex; align-items:center; gap:6px; }
        .upcoming-meta { font-size:12px; color:#64748b; margin-top:2px; display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
        .upcoming-meeting-badge { display:inline-flex; align-items:center; gap:3px; font-size:11px; color:#7c3aed; background:#f5f3ff; padding:1px 6px; border-radius:3px; font-weight:500; }

        @media(max-width:768px){
          .cal-head { flex-direction:column; align-items:flex-start; gap:12px; }
          .cal-grid { gap:0; }
          .cal-day { min-height:64px; }
          .cal-dh { padding:6px; font-size:11px; }
          .cal-day-num { font-size:12px; }
          .cal-day.today .cal-day-num { width:20px; height:20px; font-size:11px; }
          .cal-nav h2 { font-size:16px; }
          .google-bar { flex-direction:column; align-items:flex-start; }
          .cal-event-chip { font-size:10px; padding:1px 4px; }
          .cal-events-list { padding:1px 4px 4px; }
          .day-detail-modal { width:95vw; max-height:85vh; }
          .ddm-header { padding:16px; }
          .ddm-body { padding:12px 16px 16px; }
          .edit-modal { width:95vw; }
          .edit-row { flex-direction:column; gap:0; }
          .edit-foot { flex-direction:column; }
          .edit-foot-left, .edit-foot-right { width:100%; justify-content:center; }
        }
      `}</style>
    <div className="view">
      <div className="cal-head">
        <h1 className="view-title">{SPANISH_LABELS.calendar}</h1>
        <button className="btn-primary" onClick={() => setShowEventModal(true)}>
          <Plus size={16} /> {SPANISH_LABELS.addEvent}
        </button>
      </div>

      {/* Google Calendar Connection Bar */}
      <div className={`google-bar ${googleConnected ? '' : 'disconnected'}`}>
        <div className="status">
          {googleConnected ? (
            <>
              <strong>Google Calendar conectado</strong>
              {googleEmail && <span style={{ marginLeft: 8, opacity: 0.7 }}>({googleEmail})</span>}
            </>
          ) : (
            <span>Google Calendar no conectado</span>
          )}
        </div>
        {googleConnected ? (
          <>
            <button className="btn-google-sync" onClick={handleSyncRefresh}>
              <RefreshCw size={13} className={syncing ? 'spin' : ''} /> Sincronizar
            </button>
            <button className="btn-google-disconnect" onClick={handleDisconnectGoogle}>
              <Unlink size={13} /> Desconectar
            </button>
          </>
        ) : (
          <button className="btn-google-connect" onClick={handleConnectGoogle}>
            <Link2 size={13} /> Conectar Google Calendar
          </button>
        )}
      </div>

      <div className="section">
        <div className="cal-nav">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>&#8592;</button>
          <h2>{monthName}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>&#8594;</button>
        </div>
        <div className="cal-grid">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="cal-dh">{day}</div>
          ))}
          {days.map((day, idx) => {
            const { local, google } = getEventsForDay(day);
            const totalEvents = local.length + google.length;
            const isToday = day && today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
            const MAX_VISIBLE = 3;
            const allCellEvents = [
              ...local.map(e => ({ ...e, _src: 'local' })),
              ...google.map(e => ({ ...e, _src: 'google' })),
            ].sort((a, b) => {
              const tA = cellTime(a) || '99:99';
              const tB = cellTime(b) || '99:99';
              return tA.localeCompare(tB);
            });
            const visible = allCellEvents.slice(0, MAX_VISIBLE);
            const remaining = allCellEvents.length - MAX_VISIBLE;

            return (
              <div
                key={idx}
                className={`cal-day${day === null ? ' empty' : ''}${isToday ? ' today' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                {day && (
                  <>
                    <div className="cal-day-top">
                      <div className="cal-day-num">{day}</div>
                      {totalEvents > 0 && <span className="cal-event-count">{totalEvents}</span>}
                    </div>
                    <div className="cal-events-list">
                      {visible.map((event, i) => {
                        const t = cellTime(event);
                        return (
                          <div key={`${event._src}-${event.id}-${i}`} className={`cal-event-chip ${event._src}`}>
                            {t && <span className="cal-event-chip-time">{t}</span>}
                            {event.title}
                          </div>
                        );
                      })}
                      {remaining > 0 && (
                        <div className="cal-more">+{remaining} más</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="section upcoming-section">
        <h2 className="section-title">Próximos Eventos</h2>
        <div className="events-list">
          {upcomingEvents.length === 0 ? <p className="empty">{SPANISH_LABELS.noEvents}</p> : (
            upcomingEvents.slice(0, 10).map((event, i) => {
              const evDate = new Date(event.start_date || event.date);
              const dayNum = evDate.getDate();
              const monthShort = evDate.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase();
              const time = event.time || (evDate.getHours() === 0 && evDate.getMinutes() === 0 ? 'Todo el día' : evDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
              const isGoogle = event.source === 'google';
              return (
                <div
                  key={`${event.source}-${event.id}-${i}`}
                  className="upcoming-event"
                  onClick={() => handleEditEvent(event)}
                >
                  <div className="upcoming-date-box">
                    <div className="upcoming-date-day">{dayNum}</div>
                    <div className="upcoming-date-month">{monthShort}</div>
                  </div>
                  <div className="upcoming-info">
                    <h4 className="upcoming-title">
                      {event.title}
                      <span className={`event-source-badge ${isGoogle ? 'badge-google' : 'badge-local'}`}>
                        {isGoogle ? 'Google' : 'Local'}
                      </span>
                    </h4>
                    <div className="upcoming-meta">
                      <Clock size={11} /> {time}
                      {event.meeting_link && (
                        <span className="upcoming-meeting-badge" onClick={e => { e.stopPropagation(); window.open(event.meeting_link, '_blank'); }}>
                          <Video size={10} /> Reunión
                        </span>
                      )}
                      {event.description && <> · {event.description.slice(0, 50)}{event.description.length > 50 ? '…' : ''}</>}
                    </div>
                  </div>
                  <button className="ddm-edit-btn" onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }} title="Editar">
                    <Pencil size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          date={new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay)}
          localEvents={getEventsForDay(selectedDay).local}
          googleEvents={getEventsForDay(selectedDay).google}
          onClose={() => setSelectedDay(null)}
          googleConnected={googleConnected}
          onEditEvent={handleEditEvent}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEvent}
          googleConnected={googleConnected}
        />
      )}

      {showEventModal && <EventModal onClose={() => setShowEventModal(false)} onSubmit={handleAddEventWithGoogle} googleConnected={googleConnected} />}
    </div>
    </>
  );
}
