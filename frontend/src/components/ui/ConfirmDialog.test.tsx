/**
 * ConfirmDialog — the window of a question with a yes and a no. What matters:
 * whoever asked gets the answer, a no is always within reach (the second
 * button, Esc, a click outside), and only one question is open at a time.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { askConfirm, useConfirmStore } from '@/store/confirmStore';
import ConfirmDialog from './ConfirmDialog';

const DELETE = {
  title: 'Eliminare «PC-1»?',
  detail: 'Con il dispositivo vengono tolte anche le sue connessioni.',
  confirmLabel: 'Elimina',
  danger: true,
};

/** Ask, with the window on screen; gives the promise of the answer */
function ask(question = DELETE) {
  let answer!: Promise<boolean>;
  act(() => {
    answer = askConfirm(question);
  });
  return answer;
}

afterEach(() => {
  act(() => useConfirmStore.getState().answer(false));
});

describe('ConfirmDialog', () => {
  it('shows nothing while nothing is asked', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks the question with what a yes brings, and names the action on its button', () => {
    render(<ConfirmDialog />);
    void ask();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Eliminare «PC-1»?');
    expect(dialog).toHaveAccessibleDescription(DELETE.detail);
    expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
  });

  it('the button of the action is a yes, and the window goes away', async () => {
    render(<ConfirmDialog />);
    const answer = ask();

    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));

    expect(await answer).toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('«Annulla», Esc and a click outside the window are a no', async () => {
    render(<ConfirmDialog />);

    let answer = ask();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(await answer).toBe(false);

    answer = ask();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await answer).toBe(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    answer = ask();
    fireEvent.click(screen.getByRole('alertdialog').parentElement as HTMLElement);
    expect(await answer).toBe(false);
  });

  it('a click inside the window is not an answer', () => {
    render(<ConfirmDialog />);
    void ask();

    fireEvent.click(screen.getByRole('alertdialog'));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('the keyboard starts on the button of the action: Enter is a yes', () => {
    render(<ConfirmDialog />);
    void ask();

    expect(screen.getByRole('button', { name: 'Elimina' })).toHaveFocus();
  });

  it('a yes that loses something is told apart from one that does not', () => {
    render(<ConfirmDialog />);
    void ask();
    expect(screen.getByRole('button', { name: 'Elimina' }).className).toContain('bg-[var(--danger-color)]');
    act(() => useConfirmStore.getState().answer(false));

    void ask({ title: 'Caricare la rete di esempio?', detail: '', confirmLabel: 'Carica', danger: false });
    expect(screen.getByRole('button', { name: 'Carica' }).className).not.toContain('danger');
  });

  it('one question at a time: a new one is a no to the one still open', async () => {
    render(<ConfirmDialog />);
    const first = ask();
    const second = ask({ ...DELETE, title: 'Eliminare questa connessione?' });

    expect(await first).toBe(false);
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Eliminare questa connessione?');

    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(await second).toBe(true);
  });

  it('an answer given when nothing is asked does nothing', () => {
    render(<ConfirmDialog />);
    act(() => useConfirmStore.getState().answer(true));
    expect(useConfirmStore.getState().pending).toBeNull();
  });
});
