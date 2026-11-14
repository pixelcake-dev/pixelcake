/**
 * A device made in bulk is the device the window that adds one makes from
 * the same template: its name, the address it is proposed, its card, the DNS
 * server of the project on the card of an end device.
 *
 * The name is the name of the template and a number: the lowest, from 1,
 * that leaves the name free on the canvas, whatever the case.
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
import { createSampleTopology } from '@/utils/sampleTopology';
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

// The templates the app comes with, by the names their rows show (listed here
// and not read from the store: each test is told by the name of its template)
const WITH_A_CARD = [
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
];
const WITH_PORTS = ['Switch', 'Router', 'Firewall'];
const EVERY_TEMPLATE = [...WITH_PORTS, ...WITH_A_CARD];

describe('bulk add — the same device the window that adds one makes', () => {
  it.each(WITH_A_CARD)('«%s»: type, template, name, addresses, card and DNS server are the same', (name) => {
    const alone = madeAlone(named(name));
    emptyCanvas();
    const inBulk = madeInBulk(named(name));

    expect(comparable(inBulk)).toEqual(comparable(alone));
    // (a card of its own, with a MAC address of its own)
    expect(isValidMAC(inBulk.nics?.[0].mac ?? '')).toBe(true);
    expect(inBulk.nics?.[0].mac).not.toBe(alone.nics?.[0].mac);
  });

  it.each(WITH_PORTS)('«%s»: the same but for what is written on its ports', (name) => {
    const alone = madeAlone(named(name));
    emptyCanvas();
    const inBulk = madeInBulk(named(name));

    const { ports: portsAlone, ...restAlone } = comparable(alone);
    const { ports: portsInBulk, ...restInBulk } = comparable(inBulk);
    expect(restInBulk).toEqual(restAlone);
    expect(portsInBulk).toHaveLength(portsAlone?.length ?? -1);
  });
});

describe('the name of a new device — the same from both windows', () => {
  /**
   * The name each window gives a new device of a template on the canvas as
   * it is: the one made alone, then the one made in bulk. Neither stays
   */
  function namesFor(name: string): [alone: string, inBulk: string] {
    const alone = madeAlone(named(name));
    useNetworkStore.getState().removeDevice(alone.id);
    const inBulk = madeInBulk(named(name));
    useNetworkStore.getState().removeDevice(inBulk.id);
    return [alone.label, inBulk.label];
  }
  const labels = () => devices().map((d) => d.label);
  const remove = (label: string) =>
    useNetworkStore.getState().removeDevice(devices().find((d) => d.label === label)!.id);

  it('the first of a template is number 1', () => {
    expect(namesFor('PC')).toEqual(['PC-1', 'PC-1']);
    expect(namesFor('Switch')).toEqual(['Switch-1', 'Switch-1']);
    // (a dash for each space of the name of the template)
    expect(namesFor('Web Server')).toEqual(['Web-Server-1', 'Web-Server-1']);
  });

  it('the number is of the template, not of its type: after two web servers the first DNS server is number 1', () => {
    madeAlone(named('Web Server'));
    madeInBulk(named('Web Server'));
    expect(labels()).toEqual(['Web-Server-1', 'Web-Server-2']);

    expect(namesFor('DNS Server')).toEqual(['DNS-Server-1', 'DNS-Server-1']);
    expect(namesFor('Server')).toEqual(['Server-1', 'Server-1']);
    expect(namesFor('Web Server')).toEqual(['Web-Server-3', 'Web-Server-3']);
  });

  it('after a deletion the lowest free number is given, and never a name that is taken', () => {
    madeAlone(named('PC'));
    madeInBulk(named('PC'));
    madeAlone(named('PC'));
    expect(labels()).toEqual(['PC-1', 'PC-2', 'PC-3']);

    remove('PC-2');
    expect(namesFor('PC')).toEqual(['PC-2', 'PC-2']);
    madeInBulk(named('PC'));
    expect(namesFor('PC')).toEqual(['PC-4', 'PC-4']);

    remove('PC-1');
    remove('PC-3');
    expect(namesFor('PC')).toEqual(['PC-1', 'PC-1']);
    madeAlone(named('PC'));
    madeAlone(named('PC'));
    expect(labels()).toEqual(['PC-2', 'PC-1', 'PC-3']);
    expect(new Set(labels()).size).toBe(3);
  });

  it('a name is taken whatever its case, and whatever the device that has it', () => {
    // (as the terminal finds a device: «pc-1» and «PC-1» are one name to it)
    addOnCanvas('PC', 'pc-1', '10.0.0.1');
    addOnCanvas('Server', 'WEB-SERVER-1', '10.0.0.2');
    // (a switch somebody called as a PC is called)
    addOnCanvas('Switch', 'PC-2', '10.0.0.3');
    // (spaces around a name do not make another name)
    addOnCanvas('Server', ' web-server-2 ', '10.0.0.4');

    expect(namesFor('PC')).toEqual(['PC-3', 'PC-3']);
    expect(namesFor('Web Server')).toEqual(['Web-Server-3', 'Web-Server-3']);
    // and a name that only looks like one of these is not one of them
    expect(namesFor('Server')).toEqual(['Server-1', 'Server-1']);
  });

  it('a row of three in bulk takes the next three free names, those just made counted as taken', () => {
    addOnCanvas('Server', 'Srv-A', '10.0.0.1');
    addOnCanvas('Server', 'Web-Server-2', '10.0.0.2');
    addOnCanvas('PC', 'PC-A', '10.0.0.3');

    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('DNS Server'));
    fireEvent.click(more('Printer'));
    fireEvent.click(more('IP Camera'));
    fireEvent.change(quantityField(addConfigurable('Switch')), { target: { value: '3' } });
    fireEvent.click(addButton());

    expect(labels().slice(3)).toEqual([
      'Switch-1',
      'Switch-2',
      'Switch-3',
      'Web-Server-1',
      'Web-Server-3',
      'Web-Server-4',
      'DNS-Server-1',
      'IP-Camera-1',
      'Printer-1',
    ]);
    // the next one made alone goes on from there
    expect(madeAlone(named('Web Server')).label).toBe('Web-Server-5');
    expect(madeAlone(named('Mail Server')).label).toBe('Mail-Server-1');
  });

  it.each(EVERY_TEMPLATE)('«%s»: one name from both windows, on an empty canvas and on one that has some', (name) => {
    const base = name.replace(/ /g, '-');
    expect(namesFor(name)).toEqual([`${base}-1`, `${base}-1`]);

    const { type } = named(name);
    addOnCanvas(type, `${base}-1`, '10.0.0.1');
    addOnCanvas(type, `${base.toLowerCase()}-2`, '10.0.0.2');
    addOnCanvas(type, `${base}-4`, '10.0.0.4');
    expect(namesFor(name)).toEqual([`${base}-3`, `${base}-3`]);
  });

  it('the templates above are all the app comes with', () => {
    expect([...EVERY_TEMPLATE].sort()).toEqual(
      templates()
        .filter((t) => !t.isCustom)
        .map((t) => t.name)
        .sort()
    );
  });

  it('a drawing that is there keeps its names: a sample network, and what is added to it', () => {
    const sample = createSampleTopology();
    useNetworkStore.getState().loadTopology(sample.devices, sample.connections);
    const before = labels();
    expect(before).toEqual(sample.devices.map((d) => d.label));

    // «PC-1», «PC-2» and «Router-1» are of the sample; it has no «Switch-…»
    expect(namesFor('PC')).toEqual(['PC-3', 'PC-3']);
    expect(namesFor('Router')).toEqual(['Router-2', 'Router-2']);
    expect(namesFor('Switch')).toEqual(['Switch-1', 'Switch-1']);

    madeInBulk(named('PC'));
    madeAlone(named('Router'));
    expect(labels()).toEqual([...before, 'PC-3', 'Router-2']);
  });

  it('a drawing named the way it was is left as it is, number 0 included', () => {
    addOnCanvas('PC', 'PC-0', '10.0.0.1');
    addOnCanvas('PC', 'PC-1', '10.0.0.2');
    addOnCanvas('Server', 'Web-Server-2', '10.0.0.3');

    expect(namesFor('PC')).toEqual(['PC-2', 'PC-2']);
    madeAlone(named('Web Server'));
    expect(labels()).toEqual(['PC-0', 'PC-1', 'Web-Server-2', 'Web-Server-1']);
  });
});

describe('bulk add — the devices it makes', () => {
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
