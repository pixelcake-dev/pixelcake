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
  it('offers the company first, then the simple office, the site with VLANs, DMZ and firewall, and the two sites with a backup line', () => {
    openSamples();
    const offered = screen
      .getAllByRole('button')
      .map(button => button.textContent ?? '')
      .filter(text => /^(Azienda|Ufficio|Sede|Due sedi):/.test(text));
    expect(offered.map(text => text.split(':')[0])).toEqual(['Azienda', 'Ufficio', 'Sede', 'Due sedi']);
    expect(screen.getByRole('button', { name: /Azienda: uffici, Wi-Fi, server e DMZ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ufficio: due reti e un router/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Due sedi: linea principale e di riserva/ })
    ).toBeInTheDocument();
  });

  it('loads the company: every device, every cable on its interface, the whole of it asked into view', () => {
    openSamples();
    const fitsAsked = useNetworkStore.getState().fitViewRequest;

    fireEvent.click(screen.getByRole('button', { name: /Azienda: uffici, Wi-Fi, server e DMZ/ }));

    expect(labels()).toHaveLength(20);
    for (const label of ['FW-Edge', 'Router-Core', 'SW-Uffici', 'AP-Uffici', 'Portatile-1', 'Srv-Auth', 'DB-Gestionale']) {
      expect(labels()).toContain(label);
    }
    const { connections } = useNetworkStore.getState();
    expect(connections).toHaveLength(20);
    for (const connection of connections) {
      expect(connection.sourcePort ?? connection.sourceNic, connection.id).toBeDefined();
      expect(connection.targetPort ?? connection.targetNic, connection.id).toBeDefined();
    }
    expect(useNetworkStore.getState().fitViewRequest).toBe(fitsAsked + 1);
  });

  it('every sample is asked into view when it is loaded', () => {
    openSamples();
    for (const name of [/Ufficio: due reti/, /Sede: VLAN/, /Due sedi:/]) {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fitsAsked = useNetworkStore.getState().fitViewRequest;
      fireEvent.click(screen.getByRole('button', { name }));
      expect(useNetworkStore.getState().fitViewRequest, String(name)).toBe(fitsAsked + 1);
    }
  });

  it('a sample that is not loaded, because the answer was no, moves nothing', () => {
    openSamples();
    fireEvent.click(screen.getByRole('button', { name: /Ufficio: due reti/ }));
    const fitsAsked = useNetworkStore.getState().fitViewRequest;
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: /Azienda: uffici/ }));

    expect(labels()).toContain('Router-1');
    expect(useNetworkStore.getState().fitViewRequest).toBe(fitsAsked);
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

describe('DevicePanel — its title', () => {
  it('is the one of the panel it is in: the panel does not repeat it', () => {
    const { container } = render(<DevicePanel />);

    expect(container.querySelector('.sidebar-section-title')).toBeNull();
    expect(screen.queryByText(/^aggiungi$/i)).toBeNull();
  });
});
