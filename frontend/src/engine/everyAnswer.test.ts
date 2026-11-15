/**
 * Every answer the engine gives on the sample networks, pinned: every
 * ordered pair of end devices, every kind of traffic, with nothing broken
 * and with a few sets of failures. The whole of each answer is counted (the
 * verdict, every leg, every hop with what the device did, the notes), so a
 * change that makes the engine faster cannot change what it says without
 * this test seeing it.
 *
 * The digests were taken before the engine learnt to work out once, for all
 * the pairs of a drawing, what does not change from pair to pair (adjacency,
 * routing tables, distances, addresses).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setLanguage } from '@/i18n';
import type { FlowModelType } from '@/types';
import { evaluateAllFlows, withFailures } from '@/engine';
import type { Failures } from '@/engine';
import { createCompanySample } from '@/utils/sampleCompany';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createPerimeterSample } from '@/utils/samplePerimeter';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { createMultinationalSample } from '@/utils/sampleMultinational';
import type { SampleNetwork } from '@/utils/sampleNetwork';

const FLOWS: FlowModelType[] = ['ping', 'web', 'email', 'download'];

/** A short, stable number for a text (FNV-1a), carried on from one text to the next */
function digestOf(texts: Iterable<string>): string {
  let hash = 0x811c9dc5;
  for (const text of texts) {
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Every answer of a drawing with these failures: how many, how many arrive, their digest */
function answers(sample: SampleNetwork, failures: Failures | undefined) {
  const topo = withFailures({ devices: sample.devices, connections: sample.connections }, failures);
  const texts: string[] = [];
  let arrive = 0;
  for (const flow of FLOWS) {
    const table = evaluateAllFlows(topo, { flow, emailMode: sample.settings.emailMode });
    for (const [key, entry] of table) {
      if (entry.result.verdict === 'success') arrive += 1;
      texts.push(`${flow} ${key} ${JSON.stringify(entry.result)}`);
    }
  }
  return { questions: texts.length, arrive, digest: digestOf(texts) };
}

const cut = (...connections: string[]): Failures => ({ devices: [], connections });
const down = (...devices: string[]): Failures => ({ devices, connections: [] });
const nothing = () => undefined;
/** The main line of Roma, found by its ends: the cable between R-MI-WAN and R-RM */
const romeMainLine = (sample: SampleNetwork) =>
  cut(sample.connections.find((c) => c.source === 'r-mi-wan' && c.target === 'r-rm')!.id);

type Case = [
  string,
  () => SampleNetwork,
  (sample: SampleNetwork) => Failures | undefined,
  { questions: number; arrive: number; digest: string },
];

const CASES: Case[] = [
  ['the company', createCompanySample, nothing, { questions: 528, arrive: 458, digest: '64465a76' }],
  ['the company, its core router down', createCompanySample, () => down('router-core'), { questions: 528, arrive: 109, digest: '6d72a953' }],
  ['the small office', createSampleTopology, nothing, { questions: 48, arrive: 48, digest: '3d146077' }],
  ['the site', createPerimeterSample, nothing, { questions: 80, arrive: 41, digest: 'e0decd6c' }],
  ['the two sites', createRedundancySample, nothing, { questions: 80, arrive: 60, digest: '1a8cb81b' }],
  ['the two sites, the main line cut', createRedundancySample, () => cut('link-principale'), { questions: 80, arrive: 60, digest: '70b8e005' }],
  ['the multinational', createMultinationalSample, nothing, { questions: 69168, arrive: 58880, digest: '7234aaff' }],
  ['the multinational, the main line of Roma cut', createMultinationalSample, romeMainLine, { questions: 69168, arrive: 58880, digest: 'c850d2b5' }],
];

beforeAll(() => setLanguage('it'));

describe('every answer of the engine on the samples', () => {
  it.each(CASES)('%s', (_, create, failuresOf, expected) => {
    const sample = create();
    expect(answers(sample, failuresOf(sample))).toEqual(expected);
  }, 600_000);
});
