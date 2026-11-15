/**
 * The guide and the areas of the canvas («riquadri») tell the same story:
 * every name the step puts in «quotes» is on a control of the app, and what
 * it says an area does is what it does.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { renderDrawingImage } from '@/utils/drawingImage';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';
import { serializeProject } from '@/utils/projectFile';
import { useProjectStore } from '@/store/projectStore';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import Sidebar from '@/components/Sidebar/Sidebar';
import DevicePanel from '@/components/Sidebar/DevicePanel';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import ContextMenu from '@/components/ui/ContextMenu';
import AreaContextMenu from '@/components/ui/AreaContextMenu';
import HelpModal from './HelpModal';
import SettingsModal from './SettingsModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Raggruppa con i riquadri';
const ui = () => useUIStore.getState();
const store = () => useNetworkStore.getState();

/** The text of one step of the guide, by its title */
function step(title: string): string {
  ui().openHelp('guide');
  render(<HelpModal />);
  const text = (screen.getByText(title).closest('li')?.textContent ?? '').replace(/\s+/g, ' ');
  cleanup();
  ui().closeModal('help');
  return text;
}

/** What a step puts in «quotes»: the names of controls */
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1]);

function addPc(label: string, position: { x: number; y: number }) {
  return store().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position,
  });
}

