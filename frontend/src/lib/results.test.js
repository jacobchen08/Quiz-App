import { describe, expect, it } from 'vitest';
import { formatSeconds, ordinal, shareText, streaks, verdict } from './results';

describe('streaks', () => {
  it('counts the current and longest runs of correct answers', () => {
    expect(streaks([])).toEqual({ current: 0, best: 0 });
    expect(streaks([true, true, false, true])).toEqual({ current: 1, best: 2 });
    expect(streaks([false, true, true, true])).toEqual({ current: 3, best: 3 });
  });
});

describe('verdict', () => {
  it('matches the share of correct answers', () => {
    expect(verdict(10, 10)).toBe('A perfect round.');
    expect(verdict(8, 10)).toBe('Excellent round.');
    expect(verdict(5, 10)).toBe('Solid round.');
    expect(verdict(1, 10)).toMatch(/tough/i);
    expect(verdict(0, 10)).toMatch(/nothing went your way/i);
  });
});

describe('shareText', () => {
  it('puts the title, one square per question, extra lines and the link on their own lines', () => {
    const text = shareText({
      title: 'Quizzr · Solo · 2/3',
      marks: ['correct', 'wrong', 'correct'],
      lines: ['Best streak: 1'],
      url: 'https://quizzr.example',
    });
    expect(text).toBe('Quizzr · Solo · 2/3\n🟩🟥🟩\nBest streak: 1\nhttps://quizzr.example');
  });

  it('shows unanswered questions as blank squares', () => {
    expect(shareText({ title: 'T', marks: ['correct', undefined] })).toBe('T\n🟩⬜');
  });
});

describe('small formatters', () => {
  it('formats seconds as minutes and seconds', () => {
    expect(formatSeconds(9)).toBe('0:09');
    expect(formatSeconds(125.4)).toBe('2:05');
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st',
    ]);
  });
});
