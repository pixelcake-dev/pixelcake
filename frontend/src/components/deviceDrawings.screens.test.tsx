/**
 * Wherever a kind of device is shown, it is its drawing: the panel that adds
 * one, the window that adds one and the one that adds many, the window of a
 * device, the menu of a presentation, the templates in the settings. And a
 * template is given a drawing by choosing one of them.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { DRAWING_OF_TEMPLATE } from '@/utils/deviceDrawing';
import type { DeviceTemplate } from '@/types/network';
import DevicePanel from '@/components/Sidebar/DevicePanel';
import AddDeviceModal from '@/components/Modals/AddDeviceModal';
import BulkAddDeviceModal from '@/components/Modals/BulkAddDeviceModal';
import InspectorModal from '@/components/Modals/InspectorModal';
import GenericTemplatesTab from '@/components/Modals/GenericTemplatesTab';
import CustomTemplatesTab from '@/components/Modals/CustomTemplatesTab';
import TemplateEditModal from '@/components/Modals/TemplateEditModal';
import PresentationMenu from '@/components/Presentation/PresentationMenu';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const templates = () => useTemplateStore.getState().templates;
const store = () => useNetworkStore.getState();
/** The drawing shown inside an element */
const drawingIn = (element: Element | null | undefined) =>
  element?.querySelector('svg.device-drawing')?.getAttribute('data-drawing') ?? null;
const sizeIn = (element: Element | null | undefined) =>
  Number(element?.querySelector('svg.device-drawing')?.getAttribute('width'));

/** A template of the user, made when an icon was a name of the Iconify sets */
const OLD_CUSTOM: DeviceTemplate = {
  id: 'tpl-1700000000000',
  name: 'Storage di Sede',
  type: 'Database',
  icon: 'mdi:aws',
  color: '#ff9900',
  isCustom: true,
  supportsVLAN: false,
  supportsSTP: false,
  supportsPorts: false,
  supportsNICs: true,
};

