/**
 * The two dictionaries say the same things. The compiler already refuses an
 * English dictionary that lacks an entry or has one of another kind; these
 * tests look at what the compiler cannot see: an English entry still in
 * Italian, an English entry that is only the Italian one again, a piece of a
 * sentence (a button, a word in code) present in one language and not in the
 * other, a word the glossary does not allow, and a guide that names a
 * control by a label the control does not have.
 */

import { describe, it, expect } from 'vitest';
import { dictionaryOf } from '@/i18n';
import { richPieces } from './richPieces';
import { italianIn, leavesOf, quotedText } from '@/test/italian';

const italian = leavesOf(dictionaryOf('it'));
const english = leavesOf(dictionaryOf('en'));
const englishByPath = new Map(english.map((leaf) => [leaf.path, leaf]));

/** What a person reads of an entry: its text, or the texts inside a function */
const words = (leaf: { text: string; isFunction: boolean }) =>
  leaf.isFunction ? quotedText(leaf.text) : leaf.text;

/**
 * Entries that read the same in the two languages, each for a reason: a
 * technical name, a key of the keyboard, an English word the Italian
 * interface uses, a format with no words of its own.
 */
const SAME_IN_BOTH = new Set([
  'common.services.ping',
  'common.services.web',
  'common.services.email',
  'common.services.dns',
  'common.deviceTabs.nat',
  'common.deviceTabs.dhcp',
  'common.deviceTabs.dns',
  'menu.file.title',
  'sidebar.buttons.explorer',
  'sidebar.buttons.console',
  'sidebar.buttons.importExport',
  'sidebar.panels.explorer',
  'simulation.flowModels.ping',
  'contextMenu.device.console',
  'addDevice.identity.vendor',
  'addDevice.network.subnetMask',
  'addDevice.network.gateway',
  'inspector.general.identity.vendor',
  'interfaces.fields.subnetMask',
  'interfaces.fields.gateway',
  'dhcp.panel.ranges.fieldOf',
  'networkSettings.simulation.cloud',
  'newProject.network.mask',
  'advanced.shortcuts.rows.save.keys',
  'advanced.shortcuts.rows.undo.keys',
  'advanced.shortcuts.rows.copy.keys',
  'advanced.shortcuts.rows.paste.keys',
  'advanced.shortcuts.rows.release.keys',
  'advanced.shortcuts.rows.focusNext.keys',
  'advanced.shortcuts.rows.closeWindow.keys',
  'advanced.shortcuts.rows.interrupt.keys',
  'advanced.shortcuts.rows.closeTerminal.keys',
  'advanced.shortcuts.rows.leavePresentation.keys',
  'advanced.shortcuts.rows.markerToggle.keys',
  'advanced.shortcuts.rows.markerOff.keys',
  'advanced.shortcuts.rows.tourClose.keys',
  'help.about.licenceText',
  'help.about.repository',
  'presentation.caption.failuresLine',
  // (the names of drawings the Italian interface writes as the English ones, as the kit does)
  'templates.devices.drawingNames.router',
  'templates.devices.drawingNames.switch',
  'templates.devices.drawingNames.firewall',
  'templates.devices.drawingNames.access-point',
  'templates.devices.drawingNames.load-balancer',
  'templates.devices.drawingNames.cloud',
  'templates.devices.drawingNames.server',
  'templates.devices.drawingNames.database',
  'templates.devices.drawingNames.nas',
  'templates.devices.drawingNames.pc',
  'templates.devices.drawingNames.laptop',
  'templates.devices.drawingNames.smartphone',
  'templates.devices.drawingNames.tablet',
]);

