/**
 * simulationStore — the answer a run leaves on the canvas: told when the run
 * starts, left when the packet gets to the end of its way, and taken away by
 * the next question, by a stop, or when asked.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSimulationStore } from './simulationStore';

const simulation = () => useSimulationStore.getState();

const ARRIVES = { arrives: true, deviceId: 'srv' };
const STOPS = { arrives: false, deviceId: 'fw' };

beforeEach(() => {
  simulation().resetSimulation();
});

describe('the answer a run leaves on the canvas', () => {
  it('is nothing while the packet travels: the run only knows how it will end', () => {
    simulation().startSimulation(['pc', 'sw', 'srv'], 'ping', [], ARRIVES);

    expect(simulation()).toMatchObject({ isRunning: true, outcome: ARRIVES, answer: null });
  });

  it('is left when the packet gets to the end of its way, and the run is over', () => {
    simulation().startSimulation(['pc', 'sw', 'srv'], 'ping', [], ARRIVES);
    simulation().setActiveDevice('srv');
    simulation().finishSimulation();

    expect(simulation()).toMatchObject({
      isRunning: false,
      activeDeviceId: null,
      currentConnectionId: null,
      outcome: null,
      answer: ARRIVES,
    });
  });

  it('is none for a run that was not told how it ends', () => {
    simulation().startSimulation(['pc', 'sw'], 'ping');
    expect(simulation().outcome).toBeNull();
    simulation().finishSimulation();

    expect(simulation()).toMatchObject({ isRunning: false, answer: null });
  });

  it('a run that is stopped leaves none, and takes away the one that was there', () => {
    simulation().startSimulation(['pc', 'sw', 'srv'], 'ping', [], ARRIVES);
    simulation().stopSimulation();
    expect(simulation()).toMatchObject({ isRunning: false, outcome: null, answer: null });

    simulation().leaveAnswer(STOPS);
    simulation().stopSimulation();
    expect(simulation().answer).toBeNull();
  });

  it('the next question takes it away as it starts', () => {
    simulation().startSimulation(['pc', 'sw', 'srv'], 'ping', [], ARRIVES);
    simulation().finishSimulation();
    expect(simulation().answer).toEqual(ARRIVES);

    simulation().startSimulation(['pc', 'fw'], 'web', [], STOPS);
    expect(simulation()).toMatchObject({ isRunning: true, outcome: STOPS, answer: null });
  });

  it('can be left with no run at all: a question that does not even leave', () => {
    simulation().startSimulation(['pc', 'sw'], 'ping', [], ARRIVES);
    simulation().leaveAnswer(STOPS);

    expect(simulation()).toMatchObject({ isRunning: false, outcome: null, answer: STOPS });
  });

  it('is taken away when asked; a run in progress goes on, and still leaves its own', () => {
    simulation().leaveAnswer(STOPS);
    simulation().clearAnswer();
    expect(simulation().answer).toBeNull();

    const runId = simulation().startSimulation(['pc', 'sw', 'srv'], 'ping', ['c1', 'c2'], ARRIVES);
    simulation().setCurrentHop(1);
    const during = simulation();
    simulation().clearAnswer();
    // (nothing to take away: nothing changes, and nobody is told)
    expect(simulation()).toBe(during);
    expect(simulation()).toMatchObject({ isRunning: true, runId, currentHop: 1, outcome: ARRIVES });

    simulation().finishSimulation();
    expect(simulation().answer).toEqual(ARRIVES);
  });

  it('goes with the drawing it was about', () => {
    simulation().leaveAnswer(ARRIVES);
    simulation().resetSimulation();

    expect(simulation()).toMatchObject({ isRunning: false, path: [], answer: null, outcome: null });
  });
});
