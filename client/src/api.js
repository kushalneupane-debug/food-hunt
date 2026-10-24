const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some errors have no JSON body.
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export function searchNearby({ lat, lng, q = '', radiusKm = 25 }) {
  const params = new URLSearchParams({ lat, lng, q, radiusKm });
  return request(`/businesses/search?${params}`);
}

export const getBusiness = (id) => request(`/businesses/${id}`);

export const createReview = (id, review) =>
  request(`/businesses/${id}/reviews`, { method: 'POST', body: JSON.stringify(review) });
