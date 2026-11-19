/**
 * The first steps of a visitor: the guided tour, shown once on a first visit,
 * and the first question suggested after the company sample is loaded, once
 * in a browser. What a browser keeps says which of the two is still due, and
 * the suggested question is one the sample really answers, in both languages.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FIRST_TRY_SEEN_KEY,
  TOUR_SEEN_KEY,
  firstStepsAtStart,
  firstTryCommand,
  firstTryOf,
  usedBefore,
} from './firstSteps';
import { createCompanySample } from './sampleCompany';
import { createSampleTopology } from './sampleTopology';
import { executeCommand, type ExecutionResult } from '@/terminal/executor';
import { useNetworkStore } from '@/store/networkStore';
import { setLanguage, type Language } from '@/i18n';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** A browser that keeps these values */
const browserWith =
  (kept: Record<string, string>) =>
  (key: string): string | null =>
    key in kept ? kept[key] : null;

/** What the network store writes, around the board it keeps */
const keptBoard = (board: Record<string, unknown>) => JSON.stringify({ state: board, version: 0 });

const pc = { id: 'dev-1', type: 'PC', label: 'PC-1', position: { x: 0, y: 0 } };

describe('what a browser says of its visitor at start-up', () => {
  it('a browser that keeps nothing of the app: a first visit, the tour and the first question are both due', () => {
    expect(firstStepsAtStart(browserWith({}))).toEqual({ tourDue: true, firstTryDue: true });
    expect(usedBefore(browserWith({}))).toBe(false);
  });

  it('the tour once seen is not due again, nor the first question once seen', () => {
    expect(firstStepsAtStart(browserWith({ [TOUR_SEEN_KEY]: 'true' }))).toEqual({
      tourDue: false,
      firstTryDue: true,
    });
    expect(firstStepsAtStart(browserWith({ [FIRST_TRY_SEEN_KEY]: 'true' }))).toEqual({
      tourDue: true,
      firstTryDue: false,
    });
  });

  it('a drawing kept from a visit before the tour existed: not a first visit, the tour is not forced on it', () => {
    const read = browserWith({
      'pixelcake-network-v2': keptBoard({ devices: [pc], connections: [] }),
    });
    expect(usedBefore(read)).toBe(true);
    // (the first question is about a sample: it is still offered once, when the sample is loaded)
    expect(firstStepsAtStart(read)).toEqual({ tourDue: false, firstTryDue: true });
  });

  it('an area alone, or a mark of the marker, is a drawing too', () => {
    const area = {
      id: 'area-1',
      label: 'Core',
      color: 'slate',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 120 },
    };
    expect(
      usedBefore(browserWith({ 'pixelcake-network-v2': keptBoard({ devices: [], areas: [area] }) }))
    ).toBe(true);
    expect(
      usedBefore(
        browserWith({
          'pixelcake-network-v2': keptBoard({ devices: [], marks: [{ id: 'mark-1' }] }),
        })
      )
    ).toBe(true);
  });

  it('a drawing on another board of the project kept in the browser counts as well', () => {
    const project = JSON.stringify({
      state: {
        name: 'Sede',
        canvases: [
          { id: 'canvas-1', name: 'Piano 1', devices: [], connections: [] },
          { id: 'canvas-2', name: 'Piano 2', devices: [pc], connections: [] },
        ],
        activeCanvasId: 'canvas-1',
      },
      version: 0,
    });
    expect(usedBefore(browserWith({ 'pixelcake-project-v1': project }))).toBe(true);
  });

  it('a welcome screen put away for good was seen by someone who came before', () => {
    expect(usedBefore(browserWith({ 'pixelcake-hide-welcome': 'true' }))).toBe(true);
  });

  it('an empty board and an empty project, which the app writes at its very first start, are not a visit before', () => {
    const read = browserWith({
      'pixelcake-network-v2': keptBoard({ devices: [], connections: [], areas: [], marks: [] }),
      'pixelcake-project-v1': JSON.stringify({
        state: { canvases: [{ id: 'canvas-1', devices: [] }] },
        version: 0,
      }),
      'pixelcake-language': 'it',
      'pixelcake-ui-v1': JSON.stringify({ state: { darkMode: true }, version: 0 }),
    });
    expect(usedBefore(read)).toBe(false);
    expect(firstStepsAtStart(read).tourDue).toBe(true);
  });

  it('what cannot be read is no visit before, and nothing throws', () => {
    expect(
      usedBefore(
        browserWith({ 'pixelcake-network-v2': '{not json', 'pixelcake-project-v1': 'null' })
      )
    ).toBe(false);
    const refusing = () => {
      throw new Error('storage refused');
    };
    expect(usedBefore(refusing)).toBe(false);
  });
});

describe('the first question', () => {
  it('is written as a command of the terminal, a name with a space in quotes', () => {
    expect(firstTryCommand({ from: 'PC-Vendite', to: 'Web-Gestionale' })).toBe(
      'ping Web-Gestionale from PC-Vendite'
    );
    expect(firstTryCommand({ from: 'PC Sales', to: 'Web-ERP' })).toBe(
      'ping Web-ERP from "PC Sales"'
    );
  });

  it('only the company sample suggests one, naming its devices as they are loaded', () => {
    setLanguage('it');
    expect(firstTryOf(createCompanySample())).toEqual({ from: 'PC-Vendite', to: 'Web-Gestionale' });
    setLanguage('en');
    expect(firstTryOf(createCompanySample())).toEqual({ from: 'PC-Sales', to: 'Web-ERP' });
    expect(firstTryOf(createSampleTopology())).toBeNull();
  });

  /** Everything the terminal prints for a command, in order */
  const transcript = (result: ExecutionResult) => {
    const live = result.liveTrace;
    return [
      ...result.lines.map(line => line.text),
      ...(live
        ? [...(live.lookup?.lines ?? []), ...live.hopLines, ...live.finalLines].map(
            line => line.text
          )
        : []),
    ];
  };

  it.each<[Language, string, string]>([
    ['it', 'ping Web-Gestionale from PC-Vendite', 'Reply from 192.168.30.30'],
    ['en', 'ping Web-ERP from PC-Sales', 'Reply from 192.168.30.30'],
  ])('is answered on the company sample loaded in %s: %s', (language, command, reply) => {
    setLanguage(language);
    const sample = createCompanySample();
    const network = useNetworkStore.getState();
    network.clearAllDevices();
    network.loadSample(sample);

    const suggested = firstTryOf(sample);
    expect(suggested).not.toBeNull();
    expect(firstTryCommand(suggested!)).toBe(command);

    const printed = transcript(executeCommand(command, { deviceLabel: null }));
    expect(printed.join('\n')).toContain(reply);
    expect(printed.join('\n')).not.toMatch(/failed|blocked|unknown/i);
  });
});
