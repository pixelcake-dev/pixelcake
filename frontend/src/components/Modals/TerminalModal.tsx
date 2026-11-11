/**
 * TerminalModal — interactive network terminal in a floating window
 *
 * UI shell around the terminal executor (parser/engine live behind
 * `@/terminal/executor`, treated as a black box here). Owns the scrollback,
 * the input line with bash-like history recall, and the device-context
 * prompt. The console pane is intentionally dark regardless of the app
 * theme, like a real terminal.
 *
 * Rendered as a floating, draggable, resizable window (no backdrop) so the
 * canvas stays visible and interactive around it. The Apple-dots header is
 * the drag handle; a bottom-right grip resizes. Geometry lives in component
 * state and survives close/reopen because the component stays mounted and
 * simply returns null while closed.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSimulationStore } from '@/store/simulationStore';
import { executeCommand, type TerminalContext } from '@/terminal/executor';
import type { TerminalLine } from '@/terminal/types';

/** Live diagnostic session: hop lines printed as the packet travels */
interface LiveSession {
  hopLines: TerminalLine[];
  finalLines: TerminalLine[];
  /** Number of hopLines already printed */
  printed: number;
}

/** Fixed console palette — the pane stays dark regardless of app theme */
const CONSOLE_BG = '#16181d';
const CONSOLE_INPUT_COLOR = '#e6edf3';
const CONSOLE_CARET = '#4dd0e1';

const MONO_FONT =
  "'JetBrains Mono', 'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** Tone → color mapping for scrollback lines (on the fixed dark background) */
const TONE_STYLES: Record<TerminalLine['tone'], CSSProperties> = {
  normal: { color: '#d4d8de' },
  success: { color: '#3fb950' },
  error: { color: '#f85149' },
  muted: { color: '#8b949e' },
  heading: { color: '#e3b341', fontWeight: 700 },
  command: { color: '#4dd0e1' },
};

/** Shown once, on first open (persists in scrollback until `clear`) */
const WELCOME_LINES: TerminalLine[] = [
  { text: 'PixelCake Terminal', tone: 'muted' },
  { text: "type 'help' to list commands", tone: 'muted' },
];

/* ── window geometry ──────────────────────────────────────────────────── */

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;
const DEFAULT_TOP = 120;
const MIN_WIDTH = 480;
const MIN_HEIGHT = 320;
/** Approximate header height — used to keep the drag handle reachable */
const HEADER_HEIGHT = 44;
/** Minimum horizontal sliver of the window that must remain in the viewport */
const MIN_VISIBLE_X = 80;

interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ResizeState {
  pointerId: number;
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
}

const initialGeometry = (): WindowGeometry => {
  const width = Math.min(DEFAULT_WIDTH, window.innerWidth);
  const height = Math.min(DEFAULT_HEIGHT, window.innerHeight);
  return {
    x: Math.max(0, Math.round((window.innerWidth - width) / 2)),
    y: Math.min(DEFAULT_TOP, Math.max(0, window.innerHeight - height)),
    width,
    height,
  };
};

/** Clamp a position so at least part of the header stays reachable */
const clampPosition = (x: number, y: number, width: number): { x: number; y: number } => ({
  x: Math.min(Math.max(x, MIN_VISIBLE_X - width), window.innerWidth - MIN_VISIBLE_X),
  y: Math.min(Math.max(y, 0), Math.max(0, window.innerHeight - HEADER_HEIGHT)),
});

/** Clamp a size between the minimum and the viewport */
const clampSize = (width: number, height: number): { width: number; height: number } => ({
  width: Math.min(Math.max(width, MIN_WIDTH), window.innerWidth),
  height: Math.min(Math.max(height, MIN_HEIGHT), window.innerHeight),
});

/** setPointerCapture, tolerating environments without Pointer Events (jsdom) */
const capturePointer = (element: Element, pointerId: number): void => {
  if (typeof element.setPointerCapture === 'function') {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      /* pointer capture unavailable (e.g. jsdom) — dragging still works while over the handle */
    }
  }
};

/** Slim, dark, unobtrusive scrollbar — scoped to the terminal scroll pane */
const SCROLLBAR_CSS = `
.pc-terminal-scroll::-webkit-scrollbar { width: 8px; }
.pc-terminal-scroll::-webkit-scrollbar-track { background: transparent; }
.pc-terminal-scroll::-webkit-scrollbar-thumb { background-color: #3a3f4b; border-radius: 4px; }
.pc-terminal-scroll::-webkit-scrollbar-thumb:hover { background-color: #4a5161; }
.pc-terminal-scroll { scrollbar-width: thin; scrollbar-color: #3a3f4b transparent; }
`;

