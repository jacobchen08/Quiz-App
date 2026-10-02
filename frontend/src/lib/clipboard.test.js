import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the clipboard API when the page is allowed to', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('ABCDE')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('ABCDE');
  });

  it('falls back to a hidden text box where there is no clipboard API (plain http)', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn(() => true);
    expect(await copyText('ABCDE')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull(); // cleaned up afterwards
  });

  it('reports failure instead of throwing when nothing can copy', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn(() => {
      throw new Error('not supported');
    });
    expect(await copyText('ABCDE')).toBe(false);
  });
});
