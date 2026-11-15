/**
 * A sentence that says a number of things says it rightly of one: «1
 * dispositivo», not «1 dispositivi»; "1 port", not "1 ports".
 *
 * The test calls every entry of the two dictionaries that takes a number of
 * things, or a list of them, with none, one and two, and fails when the
 * words for one are the words for two (a plural after 1) or the words for
 * none (a singular after 0). Which entries take a number is read from the
 * names of their values: every name used in the dictionaries is listed below
 * as a number of things, a list of things or neither, and a name that is
 * not listed fails the test until it is.
 */

import { describe, it, expect } from 'vitest';
import { dictionaryOf, type Language } from '@/i18n';

/* ── what each value of an entry is ───────────────────────────────────── */

/** Values that are a number of things */
const COUNTS = new Set([
  'count',
  'deviceCount',
  'connectionCount',
  'portCount',
  'vlanCount',
  'total',
  'linked',
  'disabled',
  'size',
  'working',
  'endpoints',
]);

/** Values that are a list of things: of numbers (ports, VLANs) or of names */
const LISTS: Record<string, 'numbers' | 'names'> = {
  portIds: 'numbers',
  vlans: 'numbers',
  names: 'names',
  items: 'names',
  servers: 'names',
  zones: 'names',
  devices: 'names',
};

/**
 * Values that are neither: a name, a number that names one thing (port 3,
 * row 2, VLAN 10), a measure, a choice. What is given for each when an
 * entry is called; a name that is not here is given as it is.
 */
const NEITHER: Record<string, unknown> = {
  kind: 'port',
  mode: 'dark',
  maxLength: 32,
  width: 1600,
  height: 900,
  reduced: false,
  withDns: true,
  // (names, addresses, sentences: any text does)
  ...Object.fromEntries(
    [
      'address',
      'appName',
      'backup',
      'canvasName',
      'card',
      'cardName',
      'defaultMask',
      'device',
      'deviceName',
      'dns',
      'field',
      'fileName',
      'first',
      'last',
      'floor',
      'flow',
      'flowName',
      'format',
      'fromGateway',
      'gateway',
      'givenName',
      'id',
      'iface',
      'index',
      'label',
      'leg',
      'linkedTo',
      'n',
      'name',
      'network',
      'number',
      'openedName',
      'peer',
      'place',
      'port',
      'portId',
      'problem',
      'projectName',
      'query',
      'range',
      'reason',
      'record',
      'row',
      'server',
      'side',
      'site',
      'source',
      'state',
      'subnet',
      'target',
      'text',
      'tone',
      'type',
      'typeName',
      'typed',
      'value',
      'version',
      'vlan',
    ].map((name) => [name, undefined])
  ),
};

/* ── the entries that are called another way, or not for one ──────────── */

type Call = { varies: string; with: (n: number) => unknown[] };

/** Entries that take their numbers inside one value: how each number is varied */
const range = (numbers: { leased: number; free: number }) => [
  { gateway: '192.168.10.1', dns: undefined, size: 100, disabled: undefined, ...numbers },
];
const counts = (numbers: Partial<Record<'working' | 'broken' | 'rerouted' | 'unchanged', number>>) => [
  { flowName: 'Ping', endpoints: 4, working: 6, broken: 2, rerouted: 0, unchanged: 0, ...numbers },
];
const INSIDE_ONE_VALUE: Record<string, Call[]> = {
  'dhcp.rangeStatus': [
    { varies: 'leased', with: (n) => range({ leased: n, free: 2 }) },
    { varies: 'free', with: (n) => range({ leased: 2, free: n }) },
  ],
  'presentation.impact.sentence': [
    { varies: 'broken', with: (n) => counts({ broken: n }) },
    { varies: 'working', with: (n) => counts({ working: n, broken: 0 }) },
    { varies: 'rerouted', with: (n) => counts({ rerouted: n }) },
    { varies: 'unchanged', with: (n) => counts({ unchanged: n }) },
  ],
};

/** Numbers that are two at least by what the sentence says: never said of one */
const FROM_TWO = new Set([
  // "the first of N cards": said only when the device has several
  'inspector.general.network.firstCard.firstOfSeveral|count',
  // "between the N end devices": an exchange has two ends
  'presentation.impact.scope|endpoints',
  // "N DHCP servers on the same network": a warning about two or more
  'dhcp.panel.warnings.rivals|servers',
]);

/** Lists that are only written out, «A», «A e B»: no word goes with how many they are */
const ONLY_WRITTEN_OUT = new Set([
  'presentation.list|items',
  'presentation.comparison.anotherWayThrough|devices',
]);

/**
 * Numbers the words do not change with, each for a reason. An entry is here
 * for one language when the other does change («1 collegata», «2 collegate»
 * against "1 connected", "2 connected").
 */
const SAME_WORDS: Record<Language, Set<string>> = {
  it: new Set([
    // «VLAN» has one form: «VLAN 10», «VLAN 10, 20»
    'interfaces.port.vlan.typedList|vlans',
    'interfaces.vlanOfPort.trunk|vlans',
    // «3 porte collegate su 8»: no word goes with the second number
    'interfaces.portsTab.summary|total',
  ]),
  en: new Set([
    // "2 of 8 ports connected": the words go with the second number
    'interfaces.portsTab.summary|linked',
    // "1 connected", "2 disabled", "1 leased, 2 free": no noun, and the adjective has one form
    'interfaces.overview.switchCounts|linked',
    'interfaces.overview.switchCounts|disabled',
    'dhcp.rangeStatus|leased',
    'dhcp.rangeStatus|free',
    // "and 1 more", "and 2 more"
    'presentation.impact.andMore|count',
  ]),
};

