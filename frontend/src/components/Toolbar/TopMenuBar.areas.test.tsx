/**
 * Vista → «Mostra i riquadri»: the areas of the canvas shown or hidden. A
 * preference of this browser, kept with the theme, not part of the drawing.
 * Hidden, an area is not on the board (nor in its small map), cannot be
 * taken, and the Delete key does not reach it; a new area shows them again,
 * and says so.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { addAreaInView, encloseDevices } from '@/utils/areaActions';
import { setLanguage } from '@/i18n';
import { answerConfirms, settled } from '@/test/confirm';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const ui = () => useUIStore.getState();
const entry = () => screen.getByRole('menuitemcheckbox', { name: /Mostra i riquadri/ });
const areasOnBoard = () => document.querySelectorAll('.react-flow__node-area').length;

const CORE = {
  label: 'Core',
  color: 'violet' as const,
  position: { x: 100, y: 50 },
  size: { width: 300, height: 200 },
};

function renderAll() {
  return render(
    <ReactFlowProvider>
      <TopMenuBar />
      <NetworkCanvas />
    </ReactFlowProvider>
  );
}

/** The Delete key, and yes to the question it asks */
async function pressDelete() {
  answerConfirms(true);
  fireEvent.keyDown(document.body, { key: 'Delete', code: 'Delete' });
  fireEvent.keyUp(document.body, { key: 'Delete', code: 'Delete' });
  await settled();
}

beforeEach(() => {
  vi.mocked(toast.info).mockClear();
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
  createNewProject({ name: 'Sede Milano' });
  act(() => ui().setAreasShown(true));
});

afterEach(() => {
  act(() => ui().setAreasShown(true));
  vi.unstubAllGlobals();
});

describe('Vista → «Mostra i riquadri»', () => {
  it('is on by default, with its mark; a click hides the areas, another shows them again', () => {
    network().addArea(CORE);
    renderAll();
    expect(entry().getAttribute('aria-checked')).toBe('true');
    expect(entry().querySelector('svg.lucide-check')).not.toBeNull();
    expect(areasOnBoard()).toBe(1);

    fireEvent.click(entry());
    expect(ui().areasShown).toBe(false);
    expect(entry().getAttribute('aria-checked')).toBe('false');
    expect(entry().querySelector('svg.lucide-check')).toBeNull();
    expect(areasOnBoard()).toBe(0);
    // (the drawing keeps them: hidden is not deleted)
    expect(network().areas).toHaveLength(1);

    fireEvent.click(entry());
    expect(areasOnBoard()).toBe(1);
  });

  it('is said in English too', () => {
    renderAll();
    try {
      act(() => setLanguage('en'));
      expect(screen.getByRole('menuitemcheckbox', { name: /Show areas/ })).toBeInTheDocument();
    } finally {
      act(() => setLanguage('it'));
    }
  });

  it('hidden, the area that was selected is let go, and the Delete key does not reach it', async () => {
    const id = network().addArea(CORE);
    renderAll();
    act(() => network().selectArea(id));

    fireEvent.click(entry());
    expect(network().selectedAreaId).toBeNull();
    // even one selected behind the board's back stays: Delete does not reach hidden areas
    act(() => network().selectArea(id));
    await pressDelete();
    expect(network().areas).toHaveLength(1);

    // shown again, Delete deletes the selected area as before
    fireEvent.click(entry());
    act(() => network().selectArea(id));
    await pressDelete();
    expect(network().areas).toHaveLength(0);
  });

  it('is a preference of this browser: kept with the theme, not in the drawing', () => {
    act(() => ui().setAreasShown(false));
    const stored = JSON.parse(localStorage.getItem('pixelcake-ui-v1') ?? '{}');
    expect(stored.state.areasShown).toBe(false);
    expect(JSON.stringify(network().areas)).not.toContain('areasShown');
  });
});

describe('a new area while the areas are hidden', () => {
  it('«Riquadro» shows them again, and says so', () => {
    act(() => ui().setAreasShown(false));
    act(() => {
      addAreaInView();
    });
    expect(ui().areasShown).toBe(true);
    expect(toast.info).toHaveBeenCalledWith('I riquadri erano nascosti: ora si vedono di nuovo');
    expect(network().areas).toHaveLength(1);
  });

  it('«Racchiudi in un riquadro» too; while they are shown, nothing is said', () => {
    const pc = network().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });
    act(() => {
      encloseDevices([pc]);
    });
    expect(toast.info).not.toHaveBeenCalled();

    act(() => ui().setAreasShown(false));
    act(() => {
      encloseDevices([pc]);
    });
    expect(ui().areasShown).toBe(true);
    expect(toast.info).toHaveBeenCalledTimes(1);
    // (around no device there is nothing to add, and nothing to show)
    act(() => ui().setAreasShown(false));
    act(() => {
      encloseDevices([]);
    });
    expect(ui().areasShown).toBe(false);
  });
});
