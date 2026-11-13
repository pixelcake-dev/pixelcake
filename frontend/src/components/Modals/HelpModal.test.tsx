/**
 * HelpModal tests — the guide: three tabs, opened on the one that was asked
 * for. The command tab must show the very table the terminal prints with
 * `help`, so the two can never tell different stories.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useUIStore, type HelpTab } from '@/store/uiStore';
import { COMMAND_REFERENCE, executeCommand } from '@/terminal/executor';
import { GITHUB_REPO } from '@/constants/links';
import HelpModal from './HelpModal';

function openOn(tab?: HelpTab) {
  useUIStore.getState().openHelp(tab);
  return render(<HelpModal />);
}

const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent;

/** The version in package.json: the one the guide has to show */
const [packageVersion] = Object.values(
  import.meta.glob<string>('/package.json', { eager: true, import: 'version' })
);

/** [syntax, description] of every row of the command table */
function commandRows(): Array<[string, string]> {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.map(row => {
    const [syntax, description] = within(row).getAllByRole('cell');
    return [syntax.textContent ?? '', description.textContent ?? ''];
  });
}

describe('HelpModal', () => {
  beforeEach(() => {
    useUIStore.setState(state => ({
      helpTab: 'guide',
      modals: { ...state.modals, help: false },
    }));
  });

  it('shows nothing while closed', () => {
    const { container } = render(<HelpModal />);

    expect(container).toBeEmptyDOMElement();
  });

  it('is titled "Guida" and has three tabs', () => {
    openOn();

    expect(screen.getByRole('heading', { name: 'Guida' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Come si usa',
      'Comandi del terminale',
      'Informazioni',
    ]);
  });

  it('opens on "Come si usa" when no tab is asked for', () => {
    openOn();

    expect(selectedTab()).toBe('Come si usa');
    // the steps, and the line that says what the application is not
    expect(screen.getByText('Aggiungi i dispositivi')).toBeInTheDocument();
    expect(screen.getByText('Salva su file')).toBeInTheDocument();
    expect(screen.getByText('.pixelcake.json')).toBeInTheDocument();
    expect(
      screen.getByText(
        'PixelCake è un prototipo: serve a ragionare su una piccola rete, non a validarne una reale.'
      )
    ).toBeInTheDocument();
  });

  it.each<[HelpTab, string]>([
    ['guide', 'Come si usa'],
    ['commands', 'Comandi del terminale'],
    ['about', 'Informazioni'],
  ])('opens on the tab it is asked for (%s)', (tab, label) => {
    openOn(tab);

    expect(selectedTab()).toBe(label);
  });

  it('moves between its tabs', () => {
    openOn();

    fireEvent.click(screen.getByRole('tab', { name: 'Comandi del terminale' }));
    expect(selectedTab()).toBe('Comandi del terminale');
    expect(screen.queryByText('Aggiungi i dispositivi')).toBeNull();
    expect(screen.getByRole('table')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Informazioni' }));
    expect(selectedTab()).toBe('Informazioni');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('closing it puts it back on the first tab', () => {
    openOn('about');

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi la guida' }));

    expect(useUIStore.getState().modals.help).toBe(false);
    expect(useUIStore.getState().helpTab).toBe('guide');
    expect(screen.queryByRole('heading', { name: 'Guida' })).toBeNull();
  });

  describe('"Comandi del terminale"', () => {
    it('lists every entry of the terminal command reference, in its order', () => {
      openOn('commands');

      expect(COMMAND_REFERENCE.length).toBeGreaterThan(5);
      expect(commandRows()).toEqual(COMMAND_REFERENCE);
    });

    it('shows what the terminal prints with "help"', () => {
      openOn('commands');
      const printed = executeCommand('help', { deviceLabel: null }).lines.map(line => line.text);

      const rows = commandRows();
      const notPrinted = rows.filter(
        ([syntax, description]) =>
          !printed.some(text => text.includes(syntax) && text.includes(description))
      );
      expect(notPrinted).toEqual([]);
      // heading + one line per command + the two closing notes, on device
      // names and on host names
      expect(printed).toHaveLength(rows.length + 3);
    });

    it('says where else the list is and how device names are read', () => {
      openOn('commands');

      const intro = screen.getByText(/Lo stesso elenco compare scrivendo/);
      expect(intro).toHaveTextContent(
        'Lo stesso elenco compare scrivendo help nel terminale. I nomi dei dispositivi non distinguono maiuscole e minuscole e possono essere di più parole.'
      );
      expect(intro).toHaveTextContent(
        'Dove un comando chiede una destinazione si può scrivere anche un nome come www.azienda.example: il dispositivo di partenza ne chiede prima l\'indirizzo al proprio server DNS.'
      );
    });
  });

  describe('"Informazioni"', () => {
    it('gives name, version, licence, repository and technologies', () => {
      openOn('about');
      const panel = screen.getByRole('tabpanel');

      expect(within(panel).getByText('PixelCake')).toBeInTheDocument();
      expect(packageVersion).toMatch(/^\d+\.\d+\.\d+/);
      expect(within(panel).getByText(`${packageVersion} (Beta)`)).toBeInTheDocument();
      expect(within(panel).getByText(/AGPL-3\.0/)).toBeInTheDocument();
      expect(within(panel).getByText(/React 19, TypeScript, Vite/)).toBeInTheDocument();
      const link = within(panel).getByRole('link');
      expect(link).toHaveAttribute('href', GITHUB_REPO);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('has no user profile to fill in', () => {
      openOn('about');

      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByText(/Profilo/)).toBeNull();
      expect(screen.queryByText(/Email/i)).toBeNull();
    });
  });
});
