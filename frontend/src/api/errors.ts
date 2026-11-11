/**
 * API Error Helpers
 * Maps low-level fetch/HTTP errors to human-readable messages.
 */

import type { HTTPError } from './client';

/**
 * Message shown when the backend server cannot be reached at all
 * (e.g. the FastAPI server is not running).
 */
export const BACKEND_UNREACHABLE_MESSAGE =
  'Backend non raggiungibile — avvia il server backend e riprova';

/**
 * Detects the browser-native "network unreachable" failure thrown by fetch().
 * Browsers report it as a TypeError with an engine-specific message:
 * - Chrome/Edge: "Failed to fetch"
 * - Firefox: "NetworkError when attempting to fetch a resource."
 * - Safari: "Load failed"
 */
function isNetworkError(error: Error): boolean {
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return message.includes('fetch') || message.includes('load failed');
}

/**
 * Type guard for HTTPError without a runtime import of the class
 * (the class sets `name = 'HTTPError'` in its constructor).
 */
function isHTTPError(error: Error): error is HTTPError {
  return error.name === 'HTTPError';
}

/**
 * Converts an unknown error (from a fetch/API call) into a message
 * suitable for toasts and modal error boxes.
 *
 * - Backend unreachable (fetch TypeError) → friendly Italian hint
 * - HTTPError → its own message (already descriptive: "HTTP 404: Not Found - ...")
 * - Any other Error → its message
 * - Anything else → the provided fallback
 */
export function friendlyApiError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    if (isNetworkError(error)) {
      return BACKEND_UNREACHABLE_MESSAGE;
    }
    if (isHTTPError(error)) {
      return error.message;
    }
    return error.message;
  }
  return fallback;
}
