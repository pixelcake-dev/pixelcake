/**
 * Context menu tests — the right-click menus of a device and of a
 * connection offer only entries that do something: the ones that were
 * permanently disabled are gone.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NetworkConnection, NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import ContextMenu from './ContextMenu';
import { answerConfirms, settled } from '@/test/confirm';
import ConnectionContextMenu from './ConnectionContextMenu';

function addPc(label: string): NetworkDevice {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
  return useNetworkStore.getState().devices.at(-1)!;
}

function entries(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('li')).map(li => li.textContent ?? '');
}

describe('context menus', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useUIStore.getState().closeContextMenu();
    useUIStore.setState(state => ({
      terminalContextDevice: null,
      inspectorDevice: null,
      inspectorConnection: null,
      modals: {
        ...state.modals,
        inspector: false,
        codeTerminal: false,
        connectionInspector: false,
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('of a device', () => {
    function openOn(label: string) {
      const device = addPc(label);
      useUIStore.getState().setContextMenuDevice(device, 40, 60);
      return { device, ...render(<ContextMenu />) };
    }

    it('offers details, console, an area around it and delete, and nothing switched off', () => {
      const { container } = openOn('PC-1');

      expect(entries(container)).toEqual([
        'Dettagli (Modifica)',
        'Console',
        'Racchiudi in un riquadro',
        'Elimina',
      ]);
      expect(container.querySelector('li.disabled')).toBeNull();
      expect(screen.queryByText('Configurazione...')).toBeNull();
    });

    it('"Dettagli (Modifica)" opens the inspector on the device', () => {
      const { device } = openOn('PC-1');

      fireEvent.click(screen.getByText('Dettagli (Modifica)'));

      expect(useUIStore.getState().modals.inspector).toBe(true);
      expect(useUIStore.getState().inspectorDevice).toEqual(device);
      expect(useUIStore.getState().contextMenuDevice).toBeNull();
    });

    it('"Console" opens the terminal on the device', () => {
      openOn('PC-1');

      fireEvent.click(screen.getByText('Console'));

      expect(useUIStore.getState().modals.codeTerminal).toBe(true);
      expect(useUIStore.getState().terminalContextDevice).toBe('PC-1');
    });

    it('"Elimina" removes the device once confirmed', async () => {
      const confirms = answerConfirms(true);
      openOn('PC-1');

      fireEvent.click(screen.getByText('Elimina'));
      await settled();

      expect(confirms.asked).toHaveLength(1);
      expect(confirms.asked[0]).toMatchObject({ title: 'Eliminare «PC-1»?', confirmLabel: 'Elimina', danger: true });
      expect(useNetworkStore.getState().devices).toEqual([]);
    });

    it('"Elimina" leaves the device where it is on a no, and the menu is gone either way', async () => {
      answerConfirms(false);
      openOn('PC-1');

      fireEvent.click(screen.getByText('Elimina'));
      await settled();

      expect(useNetworkStore.getState().devices).toHaveLength(1);
      expect(useUIStore.getState().contextMenuDevice).toBeNull();
    });
  });

  describe('of a connection', () => {
    function openOnLink() {
      const a = addPc('PC-1');
      const b = addPc('PC-2');
      useNetworkStore.getState().addConnection({ source: a.id, target: b.id });
      const connection: NetworkConnection = useNetworkStore.getState().connections[0];
      useUIStore.getState().setContextMenuConnection(connection, 40, 60);
      return { connection, ...render(<ConnectionContextMenu />) };
    }

    it('offers edit and delete, and nothing switched off', () => {
      const { container } = openOnLink();

      expect(entries(container)).toEqual(['Modifica Connessione', 'Elimina Connessione']);
      expect(container.querySelector('li.disabled')).toBeNull();
      expect(screen.queryByText('Evidenzia Percorso')).toBeNull();
    });

    it('"Modifica Connessione" opens the connection inspector on the link', () => {
      const { connection } = openOnLink();

      fireEvent.click(screen.getByText('Modifica Connessione'));

      expect(useUIStore.getState().modals.connectionInspector).toBe(true);
      expect(useUIStore.getState().inspectorConnection).toEqual(connection);
    });

    it('"Elimina Connessione" removes the link once confirmed', async () => {
      answerConfirms(true);
      openOnLink();

      fireEvent.click(screen.getByText('Elimina Connessione'));
      await settled();

      expect(useNetworkStore.getState().connections).toEqual([]);
      expect(useNetworkStore.getState().devices).toHaveLength(2);
    });
  });
});
