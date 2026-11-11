/**
 * Dark mode at start-up. The saved choice wins and stays the same reload
 * after reload; with no saved choice the system preference is used. (An
 * earlier version toggled the theme on every start when the system preferred
 * dark, so the saved choice flipped at each reload.)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const UI_KEY = 'pixelcake-ui-v1';

/** The store as a page load creates it: module evaluated from scratch */
async function loadStore() {
  vi.resetModules();
  const { useUIStore } = await import('@/store/uiStore');
  return useUIStore;
}

function systemPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

function saveChoice(darkMode: boolean) {
  localStorage.setItem(
    UI_KEY,
    JSON.stringify({ state: { darkMode, theme: 'pixelcake' }, version: 0 })
  );
}

function pageIsDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

describe('dark mode at start-up', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows a dark system when the user has not chosen yet', async () => {
    systemPrefersDark(true);
    const store = await loadStore();

    expect(store.getState().darkMode).toBe(true);
    expect(pageIsDark()).toBe(true);
  });

  it('follows a light system when the user has not chosen yet', async () => {
    systemPrefersDark(false);
    const store = await loadStore();

    expect(store.getState().darkMode).toBe(false);
    expect(pageIsDark()).toBe(false);
  });

  it('starts light where the browser cannot tell the system preference', async () => {
    vi.stubGlobal('matchMedia', undefined);
    const store = await loadStore();

    expect(store.getState().darkMode).toBe(false);
    expect(pageIsDark()).toBe(false);
  });

  it('keeps a saved light choice on a dark system, reload after reload', async () => {
    saveChoice(false);
    systemPrefersDark(true);

    for (let reload = 0; reload < 3; reload++) {
      const store = await loadStore();
      expect(store.getState().darkMode).toBe(false);
      expect(pageIsDark()).toBe(false);
    }
  });

  it('keeps a saved dark choice on a light system, reload after reload', async () => {
    saveChoice(true);
    systemPrefersDark(false);

    for (let reload = 0; reload < 3; reload++) {
      const store = await loadStore();
      expect(store.getState().darkMode).toBe(true);
      expect(pageIsDark()).toBe(true);
    }
  });

  it('remembers a choice made with the toggle', async () => {
    systemPrefersDark(true);
    const first = await loadStore();
    first.getState().toggleDarkMode(); // dark system, the user wants light
    expect(pageIsDark()).toBe(false);

    const second = await loadStore();
    expect(second.getState().darkMode).toBe(false);
    expect(pageIsDark()).toBe(false);
  });
});
