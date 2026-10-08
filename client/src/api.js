const BASE = import.meta.env.VITE_API_URL || '';

export async function searchNearby({ lat, lng, q = '', radiusKm = 25 }) {
  const params = new URLSearchParams({ lat, lng, q, radiusKm });
  const res = await fetch(`${BASE}/api/businesses/search?${params}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}