import { useEffect, useRef, useState } from 'react';
import { flipPace, flipPath, STAGGER_MS } from '../lib/flapDrum';
import { prefersReducedMotion } from '../lib/motion';

// Split-flap display, like a station departure board. Each character sits on its own
// tile; when the text changes, every tile flips forward through its drum until it lands
// on the new character. Screen readers get the plain text, never the tiles.
//
// One flip, as on a real board: the top half of the old character folds down, uncovering
// the new character's top half; the flap lands a moment later, now showing the new
// character's bottom half over the old one. Tiles start together and stop when they reach
// their character, so a change ripples across the board rather than marching left to right.

const reduceMotion = typeof window !== 'undefined' && prefersReducedMotion();

// a blank tile shows a non-breaking space, so it keeps its height
const glyph = (c) => (c === ' ' ? '\u00a0' : c);

function Half({ part, char, className = '' }) {
  return (
    <span className={`flap-half flap-${part} ${className}`}>
      <span className="flap-glyph">{glyph(char)}</span>
    </span>
  );
}

function Flap({ char, position }) {
  // `from` is what the tile showed before the current flip, `to` what it's turning to
  const [face, setFace] = useState(() => {
    const start = reduceMotion ? char : ' ';
    return { from: start, to: start, tick: 0 };
  });
  const shownRef = useRef(face.to);
  const pace = flipPace(position);

  useEffect(() => {
    if (reduceMotion || shownRef.current === char) {
      shownRef.current = char;
      setFace((f) => (f.to === char && f.from === char ? f : { from: char, to: char, tick: f.tick }));
      return;
    }
    const timers = flipPath(shownRef.current, char).map((c, i) =>
      setTimeout(() => {
        const previous = shownRef.current;
        shownRef.current = c;
        setFace((f) => ({ from: previous, to: c, tick: f.tick + 1 }));
      }, position * STAGGER_MS + i * pace)
    );
    return () => timers.forEach(clearTimeout);
  }, [char, position, pace]);

  const flipping = face.from !== face.to;

  return (
    <span className="flap" style={{ '--flip': `${pace}ms` }}>
      {/* what stays put: the new top, and the old bottom until the flap lands on it */}
      <Half part="top" char={face.to} />
      <Half part="bottom" char={flipping ? face.from : face.to} />
      {flipping && (
        <span key={face.tick} className="flap-leaves">
          <Half part="top" char={face.from} className="flap-leaf-top" />
          <Half part="bottom" char={face.to} className="flap-leaf-bottom" />
          <span className="flap-shade" />
        </span>
      )}
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
          <Flap key={i} char={char} position={i} />
        ))}
      </span>
    </span>
  );
}

export default FlapText;
