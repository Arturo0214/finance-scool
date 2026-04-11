/**
 * AdminPanel — Finance SCool
 * Punto de entrada del panel de administración.
 * Cada sección es un módulo independiente importado con lazy loading
 * para optimizar el bundle en Netlify.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import Logo from '../components/Logo';
import NotificationDropdown from '../components/NotificationDropdown';
import {
  Menu, X, LogOut, BarChart3, Users, Calendar, MessageSquare,
  MessageCircle, Link as LinkIcon, Zap, Eye, Settings,
  Activity, Filter, PieChart, Megaphone, Briefcase,
  UserCheck, Bot,
} from 'lucide-react';

import { C, SPANISH_LABELS, isAgencyRole } from './admin/constants';
import { getAdminCSS } from './admin/adminStyles';

/* ══════════════════════════════════════════════════
   Lazy-loaded views — each chunk loaded on demand
   ══════════════════════════════════════════════════ */
const DashboardView       = lazy(() => import('./admin/views/DashboardView'));
const AgencyDashboardView = lazy(() => import('./admin/views/AgencyDashboardView'));
const FunnelView          = lazy(() => import('./admin/views/FunnelView'));
const SourcesView         = lazy(() => import('./admin/views/SourcesView'));
const CampaignsView       = lazy(() => import('./admin/views/CampaignsView'));
const LeadsView           = lazy(() => import('./admin/views/LeadsView'));
const CalendarView        = lazy(() => import('./admin/views/CalendarView'));
const ChatView            = lazy(() => import('./admin/views/ChatView'));
const VisitasView         = lazy(() => import('./admin/views/VisitasView'));
const WhatsAppView        = lazy(() => import('./admin/views/WhatsAppView'));
const HubSpotView         = lazy(() => import('./admin/views/HubSpotView'));
const WorkflowAIView      = lazy(() => import('./admin/views/WorkflowAIView'));
const TeamView            = lazy(() => import('./admin/views/TeamView'));
const FSCConversationsView = lazy(() => import('./admin/views/FSCConversationsView'));

