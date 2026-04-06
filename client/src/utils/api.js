const API = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
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
};
