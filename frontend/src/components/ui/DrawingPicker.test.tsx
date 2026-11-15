/**
 * The drawing of a template is chosen among those the app has: one button
 * for each, in the groups of the kit, named after its drawing in the
 * language of the interface, one of them chosen.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { DEVICE_DRAWING_GROUPS, DEVICE_DRAWING_IDS } from '@/data/deviceDrawings';
import { setLanguage } from '@/i18n';
import { useTemplateStore } from '@/store/templateStore';
import DrawingPicker from './DrawingPicker';

beforeEach(() => {
  localStorage.clear();
  useTemplateStore.getState().loadDefaultTemplates();
});

afterEach(() => {
  act(() => setLanguage('it'));
});

const drawingOf = (choice: HTMLElement) => choice.querySelector('svg')?.getAttribute('data-drawing');

describe('DrawingPicker', () => {
  it('offers every drawing of the app, each once, as one choice among them', () => {
    render(<DrawingPicker label="Disegno" value="server" onChange={() => {}} />);

    const group = screen.getByRole('radiogroup', { name: 'Disegno' });
    const choices = screen.getAllByRole('radio');
    expect(choices).toHaveLength(DEVICE_DRAWING_IDS.length);
    expect(choices.every((choice) => group.contains(choice))).toBe(true);
    expect([...choices.map(drawingOf)].sort()).toEqual([...DEVICE_DRAWING_IDS].sort());
    // buttons that do not send the form they are in
    expect(choices.every((choice) => choice.getAttribute('type') === 'button')).toBe(true);
  });

  it('shows them in the groups of the kit, each named, in the order of the kit', () => {
    render(<DrawingPicker label="Disegno" value="server" onChange={() => {}} />);

    const groups = within(screen.getByRole('radiogroup', { name: 'Disegno' })).getAllByRole('group');
    expect(groups.map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Rete',
      'Server',
      'Dati',
      'Dispositivi finali',
    ]);
    expect(groups.map((group) => within(group).getAllByRole('radio').map(drawingOf))).toEqual(
      DEVICE_DRAWING_GROUPS.map((entry) => [...entry.drawings])
    );
    expect(within(groups[0]).getAllByRole('radio').map(drawingOf)).toEqual([
      'router',
      'switch',
      'firewall',
      'access-point',
      'load-balancer',
      'cloud',
    ]);
  });

  it('names each drawing, as its title and for a screen reader, in the language of the interface', () => {
    render(<DrawingPicker label="Disegno" value="server" onChange={() => {}} />);

    const printer = screen.getByRole('radio', { name: 'Stampante' });
    expect(drawingOf(printer)).toBe('stampante');
    expect(printer.getAttribute('title')).toBe('Stampante');
    expect(drawingOf(screen.getByRole('radio', { name: 'Server web' }))).toBe('server-web');
    // no button is left without a name, and no two have the same
    const names = screen.getAllByRole('radio').map((choice) => choice.getAttribute('aria-label'));
    expect(names.every((name) => name && name.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);

    act(() => setLanguage('en'));
    expect(screen.getByRole('radio', { name: 'Printer' }).getAttribute('title')).toBe('Printer');
    expect(drawingOf(screen.getByRole('radio', { name: 'Web server' }))).toBe('server-web');
    expect(drawingOf(screen.getByRole('radio', { name: 'IP camera' }))).toBe('telecamera-ip');
    const groups = within(screen.getByRole('radiogroup')).getAllByRole('group');
    expect(groups.map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Network',
      'Servers',
      'Data',
      'End devices',
    ]);
  });

  it('marks the chosen one: said to who cannot see it, and drawn with its upper layer in the accent', () => {
    render(<DrawingPicker label="Disegno" value="nas" onChange={() => {}} />);

    const chosen = screen.getAllByRole('radio').filter((choice) => choice.getAttribute('aria-checked') === 'true');
    expect(chosen).toHaveLength(1);
    expect(chosen[0].getAttribute('aria-label')).toBe('NAS');
    expect(chosen[0].className).toContain('chosen');
    expect(chosen[0].querySelector('svg')?.getAttribute('class')).toContain('is-selected');
    // the others are at rest
    const others = screen.getAllByRole('radio').filter((choice) => choice !== chosen[0]);
    expect(others.every((choice) => choice.querySelector('svg')?.getAttribute('class')?.includes('is-rest'))).toBe(
      true
    );
  });

  it('tells which drawing was pressed', () => {
    const onChange = vi.fn();
    render(<DrawingPicker label="Disegno" value="server" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Firewall' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('firewall');
  });
});
