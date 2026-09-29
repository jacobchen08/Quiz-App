// All requests go to the same origin the page was served from.
// In development, vite.config.js proxies /api to the FastAPI server on port 8000.

export function questionsUrl(settings) {
  const params = new URLSearchParams({
    amount: settings.amount,
    category: settings.category || 'all',
    difficulty: settings.difficulty || 'all',
    type: settings.type || 'all',
  });
  return `/api/questions?${params}`;
}

// Daily challenge. Errors come back as { detail } from FastAPI; turn them into thrown Errors.
async function dailyRequest(path, options) {
  let response;
  try {
    response = await fetch(`/api/daily${path}`, options);
  } catch {
    throw new Error('Could not reach the server.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Something went wrong. Try again.';
    throw new Error(detail);
  }
  return data;
}

function post(body) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const daily = {
  load: (token) => dailyRequest(`?token=${encodeURIComponent(token)}`),
  start: (token, name) => dailyRequest('/start', post({ token, name })),
  answer: (token, index, answer) => dailyRequest('/answer', post({ token, index, answer })),
  leaderboard: (token) => dailyRequest(`/leaderboard?token=${encodeURIComponent(token)}`),
};

export function roomSocketUrl(code) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/api/ws/${code}`;
}
