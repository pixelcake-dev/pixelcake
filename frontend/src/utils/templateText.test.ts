import { describe, it, expect } from 'vitest';
import { dictionaryOf } from '@/i18n';
import { formerLinkTypeDescriptions as formerItalian } from '@/i18n/it/former';
import { formerLinkTypeDescriptions as formerEnglish } from '@/i18n/en/former';
import { useTemplateStore } from '@/store/templateStore';
import { deviceTemplateDescription, linkTypeDescription } from './templateText';

const italian = dictionaryOf('it');
const english = dictionaryOf('en');
type BuiltIn = keyof typeof italian.templates.links.builtInDescriptions;
const builtInOf = (templateId: string) => templateId.replace('conn-', '') as BuiltIn;

describe('the description of a link type', () => {
  it('of a built-in type follows the language, whichever language wrote it', () => {
    const builtIn = useTemplateStore.getState().connectionTemplates;
    expect(builtIn.length).toBe(5);
    for (const template of builtIn) {
      const inItalian = italian.templates.links.builtInDescriptions[builtInOf(template.id)];
      const inEnglish = english.templates.links.builtInDescriptions[builtInOf(template.id)];
      expect(linkTypeDescription(template, italian)).toBe(inItalian);
      expect(linkTypeDescription(template, english)).toBe(inEnglish);
      expect(linkTypeDescription({ ...template, description: inEnglish }, italian)).toBe(inItalian);
    }
  });

  it('kept from an earlier version, with the words of then, still follows the language', () => {
    // (the words as they were stored: they are not in the dictionaries any more)
    const kept = [
      { id: 'conn-access', description: ['Porta di accesso', 'a dispositivi finali'].join(' ') },
      { id: 'conn-trunk', description: ['Link trunk', 'tra switch'].join(' ') },
      { id: 'conn-uplink', description: ['Uplink a', 'core/internet'].join(' ') },
      { id: 'conn-access', description: ['Access port', 'for end devices'].join(' ') },
    ];
    expect(kept.map((template) => template.description)).toEqual([
      ...formerItalian.access,
      ...formerItalian.trunk,
      ...formerItalian.uplink,
      ...formerEnglish.access,
    ]);
    for (const template of kept) {
      const key = builtInOf(template.id);
      expect(linkTypeDescription(template, italian), template.description).toBe(
        italian.templates.links.builtInDescriptions[key]
      );
      expect(linkTypeDescription(template, english), template.description).toBe(
        english.templates.links.builtInDescriptions[key]
      );
    }
  });

  it('the earlier words are of built-in types, and are no longer the words of today', () => {
    for (const [former, today] of [
      [formerItalian, italian],
      [formerEnglish, english],
    ] as const) {
      for (const [key, texts] of Object.entries(former)) {
        const now = today.templates.links.builtInDescriptions[key as BuiltIn];
        expect(now, key).toBeTypeOf('string');
        expect(texts).not.toContain(now);
      }
    }
  });

  it('rewritten by the user is shown as typed, in both languages', () => {
    const rewritten = { id: 'conn-trunk', description: 'Dorsale tra i due armadi' };
    expect(linkTypeDescription(rewritten, italian)).toBe('Dorsale tra i due armadi');
    expect(linkTypeDescription(rewritten, english)).toBe('Dorsale tra i due armadi');
    // (the earlier words of another built-in type are not this type's own)
    const borrowed = { id: 'conn-trunk', description: formerItalian.access[0] };
    expect(linkTypeDescription(borrowed, english)).toBe(formerItalian.access[0]);
  });

  it('of a type the user made, or with no description, is left as it is', () => {
    expect(linkTypeDescription({ id: 'conn-custom-1', description: formerItalian.trunk[0] }, english)).toBe(
      formerItalian.trunk[0]
    );
    expect(linkTypeDescription({ id: 'conn-access', description: undefined }, english)).toBeUndefined();
  });
});

describe('what a device template is, in the panel that adds devices', () => {
  const builtIn = () => useTemplateStore.getState().templates.filter((template) => !template.isCustom);

  it.each([
    ['it', italian],
    ['en', english],
  ] as const)('%s: each of the twenty built-in templates says what it is, and no two say the same', (_, words) => {
    const said = builtIn().map((template) => deviceTemplateDescription(template, words));
    expect(said).toHaveLength(20);
    expect(said.every((text) => text.length > 0)).toBe(true);
    expect(new Set(said).size).toBe(20);
  });

  it('a template that is a kind of a type is not described as that type', () => {
    const of = (id: string) => {
      const template = builtIn().find((candidate) => candidate.id === id);
      if (!template) throw new Error(`no template ${id}`);
      return template;
    };
    // an IoT gateway is built on the access point, a printer on the PC, a NAS on the database
    expect(deviceTemplateDescription(of('tpl-iotgateway'), italian)).toBe('Collega sensori e dispositivi IoT alla rete');
    expect(deviceTemplateDescription(of('tpl-iotgateway'), english)).toBe(
      'Connects sensors and IoT devices to the network'
    );
    expect(deviceTemplateDescription(of('tpl-accesspoint'), italian)).toBe('Punto di accesso Wi-Fi');
    expect(deviceTemplateDescription(of('tpl-printer'), italian)).toBe('Stampante di rete');
    expect(deviceTemplateDescription(of('tpl-pc'), italian)).toBe('Dispositivo finale per gli utenti');
    expect(deviceTemplateDescription(of('tpl-nas'), english)).toBe('Shared network storage');
    expect(deviceTemplateDescription(of('tpl-database'), english)).toBe('Database server');
  });

  it('a template the app does not know by its id is described by its type', () => {
    expect(deviceTemplateDescription({ id: 'tpl-server-1700000000000', type: 'Server' }, italian)).toBe(
      italian.devicePanel.descriptions.server
    );
    expect(deviceTemplateDescription({ id: 'tpl-new', type: 'Router' }, english)).toBe(
      english.devicePanel.descriptions.router
    );
  });
});
