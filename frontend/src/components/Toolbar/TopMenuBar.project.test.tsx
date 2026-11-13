/**
 * TopMenuBar tests — the bar says which project is open: its name, the
 * canvas when there is more than one, and whether there are changes not yet
 * saved to a file. A click on it opens the Explorer, where all of that is
 * changed. (Before, the name of the project was only inside the Explorer.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import styleSheet from '../../index.css?raw';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const project = () => screen.getByRole('button', { name: /Sede HQ|Filiale Nord/ });
const unsavedMark = () => screen.queryByRole('img', { name: 'Modifiche non salvate su file' });

function addDevice(label: string) {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
}

beforeEach(() => {
  localStorage.clear();
  // A new, empty, saved project with no file behind it
  createNewProject({ name: 'Sede HQ' });
  useUIStore.setState({ activeSidebarPanel: null, showWelcomeScreen: false });
});

describe('TopMenuBar — the project that is open', () => {
  it('shows the name of the project, and follows it when it is renamed', () => {
    render(<TopMenuBar />);
    expect(project()).toHaveTextContent('Sede HQ');

    act(() => {
      useProjectStore.getState().renameProject('Filiale Nord');
    });

    expect(project()).toHaveTextContent('Filiale Nord');
    expect(screen.queryByText('Sede HQ')).toBeNull();
  });

  it('with one canvas shows the project alone', () => {
    const { container } = render(<TopMenuBar />);

    expect(container.querySelector('.topbar-project-canvas')).toBeNull();
    expect(project().textContent).toBe('Sede HQ');
  });

  it('with more canvases shows the one on screen, and follows the change of canvas', () => {
    const { container } = render(<TopMenuBar />);
    const canvasShown = () => container.querySelector('.topbar-project-canvas')?.textContent;
    const first = useProjectStore.getState().canvases[0];

    let second = '';
    act(() => {
      second = useProjectStore.getState().addCanvas('DMZ');
    });
    expect(canvasShown()).toBe(first.name);

    act(() => {
      useProjectStore.getState().switchCanvas(second);
    });
    expect(canvasShown()).toBe('DMZ');

    act(() => {
      useProjectStore.getState().switchCanvas(first.id);
    });
    expect(canvasShown()).toBe(first.name);
  });

  it('marks the changes not yet saved to a file, until they are saved', () => {
    render(<TopMenuBar />);
    expect(unsavedMark()).toBeNull();

    act(() => {
      addDevice('PC-1');
    });
    expect(unsavedMark()).toBeInTheDocument();

    act(() => {
      useNetworkStore.getState().markSaved();
    });
    expect(unsavedMark()).toBeNull();
  });

  it('a click opens the Explorer, where the project is renamed and the canvas changed', () => {
    render(<TopMenuBar />);
    expect(useUIStore.getState().activeSidebarPanel).toBeNull();

    fireEvent.click(project());

    expect(useUIStore.getState().activeSidebarPanel).toBe('explorer');
  });

  it('is in the bar between the menus and the "Presenta" button', () => {
    render(<TopMenuBar />);
    const after = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(after(screen.getByText('Aiuto'), project())).toBe(true);
    expect(after(project(), screen.getByRole('button', { name: /Presenta/ }))).toBe(true);
  });
});

describe('the name of the project in the bar (style sheet)', () => {
  const sheet = styleSheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`).exec(sheet);
    if (!found) throw new Error(`no rule "${selector}"`);
    return found[1].replace(/\s+/g, ' ');
  };

  it('is centred on the bar, which is what it is placed against', () => {
    expect(rule('.topbar-project')).toContain('position: absolute');
    expect(rule('.topbar-project')).toContain('left: 50%');
    expect(rule('.topbar-project')).toContain('transform: translate(-50%, -50%)');
    expect(rule('.top-menubar')).toContain('position: relative');
  });

  it('a long name is cut with an ellipsis and never runs under the menus', () => {
    expect(rule('.topbar-project')).toContain('max-width: calc(100vw - 640px)');
    const text = rule('.topbar-project-name,\n.topbar-project-canvas');
    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toContain('white-space: nowrap');
    expect(text).toContain('min-width: 0');
  });
});
