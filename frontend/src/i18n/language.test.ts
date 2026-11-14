/**
 * The language the interface starts in, and where the choice is kept.
 *
 * At start-up: `?lang=` in the address, then the choice remembered in this
 * browser, then the languages of the browser (the first one the interface
 * speaks; English when it speaks none). Only a choice is remembered. The
 * page says its language in `<html lang>`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEY = 'pixelcake-language';

/** The browser the visitor has: its languages, in the order they prefer them */
function browserSpeaks(...languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
  Object.defineProperty(window.navigator, 'language', { value: languages[0] ?? '', configurable: true });
}

/** The app as a page load starts it: the language module evaluated from scratch */
async function visit(address = '/') {
  window.history.replaceState(null, '', address);
  vi.resetModules();
  return import('@/i18n');
}

describe('the language of the interface', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    document.documentElement.lang = '';
  });

  afterEach(() => {
    // (what test/setup.ts gives every other test: an Italian browser at the plain address)
    browserSpeaks('it-IT', 'it');
    localStorage.removeItem(KEY);
    window.history.replaceState(null, '', '/');
    document.documentElement.lang = 'it';
    vi.restoreAllMocks();
  });

  describe('on a first visit', () => {
    it.each([
      [['it-IT', 'it', 'en'], 'it'],
      [['it'], 'it'],
      [['it-CH'], 'it'],
      [['IT'], 'it'],
      [['en-US', 'en'], 'en'],
      [['en-GB', 'it'], 'en'],
    ])('a browser that speaks %j starts in "%s"', async (languages, expected) => {
      browserSpeaks(...languages);
      const { getLanguage } = await visit();

      expect(getLanguage()).toBe(expected);
    });

    it.each([[['de-DE', 'de']], [['fr']], [['ja', 'zh']], [['itx']]])(
      'a browser that speaks neither (%j) starts in English',
      async (languages) => {
        browserSpeaks(...languages);
        const { getLanguage } = await visit();

        expect(getLanguage()).toBe('en');
      }
    );

    it('takes the first language of the visitor that the interface speaks, not only the first one', async () => {
      browserSpeaks('de-CH', 'it-CH', 'en');
      expect((await visit()).getLanguage()).toBe('it');

      browserSpeaks('fr', 'en-GB', 'it');
      expect((await visit()).getLanguage()).toBe('en');
    });

    it('reads the one language of a browser that gives no list', async () => {
      Object.defineProperty(window.navigator, 'languages', { value: undefined, configurable: true });
      Object.defineProperty(window.navigator, 'language', { value: 'it-IT', configurable: true });

      expect((await visit()).getLanguage()).toBe('it');
    });

    it('remembers nothing: a language that was detected is detected again next time', async () => {
      browserSpeaks('en-US');
      await visit();
      expect(localStorage.getItem(KEY)).toBeNull();

      browserSpeaks('it-IT');
      expect((await visit()).getLanguage()).toBe('it');
    });
  });

  describe('a choice', () => {
    it('is followed at once, by code outside React too', async () => {
      browserSpeaks('it-IT');
      const { getLanguage, setLanguage, getT } = await visit();
      expect(getT().common.actions.save).toBe('Salva');

      setLanguage('en');

      expect(getLanguage()).toBe('en');
      expect(getT().common.actions.save).toBe('Save');
      expect(getT().files.opened('HQ')).toBe('Project "HQ" opened');
    });

    it('is remembered, and wins over the language of the browser at the next visit', async () => {
      browserSpeaks('it-IT');
      const { setLanguage } = await visit();
      setLanguage('en');
      expect(localStorage.getItem(KEY)).toBe('en');

      for (let reload = 0; reload < 3; reload++) {
        expect((await visit()).getLanguage()).toBe('en');
      }

      browserSpeaks('en-US');
      const again = await visit();
      again.setLanguage('it');
      expect((await visit()).getLanguage()).toBe('it');
    });

    it('lasts for the visit where the browser refuses to keep it', async () => {
      browserSpeaks('it-IT');
      const { getLanguage, setLanguage } = await visit();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage is full');
      });

      expect(() => setLanguage('en')).not.toThrow();
      expect(getLanguage()).toBe('en');
    });

    it('something else left under the key is not a choice', async () => {
      localStorage.setItem(KEY, 'klingon');
      browserSpeaks('it-IT');

      expect((await visit()).getLanguage()).toBe('it');
    });
  });

  describe('?lang= in the address', () => {
    it('chooses the language, whatever the browser speaks and whatever was remembered', async () => {
      browserSpeaks('it-IT');
      localStorage.setItem(KEY, 'it');

      expect((await visit('/?lang=en')).getLanguage()).toBe('en');

      browserSpeaks('en-US');
      localStorage.setItem(KEY, 'en');

      expect((await visit('/?lang=it')).getLanguage()).toBe('it');
    });

    it('is remembered: the next visit, without it, is in the same language', async () => {
      browserSpeaks('it-IT');
      await visit('/?lang=en');
      expect(localStorage.getItem(KEY)).toBe('en');

      expect((await visit('/')).getLanguage()).toBe('en');
    });

    it('is taken out of the address, and the rest of the address stays', async () => {
      browserSpeaks('it-IT');
      await visit('/?lang=en&demo=1#guide');

      expect(window.location.search).toBe('?demo=1');
      expect(window.location.hash).toBe('#guide');
    });

    it('so a choice made afterwards with the switch survives a reload', async () => {
      browserSpeaks('en-US');
      const { setLanguage } = await visit('/?lang=en');
      setLanguage('it');

      // (a reload of the address as it is now)
      expect((await visit(window.location.pathname + window.location.search)).getLanguage()).toBe('it');
    });

    it.each(['/?lang=de', '/?lang=', '/?lang=english'])('a language it does not speak is ignored (%s)', async (address) => {
      browserSpeaks('it-IT');
      const { getLanguage } = await visit(address);

      expect(getLanguage()).toBe('it');
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('reads capitals and regions as the language they are', async () => {
      browserSpeaks('it-IT');

      expect((await visit('/?lang=EN')).getLanguage()).toBe('en');
      expect((await visit('/?lang=en-GB')).getLanguage()).toBe('en');
    });
  });

  describe('<html lang>', () => {
    it('says the language the page starts in', async () => {
      browserSpeaks('en-US');
      await visit();
      expect(document.documentElement.lang).toBe('en');

      browserSpeaks('it-IT');
      await visit();
      expect(document.documentElement.lang).toBe('it');
    });

    it('follows the choice', async () => {
      browserSpeaks('it-IT');
      const { setLanguage } = await visit();

      setLanguage('en');
      expect(document.documentElement.lang).toBe('en');

      setLanguage('it');
      expect(document.documentElement.lang).toBe('it');
    });
  });
});
