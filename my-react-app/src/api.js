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

export function roomSocketUrl(code) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/api/ws/${code}`;
}
