/**
 * Bulk add — where the new devices go: in an ordered grid, in the part of
 * the canvas on screen, starting where the window that adds one device puts
 * a new one; cells a device is already on are skipped; the view is brought
 * to show them when they do not fit in it; and they are the selection
 * afterwards, ready to be dragged together.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { NEW_DEVICE_STEP } from '@/utils/placeDevice';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';
import {
  addButton,
  addConfigurable,
  emptyCanvas,
  more,
  openBulkWindow,
  quantityField,
} from '@/test/bulkAddWindow';
import AddDeviceModal from './AddDeviceModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const devices = () => network().devices;

/** The canvas on the page: 1000 by 600, from (0, 0) of the window */
const CANVAS = { width: 1000, height: 600 };

beforeEach(() => {
  localStorage.clear();
  emptyCanvas();
  network().setViewport({ x: 0, y: 0, zoom: 1 });
  useUIStore.getState().closeModal('bulkAddDevice');
  useUIStore.getState().closeModal('addDevice');
  // where the canvas is: what the two windows read to know what is on screen
  const canvas = document.createElement('div');
  canvas.className = 'react-flow';
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, CANVAS.width, CANVAS.height);
  document.body.appendChild(canvas);
});

afterEach(() => {
  document.querySelector('.react-flow')?.remove();
});

/** Add in bulk: so many of each standard row, and a switch row of so many */
function addInBulk(rows: Record<string, number>, switches = 0): NetworkDevice[] {
  const before = devices().length;
  const view = openBulkWindow();
  for (const [name, count] of Object.entries(rows)) {
    for (let i = 0; i < count; i++) fireEvent.click(more(name));
  }
  if (switches > 0) {
    const row = addConfigurable('Switch');
    fireEvent.change(quantityField(row), { target: { value: String(switches) } });
  }
  fireEvent.click(addButton());
  view.unmount();
  return devices().slice(before);
}

/** Add one PC with the window that adds one */
function addOne(): NetworkDevice {
  useUIStore.getState().setAddDeviceType('PC', 'tpl-pc');
  useUIStore.getState().openModal('addDevice');
  const view = render(<AddDeviceModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
  view.unmount();
  return devices()[devices().length - 1];
}

/** What part of the canvas is on screen, in its own coordinates */
function onScreen() {
  const { x, y, zoom } = network().viewport;
  return { left: -x / zoom, top: -y / zoom, right: (CANVAS.width - x) / zoom, bottom: (CANVAS.height - y) / zoom };
}

const positions = (list: NetworkDevice[]) => list.map((device) => device.position);

describe('bulk add — where the new devices go', () => {
  it('the first goes where the window that adds one would put a device, wherever the view is', () => {
    network().setViewport({ x: -4000, y: -3000, zoom: 0.5 });
    const alone = addOne();
    emptyCanvas();
    const [first] = addInBulk({ PC: 3 });

    expect(first.position).toEqual(alone.position);
    // which is the first free place of what is on screen, from its top left
    const view = onScreen();
    expect(first.position.x).toBeGreaterThanOrEqual(view.left);
    expect(first.position.y).toBeGreaterThanOrEqual(view.top);
    // (the place before it on the grid is too close to the border: 24 pixels, here 48 units)
    expect(first.position.x - NEW_DEVICE_STEP.x).toBeLessThan(view.left + 48);
    expect(first.position.y - NEW_DEVICE_STEP.y).toBeLessThan(view.top + 48);
  });

  it('the others follow in rows and columns, spaced for a device and its name, with nothing left to chance', () => {
    const made = addInBulk({ PC: 2, Printer: 1, Laptop: 2 }, 2);
    expect(made).toHaveLength(7);
    const [start] = positions(made);
    // three columns for seven, in the order of the window: switches first, then the rows
    expect(positions(made)).toEqual([
      start,
      { x: start.x + NEW_DEVICE_STEP.x, y: start.y },
      { x: start.x + 2 * NEW_DEVICE_STEP.x, y: start.y },
      { x: start.x, y: start.y + NEW_DEVICE_STEP.y },
      { x: start.x + NEW_DEVICE_STEP.x, y: start.y + NEW_DEVICE_STEP.y },
      { x: start.x + 2 * NEW_DEVICE_STEP.x, y: start.y + NEW_DEVICE_STEP.y },
      { x: start.x, y: start.y + 2 * NEW_DEVICE_STEP.y },
    ]);
    expect(made.map((device) => device.templateId)).toEqual([
      'tpl-switch',
      'tpl-switch',
      'tpl-pc',
      'tpl-pc',
      'tpl-printer',
      'tpl-laptop',
      'tpl-laptop',
    ]);

    // the same batch on the same empty canvas: the same places
    emptyCanvas();
    expect(positions(addInBulk({ PC: 2, Printer: 1, Laptop: 2 }, 2))).toEqual(positions(made));
  });

  it('a cell a device is already on is skipped; a second batch does not land on the first', () => {
    const alone = addOne();
    const first = addInBulk({ PC: 4 });
    const second = addInBulk({ Server: 4 });
    const all = [alone, ...first, ...second];
    for (const [index, device] of all.entries()) {
      for (const other of all.slice(index + 1)) {
        const apart =
          Math.abs(device.position.x - other.position.x) >= DEVICE_METRICS.width ||
          Math.abs(device.position.y - other.position.y) >= deviceHeight(true);
        expect(apart, `${device.label} and ${other.label}`).toBe(true);
      }
    }
    // (the device added alone is on the first cell: the batch starts on the next)
    expect(first[0].position).toEqual({ x: alone.position.x + NEW_DEVICE_STEP.x, y: alone.position.y });
  });

  it('they are the selection afterwards, all of them and nothing else, as pasted devices are', () => {
    const alone = addOne();
    expect(network().selectedDeviceIds).toEqual([alone.id]);

    const made = addInBulk({ PC: 2, Server: 1 });

    expect(network().selectedDeviceIds).toEqual(made.map((device) => device.id));
  });

  it('when they fit in what is on screen the view does not move', () => {
    const asked = network().fitViewRequest;
    const made = addInBulk({ PC: 3 });
    const view = onScreen();
    for (const device of made) {
      expect(device.position.x).toBeGreaterThanOrEqual(view.left);
      expect(device.position.x + DEVICE_METRICS.width).toBeLessThanOrEqual(view.right);
      expect(device.position.y + deviceHeight(true)).toBeLessThanOrEqual(view.bottom);
    }
    expect(network().fitViewRequest).toBe(asked);
  });

  it('when they do not, the view is brought to show them: the new devices, not the whole drawing', () => {
    const asked = network().fitViewRequest;
    const made = addInBulk({ PC: 6, Server: 6, Laptop: 4 });

    expect(network().fitViewRequest).toBe(asked + 1);
    expect(network().fitViewNodes).toEqual(made.map((device) => device.id));
    // (a fit asked for anything else is of the whole drawing)
    act(() => network().triggerFitView());
    expect(network().fitViewNodes).toBeNull();
  });
});
