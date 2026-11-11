/**
 * App smoke tests — the application starts and works with no server at all:
 * nothing is fetched, there is always a project, and the welcome screen
 * follows the user's preference.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { _api as iconApi } from '@iconify/react';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { serializeProject } from '@/utils/projectFile';
import { createNewProject } from '@/utils/projectFileAccess';
import { createSampleTopology } from '@/utils/sampleTopology';
import App from './App';

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** What jsdom lacks and the canvas needs to mount */
function stubBrowser() {
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
}

function allToasts(): Mock[] {
  return [toast.success, toast.error, toast.warning, toast.info] as Mock[];
}

describe('App', () => {
  let fetchSpy: Mock;

  beforeEach(() => {
    localStorage.clear();
    stubBrowser();
    fetchSpy = vi.fn(() => Promise.reject(new Error('there is no server')));
    vi.stubGlobal('fetch', fetchSpy);
    createNewProject({ name: 'Sede Milano' });
    useUIStore.setState({ isAuthenticated: true, showWelcomeScreen: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts without calling any server and without complaining about one', async () => {
    render(<App />);

    expect(screen.getByText('File')).toBeInTheDocument();
    // give start-up effects and anything they schedule the time to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    for (const shown of allToasts()) {
      expect(shown).not.toHaveBeenCalled();
    }
  });

  it('draws its icons from the bundle, without asking the icon API', async () => {
    // The icon library keeps its own reference to fetch: this replaces it
    const iconFetch = vi.fn(() => Promise.reject(new Error('no icon API in tests')));
    const originalFetch = iconApi.getFetch();
    iconApi.setFetch(iconFetch as unknown as typeof fetch);
    const sample = createSampleTopology();
    useNetworkStore.getState().loadTopology(sample.devices, sample.connections);

    try {
      render(<App />);
      // the library asks for missing icons a moment after they are drawn
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      expect(iconFetch).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) iconApi.setFetch(originalFetch);
    }
  });

  it('shows the welcome screen on an empty canvas at start-up', () => {
    render(<App />);

    expect(useUIStore.getState().showWelcomeScreen).toBe(true);
    expect(screen.getByText('Visual Network Designer')).toBeInTheDocument();
  });

  it('does not show it on an empty canvas of a project that has other canvases', () => {
    const second = useProjectStore.getState().addCanvas('Piano 2');

    render(<App />);

    // two canvases, both empty: the project is not a blank start any more
    expect(screen.queryByText('Visual Network Designer')).toBeNull();

    act(() => {
      useProjectStore.getState().switchCanvas(second);
    });
    expect(screen.queryByText('Visual Network Designer')).toBeNull();

    // back to a single empty canvas: it is a blank start again
    act(() => {
      useProjectStore.getState().deleteCanvas(second);
    });
    expect(screen.getByText('Visual Network Designer')).toBeInTheDocument();
  });

  it('leaves the theme alone at start-up, whatever the system prefers', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    useUIStore.getState().setDarkMode(false);

    render(<App />);

    expect(useUIStore.getState().darkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('does not show it when the user chose not to see it again', () => {
    localStorage.setItem('pixelcake-hide-welcome', 'true');

    render(<App />);

    expect(useUIStore.getState().showWelcomeScreen).toBe(false);
    expect(screen.queryByText('Visual Network Designer')).toBeNull();
  });

  it('does not show it over a drawing, and shows it again when the canvas is emptied', () => {
    useNetworkStore.getState().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });

    render(<App />);
    expect(screen.queryByText('Visual Network Designer')).toBeNull();

    act(() => useNetworkStore.getState().removeDevice('dev-0'));
    expect(screen.getByText('Visual Network Designer')).toBeInTheDocument();
  });

  it('switching canvas shows each canvas where it was left (pan and zoom)', async () => {
    const network = () => useNetworkStore.getState();
    const project = () => useProjectStore.getState();
    // Canvas 1 left at one view, canvas "B" at another
    network().setViewport({ x: 120, y: -40, zoom: 1.5 });
    const second = project().addCanvas('B');
    project().switchCanvas(second);
    network().setViewport({ x: -300, y: 75, zoom: 0.5 });
    project().switchCanvas('canvas-1');
    network().markSaved();

    render(<App />);
    const view = () =>
      document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform;
    expect(view()).toBe('translate(120px,-40px) scale(1.5)');

    // (React Flow moves the view on its next animation frame)
    act(() => project().switchCanvas(second));
    await waitFor(() => expect(view()).toBe('translate(-300px,75px) scale(0.5)'));

    act(() => project().switchCanvas('canvas-1'));
    await waitFor(() => expect(view()).toBe('translate(120px,-40px) scale(1.5)'));
    // moving the view this way does not come back as a change of the canvas
    expect(network().viewport).toEqual({ x: 120, y: -40, zoom: 1.5 });
    expect(network().hasUnsavedChanges).toBe(false);
  });

  // ---------- whole flows, through the real screens ----------

  describe('welcome screen', () => {
    it('"Carica Sample Topology" draws the sample, which is then something to save', () => {
      render(<App />);

      fireEvent.click(screen.getByText('Carica Sample Topology'));

      expect(screen.queryByText('Visual Network Designer')).toBeNull();
      expect(screen.getByText('PC-1')).toBeInTheDocument();
      expect(screen.getByText('Router-1')).toBeInTheDocument();
      expect(useNetworkStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('"Apri Progetto" opens the file picker: cancelling it leaves the welcome screen', async () => {
      const picker = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
      vi.stubGlobal('showOpenFilePicker', picker);
      render(<App />);

      fireEvent.click(screen.getByText('Apri Progetto'));

      await waitFor(() => expect(picker).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(screen.getByText('Visual Network Designer')).toBeInTheDocument();
      expect(useProjectStore.getState().name).toBe('Sede Milano');
    });

    it('"Apri Progetto" with a file: the project is on screen and the welcome screen is gone', async () => {
      const text = serializeProject({
        format: 'pixelcake-project',
        version: 1,
        name: 'Sede Roma',
        description: 'Aperto da file',
        savedAt: '2026-11-10T08:00:00.000Z',
        settings: { ipClass: '10.0.0.0', subnet: '255.0.0.0', gateway: '10.0.0.1' },
        activeCanvasId: 'canvas-1',
        canvases: [
          {
            id: 'canvas-1',
            name: 'Piano terra',
            devices: [
              {
                id: 'dev-0',
                type: 'PC',
                label: 'Reception',
                ip: '10.0.0.10',
                subnet: '255.0.0.0',
                gateway: '10.0.0.1',
                position: { x: 0, y: 0 },
              },
            ],
            connections: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            deviceCounter: 1,
            connectionCounter: 0,
          },
          {
            id: 'canvas-2',
            name: 'Primo piano',
            devices: [],
            connections: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            deviceCounter: 0,
            connectionCounter: 0,
          },
        ],
        templates: { devices: [], connections: [] },
      });
      const handle = {
        name: 'sede-roma.pixelcake.json',
        getFile: async () => new File([text], 'sede-roma.pixelcake.json'),
        createWritable: async () => ({ write: async () => {}, close: async () => {} }),
      };
      vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([handle]));
      useUIStore.setState({ activeSidebarPanel: 'explorer' });
      render(<App />);

      fireEvent.click(screen.getByText('Apri Progetto'));

      await waitFor(() => expect(screen.getByText('Reception')).toBeInTheDocument());
      expect(screen.queryByText('Visual Network Designer')).toBeNull();
      // the explorer shows the project that was opened
      expect(screen.getByText('Sede Roma')).toBeInTheDocument();
      expect(screen.getByText('Aperto da file')).toBeInTheDocument();
      expect(screen.getByText('Piano terra')).toBeInTheDocument();
      expect(screen.getByText('Primo piano')).toBeInTheDocument();
      expect(screen.queryByText('Modifiche non salvate su file')).toBeNull();

      // its second canvas is empty: the device leaves the screen, and comes back
      fireEvent.click(screen.getByText('Primo piano'));
      expect(screen.queryByText('Reception')).toBeNull();
      fireEvent.click(screen.getByText('Piano terra'));
      expect(screen.getByText('Reception')).toBeInTheDocument();
    });

    it('"Nuovo Progetto" opens the form; the new project starts on its empty canvas', () => {
      useUIStore.setState({ activeSidebarPanel: 'explorer' });
      render(<App />);

      fireEvent.click(screen.getByText('Nuovo Progetto'));
      fireEvent.change(screen.getByLabelText('Nome Progetto *'), {
        target: { value: 'Sede Torino' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Crea Progetto' }));

      expect(screen.getByText('Sede Torino')).toBeInTheDocument();
      expect(screen.queryByText('Visual Network Designer')).toBeNull();
      expect(screen.queryByLabelText('Nome Progetto *')).toBeNull();
      expect(useProjectStore.getState().canvases).toHaveLength(1);
    });
  });

  describe('a drawing that is not saved to a file yet', () => {
    function draw() {
      useNetworkStore.getState().addDevice({
        type: 'PC',
        label: 'PC-1',
        ip: '192.168.1.10',
        subnet: '255.255.255.0',
        gateway: '192.168.1.1',
        position: { x: 0, y: 0 },
      });
    }

    it('File → Nuovo progetto… keeps it when the user declines the confirmation', () => {
      draw();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<App />);

      fireEvent.click(screen.getByText('Nuovo progetto…'));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText('Nome Progetto *')).toBeNull();
      expect(screen.getByText('PC-1')).toBeInTheDocument();
    });

    it('is still there after a reload of the page', () => {
      draw();
      const { unmount } = render(<App />);
      expect(screen.getByText('PC-1')).toBeInTheDocument();
      unmount();

      // what the next page load finds in the browser
      const stored = JSON.parse(localStorage.getItem('pixelcake-network-v2') ?? '{}');
      expect(stored.state.devices).toHaveLength(1);
      expect(stored.state.hasUnsavedChanges).toBe(true);
      expect(JSON.parse(localStorage.getItem('pixelcake-project-v1') ?? '{}').state).toMatchObject({
        name: 'Sede Milano',
        activeCanvasId: 'canvas-1',
      });
    });
  });

  it('Ctrl+S saves the project to a file', async () => {
    let written = '';
    const handle = {
      name: 'sede-milano.pixelcake.json',
      getFile: async () => new File([written], 'sede-milano.pixelcake.json'),
      createWritable: async () => ({
        write: async (data: string) => {
          written = data;
        },
        close: async () => {},
      }),
    };
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue(handle));
    render(<App />);
    act(() => useNetworkStore.getState().setGlobalNetworkSettings({ gateway: '192.168.1.254' }));

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(document.body, event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(useNetworkStore.getState().hasUnsavedChanges).toBe(false));
    expect(JSON.parse(written)).toMatchObject({
      format: 'pixelcake-project',
      name: 'Sede Milano',
      settings: { gateway: '192.168.1.254' },
    });
  });

  it('the save shortcut belongs to the app, not to the login page', () => {
    useUIStore.setState({ isAuthenticated: false });
    const picker = vi.fn();
    vi.stubGlobal('showSaveFilePicker', picker);
    render(<App />);

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(document.body, event);

    expect(event.defaultPrevented).toBe(false);
    expect(picker).not.toHaveBeenCalled();
  });
});
