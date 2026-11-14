/**
 * AppearanceSettingsTab tests — how the app looks is one choice, light or
 * dark, and under it the language of the interface. (A second set of
 * colours, "Modern Tech", could be picked here once: it is gone, and the tab
 * no longer offers a choice of one.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import AppearanceSettingsTab from './AppearanceSettingsTab';

const pageIsDark = () => document.documentElement.classList.contains('dark');

beforeEach(() => {
  localStorage.clear();
  useUIStore.getState().setDarkMode(false);
});

describe('AppearanceSettingsTab', () => {
  it('has two controls: the switch between light and dark, and the choice of the language', () => {
    render(<AppearanceSettingsTab />);

    expect(screen.getAllByRole('switch')).toHaveLength(1);
    // (the only buttons are the two languages; test of the switch: LanguageSwitch.test.tsx)
    const languages = within(screen.getByRole('group', { name: 'Lingua' })).getAllByRole('button');
    expect(languages.map((language) => language.textContent)).toEqual(['it', 'en']);
    expect(screen.queryAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText('Tema Colore')).toBeNull();
    expect(screen.queryByText(/Modern Tech/)).toBeNull();
  });

  it('the switch says which of the two is on, and changes it', () => {
    render(<AppearanceSettingsTab />);
    const mode = screen.getByRole('switch');

    expect(mode).toHaveAttribute('aria-checked', 'false');
    expect(mode).toHaveTextContent('Tema Chiaro Attivo');
    expect(mode).toHaveTextContent('Clicca per passare al tema scuro');
    expect(pageIsDark()).toBe(false);

    fireEvent.click(mode);

    expect(mode).toHaveAttribute('aria-checked', 'true');
    expect(mode).toHaveTextContent('Tema Scuro Attivo');
    expect(mode).toHaveTextContent('Clicca per passare al tema chiaro');
    expect(useUIStore.getState().darkMode).toBe(true);
    expect(pageIsDark()).toBe(true);

    fireEvent.click(mode);

    expect(mode).toHaveAttribute('aria-checked', 'false');
    expect(pageIsDark()).toBe(false);
  });

  it('is a real button: the keyboard reaches it', () => {
    render(<AppearanceSettingsTab />);
    const mode = screen.getByRole('switch');

    expect(mode.tagName).toBe('BUTTON');
    mode.focus();
    expect(mode).toHaveFocus();
  });
});
