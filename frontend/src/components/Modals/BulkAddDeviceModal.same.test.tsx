/**
 * A device made in bulk is the device the window that adds one makes from
 * the same template: its name and its counter, the address it is proposed,
 * its card, the DNS server of the project on the card of an end device.
 *
 * Both windows are the real ones: each makes its device, and the two are
 * compared.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { isValidMAC } from '@/utils/ipHelpers';
import type { DeviceTemplate, NetworkDevice } from '@/types/network';
import {
  PROJECT_DNS,
  addButton,
  addConfigurable,
  emptyCanvas,
  more,
  openBulkWindow,
  quantityField,
} from '@/test/bulkAddWindow';
import AddDeviceModal from './AddDeviceModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const devices = () => useNetworkStore.getState().devices;
const templates = () => useTemplateStore.getState().templates;
const templateOf = (device: NetworkDevice) => templates().find((t) => t.id === device.templateId);
/** A template the app comes with, by the name its row shows */
const named = (name: string) => templates().find((t) => t.name === name && !t.isCustom)!;

/** One device of a template made with the window that adds one, opened as the panel opens it */
function madeAlone(template: DeviceTemplate): NetworkDevice {
  useUIStore.getState().setAddDeviceType(template.type, template.id);
  useUIStore.getState().openModal('addDevice');
  const view = render(<AddDeviceModal />);
  // (the second of its two buttons adds)
  fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.modal-actions button')[1]);
  view.unmount();
  return devices()[devices().length - 1];
}

/** One device of a template made with the window that adds in bulk */
function madeInBulk(template: DeviceTemplate): NetworkDevice {
  const view = openBulkWindow();
  if (template.supportsPorts) {
    fireEvent.change(quantityField(addConfigurable(template.name)), { target: { value: '1' } });
  } else {
    fireEvent.click(more(template.name));
  }
  fireEvent.click(addButton());
  view.unmount();
  return devices()[devices().length - 1];
}

/**
 * What two devices are compared by. Left out: the id and the place, which
 * are of each device; the MAC address of a card, drawn at random; an empty
 * «Vendor» or «Posizione», which the window that adds one leaves from its
 * form on what is not a PC.
 */
function comparable(device: NetworkDevice): Partial<NetworkDevice> {
  const copy: Partial<NetworkDevice> = {
    ...device,
    nics: device.nics?.map((card) => ({ ...card, mac: undefined })),
  };
  delete copy.id;
  delete copy.position;
  if (!copy.vendor) delete copy.vendor;
  if (!copy.location) delete copy.location;
  return copy;
}

const addOnCanvas = (type: string, label: string, ip: string) =>
  useNetworkStore.getState().addDevice({
    type,
    label,
    ip,
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
  });

beforeEach(() => {
  localStorage.clear();
  useTemplateStore.getState().loadDefaultTemplates();
  emptyCanvas();
  useUIStore.getState().closeModal('bulkAddDevice');
  useUIStore.getState().closeModal('addDevice');
});

describe('bulk add — the same device the window that adds one makes', () => {
  // (listed here and not read from the store: each test is told by the name of its template)
  it.each([
    'PC',
    'Server',
    'Access Point',
    'Load Balancer',
    'Database',
    'Cloud',
    'Mail Server',
    'VPS',
    'Web Server',
    'Proxy Server',
    'Storage S3',
    'NAS',
    'DNS Server',
    'DHCP Server',
    'IoT Gateway',
    'IP Camera',
    'Printer',
  ])('«%s»: type, template, name, addresses, card and DNS server are the same', (name) => {
    const alone = madeAlone(named(name));
    emptyCanvas();
    const inBulk = madeInBulk(named(name));

    expect(comparable(inBulk)).toEqual(comparable(alone));
    // (a card of its own, with a MAC address of its own)
    expect(isValidMAC(inBulk.nics?.[0].mac ?? '')).toBe(true);
    expect(inBulk.nics?.[0].mac).not.toBe(alone.nics?.[0].mac);
  });

  it.each(['Switch', 'Router', 'Firewall'])('«%s»: the same but for what is written on its ports', (name) => {
    const alone = madeAlone(named(name));
    emptyCanvas();
    const inBulk = madeInBulk(named(name));

    const { ports: portsAlone, ...restAlone } = comparable(alone);
    const { ports: portsInBulk, ...restInBulk } = comparable(inBulk);
    expect(restInBulk).toEqual(restAlone);
    expect(portsInBulk).toHaveLength(portsAlone?.length ?? -1);
  });
});

