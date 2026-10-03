import { describe, expect, it } from 'vitest';
import { categories, categoryLabel } from './categories';

describe('categoryLabel', () => {
  it('drops the Entertainment: and Science: prefixes', () => {
    expect(categoryLabel('Entertainment: Video Games')).toBe('Video Games');
    expect(categoryLabel('Science: Computers')).toBe('Computers');
  });

  it('leaves every other name alone', () => {
    expect(categoryLabel('Science & Nature')).toBe('Science & Nature');
    expect(categoryLabel('Geography')).toBe('Geography');
    expect(categoryLabel(undefined)).toBe('');
  });

  it('never gives two categories the same label', () => {
    const labels = categories.map((c) => categoryLabel(c.name));
    expect(new Set(labels).size).toBe(labels.length);
  });
});
