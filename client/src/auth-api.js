const BASE = import.meta.env.VITE_API_URL || '';

async function authRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api/auth/${path}`, options);
  } catch {
    throw new Error('Cannot reach Food Hunt. Please try again.');
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function registerAccount(account) {
  return authRequest('register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
}

export function loginAccount(credentials) {
  return authRequest('login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

export function getProfile(token) {
  return authRequest('me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}
