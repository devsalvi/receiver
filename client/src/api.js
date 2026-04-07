const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Dashboard
  getStats: () => request('/business/stats'),

  // Appointments
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/appointments?${qs}`);
  },
  getAppointment: (id) => request(`/appointments/${id}`),
  createAppointment: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAvailability: (date, barberId) => {
    const qs = barberId ? `?barber_id=${barberId}` : '';
    return request(`/appointments/availability/${date}${qs}`);
  },

  // Services
  getServices: () => request('/services'),
  createService: (data) => request('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id, data) => request(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),

  // Barbers
  getBarbers: () => request('/barbers'),
  createBarber: (data) => request('/barbers', { method: 'POST', body: JSON.stringify(data) }),
  updateBarber: (id, data) => request(`/barbers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Business
  getBusiness: () => request('/business'),
  updateBusiness: (data) => request('/business', { method: 'PATCH', body: JSON.stringify(data) }),
  updateHours: (hours) => request('/business/hours', { method: 'PUT', body: JSON.stringify({ hours }) }),

  // Calls
  getCalls: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/calls?${qs}`);
  },
  getCall: (id) => request(`/calls/${id}`),

  // Auth
  getGoogleStatus: () => request('/auth/google/status'),
};
