import { useState } from 'react';
import { C, SPANISH_LABELS } from '../constants';
import { Plus, X, Clock } from 'lucide-react';

function EventModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    description: '',
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
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay   = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName  = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = day => {
    if (!day) return [];
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(e => new Date(e.start_date || e.date).toDateString() === date.toDateString());
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
        .cal-day { background:#fff; padding:10px; min-height:72px; }
        .cal-day.empty { background:#f8fafc; }
        .cal-day-num { font-size:13px; font-weight:600; color:#0f172a; margin-bottom:4px; }
        .cal-dot { width:6px; height:6px; background:#0088E0; border-radius:50%; display:inline-block; margin-right:3px; }
      `}</style>
    <div className="view">
      <div className="cal-head">
        <h1 className="view-title">{SPANISH_LABELS.calendar}</h1>
        <button className="btn-primary" onClick={() => setShowEventModal(true)}>
          <Plus size={16} /> {SPANISH_LABELS.addEvent}
        </button>
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
            const dayEvents = getEventsForDay(day);
            return (
              <div key={idx} className={`cal-day${day === null ? ' empty' : ''}`}>
                {day && (
                  <>
                    <div className="cal-day-num">{day}</div>
                    {dayEvents.map(event => <div key={event.id} className="cal-dot" title={event.title} />)}
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
          {events.length === 0 ? <p className="empty">{SPANISH_LABELS.noEvents}</p> : (
            events.slice(0, 8).map(event => (
              <div key={event.id} className="event-card">
                <div>
                  <h3>{event.title}</h3>
                  <span className="ev-time"><Clock size={13} /> {new Date(event.start_date || event.date).toLocaleDateString('es-MX')} — {event.time || 'Sin hora'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showEventModal && <EventModal onClose={() => setShowEventModal(false)} onSubmit={onAddEvent} />}
    </div>
    </>
  );
}
