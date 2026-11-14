/**
 * What the app bundles from others travels with the texts of its licences:
 * the two typefaces of the interface and every icon set still bundled have
 * their text in public/licenses/, which the build copies as it is, and the
 * README names exactly what is bundled. When this fails after updating a
 * package, run `pnpm licenses:fonts`; after changing the icons, `pnpm
 * icons:bundle`, which writes the texts of the icon sets too.
 */

import { describe, it, expect } from 'vitest';
import { BUNDLED_ICON_SETS, BUNDLED_ICON_SET_INFO } from '@/data/bundledIcons';
import { BUNDLED_FONTS } from '@/constants/thirdParty';
import inter from '../../node_modules/@fontsource-variable/inter/LICENSE?raw';
import jetbrainsMono from '../../node_modules/@fontsource/jetbrains-mono/LICENSE?raw';
import readme from '../../../README.md?raw';

/** The files under public/licenses/, by the path the built app has them at */
const shipped = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('/public/licenses/*', { query: '?raw', import: 'default', eager: true })
  ).map(([path, text]) => [path.replace('/public/', ''), text.replace(/\r\n/g, '\n')])
);

/** The licence of each package the typefaces come from, as the package has it */
const PACKAGES: Record<string, string> = { Inter: inter, 'JetBrains Mono': jetbrainsMono };

describe('the licences of the typefaces', () => {
  it('are the two the interface is set in, each with the notice its project writes', () => {
    expect(BUNDLED_FONTS.map((font) => [font.name, font.notice])).toEqual([
      ['Inter', 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)'],
      [
        'JetBrains Mono',
        'Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)',
      ],
    ]);
    for (const font of BUNDLED_FONTS) expect(font.license).toBe('SIL OFL 1.1');
  });

  it.each(BUNDLED_FONTS.map((font) => [font.name, font] as const))(
    '%s: the text of its package, its first line reduced to the one copyright notice',
    (name, font) => {
      const text = shipped[font.file];
      expect(text, `${font.file} is not in public/`).toBeDefined();
      const [first, ...rest] = PACKAGES[name].replace(/\r\n/g, '\n').split('\n');
      // (the package repeats the notice once for each font file it has)
      expect(first.startsWith(font.notice)).toBe(true);
      expect(first.length).toBeGreaterThan(font.notice.length);
      expect(text).toBe([font.notice, ...rest].join('\n'));
      expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  );
});

describe('the licences of the icon sets', () => {
  it('every set bundled says what it is and where its licence is, and no other set does', () => {
    expect(BUNDLED_ICON_SET_INFO.map((set) => set.prefix)).toEqual(BUNDLED_ICON_SETS);
    for (const set of BUNDLED_ICON_SET_INFO) {
      expect(set.name, set.prefix).not.toBe('');
      expect(set.license, set.prefix).not.toBe('');
      expect(set.file).toBe(`licenses/icons-${set.prefix}.txt`);
    }
  });

  it.each(BUNDLED_ICON_SET_INFO.map((set) => [set.prefix, set] as const))(
    '%s: the text of its licence travels with the app',
    (_prefix, set) => {
      const text = shipped[set.file];
      expect(text, `${set.file} is not in public/`).toBeDefined();
      const words: Record<string, string[]> = {
        'Apache-2.0': ['Apache License', 'Version 2.0', 'TERMS AND CONDITIONS'],
        ISC: ['ISC License', 'Permission to use, copy, modify'],
      };
      expect(words[set.spdx], `a licence the test does not know: ${set.spdx}`).toBeDefined();
      for (const word of words[set.spdx]) expect(text).toContain(word);
    }
  );

  it('the devices are not drawn with a set: the sets of before are gone', () => {
    expect(BUNDLED_ICON_SETS).not.toContain('solar');
    expect(BUNDLED_ICON_SETS).not.toContain('carbon');
  });
});

describe('what is in public/licenses/', () => {
  it('is the texts of what is bundled, and nothing else', () => {
    expect(Object.keys(shipped).sort()).toEqual(
      [...BUNDLED_FONTS.map((font) => font.file), ...BUNDLED_ICON_SET_INFO.map((set) => set.file)].sort()
    );
  });
});

describe('the README', () => {
  const text = readme.replace(/\r\n/g, '\n');

  it('names exactly the icon sets that are bundled, each with its licence', () => {
    const found = /The bundled icons keep their own licences: (.+?), obtained through/.exec(text);
    expect(found, 'the sentence on the icons is not in the README').not.toBeNull();
    const named = (found?.[1] ?? '').split(/, | and /);
    expect(named.sort()).toEqual(BUNDLED_ICON_SET_INFO.map((set) => `${set.name} (${set.license})`).sort());
  });

  it('names the two typefaces, and says the drawings of the devices are of the app', () => {
    for (const font of BUNDLED_FONTS) expect(text).toContain(font.name);
    expect(text).toContain('SIL Open Font License 1.1');
    expect(text).toMatch(/drawings of the devices are PixelCake's own/);
    // (by the holder of the app: no other name)
    const start = text.indexOf('## License');
    const licence = text.slice(start, text.indexOf('\n## ', start + 1));
    expect(licence).toContain('Material Design Icons');
    expect(licence.match(/@[A-Za-z0-9-]+/g)?.filter((name) => name !== '@Phil-pje') ?? []).toEqual([]);
  });
});
