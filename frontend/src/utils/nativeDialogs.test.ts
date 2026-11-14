/**
 * Messages to the user go through toasts, and a question with a yes and a no
 * through a window of the app (store/confirmStore.ts). The browser's own
 * alert(), confirm() and prompt() stop the whole page and look like nothing
 * else in the app: no source file may call them.
 */

import { describe, it, expect } from 'vitest';

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** A call of one of the three, bare or through window/globalThis; not a method of something else */
const NATIVE_DIALOG = /(?<![\w.$])(?:(?:window|globalThis)\.)?(?:alert|confirm|prompt)\s*\(/;

describe('native dialogs', () => {
  it('recognises a call of alert(), confirm() or prompt() and nothing else (the scan itself works)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);

    for (const call of [
      "alert('x')",
      "window.alert('x')",
      'return alert(`x`);',
      "if (confirm('x')) {",
      "window.confirm('x')",
      "globalThis.prompt('x')",
    ]) {
      expect(NATIVE_DIALOG.test(call), call).toBe(true);
    }
    for (const other of [
      "toast.error('x')",
      "showAlert('x')",
      "dialog.alert('x')",
      'role="alert"',
      'askConfirm({ title })',
      'await confirmDiscardChanges()',
      "answerConfirms(true)",
    ]) {
      expect(NATIVE_DIALOG.test(other), other).toBe(false);
    }
  });

  it('no source file calls alert(), confirm() or prompt()', () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !/\.test\.tsx?$/.test(file))
      .filter(([, text]) => NATIVE_DIALOG.test(text))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
