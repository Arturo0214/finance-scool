import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, MessageCircle, UserPlus, AlertCircle, Info } from 'lucide-react';
import { api } from '../utils/api';

const TYPE_CONFIG = {
  whatsapp:  { icon: MessageCircle, color: '#25D366', bg: '#D1FAE5' },
  lead:      { icon: UserPlus,      color: '#3B82F6', bg: '#DBEAFE' },
  cita:      { icon: Check,         color: '#8B5CF6', bg: '#EDE9FE' },
  alerta:    { icon: AlertCircle,   color: '#EF4444', bg: '#FEE2E2' },
  info:      { icon: Info,          color: '#6B7280', bg: '#F3F4F6' },
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'Ahora';
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationDropdown({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    await api.markNotificationRead(id);
    setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(p => Math.max(0, p - 1));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleClick = (n) => {
    if (!n.is_read) markRead(n.id);
    if (n.link && onNavigate) onNavigate(n.link.replace('/admin/', ''));
    setOpen(false);
  };

  return (
    <>
      <style>{`
        .notif-wrap { position:relative; }
        .notif-bell { background:none; border:none; cursor:pointer; position:relative; padding:6px; display:flex; align-items:center; border-radius:8px; transition:background .15s; color:#64748b; }
        .notif-bell:hover { background:#f1f5f9; }
        .notif-bell.active { color:#0066CC; background:#eff6ff; }
        .notif-badge { position:absolute; top:2px; right:2px; background:#EF4444; color:#fff; font-size:9px; font-weight:700; min-width:16px; height:16px; border-radius:8px; display:flex; align-items:center; justify-content:center; padding:0 4px; border:2px solid #fff; animation:notif-pulse 2s infinite; }
        @keyframes notif-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        .notif-dd { position:absolute; top:calc(100% + 8px); right:0; width:380px; max-width:95vw; background:#fff; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,.15); border:1px solid #e2e8f0; z-index:9999; overflow:hidden; }
        .notif-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #f1f5f9; }
        .notif-hdr h3 { margin:0; font-size:15px; font-weight:700; color:#0f172a; }
        .notif-hdr-actions { display:flex; gap:6px; align-items:center; }
        .notif-mark-all { background:none; border:none; color:#3B82F6; font-size:11px; font-weight:600; cursor:pointer; padding:4px 8px; border-radius:6px; }
        .notif-mark-all:hover { background:#eff6ff; }
        .notif-list { max-height:400px; overflow-y:auto; }
        .notif-item { display:flex; gap:10px; padding:12px 16px; cursor:pointer; transition:background .12s; border-bottom:1px solid #f8fafc; }
        .notif-item:hover { background:#f8fafc; }
        .notif-item.unread { background:#eff6ff; }
        .notif-item.unread:hover { background:#dbeafe; }
        .notif-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .notif-body { flex:1; min-width:0; }
        .notif-msg { font-size:13px; color:#334155; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .notif-item.unread .notif-msg { font-weight:600; color:#0f172a; }
        .notif-time { font-size:11px; color:#94a3b8; margin-top:2px; }
        .notif-dot { width:8px; height:8px; border-radius:50%; background:#3B82F6; flex-shrink:0; margin-top:4px; }
        .notif-empty { padding:40px 20px; text-align:center; color:#94a3b8; font-size:13px; }
        @media(max-width:480px) { .notif-dd { width:100vw; right:-60px; border-radius:0 0 12px 12px; } }
      `}</style>
      <div className="notif-wrap" ref={ref}>
        <button className={`notif-bell${open ? ' active' : ''}`} onClick={() => setOpen(o => !o)} title="Notificaciones">
          <Bell size={20} />
          {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        {open && (
          <div className="notif-dd">
            <div className="notif-hdr">
              <h3>Notificaciones</h3>
              <div className="notif-hdr-actions">
                {unreadCount > 0 && <button className="notif-mark-all" onClick={markAllRead}><CheckCheck size={12} /> Marcar todo leído</button>}
                <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:2, display:'flex' }}><X size={16} /></button>
              </div>
            </div>
            <div className="notif-list">
              {notifications.length === 0 ? (
                <div className="notif-empty">
                  <Bell size={28} color="#cbd5e1" style={{ marginBottom:8 }} />
                  <p style={{ margin:0 }}>Sin notificaciones</p>
                </div>
              ) : (
                notifications.slice(0, 20).map(n => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} className={`notif-item${!n.is_read ? ' unread' : ''}`} onClick={() => handleClick(n)}>
                      <div className="notif-icon" style={{ background: cfg.bg }}><Icon size={18} color={cfg.color} /></div>
                      <div className="notif-body">
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.is_read && <div className="notif-dot" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
