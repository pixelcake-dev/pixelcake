/**
 * Spanning tree is not simulated, so nothing in the interface offers to
 * configure it: a setting that changes nothing is not shown.
 *
 * What a file or a stored drawing carries about it is another matter: it is
 * read without complaint, left alone by every edit, and written again as it
 * was.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createSampleTopology } from '@/utils/sampleTopology';
import { parseProjectFile, serializeProject } from '@/utils/projectFile';
import { parseYamlTopology } from '@/utils/importYaml';
import { generateYaml } from '@/utils/exportYaml';
import type { ProjectFile } from '@/types/project';
import type { NetworkDevice } from '@/types';
import DevicePanel from '@/components/Sidebar/DevicePanel';
import InspectorModal from './InspectorModal';
import ConnectionInspectorModal from './ConnectionInspectorModal';
import AddDeviceModal from './AddDeviceModal';
import BulkAddDeviceModal from './BulkAddDeviceModal';
import SettingsModal from './SettingsModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** The protocol by any of its names */
const SPANNING_TREE = /spanning|\bR?STP\b|\bPVST|\bMST\b/i;

/** Everything a user can read on the page: the texts, and what controls say of themselves */
function shown(): string {
  const said = Array.from(document.querySelectorAll('*')).flatMap(element =>
    ['title', 'aria-label', 'placeholder', 'alt'].map(name => element.getAttribute(name) ?? '')
  );
  return [document.body.textContent ?? '', ...said].join('\n');
}

const ui = () => useUIStore.getState();
const network = () => useNetworkStore.getState();

