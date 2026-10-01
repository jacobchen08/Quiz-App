import { useCallback, useState } from 'react';

// A true/false preference remembered in this browser (like "settings hidden"). Falls back to
// plain state when storage isn't available, e.g. in private browsing.
export default function usePersistentFlag(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === 'true';
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        try {
          localStorage.setItem(key, String(resolved));
        } catch {
          // not remembered this time; the toggle still works
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}
