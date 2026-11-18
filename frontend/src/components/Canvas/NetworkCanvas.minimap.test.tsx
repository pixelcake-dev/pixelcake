/**
 * The small map: a plain square for each device, in the colour of its type,
 * and nothing else. No rounded corners (drawn without smoothing, at a scale
 * that is not a whole number, they left stray pixels around the squares), no
 * border, and no rectangle of the areas, which at that size showed as faint
 * marks around and under the squares.
 *
 * The devices are given a size the way a browser gives it
 * (test/measuredCanvas): React Flow draws on the small map only what it has
 * measured.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { stubMeasuringBrowser } from '@/test/measuredCanvas';
import { MINI_MAP_COLOURS } from '@/utils/miniMapColour';
import NetworkCanvas from './NetworkCanvas';

const store = () => useNetworkStore.getState();

beforeEach(() => {
  localStorage.clear();
  stubMeasuringBrowser();
  createNewProject({ name: 'Sede Milano' });
  useUIStore.setState({ showWelcomeScreen: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the small map', () => {
  it('draws a plain square for each device, and nothing for an area', async () => {
    store().addDevice({ type: 'PC', label: 'PC-1', ip: '', subnet: '', gateway: '', position: { x: 150, y: 120 } });
    store().addDevice({ type: 'Router', label: 'R-1', ip: '', subnet: '', gateway: '', position: { x: 400, y: 120 } });
    store().addArea({ label: 'Uffici', color: 'green', position: { x: 100, y: 50 }, size: { width: 500, height: 250 } });

    render(
      <ReactFlowProvider>
        <NetworkCanvas />
      </ReactFlowProvider>
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const map = document.querySelector('.react-flow__minimap svg')!;
    const shapes = Array.from(map.querySelectorAll('.react-flow__minimap-node'));
    expect(shapes.map((shape) => shape.getAttribute('fill'))).toEqual([MINI_MAP_COLOURS.PC, MINI_MAP_COLOURS.Router]);
    for (const shape of shapes) {
      expect(shape.tagName.toLowerCase()).toBe('rect');
      expect(shape.getAttribute('rx') ?? '0').toBe('0');
      expect(shape.getAttribute('ry') ?? '0').toBe('0');
      expect(shape.getAttribute('stroke-width') ?? '0').toBe('0');
    }
    // only the squares and the veil over what is outside the view
    expect(Array.from(map.children).map((child) => child.tagName.toLowerCase())).toEqual([
      'title',
      'rect',
      'rect',
      'path',
    ]);
  });
});
