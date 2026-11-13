/**
 * InlineEdit tests — Enter and leaving the field confirm, Escape cancels, and
 * whichever comes first is the only outcome.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineEdit } from './InlineEdit';

/**
 * Render the field alone. Unlike a real parent it stays mounted after an
 * outcome, which is what lets a late event reach it.
 */
function setup(value = 'Canvas 1') {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(<InlineEdit value={value} label="Nome" onCommit={onCommit} onCancel={onCancel} />);
  const input = screen.getByLabelText<HTMLInputElement>('Nome');
  return { input, onCommit, onCancel };
}

describe('InlineEdit', () => {
  it('starts from the current text, focused', () => {
    const { input } = setup('Canvas 1');

    expect(input.value).toBe('Canvas 1');
    expect(document.activeElement).toBe(input);
  });

  it('Enter confirms what was typed', () => {
    const { input, onCommit, onCancel } = setup();

    fireEvent.change(input, { target: { value: 'Piano terra' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Piano terra');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape cancels', () => {
    const { input, onCommit, onCancel } = setup();

    fireEvent.change(input, { target: { value: 'Piano terra' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Escape is used up by the edit: the press is marked, Enter and other keys are not', () => {
    const { input } = setup();

    // fireEvent tells with `false` that the event was marked (preventDefault):
    // that mark is what keeps a window from closing on the same press
    expect(fireEvent.keyDown(input, { key: 'a' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
  });

  it('leaving the field confirms', () => {
    const { input, onCommit } = setup();

    fireEvent.change(input, { target: { value: 'Piano terra' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith('Piano terra');
  });

  it('a blur that follows Escape does not confirm what was cancelled', () => {
    const { input, onCommit, onCancel } = setup();

    fireEvent.change(input, { target: { value: 'Piano terra' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a blur that follows Enter does not confirm twice', () => {
    const { input, onCommit } = setup();

    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('other keys do nothing, and a click inside does not reach what is around it', () => {
    const onOutsideClick = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <div onClick={onOutsideClick}>
        <InlineEdit value="x" label="Nome" onCommit={onCommit} onCancel={onCancel} />
      </div>
    );
    const input = screen.getByLabelText('Nome');

    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.click(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onOutsideClick).not.toHaveBeenCalled();
  });
});