/* ── reading the dictionaries ─────────────────────────────────────────── */

type Entry = { path: string; say: (...values: unknown[]) => unknown; names: string[]; oneValue: boolean };

function entriesOf(node: unknown, path = ''): Entry[] {
  if (typeof node === 'function') {
    const head = String(node).split('=>')[0];
    return [
      {
        path,
        say: node as Entry['say'],
        names: head.match(/[A-Za-z_$][\w$]*/g) ?? [],
        // (`({ a, b }) =>`: the numbers are inside one value)
        oneValue: head.includes('{'),
      },
    ];
  }
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) => entriesOf(value, path ? `${path}.${key}` : key));
}

const isNumberOfThings = (name: string) => COUNTS.has(name) || name in LISTS;

/** The values an entry is called with: `varied` is n things, every other number is two */
function valuesFor(names: string[], varied: string, n: number): unknown[] {
  return names.map((name) => {
    const many = name === varied ? n : 2;
    if (COUNTS.has(name)) return many;
    if (name in LISTS) {
      return Array.from({ length: many }, (_, index) => (LISTS[name] === 'numbers' ? 10 * (index + 1) : `Nome-${'ABC'[index]}`));
    }
    return NEITHER[name] ?? name;
  });
}

/** The calls of an entry: one for each number it takes */
function callsOf(entry: Entry): Call[] {
  if (entry.path in INSIDE_ONE_VALUE) return INSIDE_ONE_VALUE[entry.path];
  return entry.names
    .filter(isNumberOfThings)
    .map((name) => ({ varies: name, with: (n: number) => valuesFor(entry.names, name, n) }));
}

/**
 * The words of a sentence without what changes with the number alone: the
 * numbers, the names of a list, the punctuation between them.
 */
const wordsOf = (sentence: string) =>
  sentence
    .replace(/Nome-[ABC]/g, '')
    .replace(/\d+/g, '')
    .replace(/[^\p{L}<>/]+/gu, ' ')
    .trim();

const languages: Language[] = ['it', 'en'];

/* ── the tests ────────────────────────────────────────────────────────── */

describe('the entries that say a number of things', () => {
  it('every value of every entry is known as a number of things, a list, or neither', () => {
    const unknown = languages.flatMap((language) =>
      entriesOf(dictionaryOf(language))
        .filter((entry) => !(entry.path in INSIDE_ONE_VALUE))
        .flatMap((entry) =>
          entry.names
            .filter((name) => !isNumberOfThings(name) && !(name in NEITHER))
            .map((name) => `${language} ${entry.path}: ${name}`)
        )
    );
    expect(unknown).toEqual([]);

    // (numbers inside one value cannot be varied by name: each such entry says how)
    const notSaidHow = entriesOf(dictionaryOf('it'))
      .filter((entry) => entry.oneValue && entry.names.some(isNumberOfThings))
      .filter((entry) => !(entry.path in INSIDE_ONE_VALUE))
      .map((entry) => entry.path);
    expect(notSaidHow).toEqual([]);
  });

  it('there are many of them, the same in the two languages', () => {
    const counted = (language: Language) =>
      entriesOf(dictionaryOf(language))
        .flatMap((entry) => callsOf(entry).map((call) => `${entry.path}|${call.varies}`))
        .sort();
    expect(counted('it').length).toBeGreaterThan(55);
    expect(counted('en')).toEqual(counted('it'));
  });

  it.each(languages)('%s: none says of one what it says of two, or of none what it says of one', (language) => {
    const findings: string[] = [];
    for (const entry of entriesOf(dictionaryOf(language))) {
      for (const call of callsOf(entry)) {
        const key = `${entry.path}|${call.varies}`;
        const said = (n: number) => {
          const sentence = entry.say(...call.with(n));
          expect(typeof sentence, `${key} with ${n}`).toBe('string');
          return sentence as string;
        };
        if (FROM_TWO.has(key)) {
          expect(said(2)).not.toBe('');
          expect(said(3)).not.toBe('');
          continue;
        }
        const [none, one, two] = [said(0), said(1), said(2)];
        if (ONLY_WRITTEN_OUT.has(key)) continue;
        if (SAME_WORDS[language].has(key)) {
          // (the list holds nothing that does change: it would hide a mistake later)
          if (wordsOf(one) !== wordsOf(two)) findings.push(`${key}: listed as saying the same words, and does not`);
          continue;
        }
        if (wordsOf(one) === wordsOf(two)) findings.push(`${key}: «${one}» for one, «${two}» for two`);
        if (wordsOf(none) === wordsOf(one)) findings.push(`${key}: «${none}» for none, «${one}» for one`);
      }
    }
    expect(findings).toEqual([]);
  });

  it('a plural after 1 is found', () => {
    expect(wordsOf('1 dispositivi')).toBe(wordsOf('2 dispositivi'));
    expect(wordsOf('1 dispositivo')).not.toBe(wordsOf('2 dispositivi'));
    expect(wordsOf('e altri 1')).toBe(wordsOf('e altri 2'));
    expect(wordsOf('Trunk: porta <port/>, porta le VLAN <vlans/>')).toBe(
      wordsOf('Trunk: porta <port/>, porta le VLAN <vlans/>')
    );
    // (a list of one and a list of two differ by their names alone)
    expect(wordsOf('Le porte 10 hanno un cavo')).toBe(wordsOf('Le porte 10, 20 hanno un cavo'));
    expect(wordsOf('Guasti simulati: Nome-A')).toBe(wordsOf('Guasti simulati: Nome-A, Nome-B'));
  });
});
