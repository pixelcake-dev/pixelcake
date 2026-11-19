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
import { X } from 'lucide-react';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useNetworkStore } from '@/store/networkStore';
import { executeCommand, type TerminalContext } from '@/terminal/executor';
import type { TerminalLine } from '@/terminal/types';
import { useT } from '@/i18n';
import { useEscapeToClose } from '@/components/ui/useEscapeToClose';

/** Live diagnostic session: hop lines printed as the packet travels */
interface LiveSession {
  hopLines: TerminalLine[];
  finalLines: TerminalLine[];
  /** Number of hopLines already printed */
  printed: number;
  /**
   * Path index `hopLines[0]` belongs to: past the stretches of a name lookup
   * that comes before the flow, 0 without one
   */
  offset: number;
  /** What the lookup found, printed when the packet is back from it; emptied once printed */
  lookupLines: TerminalLine[];
}

/** Everything a live session still has to print, in the order it is printed */
const pendingLines = (live: LiveSession): TerminalLine[] => [
  ...live.lookupLines,
  ...live.hopLines.slice(live.printed),
  ...live.finalLines,
];

/** Fixed console palette — the pane stays dark regardless of app theme.
 *  The colours are those of the terminal shown on the site; the caret is the
 *  orange of the logo */
const CONSOLE_BG = '#161b1f';
const CONSOLE_INPUT_COLOR = '#ffffff';
const CONSOLE_CARET = '#F07D2A';

const MONO_FONT =
  "'JetBrains Mono', 'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** Tone → color mapping for scrollback lines (on the fixed dark background) */
const TONE_STYLES: Record<TerminalLine['tone'], CSSProperties> = {
  normal: { color: '#dde3e8' },
  success: { color: '#63d391' },
  error: { color: '#ff8370' },
  muted: { color: '#808d97' },
  heading: { color: '#ffffff', fontWeight: 700 },
  command: { color: '#ffffff', fontWeight: 500 },
};

/** Shown once, on first open (persists in scrollback until `clear`) */
const WELCOME_LINES: TerminalLine[] = [
  { text: 'PixelCake Terminal', tone: 'muted' },
  { text: "type 'help' to list commands", tone: 'muted' },
];

/* ── window geometry ──────────────────────────────────────────────────── */

