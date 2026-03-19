import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import Logo from '../components/Logo';
import {
  Menu,
  X,
  LogOut,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  MessageCircle,
  Link as LinkIcon,
  Zap,
  ChevronDown,
  Plus,
  Search,
  Phone,
  Briefcase,
  MapPin,
  Clock,
  Edit,
  Trash2,
  Eye,
  Send,
  AlertCircle,
  TrendingUp,
  FileText,
  PieChart,
  Target,
  Activity,
  ArrowRight,
  Filter,
  Download,
  Globe,
  Megaphone,
  BarChart2,
  Percent,
  UserCheck,
  Settings,
} from 'lucide-react';

/* ── Prudential Blue Theme ── */
const C = {
  primary: '#003DA5',
  primaryLight: '#0056D6',
  primaryDark: '#002B75',
  accent: '#0088E0',
  white: '#FFFFFF',
  bg: '#F0F4F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1E293B',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  green: '#059669',
  greenBg: '#ECFDF5',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  red: '#DC2626',
  redBg: '#FEF2F2',
  blue: '#0066CC',
  blueBg: '#EFF6FF',
};

/* ── Role helpers ── */
const isAgencyRole = (role) => ['superadmin', 'agencia'].includes(role);
const isAdvisorRole = (role) => ['asesor', 'admin'].includes(role);

const SPANISH_LABELS = {
  dashboard: 'Panel de Control',
  agencyDashboard: 'Marketing Analytics',
  leads: 'Leads',
  calendar: 'Calendario',
  chat: 'Chat Interno',
  whatsapp: 'WhatsApp',
  hubspot: 'HubSpot',
  workflow: 'Workflow AI',
  funnel: 'Embudo de Conversión',
  sources: 'Fuentes de Leads',
  campaigns: 'Campañas',
  logout: 'Cerrar Sesión',
  totalLeads: 'Leads Totales',
  newLeads: 'Leads Nuevos',
  inProgress: 'En Proceso',
  converted: 'Convertidos',
  recentLeads: 'Leads Recientes',
  todayEvents: 'Eventos de Hoy',
  search: 'Buscar...',
  name: 'Nombre',
  phone: 'Teléfono',
  service: 'Servicio',
  source: 'Fuente',
  status: 'Estado',
  date: 'Fecha',
  actions: 'Acciones',
  allStatus: 'Todos',
  newStatus: 'Nuevo',
  contacted: 'Contactado',
  processing: 'En Proceso',
  notes: 'Notas',
  changeStatus: 'Cambiar Estado',
  save: 'Guardar',
  cancel: 'Cancelar',
  close: 'Cerrar',
  addEvent: 'Agregar Evento',
  eventTitle: 'Título del Evento',
  eventDate: 'Fecha del Evento',
  eventTime: 'Hora',
  eventDescription: 'Descripción',
  messages: 'Mensajes',
  sendMessage: 'Enviar Mensaje',
  writeMessage: 'Escribe tu mensaje...',
  channelGeneral: 'general',
  whatsappTitle: 'WhatsApp para PPR',
  whatsappTemplates: 'Plantillas de Mensaje',
  hubspotConfig: 'Configuración de HubSpot',
  hubspotPortal: 'ID del Portal HubSpot',
  configure: 'Configurar',
  metaWorkflow: 'Workflow Meta Business Agent',
  team: 'Equipo',
  noLeads: 'No hay leads disponibles',
  noEvents: 'No hay eventos para hoy',
  noMessages: 'No hay mensajes en este canal',
};

const STATUS_COLORS = {
  'nuevo': { bg: C.amberBg, text: C.amber },
  'Nuevo': { bg: C.amberBg, text: C.amber },
  'contactado': { bg: C.blueBg, text: C.blue },
  'Contactado': { bg: C.blueBg, text: C.blue },
  'en_proceso': { bg: '#FFF7ED', text: '#EA580C' },
  'En Proceso': { bg: '#FFF7ED', text: '#EA580C' },
  'convertido': { bg: C.greenBg, text: C.green },
  'Convertido': { bg: C.greenBg, text: C.green },
};

/* ═══════════════════════════════════════════════════════
   MAIN ADMIN PANEL — Role-based routing
   ═══════════════════════════════════════════════════════ */
