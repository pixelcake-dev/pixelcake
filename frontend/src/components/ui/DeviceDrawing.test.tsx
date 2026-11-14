/**
 * A device as it is drawn: the shapes of its drawing three times (the lower
 * layer, the upper one in its window, the cut in its own), the colours left
 * to the style sheet, the state as a class. And which drawing a device is
 * shown with.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DEVICE_DRAWINGS, DEVICE_DRAWING_IDS } from '@/data/deviceDrawings';
import {
  DRAWING_OF_TEMPLATE,
  DRAWING_OF_TYPE,
  drawingOf,
  isDrawingId,
  type DeviceState,
} from '@/utils/deviceDrawing';
import { useTemplateStore } from '@/store/templateStore';
import styleSheet from '@/index.css?raw';
import DeviceDrawing from './DeviceDrawing';

const drawn = (container: HTMLElement) => container.querySelector<SVGSVGElement>('svg.device-drawing')!;
const shapeCount = (markup: string) => (markup.match(/<(rect|circle|ellipse|path)\b/g) ?? []).length;

describe('DeviceDrawing', () => {
  it.each(DEVICE_DRAWING_IDS)('%s: its shapes whole, then in the window of the upper layer, then in the window of the cut', (id) => {
    const { container } = render(<DeviceDrawing drawing={id} />);
    const svg = drawn(container);
    const { layer, shapes } = DEVICE_DRAWINGS[id];
    const count = shapeCount(shapes);

    expect(svg.getAttribute('viewBox')).toBe('0 0 128 128');
    const [lower, upper, cut] = Array.from(svg.children);
    expect(svg.children).toHaveLength(3);

    expect(lower.tagName.toLowerCase()).toBe('g');
    expect(lower.getAttribute('class')).toBe('device-drawing-lower');
    expect(lower.children).toHaveLength(count);

    // a window as high as the upper layer, from the top
    expect(upper.tagName.toLowerCase()).toBe('svg');
    expect(upper.getAttribute('class')).toBe('device-drawing-upper');
    expect(upper.getAttribute('viewBox')).toBe(`0 0 128 ${layer}`);
    expect(upper.getAttribute('height')).toBe(String(layer));
    expect(upper.getAttribute('width')).toBe('128');
    expect(upper.getAttribute('y')).toBeNull();
    expect(upper.children).toHaveLength(count);

    // a window 5 high across the line where the upper layer ends
    expect(cut.tagName.toLowerCase()).toBe('svg');
    expect(cut.getAttribute('class')).toBe('device-drawing-cut');
    expect(cut.getAttribute('y')).toBe(String(layer - 2.5));
    expect(cut.getAttribute('height')).toBe('5');
    expect(cut.getAttribute('viewBox')).toBe(`0 ${layer - 2.5} 128 5`);
    expect(cut.children).toHaveLength(count);

    // every shape is of the drawing (SVG, not HTML), and says what it is
    for (const shape of svg.querySelectorAll('rect, circle, ellipse, path')) {
      expect(shape.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(['l', 'g']).toContain(shape.getAttribute('class'));
    }
  });

  it('is 48 pixels wide and high unless told otherwise', () => {
    const { container, rerender } = render(<DeviceDrawing drawing="router" />);
    expect(drawn(container).getAttribute('width')).toBe('48');
    expect(drawn(container).getAttribute('height')).toBe('48');

    rerender(<DeviceDrawing drawing="router" size={20} />);
    expect(drawn(container).getAttribute('width')).toBe('20');
    expect(drawn(container).getAttribute('height')).toBe('20');
  });

  it('says its state with a class, and nothing with a colour of its own', () => {
    const states: DeviceState[] = ['rest', 'selected', 'ok', 'warning', 'error', 'off'];
    for (const state of states) {
      const { container, unmount } = render(<DeviceDrawing drawing="switch" state={state} />);
      expect(drawn(container).getAttribute('class')).toBe(`device-drawing is-${state}`);
      expect(container.innerHTML).not.toMatch(/fill=|style=|#[0-9a-f]{6}/i);
      unmount();
    }
    // at rest when nothing is said, and the classes of whoever shows it are kept
    const { container } = render(<DeviceDrawing drawing="switch" className="device-icon" />);
    expect(drawn(container).getAttribute('class')).toBe('device-drawing is-rest device-icon');
  });

  it('is a picture of what is named next to it: it says nothing, and cannot take the focus', () => {
    const { container } = render(<DeviceDrawing drawing="stampante" />);
    const svg = drawn(container);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('title')).toBeNull();
    expect(svg.getAttribute('data-drawing')).toBe('stampante');
  });

  it('the same drawing many times on a page: nothing has an id, nothing refers to one', () => {
    const { container } = render(
      <>
        <DeviceDrawing drawing="server-web" />
        <DeviceDrawing drawing="server-web" state="error" />
        <div style={{ display: 'none' }}>
          <DeviceDrawing drawing="server-web" />
        </div>
      </>
    );
    expect(container.querySelectorAll('svg.device-drawing')).toHaveLength(3);
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/url\(|clip-path|mask|<defs|href=/);
  });
});

describe('the colours of a drawing', () => {
  const sheet = styleSheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
  /** The declarations of the first block of a selector */
  const block = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`).exec(sheet);
    if (!found) throw new Error(`no rule for ${selector}`);
    return Object.fromEntries(
      found[1]
        .split(';')
        .map((declaration) => declaration.split(':').map((part) => part.trim()))
        .filter(([name, value]) => name && value)
    ) as Record<string, string>;
  };

  it('are those of the kit: the two layers in light and in dark, and one colour for each state', () => {
    const light = block(':root');
    const dark = block('.dark');
    expect(light['--device-lower']).toBe('#22313b');
    expect(light['--device-upper']).toBe('#5e8096');
    expect(dark['--device-lower']).toBe('#8fb0c6');
    expect(dark['--device-upper']).toBe('#c9d8e2');
    for (const theme of [light, dark]) {
      expect(theme['--state-selected']).toBe('#f07d2a');
      expect(theme['--state-ok']).toBe('#2fa866');
      expect(theme['--state-warning']).toBe('#f2c230');
      expect(theme['--state-error']).toBe('#e0483e');
      expect(theme['--state-off']).toBe('#9aa7b0');
      // what is drawn on the layers is the canvas, until whoever shows the drawing says another
      expect(theme['--device-ground']).toBe('var(--bg-canvas)');
      // and the upper layer is its own colour until a state is said
      expect(theme['--device-state']).toBe('var(--device-upper)');
    }
    // the orange of a selected device is the accent of the app
    expect(light['--state-selected']).toBe(light['--accent-color'].toLowerCase());
  });

  it('each layer and each window takes its own: the lower one, the state, the ground', () => {
    expect(block('.device-drawing .l').fill).toBe('var(--device-lower)');
    expect(block('.device-drawing .g').fill).toBe('var(--device-ground)');
    expect(block('.device-drawing .device-drawing-upper .l').fill).toBe('var(--device-state)');
    expect(block('.device-drawing .device-drawing-cut .l').fill).toBe('var(--device-ground)');
    // (the rules of the windows come after those of the whole drawing, and win)
    expect(sheet.indexOf('.device-drawing .device-drawing-upper .l')).toBeGreaterThan(
      sheet.indexOf('.device-drawing .l')
    );
  });

  it('a state is the colour of the upper layer, and of nothing else', () => {
    const states: Record<string, string> = {
      selected: 'var(--state-selected)',
      ok: 'var(--state-ok)',
      warning: 'var(--state-warning)',
      error: 'var(--state-error)',
      off: 'var(--state-off)',
    };
    for (const [state, colour] of Object.entries(states)) {
      expect(block(`.device-drawing.is-${state}`), state).toEqual({ '--device-state': colour });
    }
    expect(sheet).not.toContain('.device-drawing.is-rest');
  });
});

describe('which drawing a device is shown with', () => {
  const templates = () => useTemplateStore.getState().templates;

  it('every template the app comes with has a drawing of its own, and every drawing a template', () => {
    const builtIn = templates().filter((template) => !template.isCustom);
    const drawings = builtIn.map((template) => DRAWING_OF_TEMPLATE[template.id]);
    expect(drawings.filter((drawing) => !isDrawingId(drawing))).toEqual([]);
    expect(new Set(drawings).size).toBe(builtIn.length);
    // twenty-four of each: no drawing is left without a device to show
    expect(builtIn).toHaveLength(24);
    expect([...drawings].sort()).toEqual([...DEVICE_DRAWING_IDS].sort());
    // and the table names no template the app does not come with
    expect(Object.keys(DRAWING_OF_TEMPLATE).sort()).toEqual(builtIn.map((template) => template.id).sort());
  });

  it('each is the drawing its name says: the kit names them in Italian here and there', () => {
    const drawingOfName = (name: string) =>
      DRAWING_OF_TEMPLATE[templates().find((template) => template.name === name)?.id ?? ''];
    expect(drawingOfName('Cloud')).toBe('cloud');
    expect(drawingOfName('IoT Gateway')).toBe('iot');
    expect(drawingOfName('IP Camera')).toBe('telecamera-ip');
    expect(drawingOfName('Printer')).toBe('stampante');
    expect(drawingOfName('IP Phone')).toBe('telefono-ip');
    expect(drawingOfName('Laptop')).toBe('laptop');
    expect(drawingOfName('Smartphone')).toBe('smartphone');
    expect(drawingOfName('Tablet')).toBe('tablet');
    expect(drawingOfName('Mail Server')).toBe('server-mail');
    expect(drawingOfName('VPS')).toBe('server-vps');
    expect(drawingOfName('Web Server')).toBe('server-web');
    expect(drawingOfName('Proxy Server')).toBe('server-proxy');
    expect(drawingOfName('DNS Server')).toBe('server-dns');
    expect(drawingOfName('DHCP Server')).toBe('server-dhcp');
    expect(drawingOfName('Storage S3')).toBe('storage-s3');
    expect(drawingOfName('NAS')).toBe('nas');
  });

  it('every base type has one, the one of the template that is called like the type', () => {
    for (const type of new Set(templates().map((template) => template.type))) {
      expect(isDrawingId(DRAWING_OF_TYPE[type]), type).toBe(true);
    }
    expect(DRAWING_OF_TYPE.PC).toBe(DRAWING_OF_TEMPLATE['tpl-pc']);
    expect(DRAWING_OF_TYPE.Server).toBe(DRAWING_OF_TEMPLATE['tpl-server']);
    expect(DRAWING_OF_TYPE.Cloud).toBe('cloud');
  });

  it('the tables name only drawings there are', () => {
    for (const drawing of [...Object.values(DRAWING_OF_TEMPLATE), ...Object.values(DRAWING_OF_TYPE)]) {
      expect(isDrawingId(drawing), drawing).toBe(true);
    }
    expect(isDrawingId('mdi:server')).toBe(false);
    expect(isDrawingId('toString')).toBe(false);
    expect(isDrawingId(undefined)).toBe(false);
  });

  it('a template that names a drawing is shown with it', () => {
    expect(drawingOf({ id: 'tpl-1700000000000', icon: 'nas', type: 'Server' }, 'Server')).toBe('nas');
    // also one the app comes with, when its drawing was changed
    expect(drawingOf({ id: 'tpl-pc', icon: 'laptop', type: 'PC' }, 'PC')).toBe('laptop');
  });

  it('a template with an icon of before the drawings: its own drawing if the app comes with it, else the one of its type', () => {
    expect(drawingOf({ id: 'tpl-webserver', icon: 'mdi:web', type: 'Server' }, 'Server')).toBe('server-web');
    expect(drawingOf({ id: 'tpl-1700000000000', icon: 'mdi:aws', type: 'Database' }, 'Database')).toBe('database');
    expect(drawingOf({ id: 'tpl-1700000000000', icon: '', type: 'Firewall' }, 'Firewall')).toBe('firewall');
  });

  it('a device of no template is shown with the drawing of its type, and one of no known type with a plain machine', () => {
    expect(drawingOf(undefined, 'Router')).toBe('router');
    expect(drawingOf(undefined, 'AccessPoint')).toBe('access-point');
    expect(drawingOf(undefined, 'Mainframe')).toBe('server');
    expect(drawingOf({ id: 'tpl-x', icon: 'mdi:help', type: 'Mainframe' }, 'Mainframe')).toBe('server');
  });
});