function device(label: string): NetworkDevice {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

function openInspector(label: string) {
  ui().setInspectorDevice(device(label));
  ui().openModal('inspector');
  return render(<InspectorModal />);
}

/** A tab, of a window or of a part of it, by its text */
function tab(label: string): HTMLElement {
  const found = Array.from(document.querySelectorAll<HTMLElement>('.settings-tab')).find(
    button => button.textContent?.trim() === label
  );
  if (!found) throw new Error(`no tab "${label}"`);
  return found;
}

beforeEach(() => {
  localStorage.clear();
  createNewProject({ name: 'Sede Milano' });
  const sample = createSampleTopology();
  network().loadTopology(sample.devices, sample.connections);
  network().addDevice({
    type: 'Firewall',
    templateId: 'tpl-firewall',
    label: 'FW-1',
    ip: '10.0.0.2',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    portCount: 2,
    ports: [
      { id: 1, enabled: true, speed: 'auto', portType: 'lan', securityZone: 'trust' },
      { id: 2, enabled: true, speed: 'auto', portType: 'wan', securityZone: 'untrust' },
    ],
  });
  for (const name of Object.keys(ui().modals) as Array<keyof ReturnType<typeof ui>['modals']>) {
    ui().closeModal(name);
  }
});

describe('nothing in the interface offers spanning tree', () => {
  it.each(['SW-Office', 'Router-1', 'FW-1', 'PC-1'])(
    'the window of %s: no tab, no port, no network card says a word about it',
    label => {
      openInspector(label);

      const tabs = Array.from(document.querySelectorAll<HTMLElement>('.tab-header'));
      expect(tabs.length).toBeGreaterThan(1);
      let itemsOpened = 0;
      for (const header of tabs) {
        fireEvent.click(header);
        expect(shown(), `tab ${header.textContent}`).not.toMatch(SPANNING_TREE);
        // with a port or a network card chosen, its settings are on screen too
        const item = document.querySelector<HTMLElement>('.port-box, .nic-card');
        if (item) {
          fireEvent.click(item);
          itemsOpened++;
          expect(shown(), `tab ${header.textContent}, item`).not.toMatch(SPANNING_TREE);
        }
      }
      // every device has ports or network cards: their settings were looked at
      expect(itemsOpened).toBe(1);
    }
  );

  it('not even on the kinds of device whose template says they support it', () => {
    // the mark stays in the templates (files carry it): it shows nothing any more
    const templates = useTemplateStore.getState().templates;
    const marked = templates.filter(template => template.supportsSTP).map(t => t.type);
    expect(marked).toEqual(expect.arrayContaining(['Switch', 'Router', 'Firewall']));

    openInspector('SW-Office');

    expect(screen.queryByRole('group', { name: /spanning/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /STP/i })).toBeNull();
    expect(screen.queryByLabelText(/STP/i)).toBeNull();
    expect(screen.queryByLabelText(/Priorità del bridge/i)).toBeNull();
    // what the first tab does have
    expect(screen.getByLabelText('Nome Dispositivo')).toBeInTheDocument();
    expect(screen.getByText('VLAN')).toBeInTheDocument();
  });

  it('the window of a connection says nothing about it', () => {
    ui().setInspectorConnection(network().connections[0]);
    ui().openModal('connectionInspector');
    render(<ConnectionInspectorModal />);

    expect(screen.getByLabelText('Tipo Connessione')).toBeInTheDocument();
    expect(shown()).not.toMatch(SPANNING_TREE);
  });

  it('adding a device, one or many, says nothing about it', () => {
    ui().setAddDeviceType('Switch', 'tpl-switch');
    ui().openModal('addDevice');
    const single = render(<AddDeviceModal />);
    expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeInTheDocument();
    expect(shown()).not.toMatch(SPANNING_TREE);
    single.unmount();

    ui().openModal('bulkAddDevice');
    const many = render(<BulkAddDeviceModal />);
    expect(document.querySelector('.base-modal')).not.toBeNull();
    expect(shown()).not.toMatch(SPANNING_TREE);
    many.unmount();

    render(<DevicePanel />);
    expect(screen.getByText('Aggiungi in Blocco')).toBeInTheDocument();
    expect(shown()).not.toMatch(SPANNING_TREE);
  });

  it('the windows of the templates say nothing about it, and a new template is still whole', () => {
    ui().openModal('settings');
    render(<SettingsModal />);
    fireEvent.click(tab('Template'));
    expect(shown()).not.toMatch(SPANNING_TREE);
    fireEvent.click(tab('Dispositivi'));
    expect(shown()).not.toMatch(SPANNING_TREE);

    // the window of a generic template, new and of an existing one
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi Nuovo Template/ }));
    expect(screen.getByRole('heading', { name: 'Nuovo Template Generico' })).toBeInTheDocument();
    expect(shown()).not.toMatch(SPANNING_TREE);
    fireEvent.click(screen.getAllByRole('button', { name: 'Annulla' }).at(-1)!);
    fireEvent.click(screen.getAllByTitle('Modifica template')[1]);
    expect(screen.getByRole('heading', { name: 'Modifica Template Generico' })).toBeInTheDocument();
    expect(shown()).not.toMatch(SPANNING_TREE);
    fireEvent.click(screen.getAllByRole('button', { name: 'Annulla' }).at(-1)!);

    // a new custom template, of a kind that used to show the settings
    fireEvent.click(tab('Dispositivi Custom'));
    fireEvent.click(screen.getByRole('button', { name: '+ Nuovo Template' }));
    expect(shown()).not.toMatch(SPANNING_TREE);
    fireEvent.change(screen.getByLabelText('Nome Template'), { target: { value: 'Switch di piano' } });
    fireEvent.change(screen.getByLabelText('Tipo Base'), { target: { value: 'Switch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva Template' }));

    // it has every field a project file asks of a template
    const created = useTemplateStore
      .getState()
      .templates.find(template => template.name === 'Switch di piano');
    expect(created).toMatchObject({ type: 'Switch', isCustom: true });
    for (const capability of ['supportsVLAN', 'supportsSTP', 'supportsPorts', 'supportsNICs'] as const) {
      expect(typeof created?.[capability], capability).toBe('boolean');
    }
  });
});

