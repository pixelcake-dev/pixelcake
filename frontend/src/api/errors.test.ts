/**
 * Tests for friendlyApiError — mapping raw fetch/HTTP errors
 * to human-readable messages (backend-off scenario).
 */

import { describe, it, expect } from 'vitest';
import { friendlyApiError, BACKEND_UNREACHABLE_MESSAGE } from './errors';
import { HTTPError } from './client';

describe('friendlyApiError', () => {
  it('maps Chrome "Failed to fetch" (TypeError) to the backend-unreachable message', () => {
    const error = new TypeError('Failed to fetch');
    expect(friendlyApiError(error, 'fallback')).toBe(BACKEND_UNREACHABLE_MESSAGE);
  });

  it('maps Firefox "NetworkError when attempting to fetch a resource." to the backend-unreachable message', () => {
    const error = new TypeError('NetworkError when attempting to fetch a resource.');
    expect(friendlyApiError(error, 'fallback')).toBe(BACKEND_UNREACHABLE_MESSAGE);
  });

  it('maps Safari "Load failed" (TypeError) to the backend-unreachable message', () => {
    const error = new TypeError('Load failed');
    expect(friendlyApiError(error, 'fallback')).toBe(BACKEND_UNREACHABLE_MESSAGE);
  });

  it('keeps the descriptive message of an HTTPError', () => {
    const error = new HTTPError(404, 'Not Found', { detail: 'Project not found' });
    expect(friendlyApiError(error, 'fallback')).toBe(
      'HTTP 404: Not Found - Project not found'
    );
  });

  it('does NOT treat an unrelated TypeError as backend-unreachable', () => {
    const error = new TypeError('x is not a function');
    expect(friendlyApiError(error, 'fallback')).toBe('x is not a function');
  });

  it('returns the message of a plain Error', () => {
    const error = new Error('boom');
    expect(friendlyApiError(error, 'fallback')).toBe('boom');
  });

  it('returns the fallback for non-Error values', () => {
    expect(friendlyApiError('a string', 'fallback')).toBe('fallback');
    expect(friendlyApiError(undefined, 'fallback')).toBe('fallback');
    expect(friendlyApiError({ message: 'not an Error' }, 'fallback')).toBe('fallback');
  });
});
