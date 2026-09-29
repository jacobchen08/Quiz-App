import { useEffect, useRef, useState } from 'react';

// Split-flap display, like a station departure board. Each character sits on its own
// tile; when the text changes, every tile flips forward through the drum until it lands
// on the new character. Screen readers get the plain text, never the tiles.

const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.';
const STEP_MS = 55;
const STAGGER_MS = 45;
const MAX_STEPS = 6;

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The characters a tile shows on its way from `from` to `to`, skipping ahead on long trips
function flipPath(from, to) {
  const start = DRUM.indexOf(from);
  const end = DRUM.indexOf(to);
  if (start === -1 || end === -1) return [to];
  const path = [];
  for (let i = (start + 1) % DRUM.length; ; i = (i + 1) % DRUM.length) {
    path.push(DRUM[i]);
    if (i === end) break;
  }
  return path.slice(-MAX_STEPS);
}

function Flap({ char, delay }) {
  const [shown, setShown] = useState(reduceMotion ? char : ' ');
  const [tick, setTick] = useState(0);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduceMotion || shownRef.current === char) {
      shownRef.current = char;
      setShown(char);
      return;
    }
    const timers = flipPath(shownRef.current, char).map((c, i) =>
      setTimeout(() => {
        shownRef.current = c;
        setShown(c);
        setTick((t) => t + 1);
      }, delay + i * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [char, delay]);

  return (
    <span className="flap">
      <span className="flap-char">{shown === ' ' ? ' ' : shown}</span>
      {tick > 0 && <span key={tick} className="flap-leaf" />}
    </span>
  );
}

// `text` is shown in capitals; `length` pads it on the left so numbers keep their width.
function FlapText({ text, length = 0, label, size = 'md', className = '' }) {
  const value = String(text ?? '').toUpperCase().padStart(length, ' ');
  return (
    <span className={`flaps flaps-${size} ${className}`}>
      <span className="sr-only">{label ?? text}</span>
      <span className="flaps-row" aria-hidden="true">
        {[...value].map((char, i) => (
          <Flap key={i} char={char} delay={i * STAGGER_MS} />
        ))}
      </span>
    </span>
  );
}

export default FlapText;
