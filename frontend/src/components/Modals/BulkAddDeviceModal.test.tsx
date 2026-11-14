/**
 * The window that adds devices in bulk. Its list has a row for each template,
 * and several templates are of one type (seven of them are servers): a
 * quantity belongs to its row, and a row adds devices made from its own
 * template.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import type { DeviceTemplate, NetworkDevice } from '@/types/network';
import {
  addButton,
  addConfigurable,
  configurableChoices,
  configurableRows,
  emptyCanvas,
  less,
  more,
  nameOfRow,
  openBulkWindow,
  portChoices,
  quantityField,
  raised,
  rowOf,
  searchField,
  standardRows,
  total,
} from '@/test/bulkAddWindow';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const devices = () => useNetworkStore.getState().devices;
const templates = () => useTemplateStore.getState().templates;
const templateOf = (device: NetworkDevice) => templates().find((t) => t.id === device.templateId);

/** A second switch among the templates the app comes with, as a project file can bring one */
const SWITCH_POE: DeviceTemplate = {
  id: 'tpl-switch-poe',
  name: 'Switch PoE',
  type: 'Switch',
  icon: 'mdi:switch',
  color: '#5E8096',
  isCustom: false,
  supportsVLAN: true,
  supportsSTP: true,
  supportsPorts: true,
  supportsNICs: false,
  portOptions: [8, 16],
  defaultPortCount: 16,
};

let errors: MockInstance<typeof console.error>;
/** What React said about two children of a list with one key */
const sameKeyWarnings = () => errors.mock.calls.filter((call) => String(call[0]).includes('same key'));

beforeEach(() => {
  localStorage.clear();
  useTemplateStore.getState().loadDefaultTemplates();
  emptyCanvas();
  useUIStore.getState().closeModal('bulkAddDevice');
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errors.mockRestore();
});

describe('bulk add — a quantity belongs to its row', () => {
  it('one more, twice, on «Web Server»: 2 on that row and 0 on every other, the other servers too', () => {
    openBulkWindow();
    expect(standardRows()).toHaveLength(21);
    expect(raised()).toEqual([]);

    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));

    expect(raised()).toEqual(['Web Server=2']);
    expect(total()).toBe(2);
  });

  it('a number typed in the field of a row is of that row alone', () => {
    openBulkWindow();

    fireEvent.change(quantityField(rowOf('DNS Server')), { target: { value: '3' } });
    expect(raised()).toEqual(['DNS Server=3']);

    fireEvent.change(quantityField(rowOf('Printer')), { target: { value: '4' } });
    expect(raised()).toEqual(['DNS Server=3', 'Printer=4']);
    expect(total()).toBe(7);

    // emptied, it is 0 again, and the others stay
    fireEvent.change(quantityField(rowOf('DNS Server')), { target: { value: '' } });
    expect(raised()).toEqual(['Printer=4']);
  });

  it('one less takes one off its row, and cannot be pressed on a row at 0 whatever the rows of the same type hold', () => {
    openBulkWindow();
    fireEvent.click(more('Printer'));
    fireEvent.click(more('Printer'));
    fireEvent.click(more('NAS'));

    expect(less('Printer').disabled).toBe(false);
    expect(less('PC').disabled).toBe(true);
    expect(less('IP Camera').disabled).toBe(true);
    expect(less('Database').disabled).toBe(true);

    fireEvent.click(less('Printer'));
    expect(raised()).toEqual(['NAS=1', 'Printer=1']);
  });

  it('the total is the sum of the rows, rows of the same type counted each', () => {
    openBulkWindow();
    fireEvent.click(more('Server'));
    fireEvent.click(more('Mail Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.change(quantityField(addConfigurable('Switch')), { target: { value: '2' } });

    expect(raised()).toEqual(['Server=1', 'Mail Server=1', 'Web Server=2']);
    expect(total()).toBe(6);
  });

  it('the search shows the rows it finds and no other, each with its own quantity', () => {
    openBulkWindow();
    fireEvent.click(more('Web Server'));

    fireEvent.change(searchField(), { target: { value: 'server' } });
    expect(standardRows().map(nameOfRow)).toEqual([
      'Server',
      'Mail Server',
      'VPS',
      'Web Server',
      'Proxy Server',
      'DNS Server',
      'DHCP Server',
    ]);
    expect(raised()).toEqual(['Web Server=1']);

    // and all of them are back, as they were, when the search is emptied
    fireEvent.change(searchField(), { target: { value: '' } });
    expect(standardRows()).toHaveLength(21);
    expect(new Set(standardRows().map(nameOfRow)).size).toBe(21);
    expect(raised()).toEqual(['Web Server=1']);
  });

  it('the window opens again with every quantity at 0', () => {
    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Printer'));

    act(() => useUIStore.getState().closeModal('bulkAddDevice'));
    act(() => useUIStore.getState().openModal('bulkAddDevice'));

    expect(standardRows()).toHaveLength(21);
    expect(raised()).toEqual([]);
  });
});