describe('what a drawing carries about spanning tree is left alone', () => {
  it.each([
    ['switched on', { enabled: true, mode: 'MST', priority: 4096 }],
    ['switched off', { enabled: false, mode: 'RSTP', priority: 32768 }],
  ] as const)('saving the window of a device keeps its settings (%s)', (_, stp) => {
    network().updateDevice(device('SW-Office').id, { stp: { ...stp } });
    openInspector('SW-Office');

    fireEvent.change(screen.getByLabelText('Nome Dispositivo'), { target: { value: 'SW-Uffici' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(ui().modals.inspector).toBe(false);
    expect(device('SW-Uffici').stp).toEqual(stp);
  });

  it('saving the window of a device that has none does not invent them', () => {
    openInspector('SW-Office');

    fireEvent.change(screen.getByLabelText('Nome Dispositivo'), { target: { value: 'SW-Uffici' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(device('SW-Uffici')).not.toHaveProperty('stp');
  });

  it('saving the window of a connection keeps the state and the priority of its port', () => {
    const [connection] = network().connections;
    network().updateConnection(connection.id, { stpPortState: 'blocking', stpPortPriority: 64 });
    ui().setInspectorConnection(network().connections[0]);
    ui().openModal('connectionInspector');
    render(<ConnectionInspectorModal />);

    fireEvent.change(screen.getByLabelText('Etichetta Custom'), { target: { value: 'dorsale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(network().connections[0]).toMatchObject({
      label: 'dorsale',
      stpPortState: 'blocking',
      stpPortPriority: 64,
    });
  });

  it('a project file that carries them opens with no warning and is written again with them', () => {
    const file: ProjectFile = {
      format: 'pixelcake-project',
      version: 1,
      name: 'Sede Milano',
      description: '',
      savedAt: '2026-11-13T10:00:00.000Z',
      settings: { ipClass: '192.168.1.0', subnet: '255.255.255.0', gateway: '192.168.1.1', emailMode: 'auto' },
      activeCanvasId: 'canvas-1',
      canvases: [
        {
          id: 'canvas-1',
          name: 'Canvas 1',
          devices: [
            {
              id: 'dev-0',
              type: 'Switch',
              label: 'SW-1',
              ip: '192.168.1.2',
              subnet: '255.255.255.0',
              gateway: '192.168.1.1',
              position: { x: 0, y: 0 },
              stp: { enabled: true, mode: 'PVST+', priority: 8192 },
            },
            {
              id: 'dev-1',
              type: 'Switch',
              label: 'SW-2',
              ip: '192.168.1.3',
              subnet: '255.255.255.0',
              gateway: '192.168.1.1',
              position: { x: 200, y: 0 },
              stp: { enabled: false },
            },
          ],
          connections: [
            {
              id: 'conn-0',
              source: 'dev-0',
              target: 'dev-1',
              stpPortState: 'blocking',
              stpPortPriority: 128,
            },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
          deviceCounter: 2,
          connectionCounter: 1,
        },
      ],
      templates: { devices: [], connections: [] },
    };

    const opened = parseProjectFile(serializeProject(file));

    expect(opened).toEqual({ ok: true, project: file, warnings: [] });
    if (!opened.ok) return;
    expect(JSON.parse(serializeProject(opened.project)).canvases[0]).toMatchObject({
      devices: [
        { stp: { enabled: true, mode: 'PVST+', priority: 8192 } },
        { stp: { enabled: false } },
      ],
      connections: [{ stpPortState: 'blocking', stpPortPriority: 128 }],
    });
  });

  it('a YAML file that carries them opens with no warning and is exported again with them', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: SW-1',
      '      type: Switch',
      '      ip: 192.168.1.2',
      '      stp:',
      '        enabled: true',
      '        mode: RSTP',
      '        priority: 4096',
      '    - name: SW-2',
      '      type: Switch',
      '      ip: 192.168.1.3',
      '  connections:',
      '    - source: SW-1',
      '      target: SW-2',
      '      stp_state: forwarding',
      '',
    ].join('\n');

    const opened = parseYamlTopology(yaml);

    expect(opened.warnings).toEqual([]);
    expect(opened.devices.map(d => d.stp)).toEqual([
      { enabled: true, mode: 'RSTP', priority: 4096 },
      undefined,
    ]);
    expect(opened.connections.map(c => c.stpPortState)).toEqual(['forwarding']);

    const again = parseYamlTopology(generateYaml(opened.devices, opened.connections, 'Sede Milano'));
    expect(again.warnings).toEqual([]);
    expect(again.devices.map(d => d.stp)).toEqual(opened.devices.map(d => d.stp));
    expect(again.connections.map(c => c.stpPortState)).toEqual(['forwarding']);
  });
});
