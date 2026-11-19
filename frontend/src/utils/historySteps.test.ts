/**
 * The name of a step of the history, for the menu: what took the board from
 * one state to the next, when a few words can say it.
 */

import { describe, it, expect } from 'vitest';
import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';
import { describeStep } from './historySteps';

const pc = (id: string, label: string, x = 0): NetworkDevice => ({
  id,
  type: 'PC',
  label,
  ip: '',
  subnet: '255.255.255.0',
  gateway: '',
  position: { x, y: 0 },
});
const link = (id: string, source: string, target: string): NetworkConnection => ({ id, source, target });
const area = (id: string, label: string, x = 0): CanvasArea => ({
  id,
  label,
  color: 'slate',
  position: { x, y: 0 },
  size: { width: 200, height: 120 },
});

const a = pc('dev-0', 'PC-1');
const b = pc('dev-1', 'PC-2', 200);
const c = pc('dev-2', 'SW-1', 400);
const board = (devices: NetworkDevice[], connections: NetworkConnection[] = [], areas: CanvasArea[] = []) => ({
  devices,
  connections,
  areas,
  deviceCounter: 3,
  connectionCounter: 2,
});

describe('the name of a step', () => {
  it('one device added, deleted with its links, moved, edited: by its name', () => {
    expect(describeStep(board([a]), board([a, b]))).toEqual({ kind: 'addDevice', name: 'PC-2' });
    expect(describeStep(board([a, c], [link('l', 'dev-0', 'dev-2')]), board([c]))).toEqual({
      kind: 'deleteDevice',
      name: 'PC-1',
    });
    expect(describeStep(board([a, b]), board([{ ...a, position: { x: 50, y: 60 } }, b]))).toEqual({
      kind: 'moveDevice',
      name: 'PC-1',
    });
    expect(describeStep(board([a]), board([{ ...a, label: 'Desk', ip: '192.168.1.9' }]))).toEqual({
      kind: 'editDevice',
      name: 'Desk',
    });
  });

  it('several devices added, deleted or moved: how many', () => {
    expect(describeStep(board([]), board([a, b, c], [link('l', 'dev-0', 'dev-2')]))).toEqual({
      kind: 'addDevices',
      count: 3,
    });
    expect(describeStep(board([a, b, c]), board([c]))).toEqual({ kind: 'deleteDevices', count: 2 });
    const moved = (device: NetworkDevice) => ({ ...device, position: { x: device.position.x + 30, y: 40 } });
    // (with an area of the selection moved along)
    expect(describeStep(board([a, b, c], [], [area('area-1', 'Core')]), board([moved(a), moved(b), c], [], [area('area-1', 'Core', 30)]))).toEqual({
      kind: 'moveDevices',
      count: 2,
    });
  });

  it('an automatic layout: devices moved, the areas drawn again around them, the ends of links turned', () => {
    const before = board([a, b, c], [link('l', 'dev-0', 'dev-2')], [area('area-1', 'Core')]);
    const after = board(
      [a, b, c].map((device, index) => ({ ...device, position: { x: index * 300, y: 400 } })),
      [{ ...link('l', 'dev-0', 'dev-2'), sourceHandle: 'bottom', targetHandle: 'top' }],
      [{ ...area('area-1', 'Core', 20), size: { width: 640, height: 200 } }]
    );
    expect(describeStep(before, after)).toEqual({ kind: 'moveDevices', count: 3 });
    // (an area resized alone is an edit of the area)
    expect(
      describeStep(board([], [], [area('area-1', 'Core')]), board([], [], [{ ...area('area-1', 'Core'), size: { width: 400, height: 120 } }]))
    ).toEqual({ kind: 'editArea', name: 'Core' });
  });

  it('a link added, deleted or edited: by the devices at its ends; several added: how many', () => {
    expect(describeStep(board([a, c]), board([a, c], [link('l', 'dev-0', 'dev-2')]))).toEqual({
      kind: 'addLink',
      source: 'PC-1',
      target: 'SW-1',
    });
    expect(describeStep(board([a, c], [link('l', 'dev-0', 'dev-2')]), board([a, c]))).toEqual({
      kind: 'deleteLink',
      source: 'PC-1',
      target: 'SW-1',
    });
    expect(
      describeStep(board([a, c], [link('l', 'dev-0', 'dev-2')]), board([a, c], [{ ...link('l', 'dev-0', 'dev-2'), label: 'uplink' }]))
    ).toEqual({ kind: 'editLink', source: 'PC-1', target: 'SW-1' });
    expect(
      describeStep(board([a, b, c]), board([a, b, c], [link('l', 'dev-0', 'dev-2'), link('m', 'dev-1', 'dev-2')]))
    ).toEqual({ kind: 'addLinks', count: 2 });
  });

  it('an area added, deleted, moved or changed: by its label, which may be empty', () => {
    expect(describeStep(board([]), board([], [], [area('area-1', 'Core')]))).toEqual({ kind: 'addArea', name: 'Core' });
    expect(describeStep(board([], [], [area('area-1', '')]), board([]))).toEqual({ kind: 'deleteArea', name: '' });
    expect(describeStep(board([], [], [area('area-1', 'Core')]), board([], [], [area('area-1', 'Core', 80)]))).toEqual({
      kind: 'moveArea',
      name: 'Core',
    });
    expect(
      describeStep(board([], [], [area('area-1', 'Core')]), board([], [], [{ ...area('area-1', 'Core'), color: 'teal' }]))
    ).toEqual({ kind: 'editArea', name: 'Core' });
  });

  it('has no name for what cannot be said in a few words: a drawing replaced, another field of the board', () => {
    expect(describeStep(board([a, b]), board([c]))).toBeNull();
    expect(describeStep({ ...board([a]), marks: [] }, { ...board([a]), marks: ['a stroke'] })).toBeNull();
    expect(describeStep(board([a]), board([a]))).toBeNull();
  });
});
