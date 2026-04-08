/* ══════════════════════════════════════════════════════
   Admin Constants — Finance SCool
   ══════════════════════════════════════════════════════ */

/* ── Prudential Blue Palette ── */
export const C = {
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

/* ── Role Helpers ── */
export const isAgencyRole  = (role) => ['superadmin', 'agencia'].includes(role);
export const isAdvisorRole = (role) => ['asesor', 'admin'].includes(role);

/* ── Spanish Labels ── */
export const SPANISH_LABELS = {
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
  visitas: 'Visitas',
  whatsappTitle: 'WhatsApp',
  whatsappTemplates: 'Plantillas de Mensaje',
  hubspotConfig: 'Configuración de HubSpot',
  hubspotPortal: 'ID del Portal HubSpot',
  configure: 'Configurar',
  metaWorkflow: 'Workflow Meta Business Agent',
  team: 'Equipo',
  incomeType: 'Tipo de Ingreso',
  approxIncome: 'Ingreso Aproximado',
  declaracion: '¿Declara Impuestos?',
  retiroPlan: 'Plan de Retiro',
  email: 'Correo',
  noLeads: 'No hay leads disponibles',
  noEvents: 'No hay eventos para hoy',
  noMessages: 'No hay mensajes en este canal',
};

export const STATUS_COLORS = {
  'nuevo':      { bg: C.amberBg, text: C.amber },
  'Nuevo':      { bg: C.amberBg, text: C.amber },
  'contactado': { bg: C.blueBg,  text: C.blue  },
  'Contactado': { bg: C.blueBg,  text: C.blue  },
  'en_proceso': { bg: '#FFF7ED', text: '#EA580C' },
  'En Proceso': { bg: '#FFF7ED', text: '#EA580C' },
  'convertido': { bg: C.greenBg, text: C.green  },
  'Convertido': { bg: C.greenBg, text: C.green  },
};

/* ── Estado Colors (WhatsApp) ── */
export const EC = {
  nuevo:      { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  contactado: { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
  en_proceso: { bg: '#FFF7ED', text: '#9A3412', dot: '#F97316' },
  convertido: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  descartado: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
};
