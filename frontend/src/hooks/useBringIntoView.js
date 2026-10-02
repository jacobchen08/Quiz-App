import { useEffect } from 'react';
import { prefersReducedMotion } from '../lib/motion';

// When a round starts, scroll its question board into view and put focus on it. On a phone
// the first question lands below the settings, out of sight, so without this nothing seems
// to happen. `trigger` is a counter that goes up with each new round (0 means none yet).
export default function useBringIntoView(containerRef, trigger) {
  useEffect(() => {
    if (trigger === 0) return;
    const board = containerRef.current?.querySelector('.question-board');
    if (!board) return;
    board.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    board.focus({ preventScroll: true });
  }, [containerRef, trigger]);
}
