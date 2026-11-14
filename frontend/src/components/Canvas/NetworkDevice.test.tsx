/**
 * A device on the canvas: its drawing, its name under it, then its address,
 * and no box. Where a cable ends on each of its four sides, and what its
 * upper layer says.
 *
 * The canvas is the real one (React Flow included); only what jsdom lacks is
 * stubbed. How it looks is checked by eye in the browser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { DEVICE_METRICS, cableEnd, type Side } from '@/utils/deviceGeometry';
import NetworkCanvas from './NetworkCanvas';

const LEFT = 0;
const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

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

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

function add(label: string, type = 'PC', more: { ip?: string; templateId?: string; notes?: string } = {}) {
  return network().addDevice({
    type,
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: network().devices.length * 200, y: 0 },
    ...more,
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderCanvas() {
  render(
    <ReactFlowProvider>
      <NetworkCanvas />
    </ReactFlowProvider>
  );
  await settle();
}

const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const nodeOf = (label: string) => screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;
const frameOf = (label: string) => nodeOf(label).querySelector<HTMLElement>('.network-device')!;
const drawingOf = (label: string) => nodeOf(label).querySelector<SVGSVGElement>('svg.device-drawing')!;
const pointOf = (label: string, side: Side) =>
  nodeOf(label).querySelector<HTMLElement>(`.react-flow__handle[data-handleid="${side}"]`)!;

async function click(label: string) {
  const mouse = { button: LEFT, clientX: 5, clientY: 5, view: view() };
  fireEvent.mouseDown(nodeOf(label), mouse);
  fireEvent.mouseUp(nodeOf(label), mouse);
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  stubBrowser();
  presentation().exit();
  useSimulationStore.getState().resetSimulation();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false, magnifiedDeviceTypes: [] });
});

afterEach(() => {
  act(() => presentation().exit());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a device on the canvas', () => {
  it('is its drawing, its name under it, then its address: nothing else is drawn', async () => {
    add('PC-1');
    await renderCanvas();

    const content = frameOf('PC-1').querySelector('.device-content')!;
    expect([...content.children].map((child) => child.getAttribute('class'))).toEqual([
      'device-drawing is-rest device-icon',
      'device-name',
      'device-ip',
    ]);
    // the drawing of a computer, as large as the numbers of a device say
    expect(drawingOf('PC-1').dataset.drawing).toBe('pc');
    expect(drawingOf('PC-1').getAttribute('width')).toBe(String(DEVICE_METRICS.icon));
    expect(drawingOf('PC-1').getAttribute('height')).toBe(String(DEVICE_METRICS.icon));
    expect(content.querySelector('.device-name')?.textContent).toBe('PC-1');
    expect(content.querySelector('.device-ip')?.textContent).toBe('192.168.1.10');
    // around them only the four places a cable ends on: no badge, no tag
    expect([...frameOf('PC-1').children].map((child) => child.className.split(' ')[0])).toEqual([
      'react-flow__handle',
      'react-flow__handle',
      'react-flow__handle',
      'react-flow__handle',
      'device-content',
    ]);
    // and the frame is told it holds a line more
    expect(frameOf('PC-1').className).toContain('device-with-address');
  });

  it('with no address to show it is its drawing and its name: no empty line under them', async () => {
    add('SW-1', 'Switch', { ip: '' });
    await renderCanvas();

    expect(nodeOf('SW-1').querySelector('.device-ip')).toBeNull();
    expect(frameOf('SW-1').className).not.toContain('device-with-address');
    expect(drawingOf('SW-1').dataset.drawing).toBe('switch');
  });

  it('is shown with the drawing of its template, and of its type when it has none', async () => {
    add('NAS', 'Database', { templateId: 'tpl-nas' });
    add('Posta', 'Server', { templateId: 'tpl-mailserver' });
    add('Router', 'Router');
    add('Sconosciuto', 'Server', { templateId: 'tpl-of-another-file' });
    await renderCanvas();

    expect(drawingOf('NAS').dataset.drawing).toBe('nas');
    expect(drawingOf('Posta').dataset.drawing).toBe('server-mail');
    expect(drawingOf('Router').dataset.drawing).toBe('router');
    expect(drawingOf('Sconosciuto').dataset.drawing).toBe('server');
  });

  it('shows its note to the pointer that rests on it, and carries no mark for it', async () => {
    add('PC-1', 'PC', { notes: 'In sala riunioni' });
    add('PC-2');
    await renderCanvas();

    expect(frameOf('PC-1').title).toBe('In sala riunioni');
    expect(frameOf('PC-2').hasAttribute('title')).toBe(false);
  });
});

describe('the four places a cable ends on', () => {
  /** Where the device put a connection point, from the inside of its frame */
  const placed = (label: string, side: Side) => {
    const { style } = pointOf(label, side);
    return { left: style.left, top: style.top, bottom: style.bottom };
  };

  it('a computer: next to what is drawn above and at the two sides, and on the bottom of the frame', async () => {
    add('PC-1');
    await renderCanvas();

    // the mark is 8 by 2: its middle is on the end above and below, its outer edge at the sides.
    // A cable ends at (52, 12.5) above, (28.75, 32) at the left, (75.25, 32) at the right,
    // from the outside of the frame, which is 2 further out than its inside
    expect(placed('PC-1', 'top')).toMatchObject({ left: '46px', top: '10.5px' });
    expect(placed('PC-1', 'left')).toMatchObject({ left: '26.75px', top: '26px' });
    expect(placed('PC-1', 'right')).toMatchObject({ left: '71.25px', top: '26px' });
    expect(placed('PC-1', 'bottom')).toMatchObject({ left: '46px', top: 'auto', bottom: '-2px' });
  });

  it.each([
    ['Server', 'server'],
    ['Switch', 'switch'],
    ['Cloud', 'cloud'],
  ] as const)('a %s: where the numbers of its own drawing say', async (type, drawing) => {
    add('Device', type);
    await renderCanvas();

    const { border } = DEVICE_METRICS;
    const top = cableEnd(drawing, 'top', 94);
    const left = cableEnd(drawing, 'left', 94);
    const right = cableEnd(drawing, 'right', 94);
    expect(placed('Device', 'top')).toMatchObject({ left: `${top.x - border - 4}px`, top: `${top.y - border}px` });
    expect(placed('Device', 'left')).toMatchObject({ left: `${left.x - border}px`, top: `${left.y - border - 4}px` });
    expect(placed('Device', 'right')).toMatchObject({
      left: `${right.x - border - 2}px`,
      top: `${right.y - border - 4}px`,
    });
  });

  it('each tells the style sheet where it is, so that its band is placed back on the frame', async () => {
    add('PC-1');
    await renderCanvas();

    const told = (side: Side) => {
      const { style } = pointOf('PC-1', side);
      return [style.getPropertyValue('--at-x'), style.getPropertyValue('--at-y')];
    };
    expect(told('top')).toEqual(['46px', '10.5px']);
    expect(told('left')).toEqual(['26.75px', '26px']);
    expect(told('right')).toEqual(['71.25px', '26px']);
    // (the one of the bottom is on the bottom of the frame: only how far across)
    expect(told('bottom')).toEqual(['46px', '']);
  });

  it('each is a point of its side a cable can start from and end on, named after the side', async () => {
    add('PC-1');
    await renderCanvas();

    for (const side of SIDES) {
      const point = pointOf('PC-1', side);
      expect(point.className).toContain(`connect-point connect-point-${side}`);
      expect(point.className).toContain(`react-flow__handle-${side}`);
      expect(point.className).toContain('source');
      expect(point.className).toContain('connectable');
    }
  });

  it('while presenting nothing can be joined: the points stay, for the cables that hang on them', async () => {
    add('PC-1');
    await renderCanvas();
    act(() => {
      expect(presentation().enter()).toBe(true);
    });
    await settle();

    for (const side of SIDES) {
      expect(pointOf('PC-1', side)).not.toBeNull();
      expect(pointOf('PC-1', side).className.split(' ')).not.toContain('connectable');
    }
  });
});

