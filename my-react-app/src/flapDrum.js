// The drums inside split-flap tiles: which characters a tile passes through on its way
// from one character to the next, and how long each flip takes.

const LETTERS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.%';
const DIGITS = ' 0123456789'; // number tiles carry only digits, like a board's number wheels
export const FLIP_MS = 110; // one whole flip: the top leaf falls, then the bottom leaf lands
export const STAGGER_MS = 18; // neighbours set off a hair apart, not in a strict march
const MAX_STEPS = 9; // a long trip skips ahead, so nothing spins for ages

const isDigit = (c) => c === ' ' || (c >= '0' && c <= '9');

// The characters a tile shows on its way from `from` to `to`, skipping ahead on long trips
export function flipPath(from, to) {
  if (from === to) return [];
  const drum = isDigit(from) && isDigit(to) ? DIGITS : LETTERS;
  const start = drum.indexOf(from);
  const end = drum.indexOf(to);
  if (start === -1 || end === -1) return [to];
  const path = [];
  for (let i = (start + 1) % drum.length; ; i = (i + 1) % drum.length) {
    path.push(drum[i]);
    if (i === end) break;
  }
  return path.slice(-MAX_STEPS);
}

// Each tile's mechanism runs at its own slightly different speed, as on a real board
export function flipPace(position) {
  return Math.round(FLIP_MS * (0.92 + (position % 5) * 0.04));
}
