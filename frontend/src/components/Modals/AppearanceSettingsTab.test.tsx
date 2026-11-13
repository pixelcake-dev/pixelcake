/**
 * AppearanceSettingsTab tests — how the app looks is one choice, light or
 * dark. (A second set of colours, "Modern Tech", could be picked here once:
 * it is gone, and the tab no longer offers a choice of one.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import AppearanceSettingsTab from './AppearanceSettingsTab';

const pageIsDark = () => document.documentElement.classList.contains('dark');

beforeEach(() => {
  localStorage.clear();
  useUIStore.getState().setDarkMode(false);
});

describe('AppearanceSettingsTab', () => {
  it('has one control: the switch between light and dark', () => {
    render(<AppearanceSettingsTab />);

    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('Tema Colore')).toBeNull();
    expect(screen.queryByText(/Modern Tech/)).toBeNull();
  });

  it('the switch says which of the two is on, and changes it', () => {
    render(<AppearanceSettingsTab />);
    const mode = screen.getByRole('switch');

    expect(mode).toHaveAttribute('aria-checked', 'false');
    expect(mode).toHaveTextContent('Modalità Chiara Attiva');
    expect(mode).toHaveTextContent('Clicca per passare alla modalità scura');
    expect(pageIsDark()).toBe(false);

    fireEvent.click(mode);

    expect(mode).toHaveAttribute('aria-checked', 'true');
    expect(mode).toHaveTextContent('Modalità Scura Attiva');
    expect(mode).toHaveTextContent('Clicca per passare alla modalità chiara');
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
