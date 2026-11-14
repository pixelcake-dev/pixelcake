/**
 * The interface in English, screen by screen: no Italian is left anywhere a
 * person can read it or a screen reader can say it (text, `title`,
 * `placeholder`, `aria-label`, `alt`).
 *
 * Each screen is drawn in Italian and the language is changed while it is on
 * screen, as the switch does: what does not follow the change is found as
 * Italian left behind. So one pass checks two things: that every text has
 * its English, and that it changes at once.
 *
 * The network on the board is the sample of a small company, loaded in
 * English: what the app names is named in the language of that moment, and
 * is content afterwards.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, fireEvent } from '@testing-library/react';
import { setLanguage } from '@/i18n';
import { italianIn } from '@/test/italian';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createCompanySample } from '@/utils/sampleCompany';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import App from '@/App';

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

// jsdom paints nothing: the picture window is left waiting for its PNG
vi.mock('@/utils/imageExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/imageExport')>()),
  rasterizeSvg: vi.fn(() => new Promise(() => {})),
  saveImage: vi.fn(),
  copyImage: vi.fn(),
  canCopyImage: vi.fn(() => true),
  canChooseWhereToSave: vi.fn(() => true),
}));

const network = () => useNetworkStore.getState();
const ui = () => useUIStore.getState();
const presentation = () => usePresentationStore.getState();

function device(label: string) {
  const found = network().devices.find((entry) => entry.label === label);
  if (!found) throw new Error(`no device "${label}" on the board`);
  return found;
}

function cableBetween(a: string, b: string) {
  const ends = [device(a).id, device(b).id];
  const found = network().connections.find((entry) => ends.includes(entry.source) && ends.includes(entry.target));
  if (!found) throw new Error(`no cable between "${a}" and "${b}"`);
  return found;
}

const READ_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt'];

/** Everything Italian a person could read on the page right now, with where it is */
function italianOnScreen(): string[] {
  const findings: string[] = [];
  const read = (text: string | null, where: string) => {
    if (!text || !text.trim()) return;
    const italian = italianIn(text);
    if (italian.length > 0) findings.push(`${where}: "${text.replace(/\s+/g, ' ').trim().slice(0, 80)}" [${italian.join(', ')}]`);
  };
  // (a language named in itself, «Italiano», is not Italian left behind; the
  // page as a whole says its language on <html>, which is not what is meant)
  const skipped = (element: Element | null) => element?.closest('style, script, body [lang="it"]') != null;

  const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = texts.nextNode(); node; node = texts.nextNode()) {
    if (!skipped(node.parentElement)) read(node.textContent, 'text');
  }
  for (const element of document.body.querySelectorAll('*')) {
    if (skipped(element)) continue;
    for (const attribute of READ_ATTRIBUTES) read(element.getAttribute(attribute), attribute);
  }
  return findings;
}

/** The screen is in Italian now; change the language as the switch does and give back what stayed Italian */
function switchToEnglish(): string[] {
  // (first, proof that the scan sees this screen at all)
  expect(italianOnScreen().length).toBeGreaterThan(3);
  act(() => setLanguage('en'));
  return italianOnScreen();
}

/** Click every tab in view once, also those a tab brings up, and give back the Italian found under each */
function italianUnderEveryTab(selector: string): string[] {
  const seen = new Set<string>();
  const findings: string[] = [];
  for (;;) {
    const next = [...document.querySelectorAll<HTMLElement>(selector)].find(
      (tab) => !seen.has(tab.textContent ?? '')
    );
    if (!next) break;
    const name = next.textContent ?? '';
    seen.add(name);
    fireEvent.click(next);
    findings.push(...italianOnScreen().map((finding) => `under "${name}": ${finding}`));
  }
  expect(seen.size).toBeGreaterThan(1);
  return findings;
}

function loadSample(sample: () => { devices: Parameters<ReturnType<typeof network>['loadTopology']>[0]; connections: Parameters<ReturnType<typeof network>['loadTopology']>[1] }) {
  const { devices, connections } = sample();
  network().loadTopology(devices, connections);
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

  // What the app names, it names in English: the project, its board, the sample
  setLanguage('en');
  createNewProject({ name: '' });
  loadSample(createCompanySample);
  // …and the screen starts in Italian, to be switched while it is drawn
  setLanguage('it');

  presentation().exit();
  ui().closeContextMenu();
  useUIStore.setState((state) => ({
    showWelcomeScreen: false,
    welcomeRequested: false,
    helpTab: 'guide',
    activeSidebarPanel: null,
    inspectorDevice: null,
    inspectorConnection: null,
    modals: Object.fromEntries(Object.keys(state.modals).map((name) => [name, false])) as typeof state.modals,
  }));
});

