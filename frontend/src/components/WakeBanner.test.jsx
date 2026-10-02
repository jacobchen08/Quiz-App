import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import WakeBanner from './WakeBanner';
import { resetServerStatus, track } from '../lib/serverStatus';

describe('WakeBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetServerStatus();
  });
  afterEach(() => vi.useRealTimers());

  it('explains a slow request, then a sleeping server, then goes away', () => {
    render(<WakeBanner />);
    let done;
    act(() => {
      done = track();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('Still working on it…')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByText('Waking the server up…')).toBeInTheDocument();

    act(() => done());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
