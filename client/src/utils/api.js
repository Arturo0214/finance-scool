const API = import.meta.env.VITE_API_URL || '/api';

// Token fallback for mobile browsers where cookies through proxies fail
function getToken() { return localStorage.getItem('fsc_token'); }
function setToken(t) { if (t) localStorage.setItem('fsc_token', t); }
function clearToken() { localStorage.removeItem('fsc_token'); }

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

export const api = {
  // Generic
  get: (path) => request(path),


  // Auth
  login: async (email, password) => {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.token) setToken(data.token);
    return data;
  },
  logout: async () => {
    clearToken();
    return request('/auth/logout', { method: 'POST' });
  },
  me: () => request('/auth/me').catch(err => { if (err.message === 'No autorizado' || err.message === 'Token inválido') clearToken(); throw err; }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  // Leads
  createLead: (data) => request('/leads', { method: 'POST', body: JSON.stringify(data) }),
  getLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/leads?${q}`);
  },
  getLead: (id) => request(`/leads/${id}`),
  updateLead: (id, data) => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request('/stats'),
  getAgencyStats: () => request('/agency-stats'),
  getFSCStats: () => request('/fsc/stats'),

  // Events
  getEvents: () => request('/events'),
  createEvent: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  // Google Calendar
  getGoogleAuthUrl: () => request(`/google/auth-url?origin=${encodeURIComponent(window.location.origin)}`),
  getGoogleConnectionStatus: () => request('/google/connection-status'),
  getGoogleEvents: (timeMin, timeMax) => {
    const params = new URLSearchParams();
    if (timeMin) params.set('timeMin', timeMin);
    if (timeMax) params.set('timeMax', timeMax);
    return request(`/google/events?${params}`);
  },
  createGoogleEvent: (data) => request('/google/events', { method: 'POST', body: JSON.stringify(data) }),
  updateGoogleEvent: (id, data) => request(`/google/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoogleEvent: (id) => request(`/google/events/${id}`, { method: 'DELETE' }),
  disconnectGoogle: () => request('/google/disconnect', { method: 'POST' }),
  getMeetParticipants: (meetCode) => request(`/google/meet-participants/${meetCode}`),

  // Messages
  getMessages: (channel = 'general') => request(`/messages?channel=${channel}`),
  sendMessage: (content, channel = 'general') => request('/messages', { method: 'POST', body: JSON.stringify({ content, channel }) }),

  // Users
  getUsers: () => request('/users'),

  // Visits / Analytics
  getVisitStats: () => request('/visits/stats'),

  // Appointments
  getAppointments: () => request('/appointments'),
  createAppointment: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // WhatsApp
  getWhatsAppLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/whatsapp/leads?${q}`);
  },
  getWhatsAppLead: (waId) => request(`/whatsapp/leads/${waId}`),
  getWhatsAppWindowStatus: (waId) => request(`/whatsapp/leads/${waId}/window-status`),
  sendWhatsAppMessage: (wa_id, message) => request('/whatsapp/send', { method: 'POST', body: JSON.stringify({ wa_id, message }) }),
  sendWhatsAppTemplate: (wa_id, template_name, language, components) => request('/whatsapp/send-template', { method: 'POST', body: JSON.stringify({ wa_id, template_name, language, ...(components ? { components } : {}) }) }),
  sendWhatsAppTemplateBulk: (wa_ids, template_name, language, components) => request('/whatsapp/send-template-bulk', { method: 'POST', body: JSON.stringify({ wa_ids, template_name, language, ...(components ? { components } : {}) }) }),
  updateWhatsAppEstado: (waId, estado) => request(`/whatsapp/leads/${waId}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  toggleWhatsAppModoHumano: (waId) => request(`/whatsapp/leads/${waId}/modo-humano`, { method: 'PATCH' }),
  claimWhatsAppLead: (waId) => request(`/whatsapp/leads/${waId}/claim`, { method: 'PATCH' }),
  toggleWhatsAppBlock: (waId) => request(`/whatsapp/leads/${waId}/block`, { method: 'PATCH' }),
  getWhatsAppStats: () => request('/whatsapp/stats'),

  // ── CRM Incubadora S-COOL ──
  getCrmActivity: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/crm/activity${q ? `?${q}` : ''}`);
  },
  resetUserPassword: (id, password) => request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  crmGetDashboard: (anio) => request(`/crm/dashboard${anio ? `?anio=${anio}` : ''}`),
  crmGetAgentSummary: (id, anio) => request(`/crm/agents/${id}/summary${anio ? `?anio=${anio}` : ''}`),
  crmGetAgents: () => request('/crm/agents'),
  crmCreateAgent: (data) => request('/crm/agents', { method: 'POST', body: JSON.stringify(data) }),
  crmUpdateAgent: (id, data) => request(`/crm/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  crmGetClients: (params = {}) => request(`/crm/clients?${new URLSearchParams(params)}`),
  crmGetClient: (id) => request(`/crm/clients/${id}`),
  crmCreateClient: (data) => request('/crm/clients', { method: 'POST', body: JSON.stringify(data) }),
  crmUpdateClient: (id, data) => request(`/crm/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  crmDeleteClient: (id) => request(`/crm/clients/${id}`, { method: 'DELETE' }),
  crmGetPolicies: (params = {}) => request(`/crm/policies?${new URLSearchParams(params)}`),
  crmCreatePolicy: (data) => request('/crm/policies', { method: 'POST', body: JSON.stringify(data) }),
  crmUpdatePolicy: (id, data) => request(`/crm/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  crmDeletePolicy: (id) => request(`/crm/policies/${id}`, { method: 'DELETE' }),
  crmGetGoals: (anio) => request(`/crm/goals${anio ? `?anio=${anio}` : ''}`),
  crmSaveGoals: (goals) => request('/crm/goals', { method: 'PUT', body: JSON.stringify({ goals }) }),
  crmGetReminders: (params = {}) => request(`/crm/reminders?${new URLSearchParams(params)}`),
  crmCreateReminder: (data) => request('/crm/reminders', { method: 'POST', body: JSON.stringify(data) }),
  crmUpdateReminder: (id, data) => request(`/crm/reminders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  crmDeleteReminder: (id) => request(`/crm/reminders/${id}`, { method: 'DELETE' }),
  crmGetFiles: (params = {}) => request(`/crm/files?${new URLSearchParams(params)}`),
  crmRunAutoReminders: () => request('/crm/auto-reminders', { method: 'POST', body: JSON.stringify({}) }),
  crmDownloadReport: async (agentId, anio) => {
    const token = getToken();
    const res = await fetch(`${API}/crm/report/${agentId}?anio=${anio || ''}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error al generar PDF'); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || `BusinessReview_${agentId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
  crmDeleteFile: (id) => request(`/crm/files/${id}`, { method: 'DELETE' }),
  // ── Notas/Tareas, Timeline, Portal, Copiloto, Conciliación, Cohortes ──
  crmGetNotes: (client_id) => request(`/crm/notes?client_id=${client_id}`),
  crmCreateNote: (data) => request('/crm/notes', { method: 'POST', body: JSON.stringify(data) }),
  crmUpdateNote: (id, data) => request(`/crm/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  crmDeleteNote: (id) => request(`/crm/notes/${id}`, { method: 'DELETE' }),
  crmGetTimeline: (clientId) => request(`/crm/clients/${clientId}/timeline`),
  crmPortalLink: (clientId) => request(`/crm/clients/${clientId}/portal-link`, { method: 'POST' }),
  crmCopilot: (clientId, pregunta) => request(`/crm/clients/${clientId}/copilot`, { method: 'POST', body: JSON.stringify({ pregunta }) }),
  crmGetCohorts: () => request('/crm/cohorts'),
  crmReconcilePreview: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/crm/commissions/reconcile-preview`, {
      method: 'POST', credentials: 'include',
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de servidor');
    return data;
  },
  crmReconcileConfirm: (items) => request('/crm/commissions/reconcile-confirm', { method: 'POST', body: JSON.stringify({ items }) }),
  crmPortalData: (t) => request(`/crm/portal?t=${encodeURIComponent(t)}`),

  crmUploadFile: async (file, { client_id, policy_id, categoria } = {}) => {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    if (client_id) fd.append('client_id', client_id);
    if (policy_id) fd.append('policy_id', policy_id);
    if (categoria) fd.append('categoria', categoria);
    const res = await fetch(`${API}/crm/files`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir archivo');
    return data;
  },

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'POST' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
};
