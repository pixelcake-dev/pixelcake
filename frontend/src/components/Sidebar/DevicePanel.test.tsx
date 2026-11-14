/**
 * DevicePanel tests — the sample networks of the "Esempi" tab, and the
 * custom templates in the device list (they could be created, never placed).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useUIStore } from '@/store/uiStore';
import { answerConfirms, settled } from '@/test/confirm';
import DevicePanel from './DevicePanel';

const labels = () => useNetworkStore.getState().devices.map(d => d.label);

function openSamples() {
  render(<DevicePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
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

  it('every sample is asked into view when it is loaded', async () => {
    openSamples();
    answerConfirms(true);
    for (const name of [/Ufficio: due reti/, /Sede: VLAN/, /Due sedi:/]) {
      const fitsAsked = useNetworkStore.getState().fitViewRequest;
      fireEvent.click(screen.getByRole('button', { name }));
      await settled();
      expect(useNetworkStore.getState().fitViewRequest, String(name)).toBe(fitsAsked + 1);
    }
  });

  it('a sample that is not loaded, because the answer was no, moves nothing', async () => {
    openSamples();
    fireEvent.click(screen.getByRole('button', { name: /Ufficio: due reti/ }));
    await settled();
    const fitsAsked = useNetworkStore.getState().fitViewRequest;
    const confirms = answerConfirms(false);

    fireEvent.click(screen.getByRole('button', { name: /Azienda: uffici/ }));
    await settled();

    expect(confirms.asked).toHaveLength(1);

    expect(labels()).toContain('Router-1');
    expect(useNetworkStore.getState().fitViewRequest).toBe(fitsAsked);
  });

  it('loads the two sites: every device, every cable, each cable on its port', async () => {
    openSamples();

    fireEvent.click(screen.getByRole('button', { name: /Due sedi: linea principale e di riserva/ }));
    await settled();

    expect(labels()).toHaveLength(12);
    expect(labels()).toContain('R-Riserva');
    const { connections } = useNetworkStore.getState();
    expect(connections).toHaveLength(13);
    for (const connection of connections) {
      expect(connection.sourcePort ?? connection.sourceNic, connection.id).toBeDefined();
      expect(connection.targetPort ?? connection.targetNic, connection.id).toBeDefined();
    }
  });

  it('loads each one on an empty canvas without asking', async () => {
    const confirms = answerConfirms(false);
    openSamples();

    fireEvent.click(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ }));
    await settled();
    expect(labels()).toContain('FW-Edge');
    expect(labels()).toHaveLength(10);
    expect(useNetworkStore.getState().connections).toHaveLength(10);
    expect(confirms.asked).toEqual([]);
  });

  it('a sample brings the network settings of its project: a new device starts on its network', async () => {
    // a project set for another network, with a VLAN of its own
    useNetworkStore.getState().setGlobalNetworkSettings({
      ipClass: '192.168.1.0',
      gateway: '192.168.1.1',
      dns: undefined,
      vlans: [{ id: 99, name: 'Magazzino' }],
    });
    openSamples();
    answerConfirms(true);

    fireEvent.click(screen.getByRole('button', { name: /Azienda: uffici, Wi-Fi, server e DMZ/ }));
    await settled();
    const company = useNetworkStore.getState().globalNetworkSettings;
    expect(company).toMatchObject({ ipClass: '192.168.10.0', gateway: '192.168.10.1', dns: '192.168.30.10' });
    expect(company.vlans).toEqual([
      { id: 1, name: 'Predefinita' },
      { id: 10, name: 'Uffici' },
      { id: 20, name: 'Wi-Fi' },
      { id: 30, name: 'Server' },
    ]);
    expect(useNetworkStore.getState().findNextAvailableIP()).toBe('192.168.10.2');

    // another sample: its own, and nothing left of the one before (no DNS server, no VLAN)
    fireEvent.click(screen.getByRole('button', { name: /Due sedi:/ }));
    await settled();
    const twoSites = useNetworkStore.getState().globalNetworkSettings;
    expect(twoSites).toMatchObject({ ipClass: '192.168.1.0', gateway: '192.168.1.1' });
    expect(twoSites.dns).toBeUndefined();
    expect(twoSites.vlans).toBeUndefined();
    expect(useNetworkStore.getState().findNextAvailableIP()).toBe('192.168.1.5');
  });

  it('asks before replacing a drawing, and leaves it alone on "no"', async () => {
    openSamples();
    fireEvent.click(screen.getByRole('button', { name: /Ufficio: due reti e un router/ }));
    await settled();
    expect(labels()).toContain('Router-1');

    const confirms = answerConfirms(false);
    fireEvent.click(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ }));
    await settled();
    expect(confirms.asked).toHaveLength(1);
    // the question says what a yes does, and its button names the action
    expect(confirms.asked[0].title).toBe('Caricare la rete di esempio?');
    expect(confirms.asked[0].detail).toContain('Prende il posto');
    // (the settings of the project go with the drawing: the question says so)
    expect(confirms.asked[0].detail).toContain('le impostazioni di rete del progetto diventano le sue');
    expect(useNetworkStore.getState().globalNetworkSettings.vlans).toBeUndefined();
    expect(confirms.asked[0].confirmLabel).toBe('Carica');
    expect(labels()).toContain('Router-1');
    expect(labels()).not.toContain('FW-Edge');

    confirms.say(true);
    fireEvent.click(screen.getByRole('button', { name: /Sede: VLAN, DMZ e firewall/ }));
    await settled();
    expect(labels()).toContain('FW-Edge');
    expect(labels()).not.toContain('Router-1');
  });
});

describe('DevicePanel — what each device is', () => {
  it('a template says what it is under its name, not what it is built on', () => {
    render(<DevicePanel />);
    const row = (name: string) => screen.getByText(name).closest('.device-list-item');
    expect(row('IoT Gateway')).toHaveTextContent('Collega sensori e dispositivi IoT alla rete');
    expect(row('Access Point')).toHaveTextContent('Punto di accesso Wi-Fi');
    expect(row('Printer')).toHaveTextContent('Stampante di rete');
    expect(row('DNS Server')).toHaveTextContent('Traduce i nomi in indirizzi');
    // (none is left with the words of another)
    const said = Array.from(document.querySelectorAll('.device-list-description')).map(node => node.textContent);
    expect(said).toHaveLength(20);
    expect(new Set(said).size).toBe(20);
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
