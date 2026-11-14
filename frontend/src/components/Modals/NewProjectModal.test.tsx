/**
 * NewProjectModal tests — the form creates the project in the browser:
 * name, description and network settings, one empty canvas, nothing to save.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { expectSpacedApart } from '@/test/formLayout';
import NewProjectModal from './NewProjectModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** The open project: "Sede Milano", two canvases, a device on screen, changed */
function openProjectWithDrawing() {
  createNewProject({ name: 'Sede Milano' });
  useProjectStore.getState().addCanvas('DMZ');
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label: 'PC-1',
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
}

describe('NewProjectModal', () => {
  beforeEach(() => {
    localStorage.clear();
    openProjectWithDrawing();
    useUIStore.setState(state => ({
      showWelcomeScreen: true,
      modals: { ...state.modals, newProject: true },
    }));
    vi.clearAllMocks();
  });

  it('creates the project with what the form says and closes', () => {
    render(<NewProjectModal />);

    type('Nome Progetto *', '  Sede Roma ');
    type('Descrizione', 'Nuova sede');
    type('Classe IP', '10.0.0.0');
    type('Subnet Mask', '255.0.0.0');
    type('Gateway', '10.0.0.1');
    fireEvent.click(screen.getByRole('button', { name: 'Crea Progetto' }));

    expect(useProjectStore.getState()).toMatchObject({
      name: 'Sede Roma',
      description: 'Nuova sede',
      activeCanvasId: 'canvas-1',
    });
    expect(useProjectStore.getState().canvases.map(c => c.name)).toEqual(['Canvas 1']);
    expect(useNetworkStore.getState()).toMatchObject({
      devices: [],
      connections: [],
      hasUnsavedChanges: false,
      globalNetworkSettings: {
        ipClass: '10.0.0.0',
        subnet: '255.0.0.0',
        gateway: '10.0.0.1',
        emailMode: 'auto',
      },
    });
    expect(useUIStore.getState().modals.newProject).toBe(false);
    // a new project starts on its empty canvas, not behind the welcome screen
    expect(useUIStore.getState().showWelcomeScreen).toBe(false);
    expect(toast.success as Mock).toHaveBeenCalledWith('Progetto "Sede Roma" creato');
  });

  it('asks for a name and changes nothing without one', () => {
    render(<NewProjectModal />);

    type('Nome Progetto *', '   ');
    fireEvent.click(screen.getByRole('button', { name: 'Crea Progetto' }));

    expect(screen.getByText(/Il nome del progetto è obbligatorio/)).toBeInTheDocument();
    expect(useUIStore.getState().modals.newProject).toBe(true);
    expect(useProjectStore.getState().name).toBe('Sede Milano');
    expect(useProjectStore.getState().canvases).toHaveLength(2);
    expect(useNetworkStore.getState().devices).toHaveLength(1);
  });

  it('"Annulla" closes the form and leaves the open project alone', () => {
    render(<NewProjectModal />);

    type('Nome Progetto *', 'Sede Roma');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(useUIStore.getState().modals.newProject).toBe(false);
    expect(useProjectStore.getState().name).toBe('Sede Milano');
    expect(useNetworkStore.getState().devices.map(d => d.label)).toEqual(['PC-1']);
    expect(useNetworkStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('no label is glued to the field above it, in either group of fields', () => {
    render(<NewProjectModal />);

    expectSpacedApart(
      ['Nome Progetto *', 'Descrizione'].map(label => screen.getByLabelText(label))
    );
    // the values of the network are short: low fields, two to a row, in a
    // grid that keeps them apart across and down
    const fields = ['Classe IP', 'Subnet Mask', 'Gateway', 'Server DNS (facoltativo)'].map(label =>
      screen.getByLabelText(label)
    );
    const row = fields[0].closest('.grid');
    expect(row).not.toBeNull();
    expect(row?.className).toContain('grid-cols-4');
    expect(row?.className).toContain('gap-x-3');
    expect(row?.className).toContain('gap-y-2');
    for (const field of fields) {
      expect(field.closest('.grid')).toBe(row);
      expect(field.parentElement?.parentElement).toBe(row);
      expect(field.parentElement?.className).toContain('col-span-2');
    }
    expect(screen.getByRole('group', { name: 'Impostazioni di Rete Globali' })).toContainElement(row as HTMLElement);
  });

  it('the DNS server of new devices can be given at once, and is kept trimmed', () => {
    render(<NewProjectModal />);

    type('Nome Progetto *', 'Sede Roma');
    type('Server DNS (facoltativo)', ' 192.168.1.53 ');
    fireEvent.click(screen.getByRole('button', { name: 'Crea Progetto' }));

    expect(useNetworkStore.getState().globalNetworkSettings).toEqual({
      ipClass: '192.168.1.0',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: '192.168.1.53',
      emailMode: 'auto',
    });
  });

  it('left empty, the new project has none: not even the one of the project it replaces', () => {
    useNetworkStore.getState().setGlobalNetworkSettings({ dns: '10.0.0.53' });
    render(<NewProjectModal />);
    expect(screen.getByLabelText<HTMLInputElement>('Server DNS (facoltativo)').value).toBe('');

    type('Nome Progetto *', 'Sede Roma');
    fireEvent.click(screen.getByRole('button', { name: 'Crea Progetto' }));

    expect('dns' in useNetworkStore.getState().globalNetworkSettings).toBe(false);
  });

  it('a DNS server that is not an address is refused, and nothing is created', () => {
    render(<NewProjectModal />);

    type('Nome Progetto *', 'Sede Roma');
    type('Server DNS (facoltativo)', 'srv-auth');
    fireEvent.click(screen.getByRole('button', { name: 'Crea Progetto' }));

    expect(screen.getByText(/Server DNS: "srv-auth" non è un indirizzo IPv4 valido/)).toBeInTheDocument();
    expect(useUIStore.getState().modals.newProject).toBe(true);
    expect(useProjectStore.getState().name).toBe('Sede Milano');
    expect(useNetworkStore.getState().devices).toHaveLength(1);
  });

  it('starts from the default network settings every time it opens', () => {
    render(<NewProjectModal />);

    expect(screen.getByLabelText<HTMLInputElement>('Nome Progetto *').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Classe IP').value).toBe('192.168.1.0');
    expect(screen.getByLabelText<HTMLInputElement>('Subnet Mask').value).toBe('255.255.255.0');
    expect(screen.getByLabelText<HTMLInputElement>('Gateway').value).toBe('192.168.1.1');
    expect(screen.getByLabelText<HTMLInputElement>('Server DNS (facoltativo)').value).toBe('');
  });
});
