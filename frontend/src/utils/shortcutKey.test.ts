/**
 * The letter of a shortcut with Ctrl (Cmd on a Mac): the same with Caps Lock
 * on or off, and on a keyboard whose letters are not Latin; never with Shift
 * or Alt, which make other shortcuts of the browser.
 */

import { describe, it, expect } from 'vitest';
import { plainLetter, shortcutLetter } from './shortcutKey';

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

  it('is none for a key that is not a letter', () => {
    expect(shortcutLetter(key({ key: 'Delete', code: 'Delete', ctrlKey: true }))).toBeNull();
    expect(shortcutLetter(key({ key: '1', code: 'Digit1', ctrlKey: true }))).toBeNull();
    expect(shortcutLetter(key({ key: 'Control', code: 'ControlLeft', ctrlKey: true }))).toBeNull();
  });
});

describe('plainLetter', () => {
  it('is the letter of a key pressed alone, in lower case, with Caps Lock off or on', () => {
    expect(plainLetter(key({ key: 'p', code: 'KeyP' }))).toBe('p');
    expect(plainLetter(key({ key: 'P', code: 'KeyP' }))).toBe('p');
  });

  it('on a keyboard whose letters are not Latin, is the Latin letter of the same key', () => {
    // a Russian layout: the key of P writes «з»
    expect(plainLetter(key({ key: 'з', code: 'KeyP' }))).toBe('p');
  });

  it('is none with Ctrl, Cmd, Alt or Shift: those are other shortcuts, or a capital letter', () => {
    expect(plainLetter(key({ key: 'p', code: 'KeyP', ctrlKey: true }))).toBeNull();
    expect(plainLetter(key({ key: 'p', code: 'KeyP', metaKey: true }))).toBeNull();
    expect(plainLetter(key({ key: 'p', code: 'KeyP', altKey: true }))).toBeNull();
    expect(plainLetter(key({ key: 'P', code: 'KeyP', shiftKey: true }))).toBeNull();
  });

  it('is none for a key that is not a letter', () => {
    expect(plainLetter(key({ key: 'Escape', code: 'Escape' }))).toBeNull();
    expect(plainLetter(key({ key: '1', code: 'Digit1' }))).toBeNull();
  });
});
