const BASE = import.meta.env.VITE_API_URL || '';

async function authRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api/auth/${path}`, options);
  } catch {
    throw new Error('Cannot reach Food Hunt. Please try again.');
  }
  let data;
  try { data = await response.json(); } catch {
    throw new Error('Food Hunt returned an empty or invalid response. Check that the API server is running.');
  }
  if (!data || typeof data !== 'object') throw new Error('Food Hunt returned an invalid response. Please try again.');
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed. Please try again.');
    error.status = response.status;
    error.retryAfter = data.retryAfter;
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

export function requestSignupCode(details) {
  return authRequest('signup/request-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details),
  });
}

export function verifySignupCode(details) {
  return authRequest('signup/verify-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details),
  });
}
