/**
 * The drawing of a template is chosen among those the app has: one button
 * for each, named after the device the app shows with it, one of them
 * chosen.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEVICE_DRAWING_IDS } from '@/data/deviceDrawings';
import { useTemplateStore } from '@/store/templateStore';
import DrawingPicker from './DrawingPicker';

beforeEach(() => {
  localStorage.clear();
  useTemplateStore.getState().loadDefaultTemplates();
});

describe('DrawingPicker', () => {
  it('offers every drawing of the app, each once, as one choice among them', () => {
    render(<DrawingPicker label="Disegno" value="server" onChange={() => {}} />);

    const group = screen.getByRole('radiogroup', { name: 'Disegno' });
    const choices = screen.getAllByRole('radio');
    expect(choices).toHaveLength(DEVICE_DRAWING_IDS.length);
    expect(choices.every((choice) => group.contains(choice))).toBe(true);
    expect(choices.map((choice) => choice.querySelector('svg')?.getAttribute('data-drawing'))).toEqual(
      DEVICE_DRAWING_IDS
    );
    // buttons that do not send the form they are in
    expect(choices.every((choice) => choice.getAttribute('type') === 'button')).toBe(true);
  });

  it('names each drawing after the device the app shows with it', () => {
    render(<DrawingPicker label="Disegno" value="server" onChange={() => {}} />);

    expect(screen.getByRole('radio', { name: 'Web Server' }).querySelector('svg')?.getAttribute('data-drawing')).toBe(
      'server-web'
    );
    expect(screen.getByRole('radio', { name: 'Printer' }).querySelector('svg')?.getAttribute('data-drawing')).toBe(
      'stampante'
    );
    expect(screen.getByRole('radio', { name: 'Router' }).getAttribute('title')).toBe('Router');
    // no button is left without a name
    expect(screen.getAllByRole('radio').filter((choice) => !choice.getAttribute('aria-label'))).toEqual([]);
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