export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [stats, setStats] = useState({ totalLeads: 0, newLeads: 0, inProgress: 0, converted: 0 });
  const [agencyStats, setAgencyStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [leadFilter, setLeadFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [hubspotPortal, setHubspotPortal] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const messageInputRef = useRef(null);

  const userIsAgency = isAgencyRole(user?.role);
  const canManageTeam = ['superadmin', 'agencia', 'admin'].includes(user?.role);

  /* ── Navigation items based on role ── */
  const navItems = userIsAgency
    ? [
        { id: 'agency-dashboard', label: SPANISH_LABELS.agencyDashboard, icon: Activity },
        { id: 'funnel', label: SPANISH_LABELS.funnel, icon: Filter },
        { id: 'sources', label: SPANISH_LABELS.sources, icon: PieChart },
        { id: 'campaigns', label: SPANISH_LABELS.campaigns, icon: Megaphone },
        { id: 'team', label: SPANISH_LABELS.team, icon: Settings },
        { id: 'divider', label: '── Operativo ──', icon: null },
        { id: 'dashboard', label: SPANISH_LABELS.dashboard, icon: BarChart3 },
        { id: 'leads', label: SPANISH_LABELS.leads, icon: Users },
        { id: 'calendar', label: SPANISH_LABELS.calendar, icon: Calendar },
        { id: 'chat', label: SPANISH_LABELS.chat, icon: MessageSquare },
        { id: 'whatsapp', label: SPANISH_LABELS.whatsapp, icon: MessageCircle },
        { id: 'hubspot', label: SPANISH_LABELS.hubspot, icon: LinkIcon },
        { id: 'workflow', label: SPANISH_LABELS.workflow, icon: Zap },
      ]
    : [
        { id: 'dashboard', label: SPANISH_LABELS.dashboard, icon: BarChart3 },
        { id: 'leads', label: SPANISH_LABELS.leads, icon: Users },
        { id: 'calendar', label: SPANISH_LABELS.calendar, icon: Calendar },
        { id: 'chat', label: SPANISH_LABELS.chat, icon: MessageSquare },
        { id: 'whatsapp', label: SPANISH_LABELS.whatsapp, icon: MessageCircle },
        ...(canManageTeam ? [{ id: 'team', label: SPANISH_LABELS.team, icon: Settings }] : []),
      ];

  useEffect(() => {
    if (!user) { navigate('/admin/login'); return; }
    setActiveView(userIsAgency ? 'agency-dashboard' : 'dashboard');
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const promises = [
        api.getStats().catch(() => ({ totalLeads: 12, newLeads: 3, inProgress: 5, converted: 4 })),
        api.getLeads().catch(() => []),
        api.getEvents().catch(() => []),
        api.getMessages('general').catch(() => []),
      ];
      if (userIsAgency) {
        promises.push(api.getAgencyStats().catch(() => null));
      }
      const results = await Promise.all(promises);
      setStats(results[0]);
      setLeads(results[1].leads || results[1] || []);
      setEvents(results[2].events || results[2] || []);
      setMessages(results[3].messages || results[3] || []);
      if (userIsAgency && results[4]) setAgencyStats(results[4]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate('/admin/login'); };
  const handleLeadStatusChange = async (lead, newStatus) => {
    try {
      await api.updateLead(lead.id, { status: newStatus });
      setLeads(leads.map(l => (l.id === lead.id ? { ...l, status: newStatus } : l)));
      setSelectedLead({ ...lead, status: newStatus });
    } catch (error) { console.error('Error updating lead:', error); }
  };
  const handleAddEvent = async (eventData) => {
    try { await api.createEvent(eventData); setShowEventModal(false); loadData(); }
    catch (error) { console.error('Error adding event:', error); }
  };
  const handleSendMessage = async (content) => {
    if (!content.trim()) return;
    try { await api.sendMessage(content, 'general'); messageInputRef.current.value = ''; loadData(); }
    catch (error) { console.error('Error sending message:', error); }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesFilter = leadFilter === 'Todos' || lead.status === leadFilter || lead.status?.toLowerCase() === leadFilter.toLowerCase();
    const matchesSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || lead.phone?.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  const todayEvents = events.filter(event => {
    const eventDate = new Date(event.start_date || event.date).toDateString();
    return eventDate === new Date().toDateString();
  });

  const roleLabel = userIsAgency ? 'Agencia' : 'Asesor';
  const roleBadgeColor = userIsAgency ? C.accent : C.green;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .admin-wrap { display:flex; height:100vh; font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; background:${C.bg}; color:${C.text}; }

        /* Sidebar */
        .sb { width:260px; background:linear-gradient(180deg,${C.primary} 0%,${C.primaryDark} 100%); color:#fff; display:flex; flex-direction:column; padding:20px 0; transition:width .25s ease; flex-shrink:0; }
        .sb.closed { width:72px; }
        .sb-head { display:flex; align-items:center; justify-content:space-between; padding:0 16px; margin-bottom:28px; }
        .sb-logo { display:flex; align-items:center; gap:10px; }
        .sb-logo-icon { width:32px; height:32px; background:rgba(255,255,255,.15); border-radius:8px; display:flex; align-items:center; justify-content:center; }
        .sb-logo span { font-size:15px; font-weight:700; white-space:nowrap; letter-spacing:-.3px; }
        .sb-toggle { background:none; border:none; color:rgba(255,255,255,.7); cursor:pointer; padding:6px; display:flex; border-radius:6px; transition:background .2s; }
        .sb-toggle:hover { background:rgba(255,255,255,.1); }

        .sb-nav { flex:1; display:flex; flex-direction:column; gap:4px; padding:0 10px; overflow-y:auto; }
        .sb-item { background:none; border:none; color:rgba(255,255,255,.75); padding:11px 14px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:11px; font-size:13.5px; font-weight:500; transition:all .2s; white-space:nowrap; font-family:inherit; }
        .sb-item:hover { background:rgba(255,255,255,.08); color:#fff; }
        .sb-item.active { background:rgba(255,255,255,.15); color:#fff; font-weight:600; box-shadow:inset 3px 0 0 ${C.accent}; }
        .sb-divider { padding:14px 14px 6px; font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:rgba(255,255,255,.35); font-weight:600; pointer-events:none; }

        .sb-logout { background:none; border:none; color:rgba(255,255,255,.6); padding:11px 14px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:11px; font-size:13.5px; margin:0 10px; transition:all .2s; font-family:inherit; white-space:nowrap; }
        .sb-logout:hover { color:#fff; background:rgba(220,38,38,.25); }

        /* Main */
        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .topbar { background:${C.white}; padding:14px 28px; border-bottom:1px solid ${C.border}; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
        .topbar-left { display:flex; align-items:center; gap:10px; }
        .role-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
        .topbar-user { font-size:13px; font-weight:500; color:${C.textMuted}; display:flex; align-items:center; gap:8px; }
        .topbar-avatar { width:30px; height:30px; border-radius:50%; background:${C.primary}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
        .content { flex:1; overflow:auto; padding:28px; }

        /* Views */
        .view { max-width:1400px; margin:0 auto; width:100%; animation:fadeIn .3s ease; }
        .view-title { font-size:26px; font-weight:700; color:${C.text}; margin-bottom:6px; letter-spacing:-.3px; }
        .view-subtitle { font-size:14px; color:${C.textMuted}; margin-bottom:24px; }

        /* Stats Cards */
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:28px; }
        .stat-card { background:${C.white}; padding:20px; border-radius:12px; display:flex; align-items:center; gap:14px; border:1px solid ${C.border}; transition:box-shadow .2s; }
        .stat-card:hover { box-shadow:0 4px 12px rgba(0,61,165,.08); }
        .stat-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stat-label { font-size:12px; color:${C.textMuted}; margin:0 0 2px; font-weight:500; }
        .stat-value { font-size:26px; font-weight:700; color:${C.text}; margin:0; }
        .stat-change { font-size:11px; font-weight:600; margin:0; }

        /* Section */
        .section { background:${C.white}; padding:22px; border-radius:12px; border:1px solid ${C.border}; margin-bottom:20px; }
        .section-title { font-size:16px; font-weight:600; color:${C.text}; margin:0 0 14px; }
        .section-subtitle { font-size:13px; color:${C.textMuted}; margin:-10px 0 14px; }

        /* Chart */
        .chart-bars { display:flex; flex-direction:column; gap:10px; }
        .chart-row { display:flex; align-items:center; gap:14px; }
        .chart-label { width:90px; font-size:13px; font-weight:500; color:${C.textMuted}; }
        .chart-track { flex:1; height:28px; background:${C.bg}; border-radius:6px; overflow:hidden; }
        .chart-fill { height:100%; display:flex; align-items:center; justify-content:flex-end; padding-right:10px; border-radius:6px; transition:width .6s ease; }
        .chart-val { color:#fff; font-size:12px; font-weight:600; }

        /* Funnel */
        .funnel-wrap { display:flex; flex-direction:column; gap:0; }
        .funnel-stage { display:flex; align-items:center; gap:16px; padding:16px 20px; border-radius:10px; margin:0 auto; transition:all .3s; }
        .funnel-stage:hover { transform:scale(1.02); }
        .funnel-count { font-size:28px; font-weight:800; color:#fff; min-width:60px; text-align:center; }
        .funnel-info { flex:1; }
        .funnel-name { font-size:15px; font-weight:600; color:#fff; }
        .funnel-pct { font-size:12px; color:rgba(255,255,255,.8); }
        .funnel-arrow { text-align:center; color:${C.textLight}; font-size:18px; padding:4px 0; }

        /* Two Column */
        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .three-col { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }

        /* Table */
        .tbl-wrap { overflow-x:auto; border-radius:10px; border:1px solid ${C.border}; }
        table { width:100%; border-collapse:collapse; font-size:13.5px; }
        thead th { background:${C.bg}; padding:10px 14px; text-align:left; font-weight:600; color:${C.textMuted}; font-size:12px; text-transform:uppercase; letter-spacing:.3px; border-bottom:1px solid ${C.border}; }
        tbody td { padding:10px 14px; border-bottom:1px solid ${C.border}; color:${C.text}; }
        tbody tr:hover { background:${C.blueBg}; }
        .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
        .action-btn { background:none; border:none; color:${C.primary}; cursor:pointer; padding:4px; display:inline-flex; transition:color .2s; }
        .action-btn:hover { color:${C.accent}; }
        .empty { padding:32px; text-align:center; color:${C.textMuted}; font-size:14px; }

        /* Leads */
        .leads-head { display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
        .search-box { display:flex; align-items:center; background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 14px; gap:8px; }
        .search-box input { flex:1; border:none; outline:none; font-size:14px; font-family:inherit; background:none; color:${C.text}; }
        .filter-tabs { display:flex; gap:6px; flex-wrap:wrap; }
        .f-tab { padding:7px 14px; border-radius:6px; border:1px solid ${C.border}; background:${C.white}; cursor:pointer; font-size:13px; font-weight:500; transition:all .2s; font-family:inherit; color:${C.textMuted}; }
        .f-tab:hover { border-color:${C.primary}; color:${C.primary}; }
        .f-tab.active { background:${C.primary}; color:#fff; border-color:${C.primary}; }

        /* Calendar */
        .cal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
        .cal-nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
        .cal-nav button { background:none; border:1px solid ${C.border}; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:14px; color:${C.textMuted}; transition:all .2s; }
        .cal-nav button:hover { border-color:${C.primary}; color:${C.primary}; }
        .cal-nav h2 { font-size:18px; font-weight:600; color:${C.text}; text-transform:capitalize; margin:0; }
        .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:${C.border}; border-radius:8px; overflow:hidden; }
        .cal-dh { background:${C.primary}; color:#fff; padding:10px; text-align:center; font-size:12px; font-weight:600; }
        .cal-day { background:${C.white}; padding:10px; min-height:72px; }
        .cal-day.empty { background:${C.bg}; }
        .cal-day-num { font-size:13px; font-weight:600; color:${C.text}; margin-bottom:4px; }
        .cal-dot { width:6px; height:6px; background:${C.accent}; border-radius:50%; display:inline-block; margin-right:3px; }

        /* Chat */
        .chat-wrap { background:${C.white}; border-radius:12px; border:1px solid ${C.border}; display:flex; flex-direction:column; height:480px; }
        .msg-list { flex:1; overflow:auto; padding:18px; display:flex; flex-direction:column; gap:10px; }
        .msg-bubble { background:${C.bg}; padding:10px 14px; border-radius:10px; max-width:70%; }
        .msg-head { display:flex; justify-content:space-between; margin-bottom:3px; font-size:12px; }
        .msg-time { color:${C.textLight}; font-size:11px; }
        .msg-bubble p { margin:0; font-size:14px; color:${C.text}; }
        .chat-input-bar { display:flex; gap:8px; padding:14px; border-top:1px solid ${C.border}; }
        .chat-input-bar input { flex:1; border:1px solid ${C.border}; border-radius:8px; padding:10px 12px; font-size:14px; font-family:inherit; outline:none; transition:border-color .2s; }
        .chat-input-bar input:focus { border-color:${C.primary}; }
        .send-btn { background:${C.primary}; color:#fff; border:none; border-radius:8px; padding:10px 16px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; }
        .send-btn:hover { background:${C.primaryLight}; }

        /* Templates */
        .tpl-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:20px; }
        .tpl-card { background:${C.white}; padding:18px; border-radius:10px; border:1px solid ${C.border}; transition:box-shadow .2s; }
        .tpl-card:hover { box-shadow:0 4px 12px rgba(0,61,165,.06); }
        .tpl-card h3 { font-size:14px; font-weight:600; color:${C.text}; margin:0 0 8px; }
        .tpl-card p { font-size:13px; color:${C.textMuted}; margin:0; line-height:1.5; }
        .tpl-link { display:inline-block; margin-top:10px; color:${C.primary}; text-decoration:none; font-weight:600; font-size:13px; transition:color .2s; }
        .tpl-link:hover { color:${C.accent}; }

        /* Info Box */
        .info-box { background:${C.blueBg}; border:1px solid rgba(0,102,204,.2); border-radius:8px; padding:14px 16px; display:flex; gap:10px; align-items:flex-start; font-size:13px; color:${C.blue}; }
        .info-box p { margin:0; }

        /* Config */
        .config-panel { background:${C.bg}; padding:18px; border-radius:8px; margin-bottom:14px; }
        .help-text { display:block; margin-top:4px; color:${C.textLight}; font-size:12px; }
        .hs-placeholder { background:${C.bg}; padding:36px; border-radius:8px; text-align:center; color:${C.textMuted}; }

        /* Workflow */
        .wf-diagram { display:flex; align-items:center; gap:10px; overflow-x:auto; margin-bottom:20px; padding:8px 0; }
        .wf-stage { flex:1; min-width:180px; }
        .wf-box { padding:16px; border-radius:10px; color:#fff; text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; font-size:13px; font-weight:600; }
        .wf-box small { font-weight:400; opacity:.85; }
        .wf-arrow { font-size:22px; color:${C.accent}; font-weight:bold; min-width:28px; text-align:center; }
        .wf-branches { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:20px; }
        .branch-box { background:${C.white}; padding:16px; border-radius:8px; border-left:4px solid ${C.primary}; border:1px solid ${C.border}; }
        .branch-box h4 { font-size:14px; margin:0 0 8px; }
        .branch-box ul { margin:0; padding-left:18px; font-size:13px; color:${C.textMuted}; line-height:1.8; }
        .pipeline-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; }
        .pipeline-card { background:${C.white}; padding:14px; border-radius:8px; display:flex; align-items:center; gap:10px; border:1px solid ${C.border}; }
        .pipeline-badge { font-size:22px; width:44px; height:44px; display:flex; align-items:center; justify-content:center; border-radius:8px; }
        .pipeline-title { font-size:12px; color:${C.textMuted}; margin:0; }
        .pipeline-num { font-size:22px; font-weight:700; color:${C.text}; margin:0; }

        /* KPI Cards (Agency) */
        .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:28px; }
        .kpi-card { background:${C.white}; padding:20px; border-radius:12px; border:1px solid ${C.border}; position:relative; overflow:hidden; }
        .kpi-card::after { content:''; position:absolute; top:0; left:0; width:4px; height:100%; border-radius:4px 0 0 4px; }
        .kpi-card.blue::after { background:${C.primary}; }
        .kpi-card.green::after { background:${C.green}; }
        .kpi-card.amber::after { background:${C.amber}; }
        .kpi-card.red::after { background:${C.red}; }
        .kpi-card.cyan::after { background:${C.accent}; }
        .kpi-top { display:flex; justify-content:space-between; align-items:flex-start; }
        .kpi-val { font-size:32px; font-weight:800; color:${C.text}; margin:0; line-height:1; }
        .kpi-label { font-size:12px; color:${C.textMuted}; margin:6px 0 0; font-weight:500; }
        .kpi-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; }

        /* Source bar */
        .source-bar { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid ${C.border}; }
        .source-bar:last-child { border-bottom:none; }
        .source-name { width:100px; font-size:13px; font-weight:600; color:${C.text}; }
        .source-track { flex:1; height:24px; background:${C.bg}; border-radius:6px; overflow:hidden; position:relative; }
        .source-fill { height:100%; border-radius:6px; transition:width .6s ease; display:flex; align-items:center; justify-content:flex-end; padding-right:8px; }
        .source-count { font-size:12px; font-weight:600; color:#fff; }
        .source-pct { font-size:12px; font-weight:600; color:${C.textMuted}; min-width:40px; text-align:right; }

        /* Buttons */
        .btn-primary { background:${C.primary}; color:#fff; border:none; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; display:inline-flex; align-items:center; gap:6px; }
        .btn-primary:hover { background:${C.primaryLight}; }
        .btn-secondary { background:${C.bg}; color:${C.textMuted}; border:1px solid ${C.border}; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; }
        .btn-secondary:hover { background:${C.border}; }

        /* Modal */
        .modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,.4); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background:${C.white}; border-radius:14px; box-shadow:0 20px 25px -5px rgba(0,0,0,.12); max-width:480px; width:92%; max-height:90vh; display:flex; flex-direction:column; }
        .modal-head { padding:20px 22px; border-bottom:1px solid ${C.border}; display:flex; justify-content:space-between; align-items:center; }
        .modal-head h2 { font-size:18px; font-weight:600; margin:0; color:${C.text}; }
        .close-btn { background:none; border:none; cursor:pointer; color:${C.textMuted}; padding:4px; display:flex; transition:color .2s; }
        .close-btn:hover { color:${C.text}; }
        .modal-body { padding:22px; overflow:auto; flex:1; }
        .modal-foot { padding:18px 22px; border-top:1px solid ${C.border}; display:flex; gap:10px; justify-content:flex-end; }
        .field { margin-bottom:18px; }
        .field label { display:block; font-size:13px; font-weight:600; color:${C.text}; margin-bottom:5px; }
        .field input, .field select, .field textarea { width:100%; padding:10px 12px; border:1px solid ${C.border}; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .2s; background:${C.white}; color:${C.text}; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color:${C.primary}; box-shadow:0 0 0 3px rgba(0,61,165,.08); }
        .field p { margin:4px 0 0; font-size:14px; color:${C.text}; }

        /* Events */
        .events-list { display:flex; flex-direction:column; gap:10px; }
        .event-card { background:${C.bg}; padding:12px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border-left:3px solid ${C.accent}; }
        .event-card h3 { font-size:14px; font-weight:600; color:${C.text}; margin:0 0 2px; }
        .event-card .ev-time { display:flex; align-items:center; gap:4px; font-size:12px; color:${C.textMuted}; }

        /* Loading */
        .loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:14px; }
        .spinner { width:36px; height:36px; border:3px solid ${C.border}; border-top-color:${C.primary}; border-radius:50%; animation:spin .8s linear infinite; }
        .loading-wrap p { color:${C.textMuted}; font-size:14px; margin:0; }

        /* Responsive */
        @media(max-width:1100px){ .two-col,.three-col { grid-template-columns:1fr; } }
        @media(max-width:900px){
          .sb { width:72px !important; }
          .sb span, .sb-divider { display:none !important; }
          .content { padding:18px; }
          .stats-grid,.kpi-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media(max-width:600px){
          .sb { width:0 !important; padding:0 !important; overflow:hidden; }
          .content { padding:14px; }
          .stats-grid,.kpi-grid { grid-template-columns:1fr; }
          .view-title { font-size:22px; }
        }
      `}</style>

      <div className="admin-wrap">
        {/* Sidebar */}
        <aside className={`sb${sidebarOpen ? '' : ' closed'}`}>
          <div className="sb-head">
            <div className="sb-logo">
              {sidebarOpen ? <Logo height={32} variant="light" /> : <div className="sb-logo-icon"><Briefcase size={18} /></div>}
            </div>
            <button className="sb-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <nav className="sb-nav">
            {navItems.map(item => {
              if (item.id.startsWith('divider')) {
                return sidebarOpen ? <div key={item.id} className="sb-divider">{item.label.replace(/─/g, '').trim()}</div> : null;
              }
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`sb-item${activeView === item.id ? ' active' : ''}`}
                  onClick={() => setActiveView(item.id)}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <Icon size={18} />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <button className="sb-logout" onClick={handleLogout} title={!sidebarOpen ? SPANISH_LABELS.logout : ''}>
            <LogOut size={18} />
            {sidebarOpen && <span>{SPANISH_LABELS.logout}</span>}
          </button>
        </aside>

        {/* Main Content */}
        <div className="main">
          <header className="topbar">
            <div className="topbar-left">
              <span className="role-badge" style={{ background: `${roleBadgeColor}18`, color: roleBadgeColor, border: `1px solid ${roleBadgeColor}40` }}>
                {userIsAgency ? <Activity size={12} /> : <UserCheck size={12} />}
                {roleLabel}
              </span>
            </div>
            <div className="topbar-user">
              <div className="topbar-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
              <span>{user?.name || 'Usuario'}</span>
            </div>
          </header>

          <main className="content">
            {loading && (
              <div className="loading-wrap"><div className="spinner" /><p>Cargando...</p></div>
            )}

            {/* ═══ AGENCY-ONLY VIEWS ═══ */}
            {!loading && activeView === 'agency-dashboard' && userIsAgency && (
              <AgencyDashboardView stats={agencyStats || stats} leads={leads} />
            )}
            {!loading && activeView === 'funnel' && userIsAgency && (
              <FunnelView stats={agencyStats || stats} />
            )}
            {!loading && activeView === 'sources' && userIsAgency && (
              <SourcesView stats={agencyStats || stats} leads={leads} />
            )}
            {!loading && activeView === 'campaigns' && userIsAgency && (
              <CampaignsView />
            )}

            {/* ═══ SHARED VIEWS (both roles) ═══ */}
            {!loading && activeView === 'dashboard' && <DashboardView stats={stats} leads={leads} events={todayEvents} />}
            {!loading && activeView === 'leads' && (
              <LeadsView leads={filteredLeads} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                leadFilter={leadFilter} setLeadFilter={setLeadFilter} selectedLead={selectedLead}
                setSelectedLead={setSelectedLead} showLeadModal={showLeadModal} setShowLeadModal={setShowLeadModal}
                onStatusChange={handleLeadStatusChange} />
            )}
            {!loading && activeView === 'calendar' && (
              <CalendarView events={events} showEventModal={showEventModal} setShowEventModal={setShowEventModal} onAddEvent={handleAddEvent} />
            )}
            {!loading && activeView === 'chat' && (
              <ChatView messages={messages} onSendMessage={handleSendMessage} messageInputRef={messageInputRef} />
            )}
            {!loading && activeView === 'whatsapp' && <WhatsAppView />}
            {!loading && activeView === 'team' && canManageTeam && <TeamView userRole={user?.role} />}
            {!loading && activeView === 'hubspot' && userIsAgency && <HubSpotView hubspotPortal={hubspotPortal} setHubspotPortal={setHubspotPortal} />}
            {!loading && activeView === 'workflow' && userIsAgency && <WorkflowAIView metaToken={metaToken} setMetaToken={setMetaToken} />}
          </main>
        </div>
      </div>
    </>
  );
}


/* ═══════════════════════════════════════════════════════
   AGENCY DASHBOARD — Marketing Analytics (Arturo only)
   ═══════════════════════════════════════════════════════ */
function AgencyDashboardView({ stats, leads }) {
  const s = stats || {};
  const total = s.totalLeads || 0;
  const convRate = s.conversionRate || ((s.converted || 0) / Math.max(total, 1) * 100).toFixed(1);

  const kpis = [
    { label: 'Leads Totales', value: total, icon: Users, color: C.primary, bg: C.blueBg, cls: 'blue' },
    { label: 'Tasa de Conversión', value: `${convRate}%`, icon: Percent, color: C.green, bg: C.greenBg, cls: 'green' },
    { label: 'Nuevos (sin contactar)', value: s.newLeads || 0, icon: AlertCircle, color: C.amber, bg: C.amberBg, cls: 'amber' },
    { label: 'En Proceso', value: s.enProceso || s.inProgress || 0, icon: Clock, color: '#EA580C', bg: '#FFF7ED', cls: 'amber' },
    { label: 'Convertidos', value: s.converted || 0, icon: TrendingUp, color: C.green, bg: C.greenBg, cls: 'green' },
    { label: 'Contactados', value: s.contactados || 0, icon: Phone, color: C.accent, bg: C.blueBg, cls: 'cyan' },
  ];

  // Source performance data
  const sourceData = s.sourcePerformance || s.leadsBySource || [];

  // Determine best & worst source
  const sortedSources = [...sourceData].sort((a, b) => (b.total || b.count || 0) - (a.total || a.count || 0));
  const bestSource = sortedSources[0];
  const worstSource = sortedSources[sortedSources.length - 1];

  return (
    <div className="view">
      <h1 className="view-title">Marketing Analytics</h1>
      <p className="view-subtitle">Métricas de rendimiento de marketing y adquisición de leads — Vista de Agencia</p>

      <div className="kpi-grid">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div className={`kpi-card ${k.cls}`} key={k.label}>
              <div className="kpi-top">
                <div>
                  <p className="kpi-val">{k.value}</p>
                  <p className="kpi-label">{k.label}</p>
                </div>
                <div className="kpi-icon" style={{ background: k.bg, color: k.color }}><Icon size={20} /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="two-col">
        {/* Funnel Summary */}
        <div className="section">
          <h2 className="section-title">Embudo de Conversión</h2>
          <p className="section-subtitle">Progresión de leads por etapa</p>
          <FunnelMini stats={s} />
        </div>

        {/* Top Sources */}
        <div className="section">
          <h2 className="section-title">Rendimiento por Fuente</h2>
          <p className="section-subtitle">¿De dónde vienen tus leads?</p>
          <SourceBars data={sourceData} total={total} />
        </div>
      </div>

      <div className="two-col">
        {/* Insights */}
        <div className="section">
          <h2 className="section-title">Insights</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bestSource && (
              <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
                <TrendingUp size={16} />
                <p><strong>Mejor fuente:</strong> {bestSource.source || bestSource.name} con {bestSource.total || bestSource.count} leads ({bestSource.percentage || ((bestSource.total || bestSource.count) / Math.max(total, 1) * 100).toFixed(0)}% del total)</p>
              </div>
            )}
            {worstSource && sortedSources.length > 1 && (
              <div className="info-box" style={{ background: C.amberBg, borderColor: `${C.amber}40`, color: C.amber }}>
                <AlertCircle size={16} />
                <p><strong>Oportunidad:</strong> {worstSource.source || worstSource.name} solo genera {worstSource.total || worstSource.count} leads. Considerar optimizar o reasignar presupuesto.</p>
              </div>
            )}
            <div className="info-box">
              <Activity size={16} />
              <p><strong>Tasa de contacto:</strong> {s.contactRate || 0}% de leads fueron contactados. {parseFloat(s.contactRate || 0) < 50 ? 'Se recomienda mejorar el tiempo de respuesta.' : 'Buen desempeño en contacto inicial.'}</p>
            </div>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="section">
          <h2 className="section-title">Últimos Leads</h2>
          <div className="tbl-wrap">
            {leads.length === 0 ? <p className="empty">No hay leads</p> : (
              <table>
                <thead><tr><th>Nombre</th><th>Fuente</th><th>Estado</th></tr></thead>
                <tbody>
                  {leads.slice(0, 8).map(lead => {
                    const sc = STATUS_COLORS[lead.status] || { bg: C.bg, text: C.textMuted };
                    return (
                      <tr key={lead.id}>
                        <td>{lead.name}</td>
                        <td>{lead.source || 'Directo'}</td>
                        <td><span className="badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{lead.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mini Funnel Chart ── */
function FunnelMini({ stats }) {
  const s = stats || {};
  const funnel = s.funnel || [
    { stage: 'Nuevos', count: s.newLeads || 0, color: C.amber },
    { stage: 'Contactados', count: s.contactados || 0, color: C.blue },
    { stage: 'En Proceso', count: s.enProceso || s.inProgress || 0, color: '#EA580C' },
    { stage: 'Convertidos', count: s.converted || 0, color: C.green },
  ];
  const maxCount = Math.max(...funnel.map(f => f.count), 1);

  return (
    <div className="funnel-wrap">
      {funnel.map((stage, idx) => {
        const widthPct = 100 - (idx * 15);
        return (
          <div key={stage.stage}>
            <div
              className="funnel-stage"
              style={{
                background: `linear-gradient(135deg, ${stage.color}, ${stage.color}CC)`,
                width: `${widthPct}%`,
              }}
            >
              <div className="funnel-count">{stage.count}</div>
              <div className="funnel-info">
                <div className="funnel-name">{stage.stage}</div>
                <div className="funnel-pct">{((stage.count / Math.max(maxCount, 1)) * 100).toFixed(0)}% del total</div>
              </div>
            </div>
            {idx < funnel.length - 1 && (
              <div className="funnel-arrow" style={{ width: `${widthPct - 7}%`, margin: '0 auto' }}>
                <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Source Bars ── */
function SourceBars({ data, total }) {
  const colors = [C.primary, C.accent, '#059669', '#D97706', '#DC2626', '#8B5CF6', '#EC4899'];

  const items = (data || []).map((item, idx) => ({
    name: item.source || item.name || 'Directo',
    count: item.total || item.count || 0,
    pct: item.percentage || ((item.total || item.count || 0) / Math.max(total, 1) * 100).toFixed(1),
    color: colors[idx % colors.length],
  }));

  const maxCount = Math.max(...items.map(i => i.count), 1);

  return (
    <div>
      {items.map(item => (
        <div className="source-bar" key={item.name}>
          <div className="source-name">{item.name}</div>
          <div className="source-track">
            <div className="source-fill" style={{ width: `${(item.count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}BB)` }}>
              {item.count > 0 && <span className="source-count">{item.count}</span>}
            </div>
          </div>
          <div className="source-pct">{item.pct}%</div>
        </div>
      ))}
      {items.length === 0 && <p className="empty">No hay datos de fuentes</p>}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   FUNNEL VIEW — Detailed Conversion Funnel (Agency)
   ═══════════════════════════════════════════════════════ */
function FunnelView({ stats }) {
  const s = stats || {};
  const total = s.totalLeads || 1;
  const stages = [
    { name: 'Nuevo', count: s.newLeads || 0, desc: 'Leads que acaban de entrar al sistema', color: C.amber, icon: AlertCircle },
    { name: 'Contactado', count: s.contactados || 0, desc: 'Primer contacto realizado por el asesor', color: C.blue, icon: Phone },
    { name: 'En Proceso', count: s.enProceso || s.inProgress || 0, desc: 'Negociación activa, posible cierre', color: '#EA580C', icon: Clock },
    { name: 'Convertido', count: s.converted || 0, desc: 'Lead convertido a cliente PPR', color: C.green, icon: UserCheck },
  ];

  return (
    <div className="view">
      <h1 className="view-title">Embudo de Conversión</h1>
      <p className="view-subtitle">Análisis detallado del recorrido del lead hasta la conversión</p>

      {/* KPI summary */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Users size={22} /></div>
          <div><p className="stat-label">Total en Embudo</p><p className="stat-value">{total}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Percent size={22} /></div>
          <div><p className="stat-label">Tasa de Conversión</p><p className="stat-value">{s.conversionRate || ((s.converted || 0) / total * 100).toFixed(1)}%</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Target size={22} /></div>
          <div><p className="stat-label">Tasa de Contacto</p><p className="stat-value">{s.contactRate || 0}%</p></div>
        </div>
      </div>

      {/* Detailed funnel */}
      <div className="section">
        <h2 className="section-title">Etapas del Embudo</h2>
        <div className="funnel-wrap">
          {stages.map((stage, idx) => {
            const widthPct = 100 - (idx * 18);
            const dropOff = idx > 0 ? stages[idx - 1].count - stage.count : 0;
            const dropPct = idx > 0 && stages[idx - 1].count > 0 ? ((dropOff / stages[idx - 1].count) * 100).toFixed(0) : 0;
            const Icon = stage.icon;
            return (
              <div key={stage.name}>
                {idx > 0 && (
                  <div style={{ textAlign: 'center', padding: '6px 0', width: `${widthPct + 9}%`, margin: '0 auto' }}>
                    <ArrowRight size={16} style={{ transform: 'rotate(90deg)', color: C.textLight }} />
                    {dropOff > 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 600, marginLeft: 6 }}>-{dropOff} ({dropPct}% caída)</span>}
                  </div>
                )}
                <div
                  className="funnel-stage"
                  style={{
                    background: `linear-gradient(135deg, ${stage.color}, ${stage.color}CC)`,
                    width: `${widthPct}%`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={20} color="#fff" />
                    <div className="funnel-count">{stage.count}</div>
                  </div>
                  <div className="funnel-info">
                    <div className="funnel-name">{stage.name}</div>
                    <div className="funnel-pct">{stage.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="section">
        <h2 className="section-title">Recomendaciones de Optimización</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(s.newLeads || 0) > (s.contactados || 0) * 2 && (
            <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red }}>
              <AlertCircle size={16} />
              <p><strong>Alerta:</strong> Hay {s.newLeads || 0} leads sin contactar vs {s.contactados || 0} contactados. Se necesita mayor velocidad en el primer contacto.</p>
            </div>
          )}
          <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
            <TrendingUp size={16} />
            <p><strong>Objetivo:</strong> Para mejorar la conversión, enfócate en reducir el tiempo entre "Nuevo" y "Contactado". Los leads se enfrían después de 48 horas.</p>
          </div>
          <div className="info-box">
            <Activity size={16} />
            <p><strong>Benchmark:</strong> La tasa de conversión promedio en servicios financieros es 5-8%. {parseFloat(s.conversionRate || 0) >= 5 ? '¡Vas por buen camino!' : 'Hay espacio para mejorar.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   SOURCES VIEW — Lead Source Performance (Agency)
   ═══════════════════════════════════════════════════════ */
function SourcesView({ stats, leads }) {
  const s = stats || {};
  const total = s.totalLeads || leads.length || 1;
  const sourceData = s.sourcePerformance || s.leadsBySource || [];

  // Build detailed source analysis from leads
  const sourceMap = {};
  leads.forEach(lead => {
    const src = lead.source || 'directo';
    if (!sourceMap[src]) sourceMap[src] = { total: 0, nuevo: 0, contactado: 0, en_proceso: 0, convertido: 0 };
    sourceMap[src].total++;
    const st = (lead.status || 'nuevo').toLowerCase();
    if (sourceMap[src][st] !== undefined) sourceMap[src][st]++;
  });

  const detailedSources = Object.entries(sourceMap).map(([name, data]) => ({
    name,
    ...data,
    convRate: data.total > 0 ? ((data.convertido / data.total) * 100).toFixed(1) : '0.0',
  })).sort((a, b) => b.total - a.total);

  const colors = [C.primary, C.accent, '#059669', '#D97706', '#DC2626', '#8B5CF6'];

  return (
    <div className="view">
      <h1 className="view-title">Fuentes de Leads</h1>
      <p className="view-subtitle">Análisis de rendimiento por canal de adquisición</p>

      {/* Source performance bars */}
      <div className="section">
        <h2 className="section-title">Distribución por Fuente</h2>
        <SourceBars data={sourceData.length ? sourceData : detailedSources.map(s => ({ source: s.name, total: s.total, percentage: (s.total / total * 100).toFixed(1) }))} total={total} />
      </div>

      {/* Detailed table */}
      <div className="section">
        <h2 className="section-title">Rendimiento Detallado por Fuente</h2>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Total</th>
                <th>Nuevos</th>
                <th>Contactados</th>
                <th>En Proceso</th>
                <th>Convertidos</th>
                <th>Tasa Conv.</th>
              </tr>
            </thead>
            <tbody>
              {detailedSources.map((src, idx) => (
                <tr key={src.name}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[idx % colors.length], display: 'inline-block' }} />
                      <strong>{src.name}</strong>
                    </span>
                  </td>
                  <td><strong>{src.total}</strong></td>
                  <td>{src.nuevo}</td>
                  <td>{src.contactado}</td>
                  <td>{src.en_proceso}</td>
                  <td><span style={{ color: C.green, fontWeight: 700 }}>{src.convertido}</span></td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: parseFloat(src.convRate) >= 10 ? C.greenBg : parseFloat(src.convRate) >= 5 ? C.amberBg : C.redBg,
                      color: parseFloat(src.convRate) >= 10 ? C.green : parseFloat(src.convRate) >= 5 ? C.amber : C.red,
                    }}>
                      {src.convRate}%
                    </span>
                  </td>
                </tr>
              ))}
              {detailedSources.length === 0 && <tr><td colSpan={7} className="empty">No hay datos de fuentes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="section">
        <h2 className="section-title">Insights de Canales</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="info-box">
            <Globe size={16} />
            <p>Tienes <strong>{detailedSources.length}</strong> fuentes activas de leads. Diversificar canales reduce el riesgo de depender de una sola fuente.</p>
          </div>
          {detailedSources.some(s => parseFloat(s.convRate) > 15) && (
            <div className="info-box" style={{ background: C.greenBg, borderColor: `${C.green}40`, color: C.green }}>
              <TrendingUp size={16} />
              <p><strong>Alta conversión:</strong> {detailedSources.filter(s => parseFloat(s.convRate) > 15).map(s => s.name).join(', ')} tienen tasas de conversión superiores al 15%. Considera invertir más en estos canales.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   CAMPAIGNS VIEW — Campaign Tracking (Agency)
   ═══════════════════════════════════════════════════════ */
function CampaignsView() {
  const campaigns = [
    { name: 'PPR Retiro Seguro - Facebook', status: 'Activa', budget: '$15,000', spent: '$8,200', leads: 23, cpl: '$356', conv: 3, platform: 'Facebook Ads' },
    { name: 'Educación Financiera - Instagram', status: 'Activa', budget: '$10,000', spent: '$5,800', leads: 18, cpl: '$322', conv: 2, platform: 'Instagram Ads' },
    { name: 'PPR Landing - Google Search', status: 'Activa', budget: '$20,000', spent: '$12,400', leads: 31, cpl: '$400', conv: 5, platform: 'Google Ads' },
    { name: 'Retargeting - Visitantes Web', status: 'Pausada', budget: '$5,000', spent: '$3,100', leads: 8, cpl: '$387', conv: 1, platform: 'Meta Retargeting' },
    { name: 'Webinar PPR - Email', status: 'Completada', budget: '$2,000', spent: '$2,000', leads: 45, cpl: '$44', conv: 7, platform: 'Email Marketing' },
  ];

  const totalSpent = campaigns.reduce((sum, c) => sum + parseFloat(c.spent.replace(/[$,]/g, '')), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conv, 0);

  return (
    <div className="view">
      <h1 className="view-title">Campañas</h1>
      <p className="view-subtitle">Seguimiento de campañas de marketing y rendimiento publicitario</p>

      {/* Campaign KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Megaphone size={22} /></div>
          <div><p className="stat-label">Campañas Activas</p><p className="stat-value">{campaigns.filter(c => c.status === 'Activa').length}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><BarChart2 size={22} /></div>
          <div><p className="stat-label">Gasto Total</p><p className="stat-value">${totalSpent.toLocaleString()}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Users size={22} /></div>
          <div><p className="stat-label">Leads Generados</p><p className="stat-value">{totalLeads}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F3E8FF', color: '#8B5CF6' }}><Target size={22} /></div>
          <div><p className="stat-label">CPL Promedio</p><p className="stat-value">${totalLeads > 0 ? (totalSpent / totalLeads).toFixed(0) : 0}</p></div>
        </div>
      </div>

      {/* Campaign Table */}
      <div className="section">
        <h2 className="section-title">Detalle de Campañas</h2>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Plataforma</th>
                <th>Estado</th>
                <th>Presupuesto</th>
                <th>Gastado</th>
                <th>Leads</th>
                <th>CPL</th>
                <th>Conversiones</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const statusColor = c.status === 'Activa' ? { bg: C.greenBg, text: C.green } :
                  c.status === 'Pausada' ? { bg: C.amberBg, text: C.amber } :
                  { bg: C.bg, text: C.textMuted };
                return (
                  <tr key={c.name}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.platform}</td>
                    <td><span className="badge" style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>{c.status}</span></td>
                    <td>{c.budget}</td>
                    <td>{c.spent}</td>
                    <td><strong>{c.leads}</strong></td>
                    <td>{c.cpl}</td>
                    <td><span style={{ color: C.green, fontWeight: 700 }}>{c.conv}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="info-box">
        <AlertCircle size={16} />
        <p>Las métricas de campañas se actualizarán automáticamente al conectar Meta Business API y Google Ads. Configúralo desde la sección Workflow AI.</p>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   ADVISOR DASHBOARD — Operational CRM (shared/basic)
   ═══════════════════════════════════════════════════════ */
function DashboardView({ stats, leads, events }) {
  const statCards = [
    { label: SPANISH_LABELS.totalLeads, value: stats.totalLeads || 0, icon: Users, color: C.primary, bg: C.blueBg },
    { label: SPANISH_LABELS.newLeads, value: stats.newLeads || 0, icon: AlertCircle, color: C.amber, bg: C.amberBg },
    { label: SPANISH_LABELS.inProgress, value: stats.inProgress || 0, icon: Clock, color: '#EA580C', bg: '#FFF7ED' },
    { label: SPANISH_LABELS.converted, value: stats.converted || 0, icon: TrendingUp, color: C.green, bg: C.greenBg },
  ];

  return (
    <div className="view">
      <h1 className="view-title">Panel de Control</h1>
      <p className="view-subtitle">Resumen operativo de leads y actividad</p>

      <div className="stats-grid">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}><Icon size={22} /></div>
              <div>
                <p className="stat-label">{s.label}</p>
                <p className="stat-value">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="two-col">
        <div className="section">
          <h2 className="section-title">Leads por Fuente</h2>
          <SimpleBarChart />
        </div>

        <div className="section">
          <h2 className="section-title">{SPANISH_LABELS.todayEvents}</h2>
          <div className="events-list">
            {events.length === 0 ? <p className="empty">{SPANISH_LABELS.noEvents}</p> : (
              events.map(event => (
                <div key={event.id} className="event-card">
                  <div>
                    <h3>{event.title}</h3>
                    <span className="ev-time"><Clock size={13} /> {event.time || 'Sin hora'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">{SPANISH_LABELS.recentLeads}</h2>
        <div className="tbl-wrap">
          {leads.length === 0 ? <p className="empty">{SPANISH_LABELS.noLeads}</p> : (
            <table>
              <thead><tr><th>{SPANISH_LABELS.name}</th><th>{SPANISH_LABELS.phone}</th><th>{SPANISH_LABELS.service}</th><th>{SPANISH_LABELS.status}</th></tr></thead>
              <tbody>
                {leads.slice(0, 5).map(lead => {
                  const sc = STATUS_COLORS[lead.status] || { bg: C.bg, text: C.textMuted };
                  return (
                    <tr key={lead.id}>
                      <td>{lead.name}</td><td>{lead.phone}</td><td>{lead.service || 'PPR'}</td>
                      <td><span className="badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{lead.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SimpleBarChart() {
  const data = [
    { source: 'Facebook', count: 15 },
    { source: 'Instagram', count: 12 },
    { source: 'WhatsApp', count: 8 },
    { source: 'Referencia', count: 10 },
    { source: 'Web', count: 6 },
  ];
  const maxCount = Math.max(...data.map(d => d.count));
  return (
    <div className="chart-bars">
      {data.map(item => (
        <div key={item.source} className="chart-row">
          <div className="chart-label">{item.source}</div>
          <div className="chart-track">
            <div className="chart-fill" style={{ width: `${(item.count / maxCount) * 100}%`, background: `linear-gradient(90deg,${C.primary},${C.accent})` }}>
              <span className="chart-val">{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


/* ═══════ LEADS ═══════ */
function LeadsView({ leads, searchTerm, setSearchTerm, leadFilter, setLeadFilter, selectedLead, setSelectedLead, showLeadModal, setShowLeadModal, onStatusChange }) {
  return (
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.leads}</h1>
      <div className="leads-head">
        <div className="search-box">
          <Search size={18} color={C.textMuted} />
          <input type="text" placeholder={SPANISH_LABELS.search} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {['Todos', 'nuevo', 'contactado', 'en_proceso', 'convertido'].map(status => (
            <button key={status} className={`f-tab${leadFilter === status ? ' active' : ''}`} onClick={() => setLeadFilter(status)}>
              {status === 'Todos' ? 'Todos' : status === 'nuevo' ? 'Nuevo' : status === 'contactado' ? 'Contactado' : status === 'en_proceso' ? 'En Proceso' : 'Convertido'}
            </button>
          ))}
        </div>
      </div>

      <div className="tbl-wrap">
        {leads.length === 0 ? <p className="empty">{SPANISH_LABELS.noLeads}</p> : (
          <table>
            <thead><tr><th>{SPANISH_LABELS.name}</th><th>{SPANISH_LABELS.phone}</th><th>{SPANISH_LABELS.service}</th><th>{SPANISH_LABELS.source}</th><th>{SPANISH_LABELS.status}</th><th>{SPANISH_LABELS.date}</th><th>{SPANISH_LABELS.actions}</th></tr></thead>
            <tbody>
              {leads.map(lead => {
                const sc = STATUS_COLORS[lead.status] || { bg: C.bg, text: C.textMuted };
                return (
                  <tr key={lead.id}>
                    <td>{lead.name}</td><td>{lead.phone}</td><td>{lead.service || 'PPR'}</td><td>{lead.source || 'Web'}</td>
                    <td><span className="badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{lead.status}</span></td>
                    <td>{new Date(lead.created_at || lead.createdAt || Date.now()).toLocaleDateString('es-MX')}</td>
                    <td><button className="action-btn" onClick={() => { setSelectedLead(lead); setShowLeadModal(true); }} title="Ver detalles"><Eye size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showLeadModal && selectedLead && (
        <LeadModal lead={selectedLead} onClose={() => { setShowLeadModal(false); setSelectedLead(null); }} onStatusChange={onStatusChange} />
      )}
    </div>
  );
}

function LeadModal({ lead, onClose, onStatusChange }) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [newStatus, setNewStatus] = useState(lead.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{lead.name}</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          <div className="field"><label>{SPANISH_LABELS.phone}</label><p>{lead.phone}</p></div>
          <div className="field"><label>{SPANISH_LABELS.service}</label><p>{lead.service || 'PPR'}</p></div>
          <div className="field"><label>{SPANISH_LABELS.source}</label><p>{lead.source || 'Web'}</p></div>
          <div className="field">
            <label>{SPANISH_LABELS.status}</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="nuevo">Nuevo</option><option value="contactado">Contactado</option><option value="en_proceso">En Proceso</option><option value="convertido">Convertido</option>
            </select>
          </div>
          <div className="field">
            <label>{SPANISH_LABELS.notes}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={() => { onStatusChange(lead, newStatus); onClose(); }}>{SPANISH_LABELS.save}</button>
          <button className="btn-secondary" onClick={onClose}>{SPANISH_LABELS.cancel}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════ CALENDAR ═══════ */
function CalendarView({ events, showEventModal, setShowEventModal, onAddEvent }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = day => {
    if (!day) return [];
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(e => new Date(e.start_date || e.date).toDateString() === date.toDateString());
  };

  return (
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

      {showEventModal && <EventModal onClose={() => setShowEventModal(false)} onSubmit={onAddEvent} />}
    </div>
  );
}

function EventModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({ title: '', date: new Date().toISOString().split('T')[0], time: '14:00', description: '' });

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

/* ═══════ CHAT ═══════ */
function ChatView({ messages, onSendMessage, messageInputRef }) {
  const [messageText, setMessageText] = useState('');
  const handleSend = () => { if (messageText.trim()) { onSendMessage(messageText); setMessageText(''); } };

  return (
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.chat}</h1>
      <div className="chat-wrap">
        <div className="msg-list">
          {messages.length === 0 ? <p className="empty">{SPANISH_LABELS.noMessages}</p> : (
            messages.map(msg => (
              <div key={msg.id} className="msg-bubble">
                <div className="msg-head">
                  <strong>{msg.sender_name || msg.sender || 'Usuario'}</strong>
                  <span className="msg-time">{new Date(msg.created_at || msg.createdAt || Date.now()).toLocaleTimeString('es-MX')}</span>
                </div>
                <p>{msg.content}</p>
              </div>
            ))
          )}
        </div>
        <div className="chat-input-bar">
          <input ref={messageInputRef} type="text" placeholder={SPANISH_LABELS.writeMessage} value={messageText}
            onChange={e => setMessageText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} />
          <button className="send-btn" onClick={handleSend}><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
}

/* ═══════ TEAM MANAGEMENT ═══════ */
function TeamView({ userRole }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isAgency = isAgencyRole(userRole);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async (formData) => {
    try {
      await api.register(formData);
      setFeedback({ type: 'success', msg: `Usuario "${formData.name}" creado exitosamente` });
      setShowAddModal(false);
      loadUsers();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al crear usuario' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const ROLE_LABELS = {
    superadmin: 'Agencia (Super)',
    agencia: 'Agencia',
    admin: 'Admin FS',
    asesor: 'Asesor',
  };
  const ROLE_COLORS = {
    superadmin: { bg: '#F3E8FF', text: '#8B5CF6' },
    agencia: { bg: C.blueBg, text: C.accent },
    admin: { bg: C.amberBg, text: C.amber },
    asesor: { bg: C.greenBg, text: C.green },
  };

  return (
    <div className="view">
      <h1 className="view-title">Gestión del Equipo</h1>
      <p className="view-subtitle">
        {isAgency
          ? 'Administra todos los usuarios del sistema — asesores, admins y agencia'
          : 'Administra los asesores de Finance SCool'}
      </p>

      {feedback && (
        <div className="info-box" style={{
          marginBottom: 16,
          background: feedback.type === 'success' ? C.greenBg : C.redBg,
          borderColor: feedback.type === 'success' ? `${C.green}40` : `${C.red}40`,
          color: feedback.type === 'success' ? C.green : C.red,
        }}>
          {feedback.type === 'success' ? <UserCheck size={16} /> : <AlertCircle size={16} />}
          <p>{feedback.msg}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="stats-grid" style={{ flex: 1, marginBottom: 0, marginRight: 16 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Users size={22} /></div>
            <div><p className="stat-label">Total Usuarios</p><p className="stat-value">{users.length}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><UserCheck size={22} /></div>
            <div><p className="stat-label">Asesores</p><p className="stat-value">{users.filter(u => u.role === 'asesor').length}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Settings size={22} /></div>
            <div><p className="stat-label">Admins</p><p className="stat-value">{users.filter(u => u.role === 'admin').length}</p></div>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ whiteSpace: 'nowrap', height: 'fit-content' }}>
          <Plus size={16} /> Agregar Usuario
        </button>
      </div>

      <div className="section">
        <h2 className="section-title">Usuarios del Sistema</h2>
        <div className="tbl-wrap">
          {loadingUsers ? (
            <div className="loading-wrap" style={{ minHeight: 120 }}><div className="spinner" /></div>
          ) : (
            <table>
              <thead>
                <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Creado</th></tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rc = ROLE_COLORS[u.role] || { bg: C.bg, text: C.textMuted };
                  return (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className="badge" style={{ backgroundColor: rc.bg, color: rc.text }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                      <td>{new Date(u.created_at || Date.now()).toLocaleDateString('es-MX')}</td>
                    </tr>
                  );
                })}
                {users.length === 0 && <tr><td colSpan={4} className="empty">No hay usuarios registrados</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onSubmit={handleAddUser} isAgency={isAgency} />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSubmit, isAgency }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'asesor' });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.password) {
      setError('Todos los campos son obligatorios');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Agregar Usuario</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red, marginBottom: 16 }}>
              <AlertCircle size={16} /><p>{error}</p>
            </div>
          )}
          <div className="field">
            <label>Nombre completo</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Juan Pérez" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="juan@financescool.com" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="asesor">Asesor (ventas / atención)</option>
              {isAgency && <option value="admin">Admin Finance SCool (gestiona asesores)</option>}
              {isAgency && <option value="agencia">Agencia (marketing / analytics)</option>}
            </select>
            <small className="help-text">
              {form.role === 'asesor' && 'Puede ver leads, calendario, chat y WhatsApp'}
              {form.role === 'admin' && 'Puede ver todo lo operativo + gestionar el equipo de asesores'}
              {form.role === 'agencia' && 'Acceso completo: marketing analytics + operativo + gestión'}
            </small>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={handleSubmit}><Plus size={16} /> Crear Usuario</button>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════ WHATSAPP ═══════ */
function WhatsAppView() {
  return (
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.whatsappTitle}</h1>
      <div className="section">
        <h2 className="section-title">{SPANISH_LABELS.whatsappTemplates}</h2>
        <div className="tpl-grid">
          <div className="tpl-card">
            <h3>Mensaje de Seguimiento PPR</h3>
            <p>"Hola! Espero que estés bien. Te quería compartir información sobre nuestro Plan Personal de Retiro. ¿Tienes 5 minutos para conversar?"</p>
            <a className="tpl-link" href="https://wa.me/?text=Hola!%20Espero%20que%20est%C3%A9s%20bien.%20Te%20quer%C3%ADa%20compartir%20informaci%C3%B3n%20sobre%20nuestro%20Plan%20Personal%20de%20Retiro.%20%C2%BFTienes%205%20minutos%20para%20conversar?" target="_blank" rel="noopener noreferrer">Enviar Plantilla &rarr;</a>
          </div>
          <div className="tpl-card">
            <h3>Presentación de Servicio</h3>
            <p>"Contamos con un equipo especializado en planificación financiera. Nos gustaría conocer tus objetivos de retiro y ayudarte a planificar tu futuro."</p>
            <a className="tpl-link" href="https://wa.me/?text=Contamos%20con%20un%20equipo%20especializado%20en%20planificaci%C3%B3n%20financiera.%20Nos%20gustar%C3%ADa%20conocer%20tus%20objetivos%20de%20retiro%20y%20ayudarte%20a%20planificar%20tu%20futuro." target="_blank" rel="noopener noreferrer">Enviar Plantilla &rarr;</a>
          </div>
          <div className="tpl-card">
            <h3>Recordatorio de Cita</h3>
            <p>"Te recordamos sobre nuestra cita agendada. ¿Sigues disponible? Si necesitas cambiar la fecha, avísanos con tiempo."</p>
            <a className="tpl-link" href="https://wa.me/?text=Te%20recordamos%20sobre%20nuestra%20cita%20agendada.%20%C2%BFSigues%20disponible?%20Si%20necesitas%20cambiar%20la%20fecha,%20av%C3%ADsanos%20con%20tiempo." target="_blank" rel="noopener noreferrer">Enviar Plantilla &rarr;</a>
          </div>
          <div className="tpl-card">
            <h3>Agradecimiento Post-Venta</h3>
            <p>"¡Gracias por confiar en nosotros! Estamos aquí si tienes preguntas sobre tu plan. No dudes en contactarnos."</p>
            <a className="tpl-link" href="https://wa.me/?text=%C2%A1Gracias%20por%20confiar%20en%20nosotros!%20Estamos%20aqu%C3%AD%20si%20tienes%20preguntas%20sobre%20tu%20plan.%20No%20dudes%20en%20contactarnos." target="_blank" rel="noopener noreferrer">Enviar Plantilla &rarr;</a>
          </div>
        </div>
      </div>
      <div className="info-box">
        <AlertCircle size={16} />
        <p>Usa estas plantillas como base para tus mensajes personalizados. Recuerda siempre adaptar el tono según la relación con el cliente.</p>
      </div>
    </div>
  );
}

/* ═══════ HUBSPOT (Agency only) ═══════ */
function HubSpotView({ hubspotPortal, setHubspotPortal }) {
  const [portalInput, setPortalInput] = useState(hubspotPortal);
  return (
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.hubspot}</h1>
      <div className="section">
        <h2 className="section-title">{SPANISH_LABELS.hubspotConfig}</h2>
        <div className="config-panel">
          <div className="field">
            <label>{SPANISH_LABELS.hubspotPortal}</label>
            <input type="text" value={portalInput} onChange={e => setPortalInput(e.target.value)} placeholder="XXXXXXXX" />
            <small className="help-text">Tu ID de portal está disponible en Configuración de HubSpot</small>
          </div>
          <button className="btn-primary" onClick={() => setHubspotPortal(portalInput)}>{SPANISH_LABELS.configure}</button>
        </div>
      </div>
      {hubspotPortal && (
        <div className="section">
          <h2 className="section-title">Widget de HubSpot</h2>
          <div className="hs-placeholder"><p>Cargando widget de HubSpot...</p><small>Portal ID: {hubspotPortal}</small></div>
        </div>
      )}
      {!hubspotPortal && (
        <div className="info-box">
          <AlertCircle size={16} />
          <p>Configura tu ID de portal de HubSpot para integrar reuniones, tickets y otras herramientas de CRM.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════ WORKFLOW AI (Agency only) ═══════ */
function WorkflowAIView({ metaToken, setMetaToken }) {
  const [tokenInput, setTokenInput] = useState(metaToken);

  return (
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.metaWorkflow}</h1>

      <div className="section">
        <h2 className="section-title">Configuración de Meta Business API</h2>
        <div className="config-panel">
          <div className="field">
            <label>Token de Meta Business API</label>
            <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Ingresa tu token de API..." />
            <small className="help-text">Tu token se encuentra en Meta Business Suite → Configuración</small>
          </div>
          <button className="btn-primary" onClick={() => setMetaToken(tokenInput)}>Guardar Configuración</button>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Flujo de Automatización</h2>
        <div className="wf-diagram">
          <div className="wf-stage">
            <div className="wf-box" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})` }}>
              <MessageCircle size={20} /><p>Lead entra desde Meta</p><small>Facebook / Instagram Ads</small>
            </div>
          </div>
          <div className="wf-arrow">&rarr;</div>
          <div className="wf-stage">
            <div className="wf-box" style={{ background: `linear-gradient(135deg, ${C.accent}, #00B4D8)` }}>
              <Zap size={20} /><p>AI Agent Califica</p><small>Messenger / WhatsApp</small>
            </div>
          </div>
          <div className="wf-arrow">&rarr;</div>
          <div className="wf-stage">
            <div className="wf-box" style={{ background: `linear-gradient(135deg, ${C.amber}, #F59E0B)` }}>
              <AlertCircle size={20} /><p>Auto-clasificación</p><small>Hot / Warm / Cold</small>
            </div>
          </div>
        </div>

        <div className="wf-branches">
          <div>
            <div className="branch-box" style={{ borderLeftColor: C.red }}>
              <h4 style={{ color: C.red }}>Lead Caliente</h4>
              <ul><li>Notificación inmediata</li><li>Reserva de calendario automática</li><li>Asignación a agente</li><li>Llamada de seguimiento en 1 hora</li></ul>
            </div>
          </div>
          <div>
            <div className="branch-box" style={{ borderLeftColor: C.amber }}>
              <h4 style={{ color: C.amber }}>Lead Tibio</h4>
              <ul><li>Secuencia de educación</li><li>Contenido sobre PPR</li><li>Follow-up cada 3 días</li><li>Oferta especial a 7 días</li></ul>
            </div>
          </div>
          <div>
            <div className="branch-box" style={{ borderLeftColor: C.blue }}>
              <h4 style={{ color: C.blue }}>Lead Frío</h4>
              <ul><li>Secuencia de retargeting</li><li>Anuncios personalizados</li><li>Contenido de valor</li><li>Re-engagement a 30 días</li></ul>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Plantillas de Conversación del AI Agent</h2>
        <div className="tpl-grid">
          <div className="tpl-card"><h3>Saludo Inicial</h3><p>"¡Hola! Soy tu asistente de Finance SCool. ¿Cuál es tu nombre?"</p></div>
          <div className="tpl-card"><h3>Calificación</h3><p>"¿Cuál es tu edad y cuál es tu objetivo principal para la jubilación?"</p></div>
          <div className="tpl-card"><h3>Propuesta de Valor</h3><p>"Nuestro Plan Personal de Retiro te ayuda a maximizar tu futuro financiero. ¿Te interesa conocer más?"</p></div>
          <div className="tpl-card"><h3>Cierre Conversación</h3><p>"Perfecto, un asesor se contactará contigo en las próximas 24 horas. ¿Es correcto tu número?"</p></div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Estadísticas del Pipeline</h2>
        <div className="pipeline-grid">
          <div className="pipeline-card">
            <div className="pipeline-badge" style={{ background: C.redBg, color: C.red }}>🔥</div>
            <div><p className="pipeline-title">Leads Calientes</p><p className="pipeline-num">12</p></div>
          </div>
          <div className="pipeline-card">
            <div className="pipeline-badge" style={{ background: C.amberBg, color: C.amber }}>🌡️</div>
            <div><p className="pipeline-title">Leads Tibios</p><p className="pipeline-num">28</p></div>
          </div>
          <div className="pipeline-card">
            <div className="pipeline-badge" style={{ background: C.blueBg, color: C.blue }}>❄️</div>
            <div><p className="pipeline-title">Leads Fríos</p><p className="pipeline-num">45</p></div>
          </div>
          <div className="pipeline-card">
            <div className="pipeline-badge" style={{ background: C.greenBg, color: C.green }}>✓</div>
            <div><p className="pipeline-title">Conversiones</p><p className="pipeline-num">8</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