describe('what the upper layer of a device says', () => {
  const stateOf = (label: string) =>
    [...drawingOf(label).classList].filter((name) => name.startsWith('is-'));

  it('nothing at rest; "selected" on a selected device, and on that one alone', async () => {
    add('PC-1');
    add('PC-2');
    await renderCanvas();
    expect(stateOf('PC-1')).toEqual(['is-rest']);

    await click('PC-1');

    expect(nodeOf('PC-1').className).toContain('selected');
    expect(stateOf('PC-1')).toEqual(['is-selected']);
    expect(stateOf('PC-2')).toEqual(['is-rest']);
  });

  it('"off" on a device taken as broken, with a mark that says so in words', async () => {
    const broken = add('PC-1');
    add('PC-2');
    await renderCanvas();
    act(() => {
      presentation().enter();
      presentation().toggleDeviceFailure(broken);
    });
    await settle();

    expect(stateOf('PC-1')).toEqual(['is-off']);
    expect(frameOf('PC-1').className).toContain('device-failed');
    expect(frameOf('PC-1').querySelector('.device-failed-badge')?.textContent).toBe('Guasto simulato');
    expect(stateOf('PC-2')).toEqual(['is-rest']);
    expect(frameOf('PC-2').querySelector('.device-failed-badge')).toBeNull();
  });

  it('"error" on the device the answer on screen stops on; a broken device stays off', async () => {
    add('PC-1');
    const second = add('PC-2');
    await renderCanvas();
    act(() => {
      presentation().enter();
      presentation().setRoute({ links: [], arrives: false, dropDeviceId: second });
    });
    await settle();

    expect(stateOf('PC-2')).toEqual(['is-error']);
    expect(stateOf('PC-1')).toEqual(['is-rest']);

    // the same answer, with the device itself taken as broken
    act(() => {
      presentation().toggleDeviceFailure(second);
      presentation().setRoute({ links: [], arrives: false, dropDeviceId: second });
    });
    await settle();
    expect(stateOf('PC-2')).toEqual(['is-off']);
  });
});
