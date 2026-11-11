/**
 * Tests for the debounce utility.
 * NOTE: the flush() tests encode the contract introduced by the sync-fix work
 * (a pending call must be forcible before page unload).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid calls into a single invocation after the wait', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    for (let i = 0; i < 5; i++) {
      debounced();
      vi.advanceTimersByTime(20);
    }
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invokes with the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('first');
    debounced('second');
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('cancel() prevents the pending invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() with nothing pending is a no-op', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    expect(() => debounced.cancel()).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() invokes the pending call immediately and clears the timer', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('pending-args');
    debounced.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('pending-args');

    // Timer must be cleared: no second invocation later
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush() with nothing pending is a no-op', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    expect(() => debounced.flush()).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });

  it('can be re-armed after flush()', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    debounced.flush();
    debounced();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
