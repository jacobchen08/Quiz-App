import { useSyncExternalStore } from 'react';

// Whether the browser thinks it has a connection, kept up to date as that changes.
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

const getSnapshot = () => navigator.onLine;

export default function useOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