/* ── Spinner de suspense ── */
function ViewSpinner() {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <p>Cargando...</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════ */
export default function AdminPanel() {
  const navigate        = useNavigate();
  const { view: urlView } = useParams();
  const { user, loading: authLoading, logout } = useAuth();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeView = urlView || 'dashboard';
  const setActiveView = (v) => navigate(`/admin/${v}`);

  /* ── Datos globales ── */
  const [stats, setStats]           = useState({ totalLeads: 0, newLeads: 0, inProgress: 0, converted: 0 });
  const [agencyStats, setAgencyStats] = useState(null);
  const [leads, setLeads]           = useState([]);
  const [events, setEvents]         = useState([]);
  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(true);

  /* ── Estado de leads view ── */
  const [selectedLead, setSelectedLead]   = useState(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadFilter, setLeadFilter]       = useState('Todos');
  const [searchTerm, setSearchTerm]       = useState('');

  /* ── Calendario ── */
  const [showEventModal, setShowEventModal] = useState(false);

  /* ── Integraciones ── */
  const [hubspotPortal, setHubspotPortal] = useState('');
  const [metaToken, setMetaToken]         = useState('');

  const messageInputRef = useRef(null);
  const userIsAgency    = isAgencyRole(user?.role);
  const canManageTeam   = ['superadmin', 'agencia', 'admin'].includes(user?.role);

  /* ── Navegación del sidebar ── */
  const navItems = userIsAgency
    ? [
        { id: 'agency-dashboard', label: SPANISH_LABELS.agencyDashboard, icon: Activity   },
        { id: 'funnel',           label: SPANISH_LABELS.funnel,           icon: Filter     },
        { id: 'sources',          label: SPANISH_LABELS.sources,          icon: PieChart   },
        { id: 'campaigns',        label: SPANISH_LABELS.campaigns,        icon: Megaphone  },
        { id: 'team',             label: SPANISH_LABELS.team,             icon: Settings   },
        { id: 'divider-1',        label: '── Operativo ──',               icon: null       },
        { id: 'dashboard',        label: SPANISH_LABELS.dashboard,        icon: BarChart3  },
        { id: 'leads',            label: SPANISH_LABELS.leads,            icon: Users      },
        { id: 'calendar',         label: SPANISH_LABELS.calendar,         icon: Calendar   },
        { id: 'visitas',          label: SPANISH_LABELS.visitas,          icon: Eye        },
        { id: 'chat',             label: SPANISH_LABELS.chat,             icon: MessageSquare },
        { id: 'whatsapp',         label: SPANISH_LABELS.whatsapp,         icon: MessageCircle },
        { id: 'hubspot',          label: SPANISH_LABELS.hubspot,          icon: LinkIcon   },
        { id: 'workflow',         label: SPANISH_LABELS.workflow,         icon: Zap        },
        { id: 'sofia-bot',        label: 'Sofía Bot',                    icon: Bot        },
      ]
    : [
        { id: 'dashboard', label: SPANISH_LABELS.dashboard, icon: BarChart3    },
        { id: 'leads',     label: SPANISH_LABELS.leads,     icon: Users        },
        { id: 'calendar',  label: SPANISH_LABELS.calendar,  icon: Calendar     },
        { id: 'visitas',   label: SPANISH_LABELS.visitas,   icon: Eye          },
        { id: 'chat',      label: SPANISH_LABELS.chat,      icon: MessageSquare },
        { id: 'whatsapp',  label: SPANISH_LABELS.whatsapp,  icon: MessageCircle },
        ...(canManageTeam ? [{ id: 'team', label: SPANISH_LABELS.team, icon: Settings }] : []),
        { id: 'sofia-bot', label: 'Sofía Bot', icon: Bot },
      ];

  /* ── Carga inicial de datos ── */
  useEffect(() => {
    if (authLoading) return; // Wait for auth check to finish before deciding
    if (!user) { navigate('/admin/login'); return; }
    // Redirect to proper default if on generic /admin/dashboard and user is agency
    if (userIsAgency && activeView === 'dashboard') navigate('/admin/agency-dashboard', { replace: true });
    loadData();
  }, [user, authLoading, navigate]); // eslint-disable-line

  const loadData = async () => {
    try {
      setLoading(true);
      const promises = [
        api.getStats().catch(() => ({ totalLeads: 0, newLeads: 0, inProgress: 0, converted: 0 })),
        api.getLeads().catch(() => []),
        api.getEvents().catch(() => []),
        api.getMessages('general').catch(() => []),
      ];
      if (userIsAgency) promises.push(api.getAgencyStats().catch(() => null));
      const [s, l, e, m, as] = await Promise.all(promises);
      setStats(s);
      setLeads(l.leads || l || []);
      setEvents(e.events || e || []);
      setMessages(m.messages || m || []);
      if (userIsAgency && as) setAgencyStats(as);
    } catch (err) { console.error('loadData:', err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await logout(); navigate('/admin/login'); };

  const handleLeadStatusChange = async (lead, newStatus) => {
    try {
      await api.updateLead(lead.id, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    } catch (err) { console.error('updateLead:', err); }
  };

  const handleAddEvent = async (eventData) => {
    try { await api.createEvent(eventData); setShowEventModal(false); loadData(); }
    catch (err) { console.error('createEvent:', err); }
  };

  const handleSendMessage = async (content) => {
    if (!content.trim()) return;
    try { await api.sendMessage(content, 'general'); if (messageInputRef.current) messageInputRef.current.value = ''; loadData(); }
    catch (err) { console.error('sendMessage:', err); }
  };

  const filteredLeads = leads.filter(lead => {
    const matchFilter = leadFilter === 'Todos' || lead.status === leadFilter || lead.status?.toLowerCase() === leadFilter.toLowerCase();
    const matchSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || lead.phone?.includes(searchTerm);
    return matchFilter && matchSearch;
  });

  const todayEvents = events.filter(event =>
    new Date(event.start_date || event.date).toDateString() === new Date().toDateString()
  );

  const roleLabel      = userIsAgency ? 'Agencia' : 'Asesor';
  const roleBadgeColor = userIsAgency ? C.accent : C.green;

  /* ════════════════════════════════
     RENDER
     ════════════════════════════════ */
  // Show spinner while verifying auth — prevents false "No autorizado" on mobile
  if (authLoading) {
    return (
      <>
        <style>{getAdminCSS()}</style>
        <div className="admin-wrap" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
          <div className="loading-wrap"><div className="spinner" /><p>Verificando sesión...</p></div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{getAdminCSS()}</style>

      <div className="admin-wrap">

        {/* ══ Mobile overlay ══ */}
        <div className={`sb-overlay${mobileMenuOpen ? ' visible' : ''}`} onClick={() => setMobileMenuOpen(false)} />

        {/* ══ Sidebar ══ */}
        <aside className={`sb${sidebarOpen ? '' : ' closed'}${mobileMenuOpen ? ' mobile-open' : ''}`}>
          <div className="sb-head">
            <div className="sb-logo">
              <span className="sb-logo-full"><Logo height={32} variant="light" /></span>
              <span className="sb-logo-mini"><div className="sb-logo-icon"><Briefcase size={18} /></div></span>
            </div>
            <button className="sb-toggle" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <nav className="sb-nav">
            {navItems.map(item => {
              if (item.id.startsWith('divider')) {
                return <div key={item.id} className="sb-divider sb-label">{item.label.replace(/─/g, '').trim()}</div>;
              }
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`sb-item${activeView === item.id ? ' active' : ''}`}
                  onClick={() => { setActiveView(item.id); setMobileMenuOpen(false); }}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <Icon size={18} />
                  <span className="sb-label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button className="sb-logout" onClick={handleLogout} title={!sidebarOpen ? SPANISH_LABELS.logout : ''}>
            <LogOut size={18} />
            <span className="sb-label">{SPANISH_LABELS.logout}</span>
          </button>
        </aside>

        {/* ══ Contenido principal ══ */}
        <div className="main">
          {activeView !== 'whatsapp' && (
          <header className="topbar">
            <div className="topbar-left">
              <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(o => !o)}>
                <Menu size={22} />
              </button>
              <span
                className="role-badge"
                style={{ background: `${roleBadgeColor}18`, color: roleBadgeColor, border: `1px solid ${roleBadgeColor}40` }}
              >
                {userIsAgency ? <Activity size={12} /> : <UserCheck size={12} />}
                {roleLabel}
              </span>
            </div>
            <div className="topbar-user" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <NotificationDropdown onNavigate={setActiveView} />
              <div className="topbar-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
              <span>{user?.name || 'Usuario'}</span>
            </div>
          </header>
          )}

          {activeView === 'whatsapp' && (
            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(o => !o)} style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
              <Menu size={22} />
            </button>
          )}
          <main className={activeView === 'whatsapp' ? 'content-wa' : 'content'}>
            {loading && <div className="loading-wrap"><div className="spinner" /><p>Cargando...</p></div>}

            <Suspense fallback={<ViewSpinner />}>
              {/* ── Vistas exclusivas de agencia ── */}
              {!loading && activeView === 'agency-dashboard' && userIsAgency &&
                <AgencyDashboardView stats={agencyStats || stats} leads={leads} />}
              {!loading && activeView === 'funnel' && userIsAgency &&
                <FunnelView stats={agencyStats || stats} />}
              {!loading && activeView === 'sources' && userIsAgency &&
                <SourcesView stats={agencyStats || stats} leads={leads} />}
              {!loading && activeView === 'campaigns' && userIsAgency &&
                <CampaignsView />}

              {/* ── Vistas compartidas ── */}
              {!loading && activeView === 'dashboard' &&
                <DashboardView stats={stats} leads={leads} events={todayEvents} />}
              {!loading && activeView === 'leads' &&
                <LeadsView
                  leads={filteredLeads}
                  searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                  leadFilter={leadFilter} setLeadFilter={setLeadFilter}
                  selectedLead={selectedLead} setSelectedLead={setSelectedLead}
                  showLeadModal={showLeadModal} setShowLeadModal={setShowLeadModal}
                  onStatusChange={handleLeadStatusChange}
                />}
              {!loading && activeView === 'calendar' &&
                <CalendarView
                  events={events}
                  showEventModal={showEventModal} setShowEventModal={setShowEventModal}
                  onAddEvent={handleAddEvent}
                />}
              {!loading && activeView === 'chat' &&
                <ChatView messages={messages} onSendMessage={handleSendMessage} messageInputRef={messageInputRef} />}
              {!loading && activeView === 'visitas' &&
                <VisitasView />}
              {!loading && activeView === 'whatsapp' &&
                <WhatsAppView />}
              {!loading && activeView === 'team' && canManageTeam &&
                <TeamView userRole={user?.role} />}
              {!loading && activeView === 'hubspot' && userIsAgency &&
                <HubSpotView hubspotPortal={hubspotPortal} setHubspotPortal={setHubspotPortal} />}
              {!loading && activeView === 'workflow' && userIsAgency &&
                <WorkflowAIView metaToken={metaToken} setMetaToken={setMetaToken} />}
              {!loading && activeView === 'sofia-bot' &&
                <FSCConversationsView />}
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}
