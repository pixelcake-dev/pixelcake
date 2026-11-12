/**
 * Messages to the user go through toasts. The browser's own alert() stops
 * the whole page and looks like nothing else in the app: no source file may
 * call it. (confirm() is still used where a destructive action needs a yes
 * or a no.)
 */

import { describe, it, expect } from 'vitest';

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** A call of the global alert, bare or through window/globalThis; not a method of something else */
const NATIVE_ALERT = /(?<![\w.$])(?:(?:window|globalThis)\.)?alert\s*\(/;

describe('native dialogs', () => {
  it('recognises a call of alert() and nothing else (the scan itself works)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);

    for (const call of ["alert('x')", "window.alert('x')", 'return alert(`x`);']) {
      expect(NATIVE_ALERT.test(call)).toBe(true);
    }
    for (const other of [
      "toast.error('x')",
      "showAlert('x')",
      "dialog.alert('x')",
      'role="alert"',
    ]) {
      expect(NATIVE_ALERT.test(other)).toBe(false);
    }
  });

  it('no source file calls alert()', () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !/\.test\.tsx?$/.test(file))
      .filter(([, text]) => NATIVE_ALERT.test(text))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
