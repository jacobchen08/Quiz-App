// Everything the app remembers in this browser, and safe ways to read and write it.
//
// Storage can refuse to work (private browsing, a full disk, blocked site data), so these
// helpers never throw: a read gives back null, a failed write returns false, and the app
// carries on without whatever it couldn't remember.

export const KEYS = {
  dailyToken: 'quizzr-daily-token', // localStorage: your random id for the daily challenge
  name: 'quizzr-name', // localStorage: the name you last played the daily challenge under
  offlinePack: 'quizzr-offline-pack', // localStorage: questions saved for playing offline
  soloSettingsOpen: 'quizzr-solo-settings-open', // localStorage: solo settings shown or folded away
  roomSettingsOpen: 'quizzr-room-settings-open', // localStorage: a room's settings shown or folded away
  seat: 'quizzr-seat', // sessionStorage (this tab only): your seat in a multiplayer room
};

const area = (session) => (session ? sessionStorage : localStorage);

export function readStored(key, { session = false } = {}) {
  try {
    return area(session).getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key, value, { session = false } = {}) {
  try {
    area(session).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key, { session = false } = {}) {
  try {
    area(session).removeItem(key);
  } catch {
    // nothing to remove
  }
}

// A stored JSON value, or null when it's missing or unreadable
export function readStoredJson(key, options) {
  try {
    return JSON.parse(readStored(key, options));
  } catch {
    return null;
  }
}
