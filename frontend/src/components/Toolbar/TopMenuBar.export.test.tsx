/**
 * TopMenuBar — File → Esporta immagine…: the way to the picture of the
 * drawing from the menus.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const ui = () => useUIStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  ui().closeModal('exportImage');
  createNewProject({ name: 'Sede Milano' });
});

describe('TopMenuBar — File → Esporta immagine…', () => {
  it('opens the dialog when there is a drawing, and changes nothing of the project', () => {
    network().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });
    network().markSaved();
    const before = JSON.stringify(network().devices);
    render(<TopMenuBar />);

    fireEvent.click(screen.getByText('Esporta immagine…'));

    expect(ui().modals.exportImage).toBe(true);
    expect(toast.info).not.toHaveBeenCalled();
    expect(JSON.stringify(network().devices)).toBe(before);
    expect(network().hasUnsavedChanges).toBe(false);
  });

  it('on an empty canvas says there is nothing to export, and opens nothing', () => {
    render(<TopMenuBar />);

    fireEvent.click(screen.getByText('Esporta immagine…'));

    expect(ui().modals.exportImage).toBe(false);
    expect(toast.info).toHaveBeenCalledWith("Il canvas è vuoto: non c'è nulla da esportare");
  });

  it('sits in the File menu, after the entries that save the project', () => {
    render(<TopMenuBar />);
    const entry = screen.getByText('Esporta immagine…');
    const list = entry.parentElement!;
    expect(list.closest('.menu-item')?.querySelector('span')?.textContent).toBe('File');
    const tags = Array.from(list.children).map((child) =>
      child.tagName === 'HR' ? '—' : child.textContent
    );
    expect(tags.slice(-3)).toEqual(['Salva con nome…', '—', 'Esporta immagine…']);
  });
});
