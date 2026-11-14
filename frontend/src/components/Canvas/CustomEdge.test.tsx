/**
 * CustomEdge — how a cable is drawn in presentation mode: cut, leading to a
 * broken device, with the packet on it; and that the marks of a failure do
 * not show outside presentation mode.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Position, ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useTemplateStore } from '@/store/templateStore';
import type { NetworkConnection } from '@/types';
import CustomEdge from './CustomEdge';

const presentation = () => usePresentationStore.getState();

const CABLE: NetworkConnection = { id: 'cable-1', source: 'dev-a', target: 'dev-b' };

function renderEdge(connection: NetworkConnection = CABLE) {
  const { container } = render(
    <ReactFlowProvider>
      <svg>
        <CustomEdge
          id={connection.id}
          source={connection.source}
          target={connection.target}
          sourceX={0}
          sourceY={0}
          targetX={300}
          targetY={0}
          sourcePosition={Position.Right}
          targetPosition={Position.Left}
          data={connection}
        />
      </svg>
    </ReactFlowProvider>
  );
  const path = container.querySelector<SVGPathElement>('path.react-flow__edge-path');
  if (!path) throw new Error('the edge drew no path');
  return path;
}

/** The look of the cable, as the three things that tell the states apart */
const look = (path: SVGPathElement) => ({
  stroke: path.style.stroke,
  dash: path.style.strokeDasharray,
  opacity: path.style.opacity,
});

const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';

beforeEach(() => {
  presentation().exit();
  useSimulationStore.getState().resetSimulation();
  useNetworkStore.setState({ selectedDeviceId: null, hoveredDeviceId: null });
  // enter() needs a drawing; the edge itself is rendered on its own
  useNetworkStore.getState().clearAllDevices();
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label: 'PC-1',
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
  });
  presentation().enter();
});

describe('CustomEdge — presentation mode', () => {
  it('a plain cable is drawn as while building', () => {
    const plain = look(renderEdge());
    expect(plain.stroke).not.toBe(RED);
    expect(plain.stroke).not.toBe(GREEN);
    expect(plain.dash).toBe('none');
    expect(plain.opacity).toBe('0.6');
  });

  it('a cable at rest has the colour of the theme, so it changes when the theme does', () => {
    // the name of the colour, not its value of the moment the cable was drawn
    expect(look(renderEdge()).stroke).toBe('var(--line-color)');
    presentation().toggleDeviceFailure('dev-b');
    expect(look(renderEdge()).stroke).toBe('var(--line-color)');
  });

  it('a cut cable is red and broken up', () => {
    presentation().toggleConnectionFailure('cable-1');
    expect(look(renderEdge())).toEqual({ stroke: RED, dash: '3 7', opacity: '0.9' });
  });

  it('a cable into a broken device fades, at either end', () => {
    presentation().toggleDeviceFailure('dev-b');
    expect(look(renderEdge())).toMatchObject({ dash: '3 7', opacity: '0.3' });

    presentation().repairAll();
    presentation().toggleDeviceFailure('dev-a');
    expect(look(renderEdge()).opacity).toBe('0.3');

    presentation().repairAll();
    presentation().toggleDeviceFailure('dev-elsewhere');
    expect(look(renderEdge()).opacity).toBe('0.6');
  });

  it('the way of the answer is not painted: a cable on it rests like the others', () => {
    const atRest = { stroke: 'var(--line-color)', opacity: '0.6' };
    presentation().setRoute({ links: ['cable-1'], arrives: true, dropDeviceId: null });
    expect(look(renderEdge())).toMatchObject(atRest);

    presentation().setRoute({ links: ['cable-1'], arrives: false, dropDeviceId: 'dev-b' });
    expect(look(renderEdge())).toMatchObject(atRest);
  });

  it('a cable lights up while the packet is on it, in the colour of its kind, as while building', () => {
    const trunk: NetworkConnection = { ...CABLE, type: 'trunk' };
    const ofItsKind = useTemplateStore.getState().getConnectionTemplateByType('trunk')?.color;
    expect(ofItsKind).toBeTruthy();
    presentation().setRoute({ links: ['cable-1', 'cable-2'], arrives: true, dropDeviceId: null });

    // the packet is on it
    useSimulationStore.getState().startSimulation(['dev-a', 'dev-b', 'dev-c'], 'ping');
    useSimulationStore.getState().setCurrentConnection('cable-1', false, 500);
    const lit = look(renderEdge(trunk));
    expect(lit).toMatchObject({ stroke: ofItsKind, opacity: '1' });
    expect([GREEN, AMBER]).not.toContain(lit.stroke);

    // the packet has moved on to the next cable: this one rests again
    useSimulationStore.getState().setCurrentConnection('cable-2', false, 500);
    expect(look(renderEdge(trunk))).toMatchObject({ stroke: 'var(--line-color)', opacity: '0.6' });

    // a cable of no kind has no colour of its own: it only stands out
    useSimulationStore.getState().setCurrentConnection('cable-1', false, 500);
    expect(look(renderEdge())).toMatchObject({ stroke: 'var(--line-color)', opacity: '1' });
  });

  it('a cut wins over everything else', () => {
    presentation().setRoute({ links: ['cable-1'], arrives: true, dropDeviceId: null });
    presentation().toggleDeviceFailure('dev-b');
    presentation().toggleConnectionFailure('cable-1');
    expect(look(renderEdge()).stroke).toBe(RED);
  });

  it('nothing of it shows outside presentation mode, whatever the store still holds', () => {
    usePresentationStore.setState({
      active: false,
      failedConnections: ['cable-1'],
      failedDevices: ['dev-a'],
      route: { links: ['cable-1'], arrives: true, dropDeviceId: null },
    });
    const outside = look(renderEdge());
    expect(outside).toEqual({ stroke: outside.stroke, dash: 'none', opacity: '0.6' });
    expect([RED, GREEN, AMBER]).not.toContain(outside.stroke);
    usePresentationStore.setState({ failedConnections: [], failedDevices: [], route: null });
  });
});

