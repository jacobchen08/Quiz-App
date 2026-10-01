import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion';

// Rows that change places slide to their new spot instead of jumping, like names moving on
// a departures board when the order changes. Rows new to the list fade in.
//
// Mark each row with data-flip-key and pass a `signature` that changes whenever the order or
// the set of rows does (for example, the keys joined). This is the FLIP technique: measure
// where each row was, let React move it, then animate a transform from the old place.
export default function useFlipList(listRef, signature) {
  const positions = useRef(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reduce = prefersReducedMotion();
    const previous = positions.current;
    const next = new Map();

    for (const row of list.querySelectorAll(':scope > [data-flip-key]')) {
      const key = row.dataset.flipKey;
      const top = row.offsetTop; // relative to the list, so page scrolling doesn't count as movement
      next.set(key, top);
      if (!previous || reduce || !row.animate) continue;

      const before = previous.get(key);
      if (before === undefined) {
        row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
      } else if (Math.abs(before - top) > 1) {
        row.animate(
          [{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        );
      }
    }
    positions.current = next;
  }, [listRef, signature]);
}
