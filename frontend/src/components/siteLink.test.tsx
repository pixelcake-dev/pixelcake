/**
 * The way back from the app to the site: the logo of the bar, an entry of the
 * Help menu, a link of the welcome screen and a row of the About tab. Each
 * opens the site in the language of the interface, in a new tab, so that the
 * drawing stays where it is.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { setLanguage } from '@/i18n';
import { siteUrl } from '@/constants/links';
import { useUIStore } from '@/store/uiStore';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import WelcomeScreen from '@/components/WelcomeScreen';
import HelpModal from '@/components/Modals/HelpModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const IT = 'https://pixelcake.dev/it/';
const EN = 'https://pixelcake.dev/';

/** A link opens elsewhere, without handing this page to the one it opens */
function expectNewTab(link: HTMLElement) {
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
}

afterEach(() => {
  vi.restoreAllMocks();
  useUIStore.getState().closeModal('help');
});

describe('the site of PixelCake', () => {
  it('is the Italian site for the Italian interface, the English one otherwise', () => {
    expect(siteUrl('it')).toBe(IT);
    expect(siteUrl('en')).toBe(EN);
  });

  it('the logo of the bar leads to it, in the language of the moment', () => {
    render(<TopMenuBar />);
    const logo = screen.getByRole('link', { name: 'Il sito di PixelCake' });
    expect(logo.getAttribute('href')).toBe(IT);
    expectNewTab(logo);

    act(() => setLanguage('en'));
    const english = screen.getByRole('link', { name: 'The PixelCake website' });
    expect(english.getAttribute('href')).toBe(EN);
  });

  it('the Help menu has an entry that opens it in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<TopMenuBar />);
    fireEvent.click(screen.getByText('Il sito di PixelCake'));
    expect(open).toHaveBeenCalledWith(IT, '_blank', 'noopener,noreferrer');

    act(() => setLanguage('en'));
    fireEvent.click(screen.getByText('The PixelCake website'));
    expect(open).toHaveBeenLastCalledWith(EN, '_blank', 'noopener,noreferrer');
  });

  it('the welcome screen links to it first, before the code', () => {
    render(<WelcomeScreen />);
    const site = screen.getByRole('link', { name: 'Il sito' });
    expect(site.getAttribute('href')).toBe(IT);
    expectNewTab(site);
    const links = [...document.querySelectorAll('.welcome-links a')].map((a) => a.textContent);
    expect(links[0]).toBe('Il sito');

    act(() => setLanguage('en'));
    expect(screen.getByRole('link', { name: 'Website' }).getAttribute('href')).toBe(EN);
  });

  it('the About tab of the guide names it, next to the repository', () => {
    act(() => useUIStore.getState().openHelp('about'));
    render(<HelpModal />);
    const site = screen.getByRole('link', { name: 'pixelcake.dev/it' });
    expect(site.getAttribute('href')).toBe(IT);
    expectNewTab(site);
    expect(screen.getByText('Sito')).toBeTruthy();

    act(() => setLanguage('en'));
    expect(screen.getByRole('link', { name: 'pixelcake.dev' }).getAttribute('href')).toBe(EN);
  });
});
