import { useState, useEffect, useCallback } from 'react';
import { C, SPANISH_LABELS } from '../constants';
import { Plus, X, Clock, Link2, Unlink, RefreshCw } from 'lucide-react';
import { api } from '../../../utils/api';

function EventModal({ onClose, onSubmit, googleConnected }) {
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    description: '',
    syncToGoogle: googleConnected,
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{SPANISH_LABELS.addEvent}</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          <div className="field"><label>{SPANISH_LABELS.eventTitle}</label><input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
          <div className="field"><label>{SPANISH_LABELS.eventDate}</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
          <div className="field"><label>{SPANISH_LABELS.eventTime}</label><input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} /></div>
          <div className="field"><label>{SPANISH_LABELS.eventDescription}</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
          {googleConnected && (
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="syncGoogle" checked={formData.syncToGoogle} onChange={e => setFormData({ ...formData, syncToGoogle: e.target.checked })} />
              <label htmlFor="syncGoogle" style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Sincronizar con Google Calendar
              </label>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={() => onSubmit(formData)}>{SPANISH_LABELS.save}</button>
          <button className="btn-secondary" onClick={onClose}>{SPANISH_LABELS.cancel}</button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarView({ events, showEventModal, setShowEventModal, onAddEvent }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);

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
    // Create local event
    await onAddEvent({
      title: formData.title,
      start_date: `${formData.date}T${formData.time}:00`,
      description: formData.description,
      time: formData.time,
    });
    // Also create in Google Calendar if checkbox was checked
    if (formData.syncToGoogle && googleConnected) {
      try {
        await api.createGoogleEvent({
          title: formData.title,
          description: formData.description,
          start_date: formData.date,
          time: formData.time,
        });
        fetchGoogleEvents();
      } catch (err) {
        console.error('Sync to Google failed:', err);
      }
    }
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

  // All events merged for "Próximos Eventos"
  const allEvents = [
    ...events.map(e => ({ ...e, source: 'local' })),
    ...googleEvents,
  ].sort((a, b) => new Date(a.start_date || a.date) - new Date(b.start_date || b.date));

  const today = new Date();

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
        .cal-day { background:#fff; padding:10px; min-height:72px; }
        .cal-day.empty { background:#f8fafc; }
        .cal-day.today { background:#eff6ff; border:2px solid #003DA5; }
        .cal-day-num { font-size:13px; font-weight:600; color:#0f172a; margin-bottom:4px; }
        .cal-dot { width:6px; height:6px; background:#0088E0; border-radius:50%; display:inline-block; margin-right:3px; }
        .cal-dot.google { background:#34a853; }
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
        @media(max-width:768px){
          .cal-head { flex-direction:column; align-items:flex-start; gap:12px; }
          .cal-grid { gap:0; }
          .cal-day { min-height:54px; padding:6px; }
          .cal-dh { padding:6px; font-size:11px; }
          .cal-day-num { font-size:12px; }
          .cal-nav h2 { font-size:16px; }
          .google-bar { flex-direction:column; align-items:flex-start; }
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
            const isToday = day && today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
            return (
              <div key={idx} className={`cal-day${day === null ? ' empty' : ''}${isToday ? ' today' : ''}`}>
                {day && (
                  <>
                    <div className="cal-day-num">{day}</div>
                    {local.map(event => <div key={event.id} className="cal-dot" title={event.title} />)}
                    {google.map(event => <div key={event.id} className="cal-dot google" title={`Google: ${event.title}`} />)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="section">
        <h2 className="section-title">Próximos Eventos</h2>
        <div className="events-list">
          {allEvents.length === 0 ? <p className="empty">{SPANISH_LABELS.noEvents}</p> : (
            allEvents.slice(0, 12).map(event => (
              <div key={`${event.source}-${event.id}`} className="event-card">
                <div style={{ flex: 1 }}>
                  <h3>
                    {event.title}
                    <span className={`event-source-badge ${event.source === 'google' ? 'badge-google' : 'badge-local'}`} style={{ marginLeft: 8 }}>
                      {event.source === 'google' ? 'Google' : 'Local'}
                    </span>
                  </h3>
                  <span className="ev-time"><Clock size={13} /> {new Date(event.start_date || event.date).toLocaleDateString('es-MX')} — {event.time || new Date(event.start_date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || 'Sin hora'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showEventModal && <EventModal onClose={() => setShowEventModal(false)} onSubmit={handleAddEventWithGoogle} googleConnected={googleConnected} />}
    </div>
    </>
  );
}
