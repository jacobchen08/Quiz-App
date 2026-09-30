import { describe, expect, it } from 'vitest';
import { flipPace, flipPath } from './flapDrum';

describe('flipPath', () => {
  it('rolls numbers through the digit wheel, never through letters', () => {
    expect(flipPath('9', '0')).toEqual([' ', '0']);
    expect(flipPath('3', '5')).toEqual(['4', '5']);
    expect(flipPath(' ', '2')).toEqual(['0', '1', '2']);
  });

  it('runs letters through the full drum, skipping ahead on long trips', () => {
    expect(flipPath('A', 'C')).toEqual(['B', 'C']);
    const long = flipPath(' ', 'Z');
    expect(long).toHaveLength(9);
    expect(long.at(-1)).toBe('Z');
    expect(long[0]).toBe('R'); // the last nine characters before Z
  });

  it("doesn't move when there's nothing to change", () => {
    expect(flipPath('Q', 'Q')).toEqual([]);
  });

  it('jumps straight there for a character the drum lacks', () => {
    expect(flipPath('A', 'é')).toEqual(['é']);
  });
});

describe('flipPace', () => {
  it('gives neighbouring tiles slightly different speeds, all close to one flip', () => {
    const paces = [0, 1, 2, 3, 4].map(flipPace);
    expect(new Set(paces).size).toBe(5);
    for (const pace of paces) expect(pace).toBeGreaterThanOrEqual(95);
    for (const pace of paces) expect(pace).toBeLessThanOrEqual(125);
  });
});
