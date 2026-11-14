/**
 * TerminalModal tests — rendering + interaction with a mocked executor.
 * The executor is a black box: we only verify the UI contract around it
 * (echo, scrollback, history recall, clear flag, context-driven prompt),
 * plus the floating-window chrome (drag handle, resize grip, device context
 * hand-off via uiStore.terminalContextDevice).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ExecutionResult, TerminalContext } from './../../terminal/executor';
import { useUIStore } from '@/store/uiStore';
import { useSimulationStore } from '@/store/simulationStore';
import TerminalModal from './TerminalModal';

const { executeCommandMock } = vi.hoisted(() => ({
  executeCommandMock: vi.fn<(rawInput: string, context: TerminalContext) => ExecutionResult>(),
}));

vi.mock('./../../terminal/executor', () => ({
  executeCommand: executeCommandMock,
}));

/** Set the uiStore 'codeTerminal' modal open state */
const setTerminalOpen = (open: boolean) => {
  useUIStore.setState((state) => ({
    modals: { ...state.modals, codeTerminal: open },
  }));
};

/** Render the window (open) and return the terminal input element */
const openTerminal = (): HTMLInputElement => {
  setTerminalOpen(true);
  render(<TerminalModal />);
  return screen.getByLabelText<HTMLInputElement>('Riga di comando del terminale');
};

