/**
 * Sidebar tests — every icon of the sidebar does something: the buttons
 * that were only placeholders (favourites, account) are gone.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import Sidebar from './Sidebar';
import SidebarContainer from './SidebarContainer';

/** A button of the sidebar, by the name it carries */
const icon = (name: string) => screen.getByRole('button', { name });

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
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
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
    expect(screen.queryByRole('button', { name: 'Preferiti' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Account/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Coming Soon/i })).toBeNull();
  });

  it.each([
    ['Explorer', 'explorer'],
    ['Simulazione', 'simulation'],
    ['Aggiungi Dispositivo', 'devices'],
  ])('"%s" opens its panel, and closes it when pressed again', (title, panel) => {
    render(<Sidebar />);

    fireEvent.click(icon(title));
    expect(useUIStore.getState().activeSidebarPanel).toBe(panel);

    fireEvent.click(icon(title));
    expect(useUIStore.getState().activeSidebarPanel).toBeNull();
  });

  it.each([
    ['Console', 'codeTerminal'],
    ['Import/Export', 'importExport'],
    ['Impostazioni', 'settings'],
  ] as const)('"%s" opens its window', (title, modal) => {
    render(<Sidebar />);

    fireEvent.click(icon(title));

    expect(useUIStore.getState().modals[modal]).toBe(true);
  });

  it('shows one panel at a time, each under its own title', () => {
    const { container } = render(<SidebarContainer />);
    const panelTitles = () =>
      Array.from(container.querySelectorAll('.sidebar-panel-title')).map(el => el.textContent);

    expect(panelTitles()).toEqual([]);

    fireEvent.click(icon('Simulazione'));
    expect(panelTitles()).toEqual(['Simulazione']);

    fireEvent.click(icon('Aggiungi Dispositivo'));
    expect(panelTitles()).toEqual(['Aggiungi']);

    fireEvent.click(icon('Explorer'));
    expect(panelTitles()).toEqual(['Explorer']);
  });

  describe('the name of a button', () => {
    const name = () => document.querySelector<HTMLElement>('.sidebar-tooltip');

    it('is shown while the pointer is on the button, and goes with it', () => {
      render(<Sidebar />);
      expect(name()).toBeNull();

      fireEvent.mouseEnter(icon('Simulazione'));
      expect(name()).toHaveTextContent('Simulazione');

      fireEvent.mouseLeave(icon('Simulazione'));
      expect(name()).toBeNull();
    });

    it('is shown for the button the keyboard is on', () => {
      render(<Sidebar />);

      fireEvent.focus(icon('Console'));
      expect(name()).toHaveTextContent('Console');

      fireEvent.blur(icon('Console'));
      expect(name()).toBeNull();
    });

    it.each(['Explorer', 'Simulazione', 'Aggiungi Dispositivo', 'Console', 'Import/Export', 'Impostazioni'])(
      '"%s" shows its own name, one name at a time',
      label => {
        render(<Sidebar />);
        fireEvent.mouseEnter(icon('Explorer'));
        fireEvent.mouseLeave(icon('Explorer'));

        fireEvent.mouseEnter(icon(label));

        expect(document.querySelectorAll('.sidebar-tooltip')).toHaveLength(1);
        expect(name()).toHaveTextContent(label);
      }
    );

    it('goes away when the button is pressed: what opens takes its place', () => {
      render(<Sidebar />);
      fireEvent.mouseEnter(icon('Explorer'));

      fireEvent.click(icon('Explorer'));

      expect(name()).toBeNull();
      expect(useUIStore.getState().activeSidebarPanel).toBe('explorer');
    });

    it('is beside the button, half way down, drawn on the page and not inside the sidebar', () => {
      const { container } = render(<Sidebar />);
      const button = icon('Simulazione');
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 152,
        left: 0,
        right: 52,
        width: 52,
        height: 52,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      });

      fireEvent.mouseEnter(button);

      expect(name()?.style.top).toBe('126px');
      expect(name()?.style.left).toBe('60px');
      // the panel a button opens slides in over the sidebar: a name inside it would be covered
      expect(container.contains(name())).toBe(false);
    });

    it('is for the eye only: the button carries its name itself, and no native tooltip doubles it', () => {
      render(<Sidebar />);
      fireEvent.mouseEnter(icon('Impostazioni'));

      expect(name()).toHaveAttribute('aria-hidden', 'true');
      for (const button of screen.getAllByRole('button')) {
        expect(button).toHaveAttribute('aria-label');
        expect(button).not.toHaveAttribute('title');
      }
    });
  });
});
