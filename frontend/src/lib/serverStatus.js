// Keeps track of requests that are taking a while, so the app can explain the wait.
//
// The server runs on free hosting that goes to sleep after about 15 minutes without
// visitors. The first request after that takes 30–60 seconds while it starts up again,
// which looks like the app has frozen unless we say what's happening.

const SLOW_AFTER_MS = 2500; // longer than any normal request
export const GIVE_UP_AFTER_MS = 90_000;

let pending = new Map(); // id -> start time, for requests past SLOW_AFTER_MS
let nextId = 1;
const listeners = new Set();
let snapshot = { slowSince: null };

function publish() {
  const starts = [...pending.values()];
  const slowSince = starts.length ? Math.min(...starts) : null;
  if (slowSince !== snapshot.slowSince) {
    snapshot = { slowSince };
    listeners.forEach((listener) => listener());
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return snapshot;
}

// Mark the start of something that talks to the server; call the returned function when it's done
export function track() {
  const id = nextId++;
  const startedAt = Date.now();
  const timer = setTimeout(() => {
    pending.set(id, startedAt);
    publish();
  }, SLOW_AFTER_MS);
  return () => {
    clearTimeout(timer);
    if (pending.delete(id)) publish();
  };
}

// fetch, but tracked, and with a time limit so a server that never wakes up ends in a clear error
export async function apiFetch(url, options = {}) {
  const done = track();
  const controller = new AbortController();
  const limit = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    // Either way the reason is one a player can act on, so say it plainly
    throw new Error(
      controller.signal.aborted
        ? "The server didn't respond. It may still be starting up, so try again in a moment."
        : 'Could not reach the server. Check your connection and try again.'
    );
  } finally {
    clearTimeout(limit);
    done();
  }
}

// For tests
export function resetServerStatus() {
  pending = new Map();
  snapshot = { slowSince: null };
}
