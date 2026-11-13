/**
 * Presentation mode — the bar that takes the place of the menu bar: what is
 * being shown (project, canvas), the pace of the packet, the terminal, full
 * screen, and the way out.
 */

import { useEffect, useState } from 'react';
import {
  ImageDown,
  LogOut,
  Maximize,
  Minimize,
  Moon,
  Presentation,
  Sun,
  Terminal,
} from 'lucide-react';
import { usePresentationStore } from '@/store/presentationStore';
import { useProjectStore } from '@/store/projectStore';
import { SIMULATION_SPEEDS, useSimulationStore, type SimulationSpeed } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';

const SPEED_NAMES: Record<SimulationSpeed, string> = {
  0.5: 'Lenta',
  1: 'Normale',
  2: 'Veloce',
};

/** True while the user is typing somewhere: keys belong to that field */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

const PresentationBar = () => {
  const exit = usePresentationStore((state) => state.exit);
  const projectName = useProjectStore((state) => state.name);
  const canvases = useProjectStore((state) => state.canvases);
  const activeCanvasId = useProjectStore((state) => state.activeCanvasId);
  const switchCanvas = useProjectStore((state) => state.switchCanvas);
  const speed = useSimulationStore((state) => state.speed);
  const setSpeed = useSimulationStore((state) => state.setSpeed);
  const openModal = useUIStore((state) => state.openModal);
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);

  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement != null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Leaving the presentation leaves full screen too
  useEffect(() => {
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  // Esc: close the small menu if it is open, else leave the presentation.
  // While something else has the keyboard (a field, a window such as the
  // terminal) the key is not ours. Nor is a press that was already used (a
  // window that closed on it), or the same press going on: a key held down
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented || event.repeat) return;
      const presentation = usePresentationStore.getState();
      if (presentation.menu) {
        presentation.closeMenu();
        return;
      }
      if (isTyping(event.target)) return;
      if (Object.values(useUIStore.getState().modals).some(Boolean)) return;
      presentation.exit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  };

  return (
    <header className="presentation-bar">
      <span className="presentation-badge">
        <Presentation size={16} aria-hidden="true" /> Presentazione
      </span>
      <span className="presentation-project" title={projectName}>
        {projectName}
      </span>

      {canvases.length > 1 && (
        <nav className="presentation-canvases" aria-label="Canvas del progetto">
          {canvases.map((canvas) => (
            <button
              key={canvas.id}
              type="button"
              className={canvas.id === activeCanvasId ? 'active' : ''}
              aria-pressed={canvas.id === activeCanvasId}
              onClick={() => switchCanvas(canvas.id)}
            >
              {canvas.name}
            </button>
          ))}
        </nav>
      )}

      <div className="presentation-bar-tools">
        <div className="presentation-segmented compact" role="group" aria-label="Velocità del pacchetto">
          {SIMULATION_SPEEDS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={speed === entry ? 'active' : ''}
              aria-pressed={speed === entry}
              onClick={() => setSpeed(entry)}
            >
              {SPEED_NAMES[entry]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="presentation-icon-button"
          title="Terminale"
          aria-label="Terminale"
          onClick={() => openModal('codeTerminal')}
        >
          <Terminal size={18} />
        </button>
        {/* What is on screen now, as a picture: the drawing, the failures, the answer */}
        <button
          type="button"
          className="presentation-icon-button"
          title="Esporta immagine"
          aria-label="Esporta immagine"
          onClick={() => openModal('exportImage')}
        >
          <ImageDown size={18} />
        </button>
        {typeof document.documentElement.requestFullscreen === 'function' && (
          <button
            type="button"
            className="presentation-icon-button"
            title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            aria-label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}
        <button
          type="button"
          className="presentation-icon-button"
          title={darkMode ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
          aria-label={darkMode ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
          onClick={toggleDarkMode}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button type="button" className="presentation-exit" onClick={exit}>
          <LogOut size={16} aria-hidden="true" /> Esci
        </button>
      </div>
    </header>
  );
};

export default PresentationBar;
