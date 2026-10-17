// All calls to the Food Hunt API live here. See docs/api.md and docs/auth.md.
const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some errors have no JSON body.
  }

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.details = data?.details;
    throw error;
  }
  return data;
}

export function searchNearby({ lat, lng, q = '', radiusKm = 25 }) {
  const params = new URLSearchParams({ lat, lng, q, radiusKm });
  return request(`/businesses/search?${params}`);
}

export const getBusiness = (id) => request(`/businesses/${id}`);

export const createReview = (id, review) =>
  request(`/businesses/${id}/reviews`, { method: 'POST', body: review });

export const register = (account) =>
  request('/auth/register', { method: 'POST', body: account });

export const login = (credentials) =>
  request('/auth/login', { method: 'POST', body: credentials });

export const getMe = (token) => request('/auth/me', { token });
