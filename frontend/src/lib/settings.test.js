import { describe, expect, it } from 'vitest';
import { clampAmount } from './settings';

describe('clampAmount', () => {
  it('keeps a sensible number as it is', () => {
    expect(clampAmount(10)).toBe(10);
    expect(clampAmount('7')).toBe(7);
  });

  it('pulls numbers outside 1 to 50 back inside', () => {
    expect(clampAmount(0)).toBe(1);
    expect(clampAmount(-4)).toBe(1);
    expect(clampAmount(999)).toBe(50);
    expect(clampAmount('3.6')).toBe(4);
  });

  it('falls back to the default for an empty or unreadable box', () => {
    expect(clampAmount('')).toBe(10);
    expect(clampAmount(undefined)).toBe(10);
    expect(clampAmount('abc')).toBe(10);
  });
});
