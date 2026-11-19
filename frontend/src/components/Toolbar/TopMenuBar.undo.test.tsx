/**
 * Modifica → «Annulla» and «Ripeti»: each with its keys, disabled while there
 * is nothing to take back or to do again, and naming under the pointer what
 * it would take back or do again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { clearHistory } from '@/store/historyStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { setLanguage } from '@/i18n';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const pc = (label: string): Omit<NetworkDevice, 'id'> => ({
  type: 'PC',
  label,
  ip: '',
  subnet: '255.255.255.0',
  gateway: '',
  position: { x: 100, y: 100 },
});

const entry = (label: string) => {
  const item = screen.getByText(label, { selector: '.menu-entry-label' }).closest('li');
  if (!item) throw new Error(`no entry ${label}`);
  return item;
};

beforeEach(async () => {
  localStorage.clear();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Ufficio' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  clearHistory();
});

describe('Modifica → Annulla, Ripeti', () => {
  it('are disabled while there is nothing to undo or redo, and show their keys', () => {
    render(<TopMenuBar />);
    expect(entry('Annulla')).toHaveClass('disabled');
    expect(entry('Ripeti')).toHaveClass('disabled');
    expect(entry('Annulla')).toHaveTextContent('Ctrl+Z');
    expect(entry('Ripeti')).toHaveTextContent('Ctrl+Y');
  });

  it('take back the last step and do it again, naming it under the pointer', async () => {
    render(<TopMenuBar />);
    act(() => {
      useNetworkStore.getState().addDevice(pc('PC-1'));
    });
    await settle();

    expect(entry('Annulla')).not.toHaveClass('disabled');
    expect(entry('Annulla')).toHaveAttribute('title', 'Annulla: aggiungi «PC-1»');
    fireEvent.click(entry('Annulla'));
    expect(useNetworkStore.getState().devices).toEqual([]);
    expect(entry('Annulla')).toHaveClass('disabled');

    expect(entry('Ripeti')).toHaveAttribute('title', 'Ripeti: aggiungi «PC-1»');
    fireEvent.click(entry('Ripeti'));
    expect(useNetworkStore.getState().devices.map((device) => device.label)).toEqual(['PC-1']);
    expect(entry('Ripeti')).toHaveClass('disabled');
  });

  it('say it in English too', async () => {
    render(<TopMenuBar />);
    act(() => setLanguage('en'));
    act(() => {
      useNetworkStore.getState().addDevice(pc('PC-1'));
    });
    await settle();
    expect(entry('Undo')).toHaveAttribute('title', 'Undo: add “PC-1”');
    expect(entry('Redo')).toHaveClass('disabled');
  });

  it('show the keys of a Mac on a Mac', () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
    try {
      render(<TopMenuBar />);
      expect(entry('Annulla')).toHaveTextContent('⌘Z');
      expect(entry('Ripeti')).toHaveTextContent('⇧⌘Z');
    } finally {
      platform.mockRestore();
    }
  });
});
