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

  // Events
  getEvents: () => request('/events'),
  createEvent: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

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
  sendWhatsAppTemplate: (wa_id, template_name, language) => request('/whatsapp/send-template', { method: 'POST', body: JSON.stringify({ wa_id, template_name, language }) }),
  updateWhatsAppEstado: (waId, estado) => request(`/whatsapp/leads/${waId}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  toggleWhatsAppModoHumano: (waId) => request(`/whatsapp/leads/${waId}/modo-humano`, { method: 'PATCH' }),
  claimWhatsAppLead: (waId) => request(`/whatsapp/leads/${waId}/claim`, { method: 'PATCH' }),
  toggleWhatsAppBlock: (waId) => request(`/whatsapp/leads/${waId}/block`, { method: 'PATCH' }),
  getWhatsAppStats: () => request('/whatsapp/stats'),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'POST' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
};