describe('bulk add — the names, as the window that adds one gives them', () => {
  it('the name of the template, and how many of its type are there: those on the canvas and those just made', () => {
    addOnCanvas('Server', 'Srv-A', '10.0.0.1');
    addOnCanvas('Server', 'Srv-B', '10.0.0.2');
    addOnCanvas('PC', 'PC-A', '10.0.0.3');

    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('DNS Server'));
    fireEvent.click(more('Printer'));
    fireEvent.click(more('IP Camera'));
    fireEvent.change(quantityField(addConfigurable('Switch')), { target: { value: '3' } });
    fireEvent.click(addButton());

    expect(devices().slice(3).map((d) => d.label)).toEqual([
      'Switch-0',
      'Switch-1',
      'Switch-2',
      'Web-Server-2',
      'Web-Server-3',
      'DNS-Server-4',
      'IP-Camera-1',
      'Printer-2',
    ]);
    // the next one made alone goes on from there
    expect(madeAlone(named('Mail Server')).label).toBe('Mail-Server-5');
  });

  it('each has an id of its own, one after the other', () => {
    addOnCanvas('PC', 'PC-A', '10.0.0.3');
    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Printer'));
    fireEvent.click(addButton());
    madeAlone(named('PC'));

    const ids = devices().map((d) => Number(d.id.replace('dev-', '')));
    expect(ids).toHaveLength(5);
    expect(ids).toEqual(ids.map((_, index) => ids[0] + index));
  });
});

describe('bulk add — the addresses, as the window that adds one proposes them', () => {
  it('each takes the next free address of the network of the project', () => {
    // (the network of the project is told by its own field, not by its gateway)
    useNetworkStore.getState().setGlobalNetworkSettings({ ipClass: '10.20.30.0', gateway: '10.20.99.1' });
    addOnCanvas('PC', 'PC-A', '10.20.30.2');
    expect(madeAlone(named('PC')).ip).toBe('10.20.30.3');

    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Printer'));
    fireEvent.change(quantityField(addConfigurable('Switch')), { target: { value: '2' } });
    fireEvent.click(addButton());

    // one after the other: none takes the address of one made a moment before
    expect(devices().slice(2).map((d) => [templateOf(d)?.name, d.ip, d.nics?.[0].ip, d.gateway])).toEqual([
      ['Switch', '10.20.30.4', undefined, '10.20.99.1'],
      ['Switch', '10.20.30.5', undefined, '10.20.99.1'],
      ['Web Server', '10.20.30.6', '10.20.30.6', '10.20.99.1'],
      ['Printer', '10.20.30.7', '10.20.30.7', '10.20.99.1'],
    ]);
  });
});

describe('bulk add — the card of a standard device', () => {
  it('is the one the window that adds one starts from: nothing is written on it that nobody typed', () => {
    openBulkWindow();
    fireEvent.click(more('PC'));
    fireEvent.click(addButton());

    const card = devices()[0].nics![0];
    expect(Object.keys(card).sort()).toEqual(
      ['dns', 'enabled', 'gateway', 'id', 'ip', 'mac', 'name', 'speed', 'subnet'].sort()
    );
    expect(card).toMatchObject({
      id: 'nic-1',
      name: 'eth0',
      enabled: true,
      speed: 'auto',
      ip: '192.168.1.2',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: PROJECT_DNS,
    });
  });

  it('names the DNS server of the project on an end device, whatever its template, and on no other', () => {
    openBulkWindow();
    for (const name of ['Printer', 'IP Camera', 'DNS Server', 'NAS', 'IoT Gateway', 'Access Point', 'Load Balancer', 'Cloud']) {
      fireEvent.click(more(name));
    }
    fireEvent.click(addButton());

    expect(Object.fromEntries(devices().map((d) => [templateOf(d)?.name, d.nics?.[0].dns]))).toEqual({
      Printer: PROJECT_DNS,
      'IP Camera': PROJECT_DNS,
      'DNS Server': PROJECT_DNS,
      NAS: PROJECT_DNS,
      'IoT Gateway': undefined,
      'Access Point': undefined,
      'Load Balancer': undefined,
      Cloud: undefined,
    });
  });
});