// It opens small and at the right edge, under the menu bar, so that the
// drawing stays in view (the mini map, at the bottom right, stays free too)
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 340;
const DEFAULT_TOP = 64;
const DEFAULT_MARGIN = 16;
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
    x: Math.max(0, window.innerWidth - width - DEFAULT_MARGIN),
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
.pc-terminal-scroll::-webkit-scrollbar-thumb { background-color: #333d44; border-radius: 2px; }
.pc-terminal-scroll::-webkit-scrollbar-thumb:hover { background-color: #47535b; }
.pc-terminal-scroll { scrollbar-width: thin; scrollbar-color: #333d44 transparent; }
`;

const TerminalModal = () => {
  // Only the window is in the language of the interface: what the terminal
  // itself says (banner, prompt, hints, output) is English in every language
  const t = useT();
  const isOpen = useUIStore((state) => state.modals.codeTerminal);
  const closeModal = useUIStore((state) => state.closeModal);
  const terminalContextDevice = useUIStore((state) => state.terminalContextDevice);
  const terminalCommand = useUIStore((state) => state.terminalCommand);

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

  // A device renamed elsewhere (its window, a YAML added) while the terminal
  // is inside it: the prompt follows it, as it follows a rename inside `use`.
  // The context names the device; here the name is pinned to the device it
  // meant when it was entered, and moves with it. A device that leaves the
  // board (deleted, or taken back by an undo) takes the context with it.
  useEffect(() => {
    const label = context.deviceLabel;
    if (!label) return;
    const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
    const named = useNetworkStore.getState().devices.filter((d) => key(d.label ?? '') === key(label));
    if (named.length !== 1) return; // gone, or two with that name: the executor says so
    const id = named[0].id;
    return useNetworkStore.subscribe((state) => {
      const device = state.devices.find((d) => d.id === id);
      if (!device) {
        setContext((current) => (current.deviceLabel === label ? { ...current, deviceLabel: null } : current));
        setLines((prev) => [...prev, { text: `left ${label} — it is no longer on the board`, tone: 'muted' }]);
        return;
      }
      if (device.label && device.label !== label) {
        setContext((current) => (current.deviceLabel === label ? { ...current, deviceLabel: device.label } : current));
      }
    });
  }, [context.deviceLabel]);

  // Mirror the canvas packet animation into the scrollback: each trace hop
  // line appears when the packet reaches that node, the verdict when the
  // animation completes. Driven by simulationStore (PacketAnimation owns
  // the timing), so terminal output and visible flow stay in sync.
  useEffect(() => {
    const unsubscribe = useSimulationStore.subscribe((state) => {
      const live = liveRef.current;
      if (!live) return;
      if (state.isRunning) {
        // A lookup that came first: what it found, once the packet is back from it
        const batch = state.currentHop >= live.offset ? live.lookupLines.splice(0) : [];
        const upTo = Math.min(state.currentHop - live.offset, live.hopLines.length - 1);
        if (upTo >= live.printed) {
          batch.push(...live.hopLines.slice(live.printed, upTo + 1));
          live.printed = upTo + 1;
        }
        if (batch.length > 0) {
          setLines((prev) => [...prev, ...batch]);
        }
      } else {
        // Animation finished (or was stopped): flush the rest + verdict,
        // then hand the prompt back
        liveRef.current = null;
        setLines((prev) => [...prev, ...pendingLines(live)]);
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
    setLines((prev) => [...prev, ...pendingLines(live)]);
    setIsBusy(false);
  };

  /** Abort the running command (Ctrl+C, and Esc before it closes the window) */
  const interrupt = () => {
    // Drop the pending output BEFORE stopping: the flush in the store
    // subscription must not print the remaining hops of an aborted run
    liveRef.current = null;
    setLines((prev) => [...prev, { text: '^C — interrupted', tone: 'muted' }]);
    setIsBusy(false);
    useSimulationStore.getState().stopSimulation();
  };

  /** Ctrl+C: abort the running command, real-terminal style */
  useEffect(() => {
    if (!isBusy) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        interrupt();
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

  // Esc closes the window, as its cross does; a command that runs is
  // interrupted first, as Ctrl+C does. It takes its place among the windows
  // that Esc closes (the one opened last goes first), and the press is marked
  // as used, so that nothing else in the app answers it too
  useEscapeToClose(isOpen, () => {
    if (liveRef.current || isBusy) interrupt();
    handleClose();
  });

  const focusInput = () => {
    // Don't steal focus while the user is selecting output text
    if (window.getSelection()?.toString()) return;
    inputRef.current?.focus();
  };

  /** Run a line: what is typed at the prompt, or a command handed over */
  const runCommand = (raw: string = input) => {
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
      const { animationPath, animationLinks, flowModel, hopLines, finalLines, lookup, outcome } =
        result.liveTrace;
      const simulation = useSimulationStore.getState();
      if (simulation.isRunning) {
        simulation.stopSimulation();
      }
      liveRef.current = {
        hopLines,
        finalLines,
        printed: 0,
        offset: lookup?.hops ?? 0,
        lookupLines: [...(lookup?.lines ?? [])],
      };
      setIsBusy(true);
      simulation.startSimulation(animationPath, flowModel, animationLinks, outcome);
    } else if (result.outcome) {
      // A question that stops where it starts: nothing travels, the device says so at once
      useSimulationStore.getState().leaveAnswer(result.outcome);
    }

    if (raw.trim() !== '') {
      setHistory((prev) => [...prev, raw]);
    }
    setInput('');
    setHistoryIndex(null);
    draftRef.current = '';
  };

  // A command handed over as the window opens (the first question a sample
  // suggests): typed and run as if the user had, once. Read from the store,
  // not from this render, so that it is never run twice
  const runCommandRef = useRef(runCommand);
  useEffect(() => {
    runCommandRef.current = runCommand;
  });
  useEffect(() => {
    if (!isOpen) return;
    const command = useUIStore.getState().terminalCommand;
    if (!command) return;
    useUIStore.getState().setTerminalCommand(null);
    runCommandRef.current(command);
  }, [isOpen, terminalCommand]);

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
      aria-label={t.terminal.title}
      style={{
        position: 'fixed',
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        zIndex: 500, // above sidebar (100) and menubar (200)
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--terminal-border)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.28)',
        backgroundColor: CONSOLE_BG,
      }}
    >
      <style>{SCROLLBAR_CSS}</style>

      {/* Header: the title on the left, the way out on the right — doubles as the drag handle */}
      <div
        data-testid="terminal-drag-handle"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerEnd}
        onPointerCancel={handleDragPointerEnd}
        className="terminal-header flex items-center gap-2 pl-4 pr-2 py-1.5 bg-[var(--terminal-header-bg)] border-b border-[var(--terminal-border)]"
        style={{ cursor: 'move', touchAction: 'none', userSelect: 'none', flexShrink: 0 }}
      >
        {/* The title, set as a label */}
        <div className="flex-1 text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--terminal-title-color)]">
          {t.terminal.title}
        </div>

        {/* The way out (pointerdown stopped so a click does not start a drag) */}
        <div className="flex items-center" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1 rounded text-[var(--terminal-title-color)] hover:text-[var(--text-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title={t.common.actions.close}
            aria-label={t.terminal.close}
            onClick={handleClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The body of the terminal: scrollback and input line in one scrolling pane */}
      <div
        ref={scrollRef}
        data-testid="terminal-console"
        aria-label={t.terminal.output}
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
              aria-label={t.terminal.input}
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
            stroke="#808d97"
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
