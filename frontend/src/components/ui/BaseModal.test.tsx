/**
 * Esc and the windows — the key closes the window on top, as its X does, one
 * window for each press. What uses the key before a window can (an edit in
 * place, a list open inside the window) keeps the window open.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseModal } from './BaseModal';
import { Modal } from './Modal';
import { InlineEdit } from './InlineEdit';
import IconPicker from './IconPicker';
import SearchableSelect from './SearchableSelect';

/** One press of Esc, wherever the keyboard is (nowhere in particular, by default) */
const esc = (target: Element = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key: 'Escape', ...init });

const titles = () => screen.queryAllByRole('heading').map(heading => heading.textContent);

/**
 * Two windows, each closed for real by its own `onClose`. The second is
 * opened from the first, like a window that edits one item of a list.
 * `secondFirstInThePage` puts it before the other in the page.
 */
function TwoWindows({ secondFirstInThePage = false }: { secondFirstInThePage?: boolean }) {
  const [first, setFirst] = useState(true);
  const [second, setSecond] = useState(false);
  const firstWindow = (
    <Modal key="first" isOpen={first} onClose={() => setFirst(false)} title="Prima">
      <button onClick={() => setSecond(true)}>Apri la seconda</button>
    </Modal>
  );
  const secondWindow = (
    <Modal key="second" isOpen={second} onClose={() => setSecond(false)} title="Seconda">
      contenuto
    </Modal>
  );
  return <>{secondFirstInThePage ? [secondWindow, firstWindow] : [firstWindow, secondWindow]}</>;
}

describe('a window and Esc', () => {
  it('Esc closes it, as its X does; no other key does', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="Finestra">
        contenuto
      </BaseModal>
    );

    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(onClose).not.toHaveBeenCalled();

    esc();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes also while the keyboard is in one of its fields', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Finestra">
        <input aria-label="Nome" />
      </Modal>
    );

    esc(screen.getByLabelText('Nome'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a window that is closed, or gone, does not hear the key', () => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(
      <BaseModal isOpen={false} onClose={onClose} title="Finestra">
        contenuto
      </BaseModal>
    );
    esc();
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <BaseModal isOpen onClose={onClose} title="Finestra">
        contenuto
      </BaseModal>
    );
    unmount();
    esc();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls the handler it was given last', () => {
    const before = vi.fn();
    const after = vi.fn();
    const { rerender } = render(
      <BaseModal isOpen onClose={before} title="Finestra">
        contenuto
      </BaseModal>
    );
    rerender(
      <BaseModal isOpen onClose={after} title="Finestra">
        contenuto
      </BaseModal>
    );

    esc();

    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['after the other in the page', false],
    ['before the other in the page', true],
  ])('with two windows open, each press closes one: the last opened first (%s)', (_, order) => {
    render(<TwoWindows secondFirstInThePage={order} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apri la seconda' }));
    expect(titles().sort()).toEqual(['Prima', 'Seconda']);

    esc();
    expect(titles()).toEqual(['Prima']);

    esc();
    expect(titles()).toEqual([]);

    // nothing left to close: the key is nobody's, and nothing breaks
    expect(esc()).toBe(true);
  });

  it('a key held down is one press: it closes one window', () => {
    render(<TwoWindows />);
    fireEvent.click(screen.getByRole('button', { name: 'Apri la seconda' }));

    esc();
    esc(document.body, { repeat: true });
    esc(document.body, { repeat: true });

    expect(titles()).toEqual(['Prima']);
  });

  it('marks the press it used, and leaves alone a press that was already used', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Finestra">
        <input
          aria-label="Suo"
          onKeyDown={event => {
            if (event.key === 'Escape') event.preventDefault();
          }}
        />
      </Modal>
    );

    // used by the field: fireEvent tells with `false` that it was
    expect(esc(screen.getByLabelText('Suo'))).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    // used by the window: marked the same way, for whoever hears it later
    expect(esc()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('what is open inside a window goes first', () => {
  it('Esc in an edit in place cancels the edit and leaves the window open', () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    const Window = () => {
      const [editing, setEditing] = useState(true);
      return (
        <Modal isOpen onClose={onClose} title="Finestra">
          {editing && (
            <InlineEdit
              value="Canvas 1"
              label="Nome"
              onCommit={onCommit}
              onCancel={() => {
                onCancel();
                setEditing(false);
              }}
            />
          )}
        </Modal>
      );
    };
    render(<Window />);

    esc(screen.getByLabelText('Nome'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Nome')).toBeNull();

    // the next press is for the window
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes the list of an icon picker first, then the window', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Finestra">
        <IconPicker label="Icona" value="mdi:server" onChange={vi.fn()} />
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: /Server/ }));
    expect(screen.getByPlaceholderText('Cerca icone...')).toBeInTheDocument();

    // wherever the keyboard is: the list is what was opened last
    esc();
    expect(screen.queryByPlaceholderText('Cerca icone...')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes the list of a searchable select first, then the window', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Finestra">
        <SearchableSelect
          label="Partenza"
          value="a"
          onChange={vi.fn()}
          options={[
            { value: 'a', label: 'PC-1' },
            { value: 'b', label: 'PC-2' },
          ]}
        />
      </Modal>
    );
    const select = screen.getByRole('button', { name: /Partenza/ });
    fireEvent.click(select);
    expect(select).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'PC-2' })).toBeInTheDocument();

    esc();
    expect(select).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'PC-2' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a list that is open outside any window closes with Esc too', () => {
    render(
      <SearchableSelect
        label="Partenza"
        value="a"
        onChange={vi.fn()}
        options={[{ value: 'a', label: 'PC-1' }]}
      />
    );
    const select = screen.getByRole('button', { name: /Partenza/ });
    fireEvent.click(select);
    expect(select).toHaveAttribute('aria-expanded', 'true');

    esc();

    expect(select).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc on a native list is spent on the list: the window stays, the next press closes it', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Finestra">
        <select aria-label="Formato">
          <option>YAML</option>
          <option>Terraform</option>
        </select>
      </Modal>
    );
    const list = screen.getByLabelText('Formato');
    list.focus();
    expect(list).toHaveFocus();

    // (fireEvent answers false when the press was marked as used)
    expect(esc(list)).toBe(false);

    expect(onClose).not.toHaveBeenCalled();
    // The keyboard has left the field: that is what closes a native list
    expect(list).not.toHaveFocus();

    esc(document.activeElement ?? document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a native list outside any window keeps its Esc and the keyboard', () => {
    render(
      <select aria-label="Formato">
        <option>YAML</option>
      </select>
    );
    const list = screen.getByLabelText('Formato');
    list.focus();

    expect(esc(list)).toBe(true);

    expect(list).toHaveFocus();
  });
});
