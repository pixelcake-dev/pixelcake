/**
 * Debounce Utility
 * Delays function execution until after a specified delay
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns The debounced function with cancel and flush methods
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastContext: unknown = null;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastContext = this; // eslint-disable-line @typescript-eslint/no-this-alias -- Required for debounce context preservation
    lastArgs = args;

    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func.apply(lastContext, lastArgs as Parameters<T>);
    }, wait);
  } as T & { cancel: () => void; flush: () => void };

  // Cancel the pending invocation, if any
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  // Invoke the pending call immediately (no-op if nothing is pending).
  // Note: if func is async, flush fires it but cannot await it.
  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      func.apply(lastContext, lastArgs as Parameters<T>);
    }
  };

  return debounced;
}
