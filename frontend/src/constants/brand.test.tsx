/**
 * The name of the application, what it is, its motto — written once
 * (constants/brand.ts) and the same wherever the interface shows them: the
 * browser tab, the welcome screen, the menu bar, the foot of the settings
 * and of the guide.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import indexHtml from '../../index.html?raw';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import WelcomeScreen from '@/components/WelcomeScreen';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import SettingsModal from '@/components/Modals/SettingsModal';
import HelpModal from '@/components/Modals/HelpModal';
import Logo from '@/components/ui/Logo';
import { APP_DESCRIPTOR, APP_NAME, APP_TITLE, APP_VERSION } from './brand';
import { dictionaryOf } from '@/i18n';

/** The motto of the Italian interface, the language these tests run in */
const APP_MOTTO = dictionaryOf('it').common.brand.motto;

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** The motto the interface used to show in two places: the README's, in English */
const ENGLISH_MOTTO = /piece by piece/i;

/** Every way the name is written in a text, whatever the capitals */
const namesIn = (text: string) => text.match(/pixel\s?cake/gi) ?? [];

describe('the name, the descriptor and the motto', () => {
  it('are these words', () => {
    expect(APP_NAME).toBe('PixelCake');
    expect(APP_DESCRIPTOR).toBe('Visual Network Designer');
    expect(APP_MOTTO).toBe('Una rete, un pezzo alla volta');
    expect(APP_TITLE).toBe('PixelCake - Visual Network Designer');
  });
});

describe('the version', () => {
  it('is the one of package.json', () => {
    const [written] = Object.values(
      import.meta.glob<string>('/package.json', { eager: true, import: 'version' })
    );
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(APP_VERSION).toBe(written);
  });
});

describe('index.html', () => {
  const page = new DOMParser().parseFromString(indexHtml, 'text/html');

  it('titles the browser tab with the name and the descriptor', () => {
    expect(page.title).toBe(APP_TITLE);
  });

  it('describes the page starting from the same words', () => {
    const description = page.querySelector('meta[name="description"]')?.getAttribute('content');
    expect(description?.startsWith(APP_TITLE)).toBe(true);
  });

  it('writes the name one way only', () => {
    const names = namesIn(indexHtml);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter(name => name !== APP_NAME)).toEqual([]);
    expect(indexHtml).not.toMatch(/Network Architect/i);
  });
});

describe('the interface', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useUIStore.setState(state => ({
      helpTab: 'guide',
      modals: { ...state.modals, settings: false, help: false },
    }));
  });

  it('the welcome screen shows the name, the descriptor and the motto', () => {
    render(<WelcomeScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(APP_NAME);
    expect(screen.getByText(APP_DESCRIPTOR)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(APP_MOTTO);
    expect(screen.getByAltText(`Logo di ${APP_NAME}`)).toBeInTheDocument();
  });

  it('the settings and the guide end with the same motto as the welcome screen, in Italian', () => {
    useUIStore.getState().openModal('settings');
    const settings = render(<SettingsModal />);
    expect(document.querySelector('.modal-footer')).toHaveTextContent(`«${APP_MOTTO}»`);
    expect(document.body.textContent).not.toMatch(ENGLISH_MOTTO);
    settings.unmount();

    useUIStore.getState().openHelp('about');
    render(<HelpModal />);
    expect(document.querySelector('.modal-footer')).toHaveTextContent(`«${APP_MOTTO}»`);
    expect(document.body.textContent).not.toMatch(ENGLISH_MOTTO);
    // and the guide names the application as everything else does
    expect(screen.getByText(APP_NAME, { selector: 'p' })).toBeInTheDocument();
  });

  it('every text that names the application writes the name the same way', () => {
    useUIStore.getState().openHelp('guide');
    render(
      <>
        <TopMenuBar />
        <WelcomeScreen />
        <HelpModal />
        <Logo />
      </>
    );

    const texts = [
      document.body.textContent ?? '',
      ...Array.from(document.querySelectorAll('img')).map(image => image.alt),
    ];
    // (".pixelcake.json", the kind of file, is not the name)
    const names = texts.flatMap(text => namesIn(text.replace(/\.pixelcake\.json/g, '')));

    expect(names.length).toBeGreaterThan(3);
    expect(names.filter(name => name !== APP_NAME)).toEqual([]);
    // (the symbol alone: on the menu bar, and at the foot of the guide)
    expect(screen.getAllByAltText(`Simbolo di ${APP_NAME}`).length).toBeGreaterThan(0);
  });
});