function renderCanvas() {
  return render(
    <ReactFlowProvider>
      <NetworkCanvas />
      <AreaContextMenu />
    </ReactFlowProvider>
  );
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
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
  ui().closeContextMenu();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the guide — the areas of the canvas', () => {
  it('has the step, after joining the devices and before setting them', () => {
    ui().openHelp('guide');
    render(<HelpModal />);
    const titles = Array.from(document.querySelectorAll('li')).map((li) => li.querySelector('p')?.textContent);
    const at = (title: string) => titles.indexOf(title);
    expect(at(TITLE)).toBe(at('Collegali') + 1);
    expect(at(TITLE)).toBe(at('Configurali') - 1);
  });

  it('names what is on the screen', () => {
    expect(quoted(step(TITLE))).toEqual([
      'Aggiungi dispositivo',
      'Riquadro',
      'Racchiudi in un riquadro',
      'Rinomina',
      'Elimina',
      'Mostra i riquadri',
    ]);
  });

  it('Vista has the entry it names, which hides the areas and shows them again', () => {
    expect(step(TITLE)).toContain('Vista → «Mostra i riquadri» li nasconde e li mostra di nuovo');
    useNetworkStore.getState().addArea({ label: 'Core', color: 'violet', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } });
    render(
      <ReactFlowProvider>
        <TopMenuBar />
        <NetworkCanvas />
      </ReactFlowProvider>
    );
    const entry = screen.getByRole('menuitemcheckbox', { name: /Mostra i riquadri/ });
    expect(document.querySelectorAll('.react-flow__node-area')).toHaveLength(1);
    fireEvent.click(entry);
    expect(document.querySelectorAll('.react-flow__node-area')).toHaveLength(0);
    fireEvent.click(entry);
    expect(useUIStore.getState().areasShown).toBe(true);
  });

  it('the panel it names has the entry it names, which adds an area in the middle of the view', () => {
    expect(step(TITLE)).toContain(
      "Nel pannello «Aggiungi dispositivo» c'è «Riquadro», che ne aggiunge uno al centro della vista"
    );
    const sidebar = render(<Sidebar />);
    expect(screen.getByRole('button', { name: 'Aggiungi dispositivo' })).toBeInTheDocument();
    sidebar.unmount();

    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /^Riquadro/ }));
    const [area] = store().areas;
    expect(area.position.x + area.size.width / 2).toBe(Math.round(window.innerWidth / 2));
    expect(area.position.y + area.size.height / 2).toBe(Math.round(window.innerHeight / 2));
  });

  it('Modifica and the menu of a device have the entry it names: the area is made around the selected devices', () => {
    expect(step(TITLE)).toContain(
      "seleziona i dispositivi e scegli Modifica → «Racchiudi in un riquadro» (c'è anche nel clic destro su un dispositivo): il riquadro nasce intorno a loro."
    );
    const first = addPc('PC-1', { x: 100, y: 200 });
    const second = addPc('PC-2', { x: 400, y: 150 });
    store().selectMultipleDevices([first, second]);
    render(
      <>
        <TopMenuBar />
        <ContextMenu />
      </>
    );
    const modifica = screen.getByText('Modifica', { selector: '.menu-item > span' }).parentElement!;
    fireEvent.click(Array.from(modifica.querySelectorAll('li')).find((li) => li.textContent === 'Racchiudi in un riquadro')!);
    const [area] = store().areas;
    // both devices are inside it (where nothing measures it, a device is its frame)
    for (const device of store().devices) {
      expect(device.position.x).toBeGreaterThan(area.position.x);
      expect(device.position.y).toBeGreaterThan(area.position.y);
      expect(device.position.x + DEVICE_METRICS.width).toBeLessThan(area.position.x + area.size.width);
      expect(device.position.y + deviceHeight(true)).toBeLessThan(area.position.y + area.size.height);
    }

    act(() => ui().setContextMenuDevice(store().devices[0], 40, 60));
    expect(Array.from(document.querySelectorAll('.context-menu.show li')).map((li) => li.textContent)).toContain(
      'Racchiudi in un riquadro'
    );
  });

  it('the name is typed and confirmed with Enter; a double click on it renames', () => {
    expect(step(TITLE)).toContain('Scrivi il nome e premi Invio.');
    expect(step(TITLE)).toContain('Un doppio clic sul nome lo rinomina');
    addPc('PC-1', { x: 0, y: 0 });
    renderCanvas();
    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /^Riquadro/ }));

    const field = screen.getByLabelText('Nome del riquadro');
    fireEvent.change(field, { target: { value: 'Core' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(store().areas[0].label).toBe('Core');

    fireEvent.doubleClick(document.querySelector('.area-label')!);
    expect(screen.getByLabelText('Nome del riquadro')).toHaveValue('Core');
  });

  it('it is taken by its name or its border, moving it leaves the devices where they are, and selected it has eight handles', () => {
    expect(step(TITLE)).toContain(
      'Un riquadro si prende dal nome o dal bordo: trascinandolo si sposta, e i dispositivi restano dove sono; quando è selezionato mostra otto maniglie per ridimensionarlo.'
    );
    const device = addPc('PC-1', { x: 150, y: 120 });
    const id = store().addArea({ label: 'Core', color: 'slate', position: { x: 100, y: 50 }, size: { width: 300, height: 200 } });
    renderCanvas();
    const drawn = screen.getByTestId(`area-${id}`);

    for (const grip of [drawn.querySelector('.area-label')!, drawn.querySelector('.area-edge-right')!]) {
      const before = store().areas[0].position;
      fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 60, clientY: 50 });
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 60, clientY: 50 });
      expect(store().areas[0].position).toEqual({ x: before.x + 40, y: before.y + 30 });
    }
    expect(store().devices.find((d) => d.id === device)?.position).toEqual({ x: 150, y: 120 });
    expect(store().selectedAreaId).toBe(id);
    expect(drawn.querySelectorAll('.area-resize-handle')).toHaveLength(8);
  });

  it('the right button opens the menu it describes, and the key it names deletes the selected area', () => {
    expect(step(TITLE)).toContain(
      'il clic destro apre un menu con «Rinomina», i colori ed «Elimina», e il tasto Canc elimina il riquadro selezionato.'
    );
    addPc('PC-1', { x: 0, y: 0 });
    const id = store().addArea({ label: 'Core', color: 'slate', position: { x: 100, y: 50 }, size: { width: 300, height: 200 } });
    renderCanvas();

    fireEvent.contextMenu(document.querySelector('.area-label')!, { clientX: 140, clientY: 70 });
    expect(Array.from(document.querySelectorAll('.context-menu.show li')).map((li) => li.textContent)).toEqual([
      'Rinomina',
      'Elimina',
    ]);
    expect(screen.getByRole('group', { name: 'Colore del riquadro' }).querySelectorAll('button')).toHaveLength(6);
    act(() => ui().closeContextMenu());

    expect(store().selectedAreaId).toBe(id);
    fireEvent.keyDown(document.body, { key: 'Delete', code: 'Delete' });
    expect(store().areas).toEqual([]);
    expect(store().devices).toHaveLength(1);

    // «Canc» is what the list of shortcuts calls that key, and it says the same
    cleanup();
    act(() => ui().openModal('settings'));
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Avanzate' }));
    const line = screen.getByText('Elimina i dispositivi selezionati, o il riquadro selezionato');
    expect(line.nextElementSibling).toHaveTextContent('Canc');
    act(() => ui().closeModal('settings'));
  });

  it('the inside of an area is not in the way: what is there is not the area\'s to catch', () => {
    expect(step(TITLE)).toContain(
      "L'interno di un riquadro non intralcia: lì dentro i dispositivi si selezionano, si collegano e si spostano come sempre."
    );
    addPc('PC-1', { x: 150, y: 120 });
    const id = store().addArea({ label: 'Core', color: 'slate', position: { x: 100, y: 50 }, size: { width: 300, height: 200 } });
    renderCanvas();
    // the area itself catches nothing; only its label and the sides of its border do
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
    expect(node.className).not.toContain('selectable');
    expect(node.style.pointerEvents).toBe('none');
    const catching = Array.from(screen.getByTestId(`area-${id}`).children).map((child) => child.className.split(' ')[0]);
    expect(catching).toEqual(['area-edge', 'area-edge', 'area-edge', 'area-edge', 'area-label']);
    // and it is under the devices
    expect(node.style.zIndex).toBe('-1');
  });

  it('they are in the exported picture and in the project that is saved, as it says', () => {
    expect(step(TITLE)).toContain(
      "I riquadri si vedono anche in presentazione e nell'immagine esportata, e vengono salvati con il progetto."
    );
    addPc('PC-1', { x: 150, y: 120 });
    store().addArea({ label: 'Core', color: 'slate', position: { x: 100, y: 50 }, size: { width: 300, height: 200 } });

    const { devices, connections, areas } = store();
    const picture = renderDrawingImage(
      { devices, connections, areas, deviceTemplates: [], connectionTemplates: [], measureText: (text) => text.length * 6 },
      { theme: 'light' }
    );
    expect(picture.svg).toContain('>CORE</text>');

    const file = JSON.parse(serializeProject(useProjectStore.getState().buildProjectFile()));
    expect(file.canvases[0].areas).toEqual([
      { id: 'area-1', label: 'Core', color: 'slate', position: { x: 100, y: 50 }, size: { width: 300, height: 200 } },
    ]);
  });
});
