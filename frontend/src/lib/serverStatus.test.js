import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, GIVE_UP_AFTER_MS, getSnapshot, resetServerStatus, track } from './serverStatus';

describe('serverStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetServerStatus();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('only reports a request once it has been slow for a moment', () => {
    const done = track();
    vi.advanceTimersByTime(2000);
    expect(getSnapshot().slowSince).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(getSnapshot().slowSince).not.toBeNull();
    done();
    expect(getSnapshot().slowSince).toBeNull();
  });

  it('never reports a quick request', () => {
    const done = track();
    vi.advanceTimersByTime(300);
    done();
    vi.advanceTimersByTime(5000);
    expect(getSnapshot().slowSince).toBeNull();
  });

  it('gives up on a server that never answers, with a message a player can act on', async () => {
    vi.stubGlobal(
      'fetch',
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
    );
    const request = apiFetch('/api/questions');
    const outcome = expect(request).rejects.toThrow(/didn't respond/);
    await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS);
    await outcome;
    expect(getSnapshot().slowSince).toBeNull();
  });

  it('turns a network failure into a plain message', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiFetch('/api/questions')).rejects.toThrow(/Could not reach the server/);
  });
});
