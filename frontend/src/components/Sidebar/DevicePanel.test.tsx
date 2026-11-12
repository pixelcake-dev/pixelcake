/**
 * DevicePanel tests — the sample networks of the "Topologie" tab, and the
 * custom templates in the device list (they could be created, never placed).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useUIStore } from '@/store/uiStore';
import DevicePanel from './DevicePanel';

const labels = () => useNetworkStore.getState().devices.map(d => d.label);

function openSamples() {
  render(<DevicePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Topologie' }));
}

beforeEach(() => {
  localStorage.clear();
  useNetworkStore.getState().clearAllDevices();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DevicePanel — sample networks', () => {
  it('offers the simple office, the site with VLANs, DMZ and firewall, and the two sites with a backup line', () => {
    openSamples();
    expect(screen.getByRole('button', { name: /Ufficio: due reti e un router/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Due sedi: linea principale e di riserva/ })
    ).toBeInTheDocument();
  });

  it('loads the two sites: every device, every cable, each cable on its port', () => {
    openSamples();

    fireEvent.click(screen.getByRole('button', { name: /Due sedi: linea principale e di riserva/ }));

    expect(labels()).toHaveLength(12);
    expect(labels()).toContain('R-Riserva');
    const { connections } = useNetworkStore.getState();
    expect(connections).toHaveLength(13);
    for (const connection of connections) {
      expect(connection.sourcePort ?? connection.sourceNic, connection.id).toBeDefined();
      expect(connection.targetPort ?? connection.targetNic, connection.id).toBeDefined();
    }
  });

  it('loads each one on an empty canvas without asking', () => {
    const confirm = vi.spyOn(window, 'confirm');
    openSamples();

    fireEvent.click(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ }));
    expect(labels()).toContain('FW-Edge');
    expect(labels()).toHaveLength(10);
    expect(useNetworkStore.getState().connections).toHaveLength(10);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before replacing a drawing, and leaves it alone on "no"', () => {
    openSamples();
    fireEvent.click(screen.getByRole('button', { name: /Ufficio: due reti e un router/ }));
    expect(labels()).toContain('Router-1');

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(labels()).toContain('Router-1');
    expect(labels()).not.toContain('FW-Edge');

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ }));
    expect(labels()).toContain('FW-Edge');
    expect(labels()).not.toContain('Router-1');
  });
});

describe('DevicePanel — custom templates', () => {
  it('lists a custom template with the built-in ones, and starts adding a device of it', () => {
    useTemplateStore.getState().addTemplate({
      name: 'Centralino',
      type: 'Server',
      icon: 'mdi:server',
      color: '#5B7C8D',
      isCustom: true,
      supportsVLAN: false,
      supportsSTP: false,
      supportsPorts: false,
      supportsNICs: true,
    });
    const custom = useTemplateStore.getState().templates.find(t => t.name === 'Centralino');

    render(<DevicePanel />);
    fireEvent.click(screen.getByText('Centralino'));

    expect(useUIStore.getState().modals.addDevice).toBe(true);
    expect(useUIStore.getState().addDeviceTemplateId).toBe(custom?.id);
    useUIStore.getState().closeModal('addDevice');
    if (custom) useTemplateStore.getState().deleteTemplate(custom.id);
  });
});