afterEach(() => {
  act(() => presentation().exit());
  vi.unstubAllGlobals();
});

describe('the interface in English', () => {
  it('the scan finds Italian where there is some, and none in English', () => {
    document.body.innerHTML =
      '<p>Nessun dispositivo</p><button title="Chiudi la finestra"></button><input placeholder="Cerca dispositivo..." />' +
      '<img alt="Anteprima" /><span aria-label="Elimina la regola 2"></span><button lang="it" title="Italiano">it</button>';
    expect(italianOnScreen()).toHaveLength(5);

    document.body.innerHTML =
      '<p>No devices</p><button title="Close the window"></button><input placeholder="Search devices..." />' +
      '<span>PC-Vendite</span><code>ping www.azienda.example from PC-1</code><button lang="it" title="Italiano">it</button>';
    expect(italianOnScreen()).toEqual([]);
    document.body.innerHTML = '';
  });

  it('the welcome screen', () => {
    act(() => network().clearAllDevices());
    useUIStore.setState({ showWelcomeScreen: true });
    render(<App />);
    expect(document.querySelector('.welcome-screen-container')).not.toBeNull();

    expect(switchToEnglish()).toEqual([]);
  });

  it('the board with a network on it, the menu bar with all its menus, the sidebar', () => {
    render(<App />);
    expect(document.querySelectorAll('.dropdown-content li').length).toBeGreaterThan(15);

    expect(switchToEnglish()).toEqual([]);
    // what the sample named is in English, because it was loaded in English
    expect(document.body.textContent).toContain('PC-Sales');
    expect(document.documentElement.lang).toBe('en');
  });

  it.each(['explorer', 'simulation', 'devices'] as const)('the %s panel', (panel) => {
    render(<App />);
    act(() => ui().setActiveSidebarPanel(panel));

    expect(switchToEnglish()).toEqual([]);
    if (panel === 'devices') expect(italianUnderEveryTab('.segmented button:not([lang])')).toEqual([]);
  });

  it.each([
    ['PC', 'tpl-pc'],
    ['Switch', 'tpl-switch'],
    ['Router', 'tpl-router'],
    ['Server', 'tpl-server'],
  ] as const)('the window that adds a device (%s)', (type, templateId) => {
    render(<App />);
    act(() => {
      ui().setAddDeviceType(type, templateId);
      ui().openModal('addDevice');
    });

    expect(switchToEnglish()).toEqual([]);
  });

  it('the window that adds many devices', () => {
    render(<App />);
    act(() => ui().openModal('bulkAddDevice'));

    expect(switchToEnglish()).toEqual([]);
  });

  it.each([
    ['a PC', 'PC-Sales'],
    ['a PC on DHCP', 'Laptop-1'],
    ['a server that answers for names', 'Srv-Auth'],
    ['a switch', 'SW-Offices'],
    ['a router', 'Router-Core'],
    ['a firewall', 'FW-Edge'],
    ['an access point', 'AP-Offices'],
  ])('the window of a device: %s, every tab, a port or a card open', (_kind, label) => {
    render(<App />);
    act(() => {
      ui().setInspectorDevice(device(label));
      ui().openModal('inspector');
    });

    expect(switchToEnglish()).toEqual([]);
    expect(italianUnderEveryTab('.tab-header')).toEqual([]);

    // a port picked in the grid, or a card opened in the list, shows its own fields
    const tabs = [...document.querySelectorAll<HTMLElement>('.tab-header')];
    const interfaces = tabs.find((tab) => /^(Ports|Network cards)/.test(tab.textContent ?? ''));
    expect(interfaces).toBeDefined();
    fireEvent.click(interfaces!);
    const first = document.querySelector<HTMLElement>('.port-box, .nic-card');
    expect(first).not.toBeNull();
    fireEvent.click(first!);
    expect(italianOnScreen()).toEqual([]);
  });

  it('a device left without an address says so in words, on the board and in the menus that list it', () => {
    // A PC on DHCP with no server on its network: nobody hands it an address
    act(() => {
      network().clearAllDevices();
      network().addDevice({
        type: 'PC',
        label: 'PC-1',
        ip: '',
        subnet: '',
        gateway: '',
        position: { x: 100, y: 100 },
        nics: [{ id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip: '', subnet: '', gateway: '', dhcp: true }],
      });
      network().addDevice({
        type: 'PC',
        label: 'PC-2',
        ip: '192.168.1.11',
        subnet: '255.255.255.0',
        gateway: '',
        position: { x: 300, y: 100 },
      });
    });
    render(<App />);
    act(() => ui().setActiveSidebarPanel('simulation'));
    expect(document.body.textContent).toContain('DHCP: nessun indirizzo');

    act(() => setLanguage('en'));

    expect(italianOnScreen()).toEqual([]);
    expect(document.body.textContent).toContain('DHCP: no address');
    expect(document.body.textContent).not.toContain('nessun indirizzo');
  });

  it('the window of a link', () => {
    render(<App />);
    act(() => {
      ui().setInspectorConnection(cableBetween('PC-Sales', 'SW-Offices'));
      ui().openModal('connectionInspector');
    });

    expect(switchToEnglish()).toEqual([]);
  });

  it('the menus a right click opens: on a device, on a link, on an area', () => {
    render(<App />);

    act(() => ui().setContextMenuDevice(device('Router-Core'), 200, 200));
    expect(document.querySelector('.context-menu.show')).not.toBeNull();
    expect(switchToEnglish()).toEqual([]);

    act(() => ui().setContextMenuConnection(cableBetween('PC-Sales', 'SW-Offices'), 200, 200));
    expect(italianOnScreen()).toEqual([]);

    let areaId = '';
    act(() => {
      areaId = network().addArea({
        label: '',
        color: 'slate',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
      });
      ui().setContextMenuArea(areaId, 200, 200);
    });
    expect(italianOnScreen()).toEqual([]);
    // (an area without a name says so in words, on the board)
    expect(document.body.textContent).toContain('Unnamed');
  });

  it('the settings, every tab and the tabs inside them', () => {
    render(<App />);
    act(() => ui().openModal('settings'));

    expect(switchToEnglish()).toEqual([]);
    expect(italianUnderEveryTab('.settings-tab')).toEqual([]);
  });

  it('the guide, its three tabs', () => {
    render(<App />);
    act(() => ui().openHelp('guide'));

    expect(switchToEnglish()).toEqual([]);
    expect(italianUnderEveryTab('.settings-tab')).toEqual([]);
  });

  it('the window that creates a project, the terminal, the import and export window', () => {
    render(<App />);

    act(() => ui().openModal('newProject'));
    expect(switchToEnglish()).toEqual([]);
    act(() => ui().closeModal('newProject'));

    act(() => ui().openModal('codeTerminal'));
    expect(italianOnScreen()).toEqual([]);
    act(() => ui().closeModal('codeTerminal'));

    act(() => ui().openModal('importExport'));
    expect(italianOnScreen()).toEqual([]);
    expect(italianUnderEveryTab('.settings-tab')).toEqual([]);
  });

  it('the window that exports the board as a picture', () => {
    render(<App />);
    act(() => ui().openModal('exportImage'));

    expect(switchToEnglish()).toEqual([]);
  });

  it('presentation mode: the bar, the panel with a question and its answer, a failure, the two menus', () => {
    // (the sample made for failures: two sites, a main line and a backup line)
    setLanguage('en');
    loadSample(createRedundancySample);
    setLanguage('it');
    render(<App />);
    act(() => {
      expect(presentation().enter()).toBe(true);
    });
    act(() => {
      presentation().setSource(device('PC-Branch-1').id);
      presentation().setTarget(device('Srv-File').id);
    });
    expect(document.querySelector('.presentation-panel')).not.toBeNull();

    expect(switchToEnglish()).toEqual([]);

    // the main line is cut: the answer, the simulated failure and its effect on the rest
    act(() => presentation().toggleConnectionFailure(cableBetween('R-HQ', 'R-Branch').id));
    expect(italianOnScreen()).toEqual([]);
    expect(document.body.textContent).toContain('Simulated failures');

    act(() => presentation().openMenu({ kind: 'device', id: device('SW-Core').id, x: 300, y: 300 }));
    expect(document.querySelector('.presentation-menu')).not.toBeNull();
    expect(italianOnScreen()).toEqual([]);

    act(() =>
      presentation().openMenu({ kind: 'connection', id: cableBetween('R-HQ', 'R-Branch').id, x: 300, y: 300 })
    );
    expect(italianOnScreen()).toEqual([]);

    // a device that is down, and a question that no longer arrives
    act(() => presentation().toggleDeviceFailure(device('R-Backup').id));
    expect(italianOnScreen()).toEqual([]);

    // every kind of exchange
    for (const flow of ['web', 'email', 'ping'] as const) {
      act(() => presentation().setFlow(flow));
      expect(italianOnScreen()).toEqual([]);
    }
  });
});