/** Type a command and press Enter */
const typeCommand = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('TerminalModal', () => {
  beforeEach(() => {
    executeCommandMock.mockReset();
    // Default executor behavior: one output line, context passed through
    executeCommandMock.mockImplementation((rawInput, context) => ({
      lines: [{ text: `executed: ${rawInput}`, tone: 'normal' }],
      context,
    }));
    // Store hygiene: window closed, no pending device context, no simulation
    useUIStore.setState((state) => ({
      modals: { ...state.modals, codeTerminal: false },
      terminalContextDevice: null,
    }));
    useSimulationStore.getState().resetSimulation();
  });

  it('renders nothing when the window is closed', () => {
    setTerminalOpen(false);
    render(<TerminalModal />);
    expect(screen.queryByText("type 'help' to list commands")).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Riga di comando del terminale')).not.toBeInTheDocument();
  });

  it('renders the welcome banner and the default prompt when open', () => {
    openTerminal();
    expect(screen.getByText('PixelCake Terminal')).toBeInTheDocument();
    expect(screen.getByText("type 'help' to list commands")).toBeInTheDocument();
    expect(screen.getByText('pixelcake>')).toBeInTheDocument();
  });

  it('renders as a floating window with drag and resize handles', () => {
    openTerminal();
    const win = screen.getByTestId('terminal-window');
    // Floating chrome: fixed position, above sidebar (100) and menubar (200)
    expect(win.style.position).toBe('fixed');
    expect(win.style.zIndex).toBe('500');
    // Header doubles as the drag handle; corner grip resizes
    expect(screen.getByTestId('terminal-drag-handle')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-resize-handle')).toBeInTheDocument();
    // Slim scoped scrollbar applied to the scroll container
    expect(screen.getByTestId('terminal-console')).toHaveClass('pc-terminal-scroll');
  });

  it('moves the window when dragging the header', () => {
    openTerminal();
    const win = screen.getByTestId('terminal-window');
    const handle = screen.getByTestId('terminal-drag-handle');
    const startLeft = parseInt(win.style.left, 10);
    const startTop = parseInt(win.style.top, 10);

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 400, clientY: 130 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 460, clientY: 180 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(parseInt(win.style.left, 10)).toBe(startLeft + 60);
    expect(parseInt(win.style.top, 10)).toBe(startTop + 50);

    // After pointerup, further moves are ignored
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 900, clientY: 600 });
    expect(parseInt(win.style.left, 10)).toBe(startLeft + 60);
  });

  it('clamps dragging so the header cannot leave the viewport at the top', () => {
    openTerminal();
    const win = screen.getByTestId('terminal-window');
    const handle = screen.getByTestId('terminal-drag-handle');

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 400, clientY: 130 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: -5000 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(win.style.top).toBe('0px');
  });

  it('resizes from the corner grip, clamped to the 480x320 minimum', () => {
    openTerminal();
    const win = screen.getByTestId('terminal-window');
    const grip = screen.getByTestId('terminal-resize-handle');
    const startWidth = parseInt(win.style.width, 10);
    const startHeight = parseInt(win.style.height, 10);

    // Shrinking far below the minimum clamps to 480x320
    fireEvent.pointerDown(grip, { pointerId: 2, button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(grip, { pointerId: 2, clientX: -2000, clientY: -2000 });
    fireEvent.pointerUp(grip, { pointerId: 2 });
    expect(win.style.width).toBe('480px');
    expect(win.style.height).toBe('320px');
    expect(startWidth).toBeGreaterThanOrEqual(480);
    expect(startHeight).toBeGreaterThanOrEqual(320);
  });

  it('starts in the device context when terminalContextDevice is set, and consumes it', () => {
    useUIStore.setState({ terminalContextDevice: 'Router-1' });
    const input = openTerminal();

    // Context line appended (same shape as the executor's `use` output)
    expect(
      screen.getByText('context: Router-1 — "from" is now implied, "exit" to leave')
    ).toBeInTheDocument();
    // Prompt reflects the device context
    expect(screen.getByText('Router-1>')).toBeInTheDocument();
    // The pending context was consumed
    expect(useUIStore.getState().terminalContextDevice).toBeNull();

    // Commands now execute inside that context
    typeCommand(input, 'show config');
    expect(executeCommandMock).toHaveBeenLastCalledWith('show config', {
      deviceLabel: 'Router-1',
    });
  });

  it('switches context when terminalContextDevice arrives while already open', () => {
    openTerminal();
    expect(screen.getByText('pixelcake>')).toBeInTheDocument();

    act(() => {
      useUIStore.getState().setTerminalContextDevice('Switch-2');
    });

    expect(
      screen.getByText('context: Switch-2 — "from" is now implied, "exit" to leave')
    ).toBeInTheDocument();
    expect(screen.getByText('Switch-2>')).toBeInTheDocument();
    expect(useUIStore.getState().terminalContextDevice).toBeNull();
  });

  it('autofocuses the input when the window opens', () => {
    const input = openTerminal();
    expect(input).toHaveFocus();
  });

  it('focuses the input when clicking anywhere in the console', () => {
    const input = openTerminal();
    input.blur();
    expect(input).not.toHaveFocus();
    fireEvent.click(screen.getByTestId('terminal-console'));
    expect(input).toHaveFocus();
  });

  it('echoes the command with the prompt and prints executor lines on Enter', () => {
    const input = openTerminal();
    typeCommand(input, 'show devices');

    expect(executeCommandMock).toHaveBeenCalledTimes(1);
    expect(executeCommandMock).toHaveBeenCalledWith('show devices', { deviceLabel: null });
    // Echoed prompt + command
    expect(screen.getByText('pixelcake> show devices')).toBeInTheDocument();
    // Executor output appended to the scrollback
    expect(screen.getByText('executed: show devices')).toBeInTheDocument();
    // Input cleared after submit
    expect(input.value).toBe('');
  });

  it('calls the executor on empty Enter but does not record it in history', () => {
    const input = openTerminal();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(executeCommandMock).toHaveBeenCalledWith('', { deviceLabel: null });

    // History is empty: ArrowUp leaves the input untouched
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('');
  });

  it('recalls history with ArrowUp (up = older) and ArrowDown (down = newer)', () => {
    const input = openTerminal();
    typeCommand(input, 'first cmd');
    typeCommand(input, 'second cmd');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('second cmd');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('first cmd');

    // Already at the oldest entry: stays put
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('first cmd');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('second cmd');

    // Past the newest entry: back to the (empty) draft
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('resets history navigation when typing, preserving the draft', () => {
    const input = openTerminal();
    typeCommand(input, 'first cmd');
    typeCommand(input, 'second cmd');

    // Start typing a new command, then navigate history
    fireEvent.change(input, { target: { value: 'dra' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('second cmd');

    // ArrowDown past the newest entry restores the draft
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('dra');

    // Typing again resets the index: ArrowUp recalls the newest entry
    fireEvent.change(input, { target: { value: 'draft2' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('second cmd');
  });

  it('empties the scrollback when the executor sets the clear flag', () => {
    const input = openTerminal();
    typeCommand(input, 'show devices');
    expect(screen.getByText('executed: show devices')).toBeInTheDocument();

    executeCommandMock.mockReturnValueOnce({
      lines: [{ text: 'screen cleared', tone: 'muted' }],
      context: { deviceLabel: null },
      clear: true,
    });
    typeCommand(input, 'clear');

    // Banner, previous output and the echoed 'clear' itself are all gone
    expect(screen.queryByText('PixelCake Terminal')).not.toBeInTheDocument();
    expect(screen.queryByText('pixelcake> show devices')).not.toBeInTheDocument();
    expect(screen.queryByText('executed: show devices')).not.toBeInTheDocument();
    expect(screen.queryByText('pixelcake> clear')).not.toBeInTheDocument();
    // Lines returned alongside the clear flag are printed
    expect(screen.getByText('screen cleared')).toBeInTheDocument();
  });

  it('updates the prompt from the context returned by the executor', () => {
    const input = openTerminal();

    executeCommandMock.mockReturnValueOnce({
      lines: [],
      context: { deviceLabel: 'PC-1' },
    });
    typeCommand(input, 'use PC-1');

    // Input-row prompt now reflects the device context
    expect(screen.getByText('PC-1>')).toBeInTheDocument();

    // The next command is echoed with the new prompt and executed in that context
    typeCommand(input, 'show config');
    expect(screen.getByText('PC-1> show config')).toBeInTheDocument();
    expect(executeCommandMock).toHaveBeenLastCalledWith('show config', { deviceLabel: 'PC-1' });
  });

  it('reveals live trace output as the packet animation advances', () => {
    const input = openTerminal();
    executeCommandMock.mockImplementationOnce((_rawInput, context) => ({
      lines: [{ text: 'Tracing route...', tone: 'muted' }],
      context,
      liveTrace: {
        animationPath: ['dev-0', 'dev-1', 'dev-2'],
        flowModel: 'ping',
        hopLines: [
          { text: 'hop 1 A', tone: 'normal' },
          { text: 'hop 2 B', tone: 'normal' },
          { text: 'hop 3 C', tone: 'success' },
        ],
        finalLines: [{ text: 'Trace complete.', tone: 'success' }],
      },
    }));

    typeCommand(input, 'trace c from a');

    // Animation started on the canvas path; header + first hop visible,
    // the rest waits for the packet
    expect(useSimulationStore.getState().isRunning).toBe(true);
    expect(useSimulationStore.getState().path).toEqual(['dev-0', 'dev-1', 'dev-2']);
    expect(screen.getByText('Tracing route...')).toBeInTheDocument();
    expect(screen.getByText('hop 1 A')).toBeInTheDocument();
    expect(screen.queryByText('hop 2 B')).not.toBeInTheDocument();
    expect(screen.queryByText('Trace complete.')).not.toBeInTheDocument();

    // The prompt is blocked while the command runs (real-terminal behavior)
    expect(screen.queryByLabelText('Riga di comando del terminale')).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-busy')).toBeInTheDocument();

    // Packet reaches the second node
    act(() => {
      useSimulationStore.getState().setCurrentHop(1);
    });
    expect(screen.getByText('hop 2 B')).toBeInTheDocument();
    expect(screen.queryByText('hop 3 C')).not.toBeInTheDocument();

    // Animation completes: last hop + verdict flushed, prompt handed back
    act(() => {
      useSimulationStore.getState().stopSimulation();
    });
    expect(screen.getByText('hop 3 C')).toBeInTheDocument();
    expect(screen.getByText('Trace complete.')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-busy')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Riga di comando del terminale')).toBeInTheDocument();
  });

  it('prints what a name lookup found when the packet is back from it, then the hops of the flow', () => {
    const input = openTerminal();
    executeCommandMock.mockImplementationOnce((_rawInput, context) => ({
      lines: [{ text: 'Looking up...', tone: 'muted' }],
      context,
      liveTrace: {
        // asker, DNS server, asker again, then the way of the trace
        animationPath: ['dev-0', 'dev-9', 'dev-0', 'dev-1', 'dev-2'],
        animationLinks: ['conn-9', 'conn-9', 'conn-1', 'conn-2'],
        flowModel: 'ping',
        lookup: {
          hops: 2,
          lines: [
            { text: 'name is 10.0.0.2', tone: 'success' },
            { text: 'Tracing route...', tone: 'muted' },
          ],
        },
        hopLines: [
          { text: 'hop 1 A', tone: 'normal' },
          { text: 'hop 2 B', tone: 'normal' },
          { text: 'hop 3 C', tone: 'success' },
        ],
        finalLines: [{ text: 'Trace complete.', tone: 'success' }],
      },
    }));

    typeCommand(input, 'trace name from a');

    // One animation for the lookup and the flow; while the question travels
    // only the header is there
    expect(useSimulationStore.getState().path).toEqual(['dev-0', 'dev-9', 'dev-0', 'dev-1', 'dev-2']);
    expect(useSimulationStore.getState().links).toEqual(['conn-9', 'conn-9', 'conn-1', 'conn-2']);
    expect(screen.getByText('Looking up...')).toBeInTheDocument();
    expect(screen.queryByText('name is 10.0.0.2')).not.toBeInTheDocument();
    expect(screen.queryByText('hop 1 A')).not.toBeInTheDocument();

    // At the DNS server: still nothing
    act(() => {
      useSimulationStore.getState().setCurrentHop(1);
    });
    expect(screen.queryByText('name is 10.0.0.2')).not.toBeInTheDocument();
    expect(screen.queryByText('hop 1 A')).not.toBeInTheDocument();

    // Back on the device that asked: what was found, and the first hop of the flow
    act(() => {
      useSimulationStore.getState().setCurrentHop(2);
    });
    expect(screen.getByText('name is 10.0.0.2')).toBeInTheDocument();
    expect(screen.getByText('Tracing route...')).toBeInTheDocument();
    expect(screen.getByText('hop 1 A')).toBeInTheDocument();
    expect(screen.queryByText('hop 2 B')).not.toBeInTheDocument();

    // The same state again prints nothing twice
    act(() => {
      useSimulationStore.getState().setCurrentHop(2);
    });
    expect(screen.getAllByText('name is 10.0.0.2')).toHaveLength(1);

    act(() => {
      useSimulationStore.getState().setCurrentHop(3);
    });
    expect(screen.getByText('hop 2 B')).toBeInTheDocument();
    expect(screen.queryByText('hop 3 C')).not.toBeInTheDocument();

    act(() => {
      useSimulationStore.getState().stopSimulation();
    });
    expect(screen.getByText('hop 3 C')).toBeInTheDocument();
    expect(screen.getByText('Trace complete.')).toBeInTheDocument();
    expect(screen.getAllByText('name is 10.0.0.2')).toHaveLength(1);
    expect(screen.getByLabelText('Riga di comando del terminale')).toBeInTheDocument();
  });

  it('an animation that ends before the lookup is back prints everything, in order', () => {
    const input = openTerminal();
    executeCommandMock.mockImplementationOnce((_rawInput, context) => ({
      lines: [{ text: 'Looking up...', tone: 'muted' }],
      context,
      liveTrace: {
        animationPath: ['dev-0', 'dev-9', 'dev-0', 'dev-1'],
        flowModel: 'web',
        lookup: { hops: 2, lines: [{ text: 'name is 10.0.0.2', tone: 'success' }] },
        hopLines: [{ text: 'hop 1 A', tone: 'normal' }],
        finalLines: [{ text: 'Page received.', tone: 'success' }],
      },
    }));

    typeCommand(input, 'browse name from a');
    act(() => {
      useSimulationStore.getState().stopSimulation();
    });
    const texts = ['Looking up...', 'name is 10.0.0.2', 'hop 1 A', 'Page received.'];
    const all = document.body.textContent ?? '';
    const places = texts.map(text => all.indexOf(text));
    expect(places.every(place => place >= 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    expect(screen.queryByTestId('terminal-busy')).not.toBeInTheDocument();
  });

  it('Ctrl+C while the question travels drops what the lookup found, with the rest', () => {
    const input = openTerminal();
    executeCommandMock.mockImplementationOnce((_rawInput, context) => ({
      lines: [],
      context,
      liveTrace: {
        animationPath: ['dev-0', 'dev-9', 'dev-0', 'dev-1'],
        flowModel: 'ping',
        lookup: { hops: 2, lines: [{ text: 'name is 10.0.0.2', tone: 'success' }] },
        hopLines: [],
        finalLines: [{ text: 'Reply.', tone: 'success' }],
      },
    }));
    typeCommand(input, 'ping name from a');
    expect(screen.queryByText('name is 10.0.0.2')).not.toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    });
    expect(screen.queryByText('name is 10.0.0.2')).not.toBeInTheDocument();
    expect(screen.queryByText('Reply.')).not.toBeInTheDocument();
    expect(screen.getByText('^C — interrupted')).toBeInTheDocument();
  });

  it('sets the packet off on the cables the command names', () => {
    const input = openTerminal();
    executeCommandMock.mockImplementationOnce((_rawInput, context) => ({
      lines: [],
      context,
      liveTrace: {
        animationPath: ['dev-0', 'dev-1'],
        animationLinks: ['conn-7'],
        flowModel: 'web',
        hopLines: [],
        finalLines: [],
      },
    }));

    typeCommand(input, 'browse b from a');

    expect(useSimulationStore.getState()).toMatchObject({
      isRunning: true,
      flowModel: 'web',
      path: ['dev-0', 'dev-1'],
      links: ['conn-7'],
    });
  });

  it('Ctrl+C interrupts a running command without printing the remaining output', () => {
    const input = openTerminal();
    executeCommandMock.mockImplementationOnce((_rawInput, context) => ({
      lines: [{ text: 'Tracing route...', tone: 'muted' }],
      context,
      liveTrace: {
        animationPath: ['dev-0', 'dev-1', 'dev-2'],
        flowModel: 'ping',
        hopLines: [
          { text: 'hop 1 A', tone: 'normal' },
          { text: 'hop 2 B', tone: 'normal' },
          { text: 'hop 3 C', tone: 'success' },
        ],
        finalLines: [{ text: 'Trace complete.', tone: 'success' }],
      },
    }));

    typeCommand(input, 'trace c from a');
    expect(screen.getByTestId('terminal-busy')).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    });

    // Aborted: ^C marker, no pending hops or verdict, prompt back, sim stopped
    expect(screen.getByText('^C — interrupted')).toBeInTheDocument();
    expect(screen.queryByText('hop 2 B')).not.toBeInTheDocument();
    expect(screen.queryByText('Trace complete.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-busy')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Riga di comando del terminale')).toBeInTheDocument();
    expect(useSimulationStore.getState().isRunning).toBe(false);
  });
});
