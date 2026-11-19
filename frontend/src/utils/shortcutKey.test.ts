/**
 * The letter of a shortcut with Ctrl (Cmd on a Mac): the same with Caps Lock
 * on or off, and on a keyboard whose letters are not Latin; never with Shift
 * or Alt, which make other shortcuts of the browser.
 */

import { describe, it, expect } from 'vitest';
import { shortcutLetter } from './shortcutKey';

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('shortcutLetter', () => {
  it('is the letter of the key, in lower case, with Caps Lock off or on', () => {
    expect(shortcutLetter(key({ key: 'c', code: 'KeyC', ctrlKey: true }))).toBe('c');
    expect(shortcutLetter(key({ key: 'C', code: 'KeyC', ctrlKey: true }))).toBe('c');
    expect(shortcutLetter(key({ key: 'V', code: 'KeyV', metaKey: true }))).toBe('v');
  });

  it('is the letter of the key, also without its code (an event made by a page)', () => {
    expect(shortcutLetter(key({ key: 'S', ctrlKey: true }))).toBe('s');
  });

  it('on a keyboard whose letters are not Latin, is the Latin letter of the same key', () => {
    // a Russian layout: the key of C writes «с»
    expect(shortcutLetter(key({ key: 'с', code: 'KeyC', ctrlKey: true }))).toBe('c');
    expect(shortcutLetter(key({ key: 'м', code: 'KeyV', ctrlKey: true }))).toBe('v');
  });

  it('is none without Ctrl or Cmd, and none with Shift or Alt', () => {
    expect(shortcutLetter(key({ key: 'c', code: 'KeyC' }))).toBeNull();
    expect(shortcutLetter(key({ key: 'C', code: 'KeyC', ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(shortcutLetter(key({ key: 'c', code: 'KeyC', ctrlKey: true, altKey: true }))).toBeNull();
  });

  it('with Shift, only for a shortcut that has Shift too (Ctrl+Shift+Z): Caps Lock does not count', () => {
    const withShift = { withShift: true };
    expect(shortcutLetter(key({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true }), withShift)).toBe('z');
    expect(shortcutLetter(key({ key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true }), withShift)).toBe('z');
    expect(shortcutLetter(key({ key: 'Я', code: 'KeyZ', metaKey: true, shiftKey: true }), withShift)).toBe('z');
    expect(shortcutLetter(key({ key: 'z', code: 'KeyZ', ctrlKey: true }), withShift)).toBe('z');
    expect(shortcutLetter(key({ key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true, shiftKey: true }), withShift)).toBeNull();
  });

  it('is none for a key that is not a letter', () => {
    expect(shortcutLetter(key({ key: 'Delete', code: 'Delete', ctrlKey: true }))).toBeNull();
    expect(shortcutLetter(key({ key: '1', code: 'Digit1', ctrlKey: true }))).toBeNull();
    expect(shortcutLetter(key({ key: 'Control', code: 'ControlLeft', ctrlKey: true }))).toBeNull();
  });
});
