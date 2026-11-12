/**
 * PresentationMenu — the small menu a click on a device or on a cable opens.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import PresentationMenu from './PresentationMenu';

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

const id = (label: string) => {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

const cable = (a: string, b: string) => {
  const [first, second] = [id(a), id(b)];
  const found = network().connections.find(
    c => (c.source === first && c.target === second) || (c.source === second && c.target === first)
  );
  if (!found) throw new Error(`no cable between "${a}" and "${b}"`);
  return found.id;
};

function openOn(label: string) {
  act(() => presentation().openMenu({ kind: 'device', id: id(label), x: 100, y: 120 }));
}

function openOnCable(a: string, b: string) {
  act(() => presentation().openMenu({ kind: 'connection', id: cable(a, b), x: 100, y: 120 }));
}

const items = () => screen.getAllByRole('menuitem').map(item => item.textContent?.trim());

beforeEach(() => {
  localStorage.clear();
  presentation().exit();
  const sample = createRedundancySample();
  network().clearAllDevices();
  network().loadTopology(sample.devices, sample.connections);
  presentation().enter();
});

describe('PresentationMenu', () => {
  it('shows nothing until something is clicked', () => {
    render(<PresentationMenu />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('on a device: what it is, and the three things to do with it', () => {
    render(<PresentationMenu />);
    openOn('SW-Core');

    const menu = screen.getByRole('menu', { name: 'SW-Core' });
    expect(menu).toHaveTextContent('Switch · 192.168.1.2');
    expect(items()).toEqual(['Parti da qui', 'Arriva qui', 'Simula un guasto']);
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('120px');
  });

  it('"Parti da qui" and "Arriva qui" set the two ends and close the menu', () => {
    render(<PresentationMenu />);

    openOn('PC-Sede-1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Parti da qui' }));
    expect(presentation()).toMatchObject({ sourceId: id('PC-Sede-1'), menu: null });
    expect(screen.queryByRole('menu')).toBeNull();

    openOn('Srv-File');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arriva qui' }));
    expect(presentation()).toMatchObject({ sourceId: id('PC-Sede-1'), targetId: id('Srv-File'), menu: null });
  });

  it('does not offer a device the end it already is; the other end turns the question round', () => {
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    render(<PresentationMenu />);

    openOn('PC-Sede-1');
    expect(screen.getByRole('menuitem', { name: 'Parti da qui' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Arriva qui' })).toBeEnabled();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Arriva qui' }));
    expect(presentation()).toMatchObject({ sourceId: id('Srv-File'), targetId: id('PC-Sede-1') });
  });

  it('breaks a device, then offers to repair it', () => {
    render(<PresentationMenu />);

    openOn('SW-Core');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Simula un guasto' }));
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
    expect(presentation().menu).toBeNull();

    openOn('SW-Core');
    expect(items()).toEqual(['Parti da qui', 'Arriva qui', 'Ripara']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ripara' }));
    expect(presentation().failedDevices).toEqual([]);
  });

  it('on a cable: the two devices it joins, what it carries, and one thing to do', () => {
    render(<PresentationMenu />);
    openOnCable('R-Sede', 'R-Filiale');

    const menu = screen.getByRole('menu', { name: 'Cavo R-Sede – R-Filiale' });
    expect(menu).toHaveTextContent('Linea principale · 1 Gbps');
    expect(items()).toEqual(['Simula un guasto']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Simula un guasto' }));
    expect(presentation().failedConnections).toEqual([cable('R-Sede', 'R-Filiale')]);

    openOnCable('R-Sede', 'R-Filiale');
    expect(items()).toEqual(['Ripara il cavo']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ripara il cavo' }));
    expect(presentation().failedConnections).toEqual([]);
  });

  it('never changes the drawing', () => {
    const before = JSON.stringify([network().devices, network().connections]);
    render(<PresentationMenu />);

    openOn('SW-Core');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Simula un guasto' }));
    openOnCable('R-Sede', 'R-Filiale');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Simula un guasto' }));
    openOn('PC-Sede-1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Parti da qui' }));

    expect(JSON.stringify([network().devices, network().connections])).toBe(before);
  });

  it('closes on a press anywhere else, and stays open on a press inside', () => {
    render(<PresentationMenu />);
    openOn('SW-Core');

    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(presentation().menu).not.toBeNull();

    fireEvent.mouseDown(document.body);
    expect(presentation().menu).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows nothing for a device or a cable that is no longer there', () => {
    render(<PresentationMenu />);
    act(() => presentation().openMenu({ kind: 'device', id: 'gone', x: 1, y: 1 }));
    expect(screen.queryByRole('menu')).toBeNull();
    act(() => presentation().openMenu({ kind: 'connection', id: 'gone', x: 1, y: 1 }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
