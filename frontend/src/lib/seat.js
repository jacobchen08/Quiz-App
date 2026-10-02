import { KEYS, readStored, readStoredJson, removeStored, writeStored } from './storage';

// Your seat in a multiplayer room: { code, token, name }, kept for this tab only.
//
// The server hands out the token when you join. If the connection drops or the page reloads,
// joining again with it puts you back in your seat with your answers and score.

export function loadSeat() {
  return readStoredJson(KEYS.seat, { session: true });
}

export function saveSeat(seat) {
  // if storage refuses, reconnecting still works until the page reloads
  writeStored(KEYS.seat, JSON.stringify(seat), { session: true });
}

export function clearSeat() {
  removeStored(KEYS.seat, { session: true });
}

// True when this tab was in a room before a reload, so the app opens on multiplayer
export function hasSeat() {
  return Boolean(readStored(KEYS.seat, { session: true }));
}
