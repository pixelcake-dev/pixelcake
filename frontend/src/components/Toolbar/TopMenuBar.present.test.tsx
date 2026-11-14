/**
 * TopMenuBar — the two ways into presentation mode: the button on the bar
 * and the entry of the Vista menu.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const presentation = () => usePresentationStore.getState();

function addPc(label: string) {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
}

beforeEach(() => {
  vi.mocked(toast.info).mockClear();
  localStorage.clear();
  presentation().exit();
  createNewProject({ name: 'Sede Milano' });
});

describe('TopMenuBar — presentation mode', () => {
  it('"Presenta" enters presentation mode when there is a drawing', () => {
    addPc('PC-1');
    render(<TopMenuBar />);

    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));

    expect(presentation().active).toBe(true);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('on an empty canvas it says there is nothing to present, and stays where it is', () => {
    render(<TopMenuBar />);

    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));

    expect(presentation().active).toBe(false);
    expect(toast.info).toHaveBeenCalledWith("Il canvas è vuoto: non c'è nulla da presentare");
  });

  it('Vista → Modalità presentazione does the same', () => {
    addPc('PC-1');
    render(<TopMenuBar />);

    fireEvent.click(screen.getByText('Modalità presentazione'));

    expect(presentation().active).toBe(true);
  });

  it('entering does not count as a change to the drawing', () => {
    addPc('PC-1');
    useNetworkStore.getState().markSaved();
    render(<TopMenuBar />);

    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));

    expect(useNetworkStore.getState().hasUnsavedChanges).toBe(false);
  });
});
