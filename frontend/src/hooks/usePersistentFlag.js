import { useCallback, useState } from 'react';
import { readStored, writeStored } from '../lib/storage';

// A true/false preference remembered in this browser (like "settings hidden"). Falls back to
// plain state when storage isn't available, e.g. in private browsing.
export default function usePersistentFlag(key, initial) {
  const [value, setValue] = useState(() => {
    const stored = readStored(key);
    return stored === null ? initial : stored === 'true';
  });

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        writeStored(key, String(resolved)); // if it isn't remembered, the toggle still works
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}
