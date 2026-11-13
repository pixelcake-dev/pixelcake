/**
 * Button — the one thing it must never do: look ready when it is not. And
 * the one thing it does for what is put inside it: an icon stays next to
 * its label.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('a button that cannot be pressed is dimmed, whatever its kind, and does nothing', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="primary" disabled onClick={onClick}>
          Salva
        </Button>
        <Button variant="secondary" disabled onClick={onClick}>
          Copia
        </Button>
        <Button variant="danger" disabled onClick={onClick}>
          Elimina
        </Button>
      </>
    );

    for (const name of ['Salva', 'Copia', 'Elimina']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      // the style of the disabled state is on every kind of button
      expect(button.className).toContain('disabled:opacity-50');
      expect(button.className).toContain('disabled:cursor-not-allowed');
      fireEvent.click(button);
    }
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps an icon and its label on one line, whatever its kind and size', () => {
    render(
      <>
        <Button variant="primary">
          <svg />
          Scarica
        </Button>
        <Button variant="secondary" size="sm">
          <svg />
          Copia
        </Button>
        <Button variant="danger" size="lg">
          <svg />
          Elimina
        </Button>
      </>
    );

    for (const name of ['Scarica', 'Copia', 'Elimina']) {
      // An icon is a block of its own in the style sheet of the page: in the
      // normal flow of a button it takes a whole line, and the label goes
      // under it. So the button lays what is inside it out in a row
      const classes = screen.getByRole('button', { name }).className.split(/\s+/);
      expect(classes, name).toEqual(
        expect.arrayContaining(['inline-flex', 'items-center', 'justify-center', 'gap-1'])
      );
      // (and nothing in the button stacks its content again)
      expect(classes.filter(cls => /^(block|inline-block|flex-col|grid)$/.test(cls)), name).toEqual([]);
    }
  });

  it('a button that can be pressed is, and keeps the classes it is given', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" className="w-full" onClick={onClick}>
        Salva
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Salva' });
    expect(button).toBeEnabled();
    expect(button.className).toContain('w-full');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