function addDevice(type: string, templateId: string | undefined, label: string) {
  return store().addDevice({
    type,
    templateId,
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  usePresentationStore.getState().exit();
  useTemplateStore.getState().loadDefaultTemplates();
  createNewProject({ name: 'Sede Milano' });
  useUIStore.setState({ showWelcomeScreen: false });
  for (const name of ['addDevice', 'bulkAddDevice', 'inspector'] as const) useUIStore.getState().closeModal(name);
});

describe('a kind of device is shown with its drawing', () => {
  it('in the panel that adds a device: every template, with its own', () => {
    render(<DevicePanel />);
    const items = Array.from(document.querySelectorAll('.device-list-item'));
    expect(items).toHaveLength(templates().length);
    expect(items.map(drawingIn)).toEqual(templates().map((template) => DRAWING_OF_TEMPLATE[template.id]));
    // no icon of the sets of before is left in the list
    expect(document.querySelector('.device-list .iconify')).toBeNull();
  });

  it('in the window that adds one, next to the name of its type', () => {
    useUIStore.getState().setAddDeviceType('Server', 'tpl-webserver');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    const type = screen.getByText('Web Server').closest('output');
    expect(drawingIn(type)).toBe('server-web');
    expect(sizeIn(type)).toBe(24);
  });

  it('in the window that adds many: on every row, and in the menu of the configurable devices', () => {
    useUIStore.getState().openModal('bulkAddDevice');
    render(<BulkAddDeviceModal />);
    const rows = Array.from(document.querySelectorAll('.standard-section tbody tr'));
    expect(rows).toHaveLength(21);
    for (const row of rows) {
      const name = row.querySelector('.type-cell span')?.textContent;
      const template = templates().find((entry) => entry.name === name);
      expect(drawingIn(row), name ?? '').toBe(DRAWING_OF_TEMPLATE[template?.id ?? '']);
    }
    fireEvent.click(document.querySelector('.add-row-btn')!);
    const choices = Array.from(document.querySelectorAll('.add-menu-item'));
    expect(choices.map(drawingIn)).toEqual(['switch', 'router', 'firewall']);
    fireEvent.click(choices[1]);
    expect(drawingIn(document.querySelector('.configurable-section tbody tr'))).toBe('router');
  });

  it('in the window of a device: the drawing of the template it was made from', () => {
    const id = addDevice('PC', 'tpl-printer', 'Stampante');
    useUIStore.getState().setInspectorDevice(store().devices.find((device) => device.id === id)!);
    useUIStore.getState().openModal('inspector');
    render(<InspectorModal />);
    const type = screen.getByText('Printer').closest('output');
    expect(drawingIn(type)).toBe('stampante');
    expect(sizeIn(type)).toBe(24);
  });

  it('in the menu a click on a device opens while presenting', () => {
    const id = addDevice('Server', 'tpl-dnsserver', 'Srv-Auth');
    addDevice('PC', 'tpl-pc', 'PC-1');
    act(() => {
      usePresentationStore.getState().enter();
      usePresentationStore.getState().openMenu({ kind: 'device', id, x: 10, y: 10 });
    });
    render(<PresentationMenu />);
    const menu = screen.getByRole('menu', { name: 'Srv-Auth' });
    expect(drawingIn(menu.querySelector('.presentation-menu-title'))).toBe('server-dns');
  });

  it('on the canvas: each device its own, a device of no template the one of its type', () => {
    addDevice('Server', 'tpl-mailserver', 'Mail');
    addDevice('Router', undefined, 'Router-Core');
    addDevice('Database', OLD_CUSTOM.id, 'Archivio');
    useTemplateStore.getState().addMissingTemplates([OLD_CUSTOM], []);
    render(
      <ReactFlowProvider>
        <NetworkCanvas />
      </ReactFlowProvider>
    );
    const drawingOfNode = (label: string) => drawingIn(screen.getByText(label).closest('.network-device'));
    expect(drawingOfNode('Mail')).toBe('server-mail');
    expect(drawingOfNode('Router-Core')).toBe('router');
    // a template of the user with an icon of before: the drawing of its base type
    expect(drawingOfNode('Archivio')).toBe('database');
    expect(document.querySelector('.network-device .iconify')).toBeNull();
  });
});

describe('the templates in the settings', () => {
  it('the ones the app comes with are listed with their drawings', () => {
    render(<GenericTemplatesTab templates={templates()} />);
    const cards = Array.from(document.querySelectorAll('.template-card'));
    expect(cards).toHaveLength(templates().length);
    expect(cards.map(drawingIn)).toEqual(templates().map((template) => DRAWING_OF_TEMPLATE[template.id]));
  });

  it('a template of the user is made with a drawing chosen among those of the app, starting from the one of its type', () => {
    render(<CustomTemplatesTab templates={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Nuovo template/ }));
    fireEvent.change(screen.getByPlaceholderText(/AWS EC2/), { target: { value: 'Archivio S3' } });

    const chosen = () => screen.getAllByRole('radio').find((choice) => choice.getAttribute('aria-checked') === 'true');
    expect(chosen()?.getAttribute('aria-label')).toBe('Server');

    // another base type: its drawing is proposed
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Database' } });
    expect(chosen()?.getAttribute('aria-label')).toBe('Database');

    // and any other can be taken
    fireEvent.click(screen.getByRole('radio', { name: 'Storage S3' }));
    fireEvent.submit(document.querySelector('form.template-form')!);

    const made = templates()[templates().length - 1];
    expect(made).toMatchObject({ name: 'Archivio S3', type: 'Database', icon: 'storage-s3', isCustom: true });
    // nothing asks for a colour any more, and none is shown
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it('a template of before the drawings is listed with the drawing of its base type', () => {
    render(<CustomTemplatesTab templates={[OLD_CUSTOM]} />);
    expect(drawingIn(screen.getByText('Storage di Sede').closest('.template-item'))).toBe('database');
  });

  it('editing a template shows its drawing as the chosen one, and saves the one chosen', () => {
    const printer = templates().find((template) => template.id === 'tpl-printer')!;
    render(<TemplateEditModal isOpen onClose={() => {}} template={printer} />);

    const chosen = () => screen.getAllByRole('radio').find((choice) => choice.getAttribute('aria-checked') === 'true');
    expect(chosen()?.getAttribute('aria-label')).toBe('Printer');

    fireEvent.click(screen.getByRole('radio', { name: 'IP Camera' }));
    expect(chosen()?.getAttribute('aria-label')).toBe('IP Camera');
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.modal-actions button')[1]);

    expect(templates().find((template) => template.id === 'tpl-printer')?.icon).toBe('telecamera-ip');
    // its name and its type are as they were
    expect(templates().find((template) => template.id === 'tpl-printer')).toMatchObject({ name: 'Printer', type: 'PC' });
  });

  it('a template with an icon of before, saved without choosing: it keeps the drawing it is shown with', () => {
    useTemplateStore.getState().addMissingTemplates([OLD_CUSTOM], []);
    render(<TemplateEditModal isOpen onClose={() => {}} template={OLD_CUSTOM} />);
    const chosen = screen.getAllByRole('radio').find((choice) => choice.getAttribute('aria-checked') === 'true');
    expect(chosen?.getAttribute('aria-label')).toBe('Database');

    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.modal-actions button')[1]);

    expect(templates().find((template) => template.id === OLD_CUSTOM.id)?.icon).toBe('database');
  });
});
