/**
 * Sidebar tests — every icon of the sidebar does something: the buttons
 * that were only placeholders (favourites, account) are gone.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import Sidebar from './Sidebar';
import SidebarContainer from './SidebarContainer';

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useUIStore.setState(state => ({
      activeSidebarPanel: null,
      modals: { ...state.modals, codeTerminal: false, importExport: false, settings: false },
    }));
  });

  it('has six buttons, all of them enabled', () => {
    render(<Sidebar />);

    const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
    expect(buttons.map(button => button.title)).toEqual([
      'Explorer',
      'Simulazione',
      'Aggiungi Dispositivo',
      'Console',
      'Import/Export',
      'Impostazioni',
    ]);
    for (const button of buttons) {
      expect(button).toBeEnabled();
    }
    expect(screen.queryByTitle('Preferiti')).toBeNull();
    expect(screen.queryByTitle(/Account/)).toBeNull();
    expect(screen.queryByTitle(/Coming Soon/i)).toBeNull();
  });

  it.each([
    ['Explorer', 'explorer'],
    ['Simulazione', 'simulation'],
    ['Aggiungi Dispositivo', 'devices'],
  ])('"%s" opens its panel, and closes it when pressed again', (title, panel) => {
    render(<Sidebar />);

    fireEvent.click(screen.getByTitle(title));
    expect(useUIStore.getState().activeSidebarPanel).toBe(panel);

    fireEvent.click(screen.getByTitle(title));
    expect(useUIStore.getState().activeSidebarPanel).toBeNull();
  });

  it.each([
    ['Console', 'codeTerminal'],
    ['Import/Export', 'importExport'],
    ['Impostazioni', 'settings'],
  ] as const)('"%s" opens its window', (title, modal) => {
    render(<Sidebar />);

    fireEvent.click(screen.getByTitle(title));

    expect(useUIStore.getState().modals[modal]).toBe(true);
  });

  it('shows one panel at a time, each under its own title', () => {
    const { container } = render(<SidebarContainer />);
    const panelTitles = () =>
      Array.from(container.querySelectorAll('.sidebar-panel-title')).map(el => el.textContent);

    expect(panelTitles()).toEqual([]);

    fireEvent.click(screen.getByTitle('Simulazione'));
    expect(panelTitles()).toEqual(['Simulazione']);

    fireEvent.click(screen.getByTitle('Aggiungi Dispositivo'));
    expect(panelTitles()).toEqual(['Aggiungi']);

    fireEvent.click(screen.getByTitle('Explorer'));
    expect(panelTitles()).toEqual(['Explorer']);
  });
});
