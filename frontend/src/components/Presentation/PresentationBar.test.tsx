/**
 * PresentationBar — what is being shown, the pace of the packet, the
 * terminal, full screen, and the ways out (the button and Esc).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useProjectStore } from '@/store/projectStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import PresentationBar from './PresentationBar';

const presentation = () => usePresentationStore.getState();
const project = () => useProjectStore.getState();

function addPc(label: string) {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
}

function closeEveryModal() {
  const ui = useUIStore.getState();
  for (const name of Object.keys(ui.modals) as Array<keyof typeof ui.modals>) ui.closeModal(name);
}

beforeEach(() => {
  localStorage.clear();
  presentation().exit();
  closeEveryModal();
  useSimulationStore.getState().setSpeed(1);
  createNewProject({ name: 'Sede Milano' });
  addPc('PC-1');
  presentation().enter();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('PresentationBar', () => {
  it('says what is on screen: presentation mode, and the project', () => {
    render(<PresentationBar />);
    expect(screen.getByText('Presentazione')).toBeInTheDocument();
    expect(screen.getByText('Sede Milano')).toBeInTheDocument();
  });

  it('the badge keeps its word when a narrow window leaves it the symbol alone', () => {
    render(<PresentationBar />);
    // The style sheet takes the word out of sight below 800 px (it is still
    // read aloud, and the pointer finds it): it is a piece of its own, and
    // the badge is named by it. That the bar fits is measured in a browser.
    const word = screen.getByText('Presentazione');
    expect(word).toHaveClass('presentation-badge-label');
    expect(word.parentElement).toHaveClass('presentation-badge');
    expect(word.parentElement).toHaveAttribute('title', 'Presentazione');
    // The way out is a button with its word, never the symbol alone
    expect(screen.getByRole('button', { name: 'Esci' })).toHaveTextContent('Esci');
  });

  it('shows the canvases only when the project has more than one, and switches between them', () => {
    const { unmount } = render(<PresentationBar />);
    expect(screen.queryByRole('navigation', { name: 'Canvas del progetto' })).toBeNull();
    unmount();

    const first = project().activeCanvasId;
    const second = project().addCanvas('Piano 2');
    render(<PresentationBar />);
    expect(screen.getByRole('button', { name: 'Canvas 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Piano 2' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Piano 2' }));

    expect(project().activeCanvasId).toBe(second);
    expect(project().activeCanvasId).not.toBe(first);
    expect(screen.getByRole('button', { name: 'Piano 2' })).toHaveAttribute('aria-pressed', 'true');
    // looking at another canvas is not an edit, and the presentation goes on
    expect(presentation().active).toBe(true);
    expect(useNetworkStore.getState().devices).toEqual([]);
  });

  it('sets the pace of the packet', () => {
    render(<PresentationBar />);
    expect(screen.getByRole('button', { name: 'Normale' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Veloce' }));
    expect(useSimulationStore.getState().speed).toBe(2);
    expect(screen.getByRole('button', { name: 'Veloce' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Lenta' }));
    expect(useSimulationStore.getState().speed).toBe(0.5);
  });

  it('opens the terminal', () => {
    render(<PresentationBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Terminale' }));
    expect(useUIStore.getState().modals.codeTerminal).toBe(true);
  });

  it('switches the theme', () => {
    render(<PresentationBar />);
    const dark = useUIStore.getState().darkMode;
    fireEvent.click(screen.getByRole('button', { name: /Passa al tema/ }));
    expect(useUIStore.getState().darkMode).toBe(!dark);
  });

  it('"Esci" leaves the presentation', () => {
    render(<PresentationBar />);
    fireEvent.click(screen.getByRole('button', { name: /Esci/ }));
    expect(presentation().active).toBe(false);
  });

  describe('Esc', () => {
    it('leaves the presentation', () => {
      render(<PresentationBar />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(presentation().active).toBe(false);
    });

    it('with the small menu open, closes the menu and nothing else', () => {
      render(<PresentationBar />);
      act(() => presentation().openMenu({ kind: 'device', id: 'dev-0', x: 1, y: 1 }));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(presentation().menu).toBeNull();
      expect(presentation().active).toBe(true);

      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(presentation().active).toBe(false);
    });

    it('belongs to the field the user is typing in', () => {
      render(<PresentationBar />);
      for (const tag of ['input', 'textarea', 'select'] as const) {
        const field = document.body.appendChild(document.createElement(tag));
        fireEvent.keyDown(field, { key: 'Escape' });
        expect(presentation().active, tag).toBe(true);
        field.remove();
      }
    });

    it('belongs to a window that is open (the terminal, the guide)', () => {
      render(<PresentationBar />);
      act(() => useUIStore.getState().openModal('codeTerminal'));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(presentation().active).toBe(true);

      act(() => useUIStore.getState().closeModal('codeTerminal'));
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(presentation().active).toBe(false);
    });

    it('a press that something else already used is not ours', () => {
      render(
        <>
          <PresentationBar />
          {/* stands for whatever closes on Esc and marks the press as used */}
          <div
            data-testid="uses-esc"
            onKeyDown={event => {
              if (event.key === 'Escape') event.preventDefault();
            }}
          />
        </>
      );

      fireEvent.keyDown(screen.getByTestId('uses-esc'), { key: 'Escape' });
      expect(presentation().active).toBe(true);
    });

    it('a key held down is not a second press', () => {
      render(<PresentationBar />);
      act(() => presentation().openMenu({ kind: 'device', id: 'dev-0', x: 1, y: 1 }));

      // the press closes the menu; holding the key does not go on to leave
      fireEvent.keyDown(document.body, { key: 'Escape' });
      fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });
      expect(presentation().menu).toBeNull();
      expect(presentation().active).toBe(true);
    });

    it('other keys do nothing', () => {
      render(<PresentationBar />);
      fireEvent.keyDown(document.body, { key: 'Enter' });
      fireEvent.keyDown(document.body, { key: 'q' });
      expect(presentation().active).toBe(true);
    });

    it('is not listened for once the bar is gone', () => {
      const { unmount } = render(<PresentationBar />);
      unmount();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(presentation().active).toBe(true);
    });
  });

  describe('full screen', () => {
    it('is not offered where the browser cannot do it', () => {
      render(<PresentationBar />);
      expect(screen.queryByRole('button', { name: /chermo intero/ })).toBeNull();
    });

    it('goes full screen and back, and leaves it with the presentation', () => {
      let element: Element | null = null;
      const request = vi.fn(async () => {
        element = document.documentElement;
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      const leave = vi.fn(async () => {
        element = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: request });
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: leave });
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });

      const { unmount } = render(<PresentationBar />);

      fireEvent.click(screen.getByRole('button', { name: 'Schermo intero' }));
      expect(request).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Esci dallo schermo intero' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Esci dallo schermo intero' }));
      expect(leave).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Schermo intero' })).toBeInTheDocument();

      // still full screen when the presentation ends: the bar takes it down
      fireEvent.click(screen.getByRole('button', { name: 'Schermo intero' }));
      unmount();
      expect(leave).toHaveBeenCalledTimes(2);
    });
  });
});