describe('bulk add — a row adds devices made from its own template', () => {
  it('a printer, two web servers and a DNS server in one go: each is what its row says', () => {
    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.click(more('Web Server'));
    fireEvent.change(quantityField(rowOf('DNS Server')), { target: { value: '1' } });
    fireEvent.click(more('Printer'));
    fireEvent.click(addButton());

    expect(devices().map((d) => [d.templateId, d.type, templateOf(d)?.name])).toEqual([
      ['tpl-webserver', 'Server', 'Web Server'],
      ['tpl-webserver', 'Server', 'Web Server'],
      ['tpl-dnsserver', 'Server', 'DNS Server'],
      ['tpl-printer', 'PC', 'Printer'],
    ]);
    // each is drawn with the icon of its template: the canvas finds it by this id
    expect(devices().map((d) => templateOf(d)?.icon)).toEqual([
      'mdi:web',
      'mdi:web',
      'mdi:dns',
      'mdi:printer-wireless',
    ]);
    // and the window is closed
    expect(useUIStore.getState().modals.bulkAddDevice).toBe(false);
  });

  it('the devices come in the order of the list, whatever the order the rows were raised in', () => {
    openBulkWindow();
    fireEvent.click(more('Printer'));
    fireEvent.click(more('DNS Server'));
    fireEvent.click(more('PC'));
    fireEvent.click(more('Web Server'));
    fireEvent.click(addButton());

    expect(devices().map((d) => templateOf(d)?.name)).toEqual(['PC', 'Web Server', 'DNS Server', 'Printer']);
  });

  it('one of every row: twenty-one devices, each of the template of its row, with one card', () => {
    openBulkWindow();
    const names = standardRows().map(nameOfRow);
    names.forEach((name) => fireEvent.click(more(name)));
    fireEvent.click(addButton());

    expect(devices()).toHaveLength(21);
    expect(devices().map((d) => templateOf(d)?.name)).toEqual(names);
    // the laptop, the smartphone, the tablet and the IP phone are among them, after the printer
    expect(names.slice(-5)).toEqual(['Printer', 'Laptop', 'Smartphone', 'Tablet', 'IP Phone']);
    for (const device of devices()) {
      const template = templateOf(device)!;
      expect(device.type, template.name).toBe(template.type);
      expect(device.nics, template.name).toHaveLength(1);
      expect(device.ports, template.name).toBeUndefined();
    }
  });

  it('a switch, a router and a firewall: each of its template, with the ports asked for', () => {
    openBulkWindow();
    for (const name of ['Switch', 'Router', 'Firewall']) {
      const row = addConfigurable(name);
      fireEvent.change(row.querySelector('.config-select')!, { target: { value: '8' } });
      fireEvent.change(quantityField(row), { target: { value: '1' } });
    }
    fireEvent.click(addButton());

    expect(devices().map((d) => [d.templateId, d.type, d.portCount, d.ports?.length, d.nics])).toEqual([
      ['tpl-switch', 'Switch', 8, 8, undefined],
      ['tpl-router', 'Router', 8, 8, undefined],
      ['tpl-firewall', 'Firewall', 8, 8, undefined],
    ]);
  });
});