const TerminalModal = () => {
  const isOpen = useUIStore((state) => state.modals.codeTerminal);
  const closeModal = useUIStore((state) => state.closeModal);
  const terminalContextDevice = useUIStore((state) => state.terminalContextDevice);

  const [lines, setLines] = useState<TerminalLine[]>(WELCOME_LINES);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  /** null = not navigating history; otherwise index into `history` */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [context, setContext] = useState<TerminalContext>({ deviceLabel: null });
  const [geometry, setGeometry] = useState<WindowGeometry>(initialGeometry);
  /** True while a diagnostic command runs: the prompt is blocked until done */
  const [isBusy, setIsBusy] = useState(false);

  /** What was typed before history navigation started (restored on ArrowDown past newest) */
  const draftRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  /** Pending live trace: output follows the canvas packet animation */
  const liveRef = useRef<LiveSession | null>(null);

  const prompt = `${context.deviceLabel ?? 'pixelcake'}> `;

  // Auto-scroll to the bottom whenever new output arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  // Autofocus the input when the window opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Consume a pending device context (set when the terminal is opened from a
  // device). Runs both on closed→open transitions and when a new device
  // arrives while the window is already open.
  useEffect(() => {
    if (!isOpen || !terminalContextDevice) return;
    setContext({ deviceLabel: terminalContextDevice });
    setLines((prev) => [
      ...prev,
      {
        text: `context: ${terminalContextDevice} — "from" is now implied, "exit" to leave`,
        tone: 'success',
      },
    ]);
    useUIStore.getState().setTerminalContextDevice(null);
  }, [isOpen, terminalContextDevice]);

  // Mirror the canvas packet animation into the scrollback: each trace hop
  // line appears when the packet reaches that node, the verdict when the
  // animation completes. Driven by simulationStore (PacketAnimation owns
  // the timing), so terminal output and visible flow stay in sync.
  useEffect(() => {
    const unsubscribe = useSimulationStore.subscribe((state) => {
      const live = liveRef.current;
      if (!live) return;
      if (state.isRunning) {
        const upTo = Math.min(state.currentHop, live.hopLines.length - 1);
        if (upTo >= live.printed) {
          const batch = live.hopLines.slice(live.printed, upTo + 1);
          live.printed = upTo + 1;
          if (batch.length > 0) {
            setLines((prev) => [...prev, ...batch]);
          }
        }
      } else {
        // Animation finished (or was stopped): flush the rest + verdict,
        // then hand the prompt back
        liveRef.current = null;
        setLines((prev) => [...prev, ...live.hopLines.slice(live.printed), ...live.finalLines]);
        setIsBusy(false);
      }
    });
    return unsubscribe;
  }, []);

  /** Finish any pending live session immediately (before a new command) */
  const flushLiveSession = () => {
    const live = liveRef.current;
    if (!live) return;
    liveRef.current = null;
    setLines((prev) => [...prev, ...live.hopLines.slice(live.printed), ...live.finalLines]);
    setIsBusy(false);
  };

  /** Ctrl+C: abort the running command, real-terminal style */
  useEffect(() => {
    if (!isBusy) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        // Drop the pending output BEFORE stopping: the flush in the store
        // subscription must not print the remaining hops of an aborted run
        liveRef.current = null;
        setLines((prev) => [...prev, { text: '^C — interrupted', tone: 'muted' }]);
        setIsBusy(false);
        useSimulationStore.getState().stopSimulation();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBusy]);

  // Hand focus back to the prompt when a command completes
  useEffect(() => {
    if (!isBusy && isOpen) {
      inputRef.current?.focus();
    }
  }, [isBusy, isOpen]);

  const handleClose = () => {
    closeModal('codeTerminal');
  };

  const focusInput = () => {
    // Don't steal focus while the user is selecting output text
    if (window.getSelection()?.toString()) return;
    inputRef.current?.focus();
  };

  const runCommand = () => {
    const raw = input;
    const echo: TerminalLine = { text: prompt + raw, tone: 'command' };
    flushLiveSession();
    const result = executeCommand(raw, context);
    setLines((prev) => {
      const base = result.clear ? [] : [...prev, echo];
      return [...base, ...result.lines];
    });
    setContext(result.context);

    // Diagnostic with a visible flow: drive the canvas animation and let the
    // subscription above reveal the output hop by hop. The prompt stays
    // blocked (isBusy) until the run completes or Ctrl+C interrupts it.
    if (result.liveTrace) {
      const { animationPath, flowModel, hopLines, finalLines } = result.liveTrace;
      const simulation = useSimulationStore.getState();
      if (simulation.isRunning) {
        simulation.stopSimulation();
      }
      liveRef.current = { hopLines, finalLines, printed: 0 };
      setIsBusy(true);
      simulation.startSimulation(animationPath, flowModel);
    }

    if (raw.trim() !== '') {
      setHistory((prev) => [...prev, raw]);
    }
    setInput('');
    setHistoryIndex(null);
    draftRef.current = '';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === null) {
        // Start navigating: remember the draft, recall the newest entry
        draftRef.current = input;
        setHistoryIndex(history.length - 1);
        setInput(history[history.length - 1]);
      } else if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setInput(history[historyIndex - 1]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      if (historyIndex < history.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setInput(history[historyIndex + 1]);
      } else {
        // Past the newest entry: restore whatever was being typed
        setHistoryIndex(null);
        setInput(draftRef.current);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    // Typing resets history navigation (bash-like)
    setHistoryIndex(null);
  };

  /* ── drag (header) ────────────────────────────────────────────────── */

  const handleDragPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: geometry.x,
      originY: geometry.y,
    };
    capturePointer(e.currentTarget, e.pointerId);
  };

  const handleDragPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setGeometry((g) => ({
      ...g,
      ...clampPosition(drag.originX + dx, drag.originY + dy, g.width),
    }));
  };

  const handleDragPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  /* ── resize (bottom-right grip) ───────────────────────────────────── */

  const handleResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originWidth: geometry.width,
      originHeight: geometry.height,
    };
    capturePointer(e.currentTarget, e.pointerId);
  };

  const handleResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const dx = e.clientX - resize.startX;
    const dy = e.clientY - resize.startY;
    setGeometry((g) => ({
      ...g,
      ...clampSize(resize.originWidth + dx, resize.originHeight + dy),
    }));
  };

  const handleResizePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === e.pointerId) {
      resizeRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-testid="terminal-window"
      role="dialog"
      aria-label="Terminal"
      style={{
        position: 'fixed',
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        zIndex: 500, // above sidebar (100) and menubar (200)
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--terminal-border)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)',
        backgroundColor: CONSOLE_BG,
      }}
    >
      <style>{SCROLLBAR_CSS}</style>

      {/* Header con pallini stile Apple — doubles as the drag handle */}
      <div
        data-testid="terminal-drag-handle"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerEnd}
        onPointerCancel={handleDragPointerEnd}
        className="terminal-header flex items-center gap-2 px-4 py-3 bg-[var(--terminal-header-bg)] border-b border-[var(--terminal-border)]"
        style={{ cursor: 'move', touchAction: 'none', userSelect: 'none', flexShrink: 0 }}
      >
        {/* Pallini rosso, giallo, verde (pointerdown stopped so clicks don't drag) */}
        <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <div
            className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff6b63] transition-colors cursor-pointer"
            title="Close"
            onClick={handleClose}
          ></div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffc43d] transition-colors cursor-pointer" title="Minimize"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#36d44e] transition-colors cursor-pointer" title="Maximize"></div>
        </div>

        {/* Titolo centrato */}
        <div className="flex-1 text-center text-sm font-medium text-[var(--terminal-title-color)]">
          Terminal
        </div>

        {/* Spazio per bilanciare i pallini */}
        <div className="w-[68px]"></div>
      </div>

      {/* Corpo del terminale: scrollback + input line in un unico pannello scrollabile */}
      <div
        ref={scrollRef}
        data-testid="terminal-console"
        aria-label="Terminal output"
        onClick={focusInput}
        className="terminal-body pc-terminal-scroll"
        style={{
          backgroundColor: CONSOLE_BG,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '14px 16px',
          fontFamily: MONO_FONT,
          fontSize: '13px',
          lineHeight: 1.55,
          cursor: 'text',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        {lines.map((line, index) => (
          <div
            key={index}
            style={{
              ...TONE_STYLES[line.tone],
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {line.text === '' ? ' ' : line.text}
          </div>
        ))}

        {/* Input row: prompt + caret, part of the buffer like a real terminal.
            While a command runs the prompt is withheld (blocked terminal) and
            a busy indicator takes its place. */}
        {isBusy ? (
          <div data-testid="terminal-busy" style={{ ...TONE_STYLES.muted, whiteSpace: 'pre-wrap' }}>
            ▌ running… — press Ctrl+C to interrupt
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span
              style={{
                ...TONE_STYLES.command,
                whiteSpace: 'pre',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              {prompt}
            </span>
            <input
              ref={inputRef}
              aria-label="Terminal input"
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                margin: 0,
                color: CONSOLE_INPUT_COLOR,
                caretColor: CONSOLE_CARET,
                font: 'inherit',
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom-right resize grip */}
      <div
        data-testid="terminal-resize-handle"
        aria-hidden="true"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '18px',
          height: '18px',
          cursor: 'nwse-resize',
          touchAction: 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block', opacity: 0.6 }}>
          <path
            d="M14 7 L7 14 M14 11.5 L11.5 14"
            stroke="#8b949e"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
};

export default TerminalModal;
