const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, { token, ...options } = {}) {
  const headers = {};
  if (options.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some errors have no JSON body.
  }
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
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
  request(`/businesses/${id}/reviews`, { method: 'POST', body: JSON.stringify(review) });

// Hunt Together (food meetups). Browsing works signed out; the rest needs the session token.
export function listMeetups({ lat, lng, radiusKm = 40, token }) {
  const params = new URLSearchParams({ lat, lng, radiusKm });
  return request(`/meetups?${params}`, { token, cache: 'no-store' });
}

export const getMeetup = (id, token) => request(`/meetups/${id}`, { token, cache: 'no-store' });

export const createMeetup = (meetup, token) =>
  request('/meetups', { method: 'POST', body: JSON.stringify(meetup), token });

// action: 'join' | 'leave' | 'cancel' | 'report'
export const meetupAction = (id, action, token, body = {}) =>
  request(`/meetups/${id}/${action}`, { method: 'POST', body: JSON.stringify(body), token });
