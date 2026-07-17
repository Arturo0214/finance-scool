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
import CmdK from '../components/CmdK';
import {
  Menu, LogOut, BarChart3, Users, Calendar, MessageSquare,
  MessageCircle, Link as LinkIcon, Zap, Eye, Settings,
  Activity, Filter, PieChart, Megaphone, Briefcase,
  UserCheck, Bot, LayoutDashboard, Contact, FileText, Target, Bell,
  KanbanSquare, HandCoins, ChevronsLeft, ChevronsRight,
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
const CrmDashboardView    = lazy(() => import('./admin/views/crm/CrmDashboardView'));
const CrmPipelineView     = lazy(() => import('./admin/views/crm/CrmPipelineView'));
const CrmClientsView      = lazy(() => import('./admin/views/crm/CrmClientsView'));
const CrmPoliciesView     = lazy(() => import('./admin/views/crm/CrmPoliciesView'));
const CrmGoalsView        = lazy(() => import('./admin/views/crm/CrmGoalsView'));
const CrmRemindersView    = lazy(() => import('./admin/views/crm/CrmRemindersView'));
const CrmCommissionsView  = lazy(() => import('./admin/views/crm/CrmCommissionsView'));
const CrmQuoteView        = lazy(() => import('./admin/views/crm/CrmQuoteView'));
const HealthView          = lazy(() => import('./admin/views/HealthView'));

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
  // Colapso del sidebar: recuerda la preferencia del usuario entre sesiones
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile && localStorage.getItem('fsc_sidebar') !== 'closed');
  const toggleSidebar = () => setSidebarOpen(o => { localStorage.setItem('fsc_sidebar', o ? 'closed' : 'open'); return !o; });
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
  // Admins ven el CRM completo de todos los consultores (Sofía Bot sigue solo agencia)
  const userSeesAllCrm  = canManageTeam;

  /* ── Navegación del sidebar ──
     Solo el CRM Incubadora S-COOL + gestión de usuarios. Las vistas
     antiguas (leads, calendario, WhatsApp, Sofía Bot, etc.) siguen
     accesibles por URL directa pero ya no aparecen en el menú. */
  const navItems = [
    { id: 'divider-crm',      label: '── CRM Asesores ──',            icon: null       },
    { id: 'crm',              label: 'Tableros CRM',                  icon: LayoutDashboard },
    { id: 'crm-pipeline',     label: 'Pipeline',                      icon: KanbanSquare },
    { id: 'crm-clientes',     label: 'Clientes',                      icon: Contact    },
    { id: 'crm-polizas',      label: 'Pólizas',                       icon: FileText   },
    { id: 'crm-comisiones',   label: 'Comisiones',                    icon: HandCoins  },
    { id: 'crm-metas',        label: 'Metas & Forecast',              icon: Target     },
    { id: 'crm-recordatorios', label: 'Recordatorios',                icon: Bell       },
    { id: 'crm-cotizador',    label: 'Cotizador PPR',                 icon: BarChart3  },
    { id: 'divider-2',        label: '── Administración ──',          icon: null       },
    { id: 'team',             label: SPANISH_LABELS.team,             icon: Settings   },
    { id: 'health',           label: 'Salud del sistema',             icon: Activity   },
  ].filter(item => {
    if (item.id === 'health') return userIsAgency;
    return (item.id !== 'team' && item.id !== 'divider-2') || canManageTeam;
  });

  /* ── Carga inicial de datos ── */
  useEffect(() => {
    if (authLoading) return; // Wait for auth check to finish before deciding
    if (!user) { navigate('/login'); return; }
    // El CRM es ahora la vista principal para todos
    if (activeView === 'dashboard') navigate('/admin/crm', { replace: true });
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
      promises.push(api.getAgencyStats().catch(() => null));
      const [s, l, e, m, as] = await Promise.all(promises);
      setStats(s);
      setLeads(l.leads || l || []);
      setEvents(e.events || e || []);
      setMessages(m.messages || m || []);
      if (as) setAgencyStats(as);
    } catch (err) { console.error('loadData:', err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

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

  const handleUpdateEvent = async (id, eventData) => {
    try { await api.updateEvent(id, eventData); loadData(); }
    catch (err) { console.error('updateEvent:', err); }
  };

  const handleDeleteEvent = async (id) => {
    try { await api.deleteEvent(id); loadData(); }
    catch (err) { console.error('deleteEvent:', err); }
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

  const roleLabel      = userIsAgency ? 'Agencia' : (user?.role === 'admin' ? 'Admin' : 'Asesor');
  const roleBadgeColor = userIsAgency ? C.accent : (user?.role === 'admin' ? C.amber : C.green);

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

        {/* ══ Buscador global ⌘K ══ */}
        <CmdK />

        {/* ══ Mobile overlay ══ */}
        <div className={`sb-overlay${mobileMenuOpen ? ' visible' : ''}`} onClick={() => setMobileMenuOpen(false)} />

        {/* ══ Sidebar ══ */}
        <aside className={`sb${sidebarOpen ? '' : ' closed'}${mobileMenuOpen ? ' mobile-open' : ''}`}>
          <div className="sb-head">
            <div className="sb-logo">
              <span className="sb-logo-full"><Logo height={32} variant="light" /></span>
              <span className="sb-logo-mini"><div className="sb-logo-icon"><Briefcase size={18} /></div></span>
            </div>
            <button className="sb-toggle" onClick={toggleSidebar} title={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}>
              {sidebarOpen ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
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
          {activeView !== 'whatsapp' && activeView !== 'sofia-bot' && (
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

          {/* WhatsApp mobile menu is inside the WA header — no floating button needed */}
          <main className={activeView === 'whatsapp' || activeView === 'sofia-bot' ? 'content-wa' : 'content'}>
            {loading && activeView !== 'whatsapp' && <div className="loading-wrap"><div className="spinner" /><p>Cargando...</p></div>}

            <Suspense fallback={<ViewSpinner />}>
              {/* ── Vistas — todos ven lo mismo ── */}
              {!loading && activeView === 'agency-dashboard' &&
                <AgencyDashboardView stats={agencyStats || stats} leads={leads} />}
              {!loading && activeView === 'funnel' &&
                <FunnelView />}
              {!loading && activeView === 'sources' &&
                <SourcesView stats={agencyStats || stats} leads={leads} />}
              {!loading && activeView === 'campaigns' &&
                <CampaignsView />}
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
                  onUpdateEvent={handleUpdateEvent}
                  onDeleteEvent={handleDeleteEvent}
                />}
              {!loading && activeView === 'chat' &&
                <ChatView messages={messages} onSendMessage={handleSendMessage} messageInputRef={messageInputRef} />}
              {!loading && activeView === 'visitas' &&
                <VisitasView />}
              {activeView === 'whatsapp' &&
                <WhatsAppView onOpenMenu={() => setMobileMenuOpen(o => !o)} />}
              {!loading && activeView === 'team' && canManageTeam &&
                <TeamView userRole={user?.role} currentUserId={user?.id} />}
              {!loading && activeView === 'hubspot' &&
                <HubSpotView hubspotPortal={hubspotPortal} setHubspotPortal={setHubspotPortal} />}
              {!loading && activeView === 'workflow' &&
                <WorkflowAIView metaToken={metaToken} setMetaToken={setMetaToken} />}
              {!loading && activeView === 'sofia-bot' && userIsAgency &&
                <FSCConversationsView onOpenMenu={() => setMobileMenuOpen(o => !o)} />}
              {/* ── CRM Asesores ── */}
              {!loading && activeView === 'crm' && <CrmDashboardView />}
              {!loading && activeView === 'crm-pipeline' && <CrmPipelineView isAgency={userSeesAllCrm} />}
              {!loading && activeView === 'crm-clientes' && <CrmClientsView isAgency={userSeesAllCrm} />}
              {!loading && activeView === 'crm-polizas' && <CrmPoliciesView isAgency={userSeesAllCrm} />}
              {!loading && activeView === 'crm-comisiones' && <CrmCommissionsView isAgency={userSeesAllCrm} />}
              {!loading && activeView === 'crm-metas' && <CrmGoalsView isAgency={userSeesAllCrm} />}
              {!loading && activeView === 'crm-recordatorios' && <CrmRemindersView isAgency={userSeesAllCrm} />}
              {!loading && activeView === 'crm-cotizador' && <CrmQuoteView />}
              {!loading && activeView === 'health' && userIsAgency && <HealthView />}
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}