describe('the two dictionaries', () => {
  it('have the same entries, each of the same kind and taking the same values', () => {
    expect(italian.length).toBeGreaterThan(900);
    expect(english.map((leaf) => leaf.path)).toEqual(italian.map((leaf) => leaf.path));

    const differentKind = italian
      .filter((leaf) => englishByPath.get(leaf.path)?.isFunction !== leaf.isFunction)
      .map((leaf) => leaf.path);
    expect(differentKind).toEqual([]);
  });

  it('no English entry is the Italian one again, unless the two really read the same', () => {
    const same = italian
      .filter((leaf) => englishByPath.get(leaf.path)?.text === leaf.text)
      .map((leaf) => leaf.path);

    expect(same.filter((path) => !SAME_IN_BOTH.has(path))).toEqual([]);
    // (and the list holds nothing that is no longer the same: it would hide a mistake later)
    expect([...SAME_IN_BOTH].filter((path) => !same.includes(path))).toEqual([]);
  });

  it('the English one has no Italian in it', () => {
    const findings = english
      .map((leaf) => ({ path: leaf.path, italian: italianIn(words(leaf), { strict: true }) }))
      .filter((finding) => finding.italian.length > 0)
      .map((finding) => `${finding.path}  [${finding.italian.join(', ')}]`);

    expect(findings).toEqual([]);
  });

  it('the scan for Italian tells the two languages apart', () => {
    for (const text of [
      'Salva su file',
      'Nessun dispositivo trovato',
      "L'indirizzo è proposto",
      'Eliminare «Uffici»?',
      'la porta non ha un indirizzo',
    ]) {
      expect(italianIn(text, { strict: true }), text).not.toEqual([]);
    }
    for (const text of [
      'Save to file',
      'No devices found',
      'The address is suggested: the first free one.',
      'Delete “Offices”?',
      'a trunk, which carries several VLANs tagged',
      'e.g. Cisco, HP, Dell…',
      'ping www.company.example from PC-Sales',
    ]) {
      expect(italianIn(text, { strict: true }), text).toEqual([]);
    }
  });

  it('a sentence has the same pieces in both languages: the words in code, the parts a screen draws', () => {
    const marksOf = (leaf: { text: string; isFunction: boolean }) => {
      const marks = richPieces(words(leaf))
        .filter((piece) => piece.kind !== 'text')
        .map((piece) => (piece.kind === 'part' ? `<${piece.name}>` : '`code`'))
        .sort();
      // (a function may write its sentence more than once, for one and for
      // many: which pieces it has is what counts, not how many times)
      return (leaf.isFunction ? [...new Set(marks)] : marks).join();
    };

    const uneven = italian
      .filter((leaf) => {
        const other = englishByPath.get(leaf.path);
        return other !== undefined && marksOf(leaf) !== marksOf(other);
      })
      .map((leaf) => leaf.path);

    expect(uneven).toEqual([]);
  });

  it('what is said of the ports or of the cards names the ones it is about', () => {
    for (const [language, ports, cards] of [
      ['it', 'porte', 'schede'],
      ['en', 'ports', 'cards'],
    ] as const) {
      const said = dictionaryOf(language).dhcp.panel.ranges.onlyAddressed;
      expect(said('port')).toContain(` ${ports} `);
      expect(said('port')).not.toContain(` ${cards} `);
      expect(said('card')).toContain(` ${cards} `);
      expect(said('card')).not.toContain(` ${ports} `);
    }
  });

  it('the English one keeps to the glossary: board, image, path, connected to, network card', () => {
    const banned: Array<[RegExp, string]> = [
      [/\bcanvas(es)?\b/i, 'board'],
      [/\bpictures?\b/i, 'image'],
      [/\bNICs?\b/, 'network card'],
      [/\b(another|shortest) way\b/i, 'path'],
      [/\blinked to\b/i, 'connected to'],
      // (as a label: «Gateway consegnato» is "Gateway for clients"; "hand out" stays as a verb)
      [/\bhanded out\b(?! by)/i, 'for clients'],
      // (an Italian word inside an example: the English ones are under company.example)
      [/azienda/i, 'company'],
    ];
    const findings = english.flatMap((leaf) =>
      banned
        .filter(([pattern]) => pattern.test(words(leaf)))
        .map(([pattern, instead]) => `${leaf.path}: ${pattern} (say "${instead}")`)
    );

    expect(findings).toEqual([]);
  });
});

/* ── the guide names controls by the labels they have ─────────────────── */

describe('the guide', () => {
  /** What the guide puts in quotes that is not the label of a control */
  const NOT_A_CONTROL = {
    it: [
      'Uffici', // the name given to VLAN 10 in the example
      'Internet', // the name of a Cloud symbol
      'Salva PNG…', // the button «Salva <format>…» with its format
      'Scarica PNG',
    ],
    en: ['Offices', 'Internet', 'Save PNG…', 'Download PNG'],
  };

  it.each([
    ['it', /«([^»]+)»/g],
    ['en', /“([^”]+)”/g],
  ] as const)('%s: every name in quotes is the label of a control', (language, quotes) => {
    const dictionary = dictionaryOf(language);
    const labels = new Set(
      leavesOf(dictionary)
        .filter((leaf) => !leaf.isFunction && !leaf.path.startsWith('help.steps'))
        .map((leaf) => leaf.text)
    );
    const quoted = Object.values(dictionary.help.steps).flatMap((step) =>
      [...step.text.matchAll(quotes)].map((match) => match[1])
    );

    expect(quoted.length).toBeGreaterThan(50);
    const unknown = quoted.filter((name) => !labels.has(name) && !NOT_A_CONTROL[language].includes(name));
    expect(unknown).toEqual([]);

    // The two built with a format are what the picture window says
    expect(dictionary.exportImage.save('PNG')).toBe(NOT_A_CONTROL[language][2]);
    expect(dictionary.exportImage.download('PNG')).toBe(NOT_A_CONTROL[language][3]);
  });

  it('has the same steps, in the same order, and quotes as many controls in each', () => {
    const steps = (language: 'it' | 'en') => Object.entries(dictionaryOf(language).help.steps);
    expect(steps('en').map(([key]) => key)).toEqual(steps('it').map(([key]) => key));

    const uneven = steps('it')
      .map(([key, step], index) => {
        const inItalian = [...step.text.matchAll(/«[^»]+»/g)].length;
        const inEnglish = [...steps('en')[index][1].text.matchAll(/“[^”]+”/g)].length;
        return inItalian === inEnglish ? null : `${key}: ${inItalian} in Italian, ${inEnglish} in English`;
      })
      .filter(Boolean);
    expect(uneven).toEqual([]);
  });

  it('the English guide has no Italian quotation marks, the Italian one no English ones', () => {
    const texts = (language: 'it' | 'en') =>
      Object.values(dictionaryOf(language).help.steps)
        .map((step) => step.text)
        .join(' ');
    expect(texts('en')).not.toMatch(/[«»]/);
    expect(texts('it')).not.toMatch(/[“”]/);
  });
});
