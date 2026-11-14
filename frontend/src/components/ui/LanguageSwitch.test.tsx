/**
 * The switch between Italian and English: two letters each, the one in use
 * marked. A click changes the whole interface at once, with no reload and
 * without losing what was on screen; the choice is remembered; text made
 * outside React (a notice, a question) follows too.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { toast } from 'sonner';
import { LANGUAGE_KEY, getLanguage, getT, setLanguage, useT } from '@/i18n';
import { useUIStore } from '@/store/uiStore';
import { useConfirmStore } from '@/store/confirmStore';
import { createNewProject, requestNewProject } from '@/utils/projectFileAccess';
import { useNetworkStore } from '@/store/networkStore';
import { settled } from '@/test/confirm';
import LanguageSwitch from './LanguageSwitch';
import WelcomeScreen from '@/components/WelcomeScreen';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import AppearanceSettingsTab from '@/components/Modals/AppearanceSettingsTab';
import ConfirmDialog from './ConfirmDialog';
import PresentationBar from '@/components/Presentation/PresentationBar';
import { usePresentationStore } from '@/store/presentationStore';
import { createSampleTopology } from '@/utils/sampleTopology';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const button = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('LanguageSwitch', () => {
  it('offers the two languages with two letters each, and marks the one in use', () => {
    render(<LanguageSwitch />);
    const group = screen.getByRole('group', { name: 'Lingua' });
    const [italian, english] = within(group).getAllByRole('button');

    expect(italian).toHaveTextContent(/^it$/);
    expect(english).toHaveTextContent(/^en$/);
    expect(italian).toHaveAttribute('aria-pressed', 'true');
    expect(english).toHaveAttribute('aria-pressed', 'false');
    expect(italian).toHaveClass('active');
    expect(english).not.toHaveClass('active');
  });

  it('names each language in itself, whatever the language of the interface', () => {
    render(<LanguageSwitch />);

    for (const language of ['it', 'en'] as const) {
      act(() => setLanguage(language));
      expect(button('Italiano')).toHaveAttribute('lang', 'it');
      expect(button('Italiano')).toHaveAttribute('title', 'Italiano');
      expect(button('English')).toHaveAttribute('lang', 'en');
      expect(button('English')).toHaveAttribute('title', 'English');
    }
  });

  it('has no flag and no picture: a language is not a country', () => {
    const { container } = render(<LanguageSwitch />);

    expect(container.querySelector('img, svg')).toBeNull();
    expect(container.textContent).toBe('iten');
  });

  it('a click changes the language: the page says so, and the choice is remembered', () => {
    render(<LanguageSwitch />);

    fireEvent.click(button('English'));

    expect(getLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(button('English')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Italiano')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button('Italiano'));

    expect(getLanguage()).toBe('it');
    expect(document.documentElement.lang).toBe('it');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('it');
    expect(screen.getByRole('group', { name: 'Lingua' })).toBeInTheDocument();
  });

  it('changes what is on screen at once, without drawing it from scratch', () => {
    // A component with something of its own to lose: what was typed in it
    const Form = () => {
      const t = useT();
      const [name, setName] = useState('');
      return (
        <label>
          {t.explorer.projectName}
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      );
    };
    render(
      <>
        <LanguageSwitch />
        <Form />
      </>
    );
    fireEvent.change(screen.getByLabelText('Nome del progetto'), { target: { value: 'Sede Milano' } });
    const field = screen.getByLabelText('Nome del progetto');

    fireEvent.click(button('English'));

    expect(screen.queryByLabelText('Nome del progetto')).toBeNull();
    // the same field, still holding what was typed
    expect(screen.getByLabelText('Project name')).toBe(field);
    expect(field).toHaveValue('Sede Milano');
  });
});

describe('where the switch is', () => {
  beforeEach(() => {
    createNewProject({ name: 'Sede Milano' });
    vi.clearAllMocks();
  });

  it('on the menu bar, next to the theme: the menus change under it', () => {
    render(<TopMenuBar />);
    expect(screen.getByText('Modifica')).toBeInTheDocument();
    expect(screen.getByText('Nuovo progetto…')).toBeInTheDocument();
    const theme = screen.getByTitle('Passa al tema scuro');
    const group = screen.getByRole('group', { name: 'Lingua' });
    // (the switch comes right before the theme button)
    expect(group.nextElementSibling).toBe(theme);

    fireEvent.click(button('English'));

    expect(screen.queryByText('Modifica')).toBeNull();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('New project…')).toBeInTheDocument();
    expect(screen.getByText('Export image…')).toBeInTheDocument();
    expect(screen.getByTitle('Switch to dark theme')).toBe(theme);
    // what the user wrote is not translated
    expect(screen.getByText('Sede Milano')).toBeInTheDocument();
  });

  it('on the bar of the presentation, next to the theme as on the menu bar', () => {
    act(() => {
      const { devices, connections } = createSampleTopology();
      useNetworkStore.getState().loadTopology(devices, connections);
      usePresentationStore.getState().enter();
    });
    render(<PresentationBar />);
    const theme = screen.getByRole('button', { name: 'Passa al tema scuro' });
    expect(screen.getByRole('group', { name: 'Lingua' }).nextElementSibling).toBe(theme);
    expect(screen.getByRole('button', { name: 'Esci' })).toBeInTheDocument();

    fireEvent.click(button('English'));

    expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBe(theme);
    act(() => usePresentationStore.getState().exit());
  });

  it('on the welcome screen', () => {
    render(<WelcomeScreen />);
    expect(screen.getByRole('button', { name: 'Carica la rete di esempio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Una rete, un pezzo alla volta');

    fireEvent.click(button('English'));

    expect(screen.getByRole('button', { name: 'Load the sample network' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Infrastructure, piece by piece');
    expect(screen.getByLabelText('Do not show this screen again')).toBeInTheDocument();
  });

  it('in the appearance tab of the settings, which names the language in use', () => {
    render(<AppearanceSettingsTab />);
    expect(screen.getByRole('heading', { name: 'Lingua' })).toBeInTheDocument();
    expect(screen.getByText('Italiano')).toBeInTheDocument();

    fireEvent.click(button('English'));

    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance settings' })).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveTextContent('Light theme on');
  });
});

describe('text made outside React', () => {
  it('a notice is written in the language of the moment it is given', () => {
    createNewProject({ name: 'Uno' });
    expect(toast.success).toHaveBeenLastCalledWith('Progetto «Uno» creato');

    setLanguage('en');
    createNewProject({ name: 'Two' });
    expect(toast.success).toHaveBeenLastCalledWith('Project “Two” created');

    setLanguage('it');
    createNewProject({ name: 'Tre' });
    expect(toast.success).toHaveBeenLastCalledWith('Progetto «Tre» creato');
  });

  it('a question is asked in the language of the moment, and its window follows a change', async () => {
    createNewProject({ name: 'Uno' });
    render(<ConfirmDialog />);
    useNetworkStore.getState().markChanged();
    setLanguage('en');

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = requestNewProject();
    });
    await settled();

    expect(useConfirmStore.getState().pending?.title).toBe('Continue without saving?');
    expect(screen.getByRole('button', { name: 'Continue without saving' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    // the button of the window is the window's own word: it follows the language
    act(() => setLanguage('it'));
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();

    act(() => useConfirmStore.getState().answer(false));
    expect(await answer).toBe(false);
    expect(useUIStore.getState().modals.newProject).toBe(false);
  });

  it('a name the app gives is given in the language of that moment, and then stays', () => {
    setLanguage('en');
    createNewProject({ name: '' });
    expect(getT().project.defaultName).toBe('Untitled project');
    const given = toast.success as ReturnType<typeof vi.fn>;
    expect(given).toHaveBeenLastCalledWith('Project “Untitled project” created');

    setLanguage('it');
    render(<TopMenuBar />);
    // (the name is content now: Italian around it, the name as it was given)
    expect(screen.getByText('Untitled project')).toBeInTheDocument();
    expect(screen.getByText('Modifica')).toBeInTheDocument();
  });
});