describe('CustomEdge — the packet', () => {
  it('draws the packet on the cable it is travelling on, for as long as the animation says', () => {
    useSimulationStore.getState().startSimulation(['dev-a', 'dev-b'], 'ping');
    useSimulationStore.getState().setCurrentConnection('cable-1', false, 640);
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge
            id="cable-1"
            source="dev-a"
            target="dev-b"
            sourceX={0}
            sourceY={0}
            targetX={300}
            targetY={0}
            sourcePosition={Position.Right}
            targetPosition={Position.Left}
            data={CABLE}
          />
          <CustomEdge
            id="cable-2"
            source="dev-b"
            target="dev-c"
            sourceX={300}
            sourceY={0}
            targetX={600}
            targetY={0}
            sourcePosition={Position.Right}
            targetPosition={Position.Left}
            data={{ id: 'cable-2', source: 'dev-b', target: 'dev-c' }}
          />
        </svg>
      </ReactFlowProvider>
    );

    const packets = container.querySelectorAll('animateMotion');
    expect(packets).toHaveLength(1);
    expect(packets[0].getAttribute('dur')).toBe('640ms');
  });

  it('runs it backwards when the packet enters from the far end of the cable', () => {
    const forward = () => {
      useSimulationStore.getState().startSimulation(['dev-a', 'dev-b'], 'ping');
      useSimulationStore.getState().setCurrentConnection('cable-1', false, 500);
      const path = renderEdge();
      return path.parentElement?.parentElement?.querySelector('animateMotion')?.getAttribute('path');
    };
    const there = forward();

    useSimulationStore.getState().setCurrentConnection('cable-1', true, 500);
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge
            id="cable-1"
            source="dev-a"
            target="dev-b"
            sourceX={0}
            sourceY={0}
            targetX={300}
            targetY={0}
            sourcePosition={Position.Right}
            targetPosition={Position.Left}
            data={CABLE}
          />
        </svg>
      </ReactFlowProvider>
    );
    const back = container.querySelector('animateMotion')?.getAttribute('path');

    expect(there).toBeTruthy();
    expect(back).toBeTruthy();
    expect(back).not.toBe(there);
  });
});
