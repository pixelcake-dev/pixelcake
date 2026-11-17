/**
 * The ways from the app to its documentation, published with it under docs/
 * (docs/it/ in Italian): an entry of the Help menu, and a line of the
 * «Comandi del terminale» tab of the guide that leads to the terminal
 * reference. Each opens the documentation in the language of the interface,
 * in a new tab, so that the drawing stays where it is.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { setLanguage } from '@/i18n';
import { docsUrl } from '@/constants/links';
import { useUIStore } from '@/store/uiStore';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import HelpModal from '@/components/Modals/HelpModal';
import { loadDocs } from '../../scripts/docs/source.mjs';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  useUIStore.getState().closeModal('help');
});

describe('the documentation', () => {
  it('is under docs/ of the app, in Italian under docs/it/', () => {
    expect(docsUrl('en')).toBe('/docs/');
    expect(docsUrl('it')).toBe('/docs/it/');
    expect(docsUrl('en', 'terminal')).toBe('/docs/terminal/');
    expect(docsUrl('it', 'terminal')).toBe('/docs/it/terminal/');
  });

  it('has a page at each of those addresses', () => {
    const hrefs = loadDocs().pages.map((page) => `/docs/${page.href}`);
    for (const address of [docsUrl('en'), docsUrl('it'), docsUrl('en', 'terminal'), docsUrl('it', 'terminal')]) {
      expect(hrefs, address).toContain(address);
    }
  });

  it('the Help menu opens it in a new tab, in the language of the moment', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<TopMenuBar />);
    fireEvent.click(screen.getByText('Documentazione'));
    expect(open).toHaveBeenCalledWith('/docs/it/', '_blank', 'noopener,noreferrer');

    act(() => setLanguage('en'));
    fireEvent.click(screen.getByText('Documentation'));
    expect(open).toHaveBeenLastCalledWith('/docs/', '_blank', 'noopener,noreferrer');
  });

  it('the entry comes right after the guide', () => {
    render(<TopMenuBar />);
    const entries = [...screen.getByText('Guida').closest('ul')!.querySelectorAll('li')].map((li) => li.textContent);
    expect(entries.slice(0, 3)).toEqual(['Guida', 'Documentazione', 'Comandi del terminale']);
  });

  it('the terminal commands of the guide lead to the terminal reference', () => {
    act(() => useUIStore.getState().openHelp('commands'));
    render(<HelpModal />);
    const link = screen.getByRole('link', { name: 'riferimento del terminale' });
    expect(link.getAttribute('href')).toBe('/docs/it/terminal/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');

    act(() => setLanguage('en'));
    expect(screen.getByRole('link', { name: 'terminal reference' }).getAttribute('href')).toBe('/docs/terminal/');
  });
});
