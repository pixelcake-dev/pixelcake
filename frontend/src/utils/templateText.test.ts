import { describe, it, expect } from 'vitest';
import { dictionaryOf } from '@/i18n';
import { formerLinkTypeDescriptions as formerItalian } from '@/i18n/it/former';
import { formerLinkTypeDescriptions as formerEnglish } from '@/i18n/en/former';
import { useTemplateStore } from '@/store/templateStore';
import { linkTypeDescription } from './templateText';

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
