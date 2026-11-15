/**
 * The guide on how a device is joined to another, and on what its drawing
 * says: every sentence states something the app does.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { runFlowSimulation } from '@/utils/runSimulation';
import styleSheet from '@/index.css?raw';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import HelpModal from './HelpModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const ui = () => useUIStore.getState();
const network = () => useNetworkStore.getState();
const simulation = () => useSimulationStore.getState();
const id = (label: string) => network().devices.find((device) => device.label === label)!.id;

/** The text of one step of the guide, by its title */
function step(title: string): string {
  ui().openHelp('guide');
  render(<HelpModal />);
  const text = screen.getByText(title).closest('li')?.textContent?.replace(/\s+/g, ' ') ?? '';
  cleanup();
  ui().closeModal('help');
  return text;
}

const sheet = styleSheet.replace(/\r\n/g, '\n');
/** The declarations of the first rule with exactly this selector */
const rule = (selector: string) => {
  const start = sheet.indexOf(`\n${selector} {\n`);
  if (start === -1) throw new Error(`no rule "${selector}"`);
  return sheet.slice(start, sheet.indexOf('\n}', start));
};

function renderCanvas() {
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
  render(
    <ReactFlowProvider>
      <NetworkCanvas />
    </ReactFlowProvider>
  );
}

const lampOf = (label: string) =>
  [...(screen.getByText(label, { selector: '.device-name' }).closest('.network-device')!.querySelector('svg.device-drawing')!.classList)]
    .find((name) => name.startsWith('is-'));

beforeEach(() => {
  localStorage.clear();
  network().clearAllDevices();
  const sample = createCompanySample();
  network().loadTopology(sample.devices, sample.connections);
  simulation().resetSimulation();
  useUIStore.setState({ showWelcomeScreen: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the guide — how two devices are joined', () => {
  it('a cable is pulled from the side of a device, which turns orange under the pointer', () => {
    const text = step('Collegali');
    expect(text).toContain(
      'Passa con il mouse sul bordo di un dispositivo: il lato sotto il puntatore diventa arancione.'
    );
    expect(text).toContain('Trascina da lì fino a un altro dispositivo e lascialo andare sopra: il cavo arriva sul lato dove lo lasci.');
    // no points to look for any more
    expect(text).not.toContain('punti di connessione');

    // the side under the pointer is the accent, the orange of the logo
    expect(rule('.connect-point:hover::after')).toContain('opacity: 1');
    const bare = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(bare).toMatch(/\}\s*\.connect-point::after\s*\{\s*background-color: var\(--accent-color\);/);
    // while a cable is pulled it can be let go anywhere on a device: the four bands cover it
    expect(rule('body.react-flow-connecting .connect-point-left::before')).toContain('width: 52px');
  });
});

describe('the guide — what the drawing of a device says', () => {
  it('after a question the device that answers is green, and stays so until something else happens', () => {
    const text = step('Chiedi se un dispositivo ne raggiunge un altro');
    expect(text).toContain(
      'Quando il pacchetto è arrivato in fondo, la parte alta del disegno del dispositivo che risponde diventa verde, o quella del dispositivo dove la domanda si ferma diventa rossa, con il bordo dello stesso colore; restano così fino alla domanda successiva, a una modifica del disegno o a un clic su un punto vuoto del canvas. Vale anche per le domande fatte dal terminale.'
    );
    renderCanvas();

    expect(runFlowSimulation(id('PC-Vendite'), id('Web-Gestionale'), 'ping')).toBe(true);
    // (the packet gets to the end of its way)
    act(() => simulation().finishSimulation());
    expect(lampOf('Web-Gestionale')).toBe('is-ok');

    // a wrong gateway: the question stops where it starts, at once
    const pc = network().devices.find((device) => device.label === 'PC-Vendite')!;
    act(() =>
      network().updateDevice(pc.id, {
        nics: pc.nics?.map((nic, index) => (index === 0 ? { ...nic, gateway: '192.168.10.254' } : nic)),
      })
    );
    expect(lampOf('Web-Gestionale')).toBe('is-rest');
    act(() => {
      expect(runFlowSimulation(id('PC-Vendite'), id('Web-Gestionale'), 'ping')).toBe(false);
    });
    expect(lampOf('PC-Vendite')).toBe('is-error');
  });

  it('a device whose first card waits for an address nobody gives it turns yellow', () => {
    const text = step('Dai gli indirizzi con il DHCP');
    expect(text).toContain(
      'quando è la prima scheda del dispositivo, sul canvas la parte alta del suo disegno diventa gialla.'
    );
    // the router of the sample stops handing out the addresses of the Wi-Fi
    const router = network().devices.find((device) => device.label === 'Router-Core')!;
    network().updateDevice(router.id, {
      ports: router.ports?.map((port) => (port.id === 2 ? { ...port, dhcpServer: undefined } : port)),
    });
    renderCanvas();

    expect(lampOf('Portatile-1')).toBe('is-warning');
    expect(lampOf('PC-Vendite')).toBe('is-rest');
  });
});
