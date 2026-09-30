import { apiFetch } from './serverStatus';

// Where the API lives.
// - Development, and the single-service deploy: the same origin as the page. In development
//   vite.config.js proxies /api to the FastAPI server on port 8000.
// - Frontend hosted as its own static site: set VITE_API_HOST (e.g. quizzr-api.onrender.com)
//   at build time, and every request goes there instead.
const API_HOST = (import.meta.env.VITE_API_HOST ?? '').trim();
const API_ORIGIN = API_HOST ? (API_HOST.includes('://') ? API_HOST : `https://${API_HOST}`).replace(/\/$/, '') : '';

export function apiUrl(path) {
  return `${API_ORIGIN}${path}`;
}

export function questionsUrl(settings) {
  const params = new URLSearchParams({
    amount: settings.amount,
    category: settings.category || 'all',
    difficulty: settings.difficulty || 'all',
    type: settings.type || 'all',
  });
  return apiUrl(`/api/questions?${params}`);
}

// Daily challenge. Errors come back as { detail } from FastAPI; turn them into thrown Errors.
async function dailyRequest(path, options) {
  const response = await apiFetch(apiUrl(`/api/daily${path}`), options); // throws a readable Error when it can't connect
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
  const origin = API_ORIGIN || window.location.origin;
  return `${origin.replace(/^http/, 'ws')}/api/ws/${code}`;
}