describe('bulk add — two templates of one type', () => {
  it('two configurable ones: each has its own row, with its name and its choices of ports, and adds its own device', () => {
    useTemplateStore.getState().addMissingTemplates([SWITCH_POE], []);
    openBulkWindow();
    expect(configurableChoices().map((choice) => choice.textContent?.trim())).toEqual([
      'Switch',
      'Router',
      'Firewall',
      'Switch PoE',
    ]);

    const second = addConfigurable('Switch PoE');
    const first = addConfigurable('Switch');
    expect(configurableRows().map(nameOfRow)).toEqual(['Switch PoE', 'Switch']);
    expect(portChoices(second)).toEqual(['8', '16']);
    expect(second.querySelector<HTMLSelectElement>('.config-select')?.value).toBe('16');
    expect(portChoices(first)).toEqual(['5', '8', '16', '24', '48']);

    fireEvent.change(quantityField(second), { target: { value: '1' } });
    fireEvent.change(quantityField(first), { target: { value: '1' } });
    fireEvent.click(addButton());

    expect(devices().map((d) => [d.templateId, d.type, d.ports?.length])).toEqual([
      ['tpl-switch-poe', 'Switch', 16],
      ['tpl-switch', 'Switch', 24],
    ]);
  });

  it('the search finds a configurable row by the name of its own template', () => {
    useTemplateStore.getState().addMissingTemplates([SWITCH_POE], []);
    openBulkWindow();
    addConfigurable('Switch PoE');
    addConfigurable('Switch');
    addConfigurable('Router');

    fireEvent.change(searchField(), { target: { value: 'poe' } });
    expect(configurableRows().map(nameOfRow)).toEqual(['Switch PoE']);

    fireEvent.change(searchField(), { target: { value: 'switch' } });
    expect(configurableRows().map(nameOfRow)).toEqual(['Switch PoE', 'Switch']);
  });

  it('a template of the user of the same type, wherever it is in the list, is not taken for the one of the row', () => {
    const ownSwitch: DeviceTemplate = { ...SWITCH_POE, id: 'tpl-1700000000000', name: 'Switch di Sede', isCustom: true };
    const ownServer: DeviceTemplate = {
      ...SWITCH_POE,
      id: 'tpl-1700000000001',
      name: 'Server di Sede',
      type: 'Server',
      isCustom: true,
      supportsPorts: false,
      supportsNICs: true,
      portOptions: undefined,
      defaultPortCount: undefined,
    };
    // (before the ones the app comes with: the list is not kept in any order)
    useTemplateStore.setState({ templates: [ownSwitch, ownServer, ...templates()] });
    openBulkWindow();

    fireEvent.change(quantityField(addConfigurable('Switch')), { target: { value: '1' } });
    fireEvent.click(more('Server'));
    fireEvent.click(addButton());

    expect(devices().map((d) => d.templateId)).toEqual(['tpl-switch', 'tpl-server']);
  });
});

describe('bulk add — every row is one React can tell from the others', () => {
  it('no two rows have the same key, in the list and in the menu of the configurable devices', () => {
    useTemplateStore.getState().addMissingTemplates([SWITCH_POE], []);
    openBulkWindow();
    fireEvent.click(more('Web Server'));
    fireEvent.change(searchField(), { target: { value: 'server' } });
    fireEvent.change(searchField(), { target: { value: '' } });

    expect(configurableChoices()).toHaveLength(4);
    expect(sameKeyWarnings()).toEqual([]);
  });
});
